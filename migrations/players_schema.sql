-- Create enum for player status if it doesn't exist
DO $$ BEGIN
    CREATE TYPE player_status AS ENUM ('waiting', 'ready', 'answering', 'answered');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS status player_status DEFAULT 'waiting',
ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add foreign key constraint if it doesn't exist
DO $$ BEGIN
    ALTER TABLE players 
    ADD CONSTRAINT fk_game_room 
    FOREIGN KEY (game_room_id) 
    REFERENCES game_rooms(id) 
    ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$; 