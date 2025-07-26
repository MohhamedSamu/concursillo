import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select(`
        phone_call_available,
        phone_search_available,
        fifty_fifty_available,
        roulette_available,
        fifty_fifty_wrong_answers,
        roulette_wrong_answers
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching wild card data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wild card data' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in wild cards API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 