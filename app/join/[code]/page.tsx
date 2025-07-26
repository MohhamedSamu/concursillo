'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import pusherClient, { GAME_EVENTS, getGameChannel } from '@/lib/pusher';

export default function JoinGame({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [gameRoom, setGameRoom] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    // Find game room by code
    async function findGameRoom() {
      try {
        const { data, error } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('code', params.code)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Sala de juego no encontrada');
        
        console.log('Found game room:', data);
        setGameRoom(data);
        
        // If already joined, subscribe to game events
        if (hasJoined) {
          subscribeToGameEvents(data.id);
        }
      } catch (err) {
        console.error('Error finding game room:', err);
        setError('Sala de juego no encontrada');
      }
    }

    findGameRoom();
  }, [params.code, hasJoined]);

  function subscribeToGameEvents(gameRoomId: string) {
    const channel = pusherClient.subscribe(getGameChannel(gameRoomId));

    channel.bind(GAME_EVENTS.GAME_STARTED, () => {
      // Store the current player name before redirecting
      sessionStorage.setItem(`current_player_name_${gameRoomId}`, playerName.trim());
      // Redirect to the game play page
      router.push(`/play/${gameRoomId}`);
    });

    // Cleanup subscription when component unmounts
    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(getGameChannel(gameRoomId));
    };
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!gameRoom || !playerName.trim()) return;

    setIsJoining(true);
    setError(null);

    try {
      console.log('Attempting to join game room:', gameRoom.id);

      // Check if name is already taken
      const { data: existingPlayers, error: checkError } = await supabase
        .from('players')
        .select('name')
        .eq('game_room_id', gameRoom.id)
        .eq('name', playerName.trim());

      if (checkError) {
        console.error('Error checking existing players:', checkError);
        throw checkError;
      }

      if (existingPlayers && existingPlayers.length > 0) {
        throw new Error('Este nombre ya está en uso');
      }

      const newPlayerData = {
        game_room_id: gameRoom.id,
        name: playerName.trim(),
        score: 0,
        status: 'waiting',
        current_answer: null
      };

      console.log('Creating new player with data:', newPlayerData);

      // First, create the player
      const { data: insertResult, error: insertError } = await supabase
        .from('players')
        .insert(newPlayerData)
        .select();

      if (insertError) {
        console.error('Error creating player:', insertError);
        throw new Error(`Error al crear el jugador: ${insertError.message}`);
      }

      if (!insertResult || insertResult.length === 0) {
        console.error('No player data returned after insert');
        
        // Try to fetch the newly created player
        const { data: newPlayer, error: fetchError } = await supabase
          .from('players')
          .select('*')
          .eq('game_room_id', gameRoom.id)
          .eq('name', playerName.trim())
          .single();

        if (fetchError || !newPlayer) {
          console.error('Error fetching created player:', fetchError);
          throw new Error('No se pudo verificar la creación del jugador');
        }

        console.log('Retrieved player after creation:', newPlayer);
        
        // Store player name in sessionStorage
        sessionStorage.setItem(`current_player_name_${gameRoom.id}`, playerName.trim());
        
        // Store player ID with name-specific key
        const storageKey = `game_${gameRoom.id}_player_${playerName.trim()}_id`;
        localStorage.setItem(storageKey, newPlayer.id);

        // Trigger Pusher event for player joined
        const response = await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: getGameChannel(gameRoom.id),
            event: GAME_EVENTS.PLAYER_JOINED,
            data: newPlayer
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to trigger Pusher event:', errorData);
          throw new Error('Failed to notify host about join');
        }

        setHasJoined(true);
        // Subscribe to game events after joining
        subscribeToGameEvents(gameRoom.id);
        return;
      }

      const newPlayer = insertResult[0];
      console.log('Created new player:', newPlayer);

      // Store player name in sessionStorage
      sessionStorage.setItem(`current_player_name_${gameRoom.id}`, playerName.trim());
      
      // Store player ID with name-specific key
      const storageKey = `game_${gameRoom.id}_player_${playerName.trim()}_id`;
      localStorage.setItem(storageKey, newPlayer.id);

      // Trigger Pusher event for player joined
      const response = await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: getGameChannel(gameRoom.id),
          event: GAME_EVENTS.PLAYER_JOINED,
          data: newPlayer
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to trigger Pusher event:', errorData);
        throw new Error('Failed to notify host about join');
      }

      const result = await response.json();
      console.log('Pusher event triggered:', result);

      setHasJoined(true);
      // Subscribe to game events after joining
      subscribeToGameEvents(gameRoom.id);
    } catch (err) {
      console.error('Error joining game:', err);
      setError(err instanceof Error ? err.message : 'Error al unirse al juego');
    } finally {
      setIsJoining(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-600 mb-4">¡Te has unido al juego!</h1>
          <p className="text-gray-700">Esperando a que el anfitrión inicie el juego...</p>
          <p className="text-gray-500 mt-2">Tu nombre: {playerName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6 py-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Unirse al Juego</h1>
        <form onSubmit={handleJoin}>
          <div className="mb-4">
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-2">
              Tu Nombre
            </label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isJoining}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={isJoining || !playerName.trim()}
          >
            {isJoining ? 'Uniéndose...' : 'Unirse al Juego'}
          </button>
        </form>
      </div>
    </div>
  );
} 