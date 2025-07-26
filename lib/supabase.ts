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

// Create Supabase client with proper headers and realtime config
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false // Since we don't need auth for this game
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=minimal'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Game room status types
export type GameStatus = 'waiting' | 'in_progress' | 'finished';

// Game phases
export type GamePhase = 'hidden' | 'question' | 'answer_a' | 'answer_b' | 'answer_c' | 'answer_d' | 'locked' | 'reveal' | 'finished';

// Database types
export interface Questionnaire {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  questionnaire_id: string;
  order_number: number;
  question_text: string;
  correct_answer: string;
  wrong_answer_1: string;
  wrong_answer_2: string;
  wrong_answer_3: string;
  created_at: string;
  updated_at: string;
}

export interface GameRoom {
  id: string;
  questionnaire_id: string;
  code: string;
  status: GameStatus;
  current_phase: GamePhase;
  current_question_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  game_room_id: string;
  name: string;
  score: number;
  status: string;
  created_at: string;
  updated_at: string;
} 