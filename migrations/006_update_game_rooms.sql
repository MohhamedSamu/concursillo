-- Migration 006: Update game rooms structure safely

-- First create the game phase type if it doesn't exist
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

-- Safely modify game_rooms table
DO $$ BEGIN
    -- Add code column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' AND column_name = 'code'
    ) THEN
        ALTER TABLE game_rooms ADD COLUMN code TEXT;
    END IF;

    -- Add current_phase column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' AND column_name = 'current_phase'
    ) THEN
        ALTER TABLE game_rooms ADD COLUMN current_phase game_phase DEFAULT 'hidden';
    END IF;

    -- Add current_question_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' AND column_name = 'current_question_id'
    ) THEN
        ALTER TABLE game_rooms ADD COLUMN current_question_id uuid REFERENCES questions(id) ON DELETE SET NULL;
    END IF;

    -- Drop current_question column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' AND column_name = 'current_question'
    ) THEN
        ALTER TABLE game_rooms DROP COLUMN current_question;
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE game_rooms ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE game_rooms ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Make code column NOT NULL and UNIQUE after we ensure it has values
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' AND column_name = 'code' 
        AND is_nullable = 'YES'
    ) THEN
        -- First ensure all existing rows have a code
        UPDATE game_rooms SET code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)) WHERE code IS NULL;
        -- Then add the constraints
        ALTER TABLE game_rooms ALTER COLUMN code SET NOT NULL;
        ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_code_key UNIQUE (code);
    END IF;
END $$;

-- Create indexes if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'game_rooms' AND indexname = 'idx_game_rooms_questionnaire_id'
    ) THEN
        CREATE INDEX idx_game_rooms_questionnaire_id ON game_rooms(questionnaire_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'game_rooms' AND indexname = 'idx_game_rooms_code'
    ) THEN
        CREATE INDEX idx_game_rooms_code ON game_rooms(code);
    END IF;
END $$;

-- Ensure the updated_at trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create or replace the trigger
DROP TRIGGER IF EXISTS update_game_rooms_updated_at ON game_rooms;
CREATE TRIGGER update_game_rooms_updated_at
    BEFORE UPDATE ON game_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 