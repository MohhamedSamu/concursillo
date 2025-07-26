-- Migration 013: Add wild cards to players table

-- Add wild card columns to players table
ALTER TABLE players 
    ADD COLUMN IF NOT EXISTS phone_call_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS phone_search_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS fifty_fifty_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS roulette_available BOOLEAN DEFAULT TRUE;

-- Add wild card usage tracking
ALTER TABLE players 
    ADD COLUMN IF NOT EXISTS phone_call_used_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS phone_search_used_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS fifty_fifty_used_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS roulette_used_at TIMESTAMP WITH TIME ZONE;

-- Add wild card results storage
ALTER TABLE players 
    ADD COLUMN IF NOT EXISTS fifty_fifty_wrong_answers TEXT[], -- Array of wrong answer letters
    ADD COLUMN IF NOT EXISTS roulette_wrong_answers TEXT[]; -- Array of wrong answer letters 