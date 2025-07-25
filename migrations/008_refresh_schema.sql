-- Migration 008: Refresh schema cache

-- First verify the players table structure
DO $$ 
BEGIN
    -- Verify players table exists and has all required columns
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'players'
    ) THEN
        CREATE TABLE players (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            game_room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'waiting',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Add status column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'players' AND column_name = 'status'
        ) THEN
            ALTER TABLE players ADD COLUMN status TEXT DEFAULT 'waiting';
        END IF;
    END IF;
END $$;

-- Force PostgREST to reload its schema cache
-- This requires superuser privileges which Supabase provides
NOTIFY pgrst, 'reload schema'; 