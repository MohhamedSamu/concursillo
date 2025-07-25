import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Create Supabase client with realtime enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Enable realtime for specific tables
supabase.channel('schema-db-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'game_rooms'
  }, () => {})
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'players'
  }, () => {})
  .subscribe();

// Type definitions
export interface Questionnaire {
  id: string; // UUID
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string; // UUID
  questionnaire_id: string; // UUID
  question_text: string;
  correct_answer: string;
  wrong_answer_1: string;
  wrong_answer_2: string;
  wrong_answer_3: string;
  order_number: number;
  created_at: string;
  updated_at: string;
}

export type GamePhase = 'hidden' | 'question' | 'answer_a' | 'answer_b' | 'answer_c' | 'answer_d' | 'locked' | 'reveal';

export interface GameRoom {
  id: string; // UUID
  code: string;
  questionnaire_id: string; // UUID
  current_phase: GamePhase;
  current_question_id: string | null; // UUID of current question
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string; // UUID
  game_room_id: string; // UUID
  name: string;
  score: number;
  status: string;
  created_at: string;
  updated_at: string;
} 