-- Migration 009: Add current_answer column to players table

-- Add current_answer column if it doesn't exist
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS current_answer text DEFAULT NULL;

-- Create index for faster lookups
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'players_current_answer_idx') THEN
        CREATE INDEX players_current_answer_idx ON players(current_answer);
    END IF;
END $$; 