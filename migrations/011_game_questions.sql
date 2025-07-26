-- Migration 011: Game Questions table for randomized answer order

-- Create game_questions table to handle randomized answer order per game
CREATE TABLE IF NOT EXISTS game_questions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
    question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
    answer_a TEXT NOT NULL,
    answer_b TEXT NOT NULL,
    answer_c TEXT NOT NULL,
    answer_d TEXT NOT NULL,
    correct_answer_letter TEXT NOT NULL CHECK (correct_answer_letter IN ('A', 'B', 'C', 'D')),
    order_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_room_id, question_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_game_questions_game_room_id ON game_questions(game_room_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_question_id ON game_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_order ON game_questions(game_room_id, order_number);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_game_questions_updated_at
    BEFORE UPDATE ON game_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 