-- Migration 001: Initial schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create questionnaires table
CREATE TABLE IF NOT EXISTS questionnaires (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id uuid REFERENCES questionnaires(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    wrong_answer_1 TEXT NOT NULL,
    wrong_answer_2 TEXT NOT NULL,
    wrong_answer_3 TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_questions_questionnaire_id ON questions(questionnaire_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_questionnaires_updated_at
    BEFORE UPDATE ON questionnaires
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create game_rooms table
CREATE TABLE IF NOT EXISTS game_rooms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('waiting', 'in_progress', 'finished'))
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 