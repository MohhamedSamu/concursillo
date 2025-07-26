-- Migration 010: Update players table with all required columns

-- Add any missing columns
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS current_answer text DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'waiting',
    ADD COLUMN IF NOT EXISTS score integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT CURRENT_TIMESTAMP;

-- Ensure NOT NULL constraints
ALTER TABLE players
    ALTER COLUMN game_room_id SET NOT NULL,
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN score SET NOT NULL,
    ALTER COLUMN status SET NOT NULL;

-- Create or update indexes
DO $$ 
BEGIN
    -- Index for game_room_id lookups
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'players_game_room_id_idx') THEN
        CREATE INDEX players_game_room_id_idx ON players(game_room_id);
    END IF;

    -- Unique index for name within a game room
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'players_game_room_id_name_idx') THEN
        CREATE UNIQUE INDEX players_game_room_id_name_idx ON players(game_room_id, name);
    END IF;

    -- Index for status lookups
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'players_status_idx') THEN
        CREATE INDEX players_status_idx ON players(status);
    END IF;
END $$;

-- Create or replace the updated_at trigger
CREATE OR REPLACE FUNCTION update_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_players_updated_at ON players;

CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_players_updated_at(); 