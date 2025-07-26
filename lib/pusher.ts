import Pusher from 'pusher-js';

// Initialize Pusher
const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || '', {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '',
});

export default pusherClient;

// Game event types
export const GAME_EVENTS = {
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  GAME_PHASE_CHANGED: 'game-phase-changed',
  ANSWER_SUBMITTED: 'answer-submitted',
  GAME_STARTED: 'game-started',
  GAME_ENDED: 'game-ended',
} as const;

// Channel naming helper
export const getGameChannel = (gameId: string) => `game-${gameId}`; 