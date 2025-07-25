'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, type GameRoom, type Player, type Question } from '@/lib/supabase';

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    initializeGameRoom();
  }, [params.id]);

  async function initializeGameRoom() {
    try {
      // First, check if a game room already exists for this questionnaire
      const { data: existingRoom, error: fetchError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('questionnaire_id', params.id)
        .eq('current_phase', 'hidden')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingRoom) {
        setGameRoom(existingRoom);
        loadPlayers(existingRoom.id);
      } else {
        // Get first question of the questionnaire
        const { data: firstQuestion, error: questionError } = await supabase
          .from('questions')
          .select('id')
          .eq('questionnaire_id', params.id)
          .order('order_number', { ascending: true })
          .limit(1)
          .single();

        if (questionError) throw questionError;
        if (!firstQuestion) throw new Error('No hay preguntas en este cuestionario');

        // Create new game room
        const gameCode = generateGameCode();
        const { data: newRoom, error: createError } = await supabase
          .from('game_rooms')
          .insert([{
            questionnaire_id: params.id,
            code: gameCode,
            current_phase: 'hidden',
            current_question_id: firstQuestion.id
          }])
          .select()
          .single();

        if (createError) throw createError;
        if (!newRoom) throw new Error('No se pudo crear la sala de juego');

        setGameRoom(newRoom);
      }
    } catch (err) {
      console.error('Error initializing game room:', err);
      setError(err instanceof Error ? err.message : 'Error al inicializar la sala de juego');
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayers(roomId: string) {
    try {
      const { data: existingPlayers, error } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      console.log('Loaded players:', existingPlayers);
      setPlayers(existingPlayers || []);
    } catch (err) {
      console.error('Error loading players:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los jugadores');
    }
  }

  useEffect(() => {
    if (!gameRoom) return;

    console.log('Setting up real-time subscriptions for host page');
    
    // Subscribe to player changes
    const playersSubscription = supabase
      .channel('players_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `game_room_id=eq.${gameRoom.id}`
      }, (payload) => {
        console.log('Player change received:', payload);
        loadPlayers(gameRoom.id);
      })
      .subscribe((status) => {
        console.log('Players subscription status:', status);
      });

    // Subscribe to game room changes
    const gameRoomSubscription = supabase
      .channel('game_room_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${gameRoom.id}`
      }, (payload) => {
        console.log('Game room update received:', payload);
        setGameRoom(payload.new as GameRoom);
      })
      .subscribe((status) => {
        console.log('Game room subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscriptions...');
      playersSubscription.unsubscribe();
      gameRoomSubscription.unsubscribe();
    };
  }, [gameRoom?.id]);

  async function resetGame() {
    if (!gameRoom) return;

    console.log('Resetting game room:', gameRoom.id);
    try {
      // Get first question
      const { data: firstQuestion, error: questionError } = await supabase
        .from('questions')
        .select('id')
        .eq('questionnaire_id', params.id)
        .order('order_number', { ascending: true })
        .limit(1)
        .single();

      if (questionError) throw questionError;

      const { error } = await supabase
        .from('game_rooms')
        .update({
          current_phase: 'hidden',
          current_question_id: firstQuestion.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', gameRoom.id);

      if (error) throw error;

      // Reset all player scores
      const { error: playersError } = await supabase
        .from('players')
        .update({
          score: 0,
          current_answer: null,
          updated_at: new Date().toISOString()
        })
        .eq('game_room_id', gameRoom.id);

      if (playersError) throw playersError;
    } catch (err) {
      console.error('Error resetting game:', err);
      setError(err instanceof Error ? err.message : 'Error al reiniciar el juego');
    }
  }

  async function startGame() {
    if (!gameRoom) return;

    console.log('Starting game for room:', gameRoom.id);
    try {
      // Navigate to control panel
      router.push(`/host/${gameRoom.id}/control`);
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar el juego');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Preparando sala de juego...</div>
      </div>
    );
  }

  if (error || !gameRoom) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-600 text-xl">{error || 'Error al cargar la sala'}</div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/join/${gameRoom.code}`;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-center mb-8">Sala de Juego</h1>
          
          <div className="flex justify-center mb-8">
            <div className="text-center">
              <div className="text-6xl font-bold mb-4">{gameRoom.code}</div>
              <p className="text-gray-600">Código de la sala</p>
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <QRCodeSVG
              value={joinUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Jugadores ({players.length})</h2>
            {players.length === 0 ? (
              <p className="text-center text-gray-500">Esperando jugadores...</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="bg-gray-50 p-4 rounded-lg text-center"
                  >
                    <div className="font-medium">{player.name}</div>
                    <div className="text-sm text-gray-500">{player.score} puntos</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={resetGame}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
            >
              Reiniciar Juego
            </button>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Comenzar Juego
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 