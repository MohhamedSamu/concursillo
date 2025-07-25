-- Migration: 003_game_rooms
-- Description: Add tables for game rooms and players

-- Create game_rooms table
CREATE TABLE public.game_rooms (
  id bigint primary key generated always as identity,
  questionnaire_id bigint references public.questionnaires(id) on delete cascade,
  code text not null unique,
  status text not null check (status in ('waiting', 'in_progress', 'finished')),
  current_question_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create players table
CREATE TABLE public.players (
  id bigint primary key generated always as identity,
  game_room_id bigint references public.game_rooms(id) on delete cascade,
  name text not null,
  score integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_room_id, name)
);

-- Create player_answers table to track answers and points
CREATE TABLE public.player_answers (
  id bigint primary key generated always as identity,
  player_id bigint references public.players(id) on delete cascade,
  game_room_id bigint references public.game_rooms(id) on delete cascade,
  question_id bigint references public.questions(id) on delete cascade,
  answer_text text not null,
  is_correct boolean not null,
  points_earned integer not null default 0,
  answer_time_ms integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
CREATE INDEX game_rooms_code_idx ON public.game_rooms(code);
CREATE INDEX game_rooms_questionnaire_id_idx ON public.game_rooms(questionnaire_id);
CREATE INDEX players_game_room_id_idx ON public.players(game_room_id);
CREATE INDEX player_answers_player_id_idx ON public.player_answers(player_id);
CREATE INDEX player_answers_game_room_id_idx ON public.player_answers(game_room_id);

-- Add updated_at triggers
CREATE TRIGGER handle_game_rooms_updated_at
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at(); 