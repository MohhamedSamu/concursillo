import { NextResponse } from 'next/server';
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
    const { channel, event, data } = body;

    console.log('Triggering Pusher event:', { channel, event, data });

    if (!channel || !event) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!data) {
      console.error('Received null data for event:', event);
      return NextResponse.json(
        { error: 'Event data cannot be null' },
        { status: 400 }
      );
    }

    await pusher.trigger(channel, event, data);

    return NextResponse.json({ 
      success: true,
      message: 'Event triggered successfully',
      details: { channel, event }
    });
  } catch (error) {
    console.error('Error triggering Pusher event:', error);
    return NextResponse.json(
      { error: 'Failed to trigger event' },
      { status: 500 }
    );
  }
} 