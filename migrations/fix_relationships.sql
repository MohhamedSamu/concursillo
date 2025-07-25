-- Fix the relationship between game_rooms and questions
ALTER TABLE game_rooms
DROP CONSTRAINT IF EXISTS fk_current_question,
DROP CONSTRAINT IF EXISTS fk_questionnaire;

-- Make sure the questionnaire_id is properly typed
ALTER TABLE game_rooms
ALTER COLUMN questionnaire_id TYPE uuid USING questionnaire_id::uuid,
ALTER COLUMN current_question_id TYPE uuid USING current_question_id::uuid;

-- Add the foreign key constraints
ALTER TABLE game_rooms
ADD CONSTRAINT fk_questionnaire
    FOREIGN KEY (questionnaire_id)
    REFERENCES questionnaires(id)
    ON DELETE CASCADE,
ADD CONSTRAINT fk_current_question
    FOREIGN KEY (current_question_id)
    REFERENCES questions(id)
    ON DELETE SET NULL;

-- Add cascade delete for players
ALTER TABLE players
DROP CONSTRAINT IF EXISTS fk_game_room,
ADD CONSTRAINT fk_game_room
    FOREIGN KEY (game_room_id)
    REFERENCES game_rooms(id)
    ON DELETE CASCADE;

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