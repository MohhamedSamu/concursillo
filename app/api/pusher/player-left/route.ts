import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerId, gameRoomId } = body;

    // Delete player from database
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId);

    if (deleteError) throw deleteError;

    // Notify other clients about player leaving
    await pusher.trigger(
      `game-${gameRoomId}`,
      'player-left',
      { playerId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling player left:', error);
    return NextResponse.json(
      { error: 'Failed to handle player left' },
      { status: 500 }
    );
  }
} 