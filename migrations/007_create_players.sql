-- Migration 007: Create players table safely

-- Create players table if it doesn't exist
CREATE TABLE IF NOT EXISTS players (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'players' AND indexname = 'idx_players_game_room_id'
    ) THEN
        CREATE INDEX idx_players_game_room_id ON players(game_room_id);
    END IF;
END $$;

-- Create or replace the trigger for updated_at
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 