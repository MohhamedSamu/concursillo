-- Add created_at column if it doesn't exist
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create a function to cleanup old game rooms
CREATE OR REPLACE FUNCTION cleanup_old_game_rooms() RETURNS trigger AS $$
BEGIN
  -- Delete players from old game rooms first
  DELETE FROM players 
  WHERE game_room_id IN (
    SELECT id FROM game_rooms 
    WHERE created_at < NOW() - INTERVAL '24 hours'
  );

  -- Then delete the old game rooms
  DELETE FROM game_rooms 
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to run the cleanup function
CREATE OR REPLACE TRIGGER trigger_cleanup_old_game_rooms
  AFTER INSERT ON game_rooms
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_game_rooms(); 