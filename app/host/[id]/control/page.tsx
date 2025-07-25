'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, type GameRoom, type Player, type Question, type GamePhase } from '@/lib/supabase';

export default function GameControl() {
  const params = useParams();
  const router = useRouter();
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<GamePhase>('hidden');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('Setting up control panel for game room:', params.id);
    loadGameData();
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, [params.id]);

  async function loadGameData() {
    try {
      console.log('Loading initial game data...');
      
      // Load game room
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', params.id)
        .single();

      if (roomError) throw roomError;
      console.log('Loaded game room:', room);
      setGameRoom(room);
      setPhase(room.current_phase);

      // Load current question if available
      if (room.current_question_id) {
        const { data: question, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .eq('id', room.current_question_id)
          .single();
        
        if (questionError) throw questionError;
        setCurrentQuestion(question);
      }

      // Load players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });

      if (playersError) throw playersError;
      console.log('Loaded players:', players);
      setPlayers(players || []);
    } catch (err) {
      console.error('Error loading game data:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los datos del juego');
    } finally {
      setLoading(false);
    }
  }

  function setupRealtimeSubscriptions() {
    console.log('Setting up real-time subscriptions...');
    
    // Subscribe to player changes
    const playersSubscription = supabase
      .channel('players_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `game_room_id=eq.${params.id}`
      }, async (payload) => {
        console.log('Player change received:', payload);
        // Reload players to get fresh data
        const { data: players } = await supabase
          .from('players')
          .select('*')
          .eq('game_room_id', params.id)
          .order('score', { ascending: false });
        setPlayers(players || []);
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
        filter: `id=eq.${params.id}`
      }, async (payload) => {
        console.log('Game room update received:', payload);
        const newGameRoom = payload.new as GameRoom;
        setGameRoom(newGameRoom);
        setPhase(newGameRoom.current_phase);

        // If question changed, fetch the new question
        if (newGameRoom.current_question_id !== gameRoom?.current_question_id) {
          console.log('Fetching new question:', newGameRoom.current_question_id);
          const { data: question, error } = await supabase
            .from('questions')
            .select('*')
            .eq('id', newGameRoom.current_question_id)
            .single();
          
          if (error) {
            console.error('Error fetching question:', error);
          } else {
            console.log('New question loaded:', question);
            setCurrentQuestion(question);
          }
        }
      })
      .subscribe((status) => {
        console.log('Game room subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscriptions...');
      playersSubscription.unsubscribe();
      gameRoomSubscription.unsubscribe();
    };
  }

  async function updatePhase(newPhase: GamePhase) {
    try {
      console.log('Updating game phase to:', newPhase);
      const { data, error } = await supabase
        .from('game_rooms')
        .update({
          current_phase: newPhase,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      console.log('Game phase updated:', data);
      setPhase(newPhase);
    } catch (err) {
      console.error('Error updating game phase:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar la fase del juego');
    }
  }

  async function nextQuestion() {
    if (!gameRoom || !currentQuestion) return;

    try {
      // Get next question
      const { data: nextQuestion, error } = await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', gameRoom.questionnaire_id)
        .gt('order_number', currentQuestion.order_number)
        .order('order_number', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setError('No hay más preguntas');
        } else {
          throw error;
        }
        return;
      }

      // Update game room with new question
      const { data: updatedRoom, error: updateError } = await supabase
        .from('game_rooms')
        .update({
          current_question_id: nextQuestion.id,
          current_phase: 'hidden',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setCurrentQuestion(nextQuestion);
      setPhase('hidden');
      setGameRoom(updatedRoom);
    } catch (err) {
      console.error('Error moving to next question:', err);
      setError(err instanceof Error ? err.message : 'Error al avanzar a la siguiente pregunta');
    }
  }

  async function resetGame() {
    if (!gameRoom) return;

    try {
      // Reset game to first question
      const { data: firstQuestion, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', gameRoom.questionnaire_id)
        .order('order_number', { ascending: true })
        .limit(1)
        .single();

      if (questionError) throw questionError;

      // Reset game room
      const { data: updatedRoom, error: roomError } = await supabase
        .from('game_rooms')
        .update({
          current_question_id: firstQuestion.id,
          current_phase: 'hidden',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)
        .select()
        .single();

      if (roomError) throw roomError;

      // Reset all player scores
      const { error: playersError } = await supabase
        .from('players')
        .update({ 
          score: 0,
          current_answer: null,
          updated_at: new Date().toISOString()
        })
        .eq('game_room_id', params.id);

      if (playersError) throw playersError;

      setCurrentQuestion(firstQuestion);
      setPhase('hidden');
      setGameRoom(updatedRoom);
      
      // Reload players
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });
      setPlayers(players || []);
    } catch (err) {
      console.error('Error resetting game:', err);
      setError(err instanceof Error ? err.message : 'Error al reiniciar el juego');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando panel de control...</div>
      </div>
    );
  }

  if (error || !gameRoom) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-600 text-xl">{error || 'Sala de juego no encontrada'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Panel de Control</h1>
            <div className="flex space-x-4">
              <button
                onClick={resetGame}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                Reiniciar Juego
              </button>
              <button
                onClick={nextQuestion}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Siguiente Pregunta
              </button>
            </div>
          </div>

          {/* Current Question */}
          {currentQuestion && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Pregunta Actual</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-lg mb-4">{currentQuestion.question_text}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded ${phase === 'answer_a' || phase === 'reveal' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    A) {currentQuestion.wrong_answer_1}
                  </div>
                  <div className={`p-3 rounded ${phase === 'answer_b' || phase === 'reveal' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    B) {currentQuestion.wrong_answer_2}
                  </div>
                  <div className={`p-3 rounded ${phase === 'answer_c' || phase === 'reveal' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    C) {currentQuestion.wrong_answer_3}
                  </div>
                  <div className={`p-3 rounded ${phase === 'answer_d' || phase === 'reveal' ? 'bg-green-100' : 'bg-gray-100'}`}>
                    D) {currentQuestion.correct_answer} {phase === 'reveal' && '✓'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phase Controls */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Control de Fases</h2>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => updatePhase('hidden')}
                className={`p-3 rounded ${phase === 'hidden' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}
              >
                Oculto
              </button>
              <button
                onClick={() => updatePhase('question')}
                className={`p-3 rounded ${phase === 'question' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Mostrar Pregunta
              </button>
              <button
                onClick={() => updatePhase('answer_a')}
                className={`p-3 rounded ${phase === 'answer_a' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Respuesta A
              </button>
              <button
                onClick={() => updatePhase('answer_b')}
                className={`p-3 rounded ${phase === 'answer_b' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Respuesta B
              </button>
              <button
                onClick={() => updatePhase('answer_c')}
                className={`p-3 rounded ${phase === 'answer_c' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Respuesta C
              </button>
              <button
                onClick={() => updatePhase('answer_d')}
                className={`p-3 rounded ${phase === 'answer_d' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Respuesta D
              </button>
              <button
                onClick={() => updatePhase('locked')}
                className={`p-3 rounded ${phase === 'locked' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}
              >
                Bloquear
              </button>
              <button
                onClick={() => updatePhase('reveal')}
                className={`p-3 rounded ${phase === 'reveal' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
              >
                Revelar
              </button>
            </div>
          </div>

          {/* Players Scoreboard */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Marcador ({players.length} jugadores)</h2>
            {players.length === 0 ? (
              <p className="text-gray-500">No hay jugadores conectados</p>
            ) : (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Posición</th>
                      <th className="px-4 py-2 text-left">Jugador</th>
                      <th className="px-4 py-2 text-center">Puntos</th>
                      <th className="px-4 py-2 text-center">Respuesta Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => (
                      <tr key={player.id} className="border-t">
                        <td className="px-4 py-2">#{index + 1}</td>
                        <td className="px-4 py-2 font-medium">{player.name}</td>
                        <td className="px-4 py-2 text-center">{player.score}</td>
                        <td className="px-4 py-2 text-center">
                          {player.current_answer || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 