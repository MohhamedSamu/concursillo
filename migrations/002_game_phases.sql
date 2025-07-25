-- Migration 002: Game phases and rooms

-- Create game phase type
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

-- Create game_rooms table if not exists
CREATE TABLE IF NOT EXISTS game_rooms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    questionnaire_id uuid REFERENCES questionnaires(id) ON DELETE CASCADE,
    current_phase game_phase DEFAULT 'hidden',
    current_question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_game_rooms_questionnaire_id ON game_rooms(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(code);

-- Create trigger for updated_at
CREATE TRIGGER update_game_rooms_updated_at
    BEFORE UPDATE ON game_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 