-- Migration 012: Add 'finished' phase to game_phase enum

-- Add 'finished' to the game_phase enum
ALTER TYPE game_phase ADD VALUE 'finished'; 