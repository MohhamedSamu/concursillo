'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, type GameRoom } from '@/lib/supabase';

export default function JoinGameWithCode() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [name, setName] = useState('');
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    checkGameRoom();
    return () => {
      // Cleanup subscription on unmount
      if (gameRoom?.id) {
        supabase.channel(`game_room_${gameRoom.id}`).unsubscribe();
      }
    };
  }, [code]);

  // Set up real-time subscription when player joins successfully
  useEffect(() => {
    if (!gameRoom?.id || !playerId) return;

    const channel = supabase
      .channel(`game_room_${gameRoom.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${gameRoom.id}`
      }, (payload: any) => {
        console.log('Game room update:', payload);
        if (payload.new.status === 'in_progress') {
          router.push(`/play/${playerId}`);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [gameRoom?.id, playerId]);

  async function checkGameRoom() {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (error) throw error;
      
      if (data.status !== 'waiting') {
        throw new Error('Esta sala ya no está disponible');
      }

      setGameRoom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sala no encontrada');
      setTimeout(() => {
        router.push('/join');
      }, 3000);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gameRoom) return;

    if (!name.trim()) {
      setError('Por favor ingresa tu nombre');
      return;
    }

    setJoining(true);
    try {
      // Check if name is already taken in this room
      const { data: existingPlayers, error: checkError } = await supabase
        .from('players')
        .select('id')
        .eq('game_room_id', gameRoom.id)
        .eq('name', name.trim());

      if (checkError) throw checkError;
      
      if (existingPlayers && existingPlayers.length > 0) {
        throw new Error('Este nombre ya está en uso en esta sala');
      }

      // Create player
      const { data: player, error: createError } = await supabase
        .from('players')
        .insert([{
          game_room_id: gameRoom.id,
          name: name.trim(),
          status: 'waiting',
          score: 0
        }])
        .select()
        .single();

      if (createError) throw createError;
      if (!player) throw new Error('Error al crear el jugador');

      setPlayerId(player.id);
      setJoined(true);
      setError('');
    } catch (err) {
      console.error('Join error:', err);
      setError(err instanceof Error ? err.message : 'Error al unirse al juego');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Verificando sala...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <div className="text-gray-600">Redirigiendo a la página principal...</div>
        </div>
      </div>
    );
  }

  if (joined && playerId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">¡Te has unido exitosamente!</div>
          <div className="text-xl mb-8">Esperando a que el anfitrión inicie el juego...</div>
          <div className="animate-bounce text-4xl">🎮</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">
                  Unirse a la Sala
                </h2>

                <div className="text-center mb-8">
                  <p className="text-xl font-semibold mb-2">Código de la sala</p>
                  <p className="text-4xl font-bold text-indigo-600">{code}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Tu Nombre
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={name}
                        onChange={(e) => {
                          setError('');
                          setName(e.target.value);
                        }}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Ingresa tu nombre"
                        maxLength={20}
                        disabled={joining}
                      />
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-red-600">
                        {error}
                      </p>
                    )}
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={joining}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {joining ? 'Uniéndose...' : 'Unirse al Juego'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 