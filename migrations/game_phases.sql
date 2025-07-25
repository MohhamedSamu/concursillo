-- Create enum for game phases
DO $$ BEGIN
    CREATE TYPE game_phase AS ENUM (
        'hidden',
        'question',
        'answer_a',
        'answer_b',
        'answer_c',
        'answer_d',
        'locked',
        'reveal'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add current_phase to game_rooms
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS current_phase game_phase DEFAULT 'hidden',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add current_answer to players
ALTER TABLE players
ADD COLUMN IF NOT EXISTS current_answer TEXT DEFAULT NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for game_rooms
DROP TRIGGER IF EXISTS update_game_rooms_updated_at ON game_rooms;
CREATE TRIGGER update_game_rooms_updated_at
    BEFORE UPDATE ON game_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 