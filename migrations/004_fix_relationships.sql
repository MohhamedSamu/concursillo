-- Migration 004: Add relationships and reset function

-- Make sure game_rooms has the necessary columns
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS questionnaire_id uuid REFERENCES questionnaires(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS current_question_id uuid REFERENCES questions(id) ON DELETE SET NULL;

-- Make sure players has the necessary columns
ALTER TABLE players
ADD COLUMN IF NOT EXISTS game_room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE;

-- Add function to reset game room
CREATE OR REPLACE FUNCTION reset_game_room(room_id uuid)
RETURNS void AS $$
BEGIN
    -- Delete all players
    DELETE FROM players WHERE game_room_id = room_id;
    
    -- Reset game room state
    UPDATE game_rooms
    SET status = 'waiting',
        current_phase = 'hidden',
        current_question_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = room_id;
END;
$$ LANGUAGE plpgsql; 