-- Migration 005: Verify and fix UUID handling

-- First, make sure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify questionnaires table
ALTER TABLE questionnaires 
ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
ALTER COLUMN id SET NOT NULL;

-- Verify questions table
ALTER TABLE questions 
ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
ALTER COLUMN id SET NOT NULL,
ALTER COLUMN questionnaire_id SET NOT NULL;

-- Add constraint if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'questions_questionnaire_id_fkey'
    ) THEN
        ALTER TABLE questions
        ADD CONSTRAINT questions_questionnaire_id_fkey
        FOREIGN KEY (questionnaire_id)
        REFERENCES questionnaires(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Verify game_rooms table
ALTER TABLE game_rooms 
ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
ALTER COLUMN id SET NOT NULL;

-- Verify players table
ALTER TABLE players 
ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
ALTER COLUMN id SET NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_questionnaire_id ON questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_players_game_room_id ON players(game_room_id);

-- Function to generate UUID if null
CREATE OR REPLACE FUNCTION ensure_uuid() 
RETURNS trigger AS $$
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := uuid_generate_v4();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to ensure UUIDs
DROP TRIGGER IF EXISTS ensure_questionnaire_uuid ON questionnaires;
CREATE TRIGGER ensure_questionnaire_uuid
    BEFORE INSERT ON questionnaires
    FOR EACH ROW
    EXECUTE FUNCTION ensure_uuid();

DROP TRIGGER IF EXISTS ensure_question_uuid ON questions;
CREATE TRIGGER ensure_question_uuid
    BEFORE INSERT ON questions
    FOR EACH ROW
    EXECUTE FUNCTION ensure_uuid();

DROP TRIGGER IF EXISTS ensure_game_room_uuid ON game_rooms;
CREATE TRIGGER ensure_game_room_uuid
    BEFORE INSERT ON game_rooms
    FOR EACH ROW
    EXECUTE FUNCTION ensure_uuid();

DROP TRIGGER IF EXISTS ensure_player_uuid ON players;
CREATE TRIGGER ensure_player_uuid
    BEFORE INSERT ON players
    FOR EACH ROW
    EXECUTE FUNCTION ensure_uuid();

-- Verify existing data
DO $$ 
BEGIN
    -- Check for any rows without UUIDs
    IF EXISTS (
        SELECT 1 FROM questionnaires WHERE id IS NULL
        UNION ALL
        SELECT 1 FROM questions WHERE id IS NULL
        UNION ALL
        SELECT 1 FROM game_rooms WHERE id IS NULL
        UNION ALL
        SELECT 1 FROM players WHERE id IS NULL
    ) THEN
        RAISE EXCEPTION 'Found rows without UUIDs';
    END IF;

    -- Check for any questions without valid questionnaire_id
    IF EXISTS (
        SELECT 1 
        FROM questions q
        LEFT JOIN questionnaires qn ON q.questionnaire_id = qn.id
        WHERE qn.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Found questions with invalid questionnaire_id';
    END IF;
END $$; 