'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import pusherClient, { GAME_EVENTS, getGameChannel } from '@/lib/pusher';

// Helper function to generate a random game code
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function HostGame({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [gameRoom, setGameRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initial load
  useEffect(() => {
    if (!initialized) {
      initializeGameRoom();
      setInitialized(true);
    }
  }, [initialized]);

  // Pusher subscription
  useEffect(() => {
    if (!gameRoom?.id) return;

    console.log('Setting up Pusher subscription for game room:', gameRoom.id);

    // Subscribe to Pusher channel
    const channel = pusherClient.subscribe(getGameChannel(gameRoom.id));

    // Handle player joined
    channel.bind(GAME_EVENTS.PLAYER_JOINED, (newPlayer: any) => {
      console.log('Player joined event received:', newPlayer);
      if (newPlayer && newPlayer.id) {
        setPlayers(current => {
          // Check if player already exists
          if (current.some(p => p?.id === newPlayer.id)) {
            return current;
          }
          return [...current, newPlayer];
        });
      } else {
        console.error('Received invalid player data:', newPlayer);
      }
    });

    // Handle player left
    channel.bind(GAME_EVENTS.PLAYER_LEFT, (playerId: string) => {
      console.log('Player left:', playerId);
      if (playerId) {
        setPlayers(current => current.filter(p => p?.id !== playerId));
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up Pusher subscription');
      channel.unbind_all();
      pusherClient.unsubscribe(getGameChannel(gameRoom.id));
    };
  }, [gameRoom?.id]);

  async function initializeGameRoom() {
    try {
      setLoading(true);
      setError(null);

      console.log('Initializing game room for questionnaire:', params.id);

      // First, verify that the questionnaire exists
      const { data: questionnaire, error: questionnaireError } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('id', params.id)
        .single();

      if (questionnaireError) {
        console.error('Error fetching questionnaire:', questionnaireError);
        throw new Error('Cuestionario no encontrado');
      }

      if (!questionnaire) {
        throw new Error('Cuestionario no encontrado');
      }

      console.log('Found questionnaire:', questionnaire.title);

      // First, clean up any old waiting game rooms for this questionnaire
      const { error: cleanupError } = await supabase
        .from('game_rooms')
        .delete()
        .eq('questionnaire_id', params.id)
        .eq('status', 'waiting')
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (cleanupError) {
        console.error('Error cleaning up old game rooms:', cleanupError);
      }

      // Get the most recent waiting game room
      const { data: existingRooms, error: fetchError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('questionnaire_id', params.id)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching existing rooms:', fetchError);
        throw fetchError;
      }

      if (existingRooms && existingRooms.length > 0) {
        const existingRoom = existingRooms[0];
        console.log('Found existing game room:', existingRoom);

        // Check if this game room has game questions
        const { data: existingGameQuestions, error: gameQuestionsCheckError } = await supabase
          .from('game_questions')
          .select('*')
          .eq('game_room_id', existingRoom.id);

        if (gameQuestionsCheckError) {
          console.error('Error checking game questions:', gameQuestionsCheckError);
          throw gameQuestionsCheckError;
        }

        console.log('Existing game questions count:', existingGameQuestions?.length || 0);

        // If no game questions exist, create them retroactively
        if (!existingGameQuestions || existingGameQuestions.length === 0) {
          console.log('No game questions found for existing room, creating them retroactively...');
          
          // Get all questions for this questionnaire
          const { data: allQuestions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('questionnaire_id', params.id)
            .order('order_number');

          if (questionsError) {
            console.error('Error fetching questions:', questionsError);
            throw questionsError;
          }

          if (!allQuestions || allQuestions.length === 0) {
            console.error('No questions found in questionnaire:', params.id);
            throw new Error('No hay preguntas en este cuestionario. Por favor, agrega preguntas antes de crear una sala de juego.');
          }

          // Create game questions for the existing room
          const gameQuestionsData = allQuestions.map((question, index) => {
            // Generate random position for correct answer (0-3 for array indexing)
            const correctAnswerPosition = Math.floor(Math.random() * 4);
            const correctAnswerLetter = ['A', 'B', 'C', 'D'][correctAnswerPosition];
            
            // Get all wrong answers
            const wrongAnswers = [
              question.wrong_answer_1,
              question.wrong_answer_2,
              question.wrong_answer_3
            ];

            // Shuffle wrong answers
            const shuffledWrongAnswers = wrongAnswers.sort(() => Math.random() - 0.5);

            // Create answer array with correct answer in the random position
            const allAnswers = ['', '', '', ''];
            allAnswers[correctAnswerPosition] = question.correct_answer;
            
            // Fill remaining positions with wrong answers
            let wrongAnswerIndex = 0;
            for (let i = 0; i < 4; i++) {
              if (i !== correctAnswerPosition) {
                allAnswers[i] = shuffledWrongAnswers[wrongAnswerIndex];
                wrongAnswerIndex++;
              }
            }

            return {
              game_room_id: existingRoom.id,
              question_id: question.id,
              answer_a: allAnswers[0],
              answer_b: allAnswers[1],
              answer_c: allAnswers[2],
              answer_d: allAnswers[3],
              correct_answer_letter: correctAnswerLetter,
              order_number: index + 1
            };
          });

          console.log('Creating retroactive game questions:', gameQuestionsData);

          const { data: insertedGameQuestions, error: gameQuestionsError } = await supabase
            .from('game_questions')
            .insert(gameQuestionsData)
            .select();

          if (gameQuestionsError) {
            console.error('Error creating retroactive game questions:', gameQuestionsError);
            throw gameQuestionsError;
          }

          console.log('Successfully created retroactive game questions:', insertedGameQuestions);
        }

        setGameRoom(existingRoom);
        await loadPlayers(existingRoom.id);
        setLoading(false);
        return;
      }

      console.log('No existing game room found, creating new one...');

      // Get first question of the questionnaire
      const { data: firstQuestion, error: questionError } = await supabase
        .from('questions')
        .select('id')
        .eq('questionnaire_id', params.id)
        .order('order_number', { ascending: true })
        .limit(1)
        .single();

      if (questionError) {
        console.error('Error fetching first question:', questionError);
        throw questionError;
      }

      if (!firstQuestion) {
        throw new Error('No hay preguntas en este cuestionario');
      }

      // Create new game room
      const gameCode = generateGameCode();
      console.log('Generated game code:', gameCode);
      console.log('Using questionnaire ID:', params.id);

      const { data: newRoom, error: createError } = await supabase
        .from('game_rooms')
        .insert([{
          questionnaire_id: params.id,
          code: gameCode,
          status: 'waiting',
          current_phase: 'hidden',
          current_question_id: firstQuestion.id
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating new room:', createError);
        throw createError;
      }

      console.log('Created new game room:', newRoom);
      console.log('New room ID:', newRoom.id);

      // Get all questions for this questionnaire
      const { data: allQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', params.id)
        .order('order_number');

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        throw questionsError;
      }

      console.log('Fetched questions from questionnaire:', allQuestions);
      console.log('Number of questions in questionnaire:', allQuestions?.length || 0);

      if (!allQuestions || allQuestions.length === 0) {
        console.error('No questions found in questionnaire:', params.id);
        throw new Error('No hay preguntas en este cuestionario. Por favor, agrega preguntas antes de crear una sala de juego.');
      }

      console.log('Questionnaire has questions, proceeding with game room creation...');

      // Initialize game questions with randomized answer order
      const gameQuestionsData = allQuestions.map((question, index) => {
        // Generate random position for correct answer (0-3 for array indexing)
        const correctAnswerPosition = Math.floor(Math.random() * 4);
        const correctAnswerLetter = ['A', 'B', 'C', 'D'][correctAnswerPosition];
        
        // Get all wrong answers
        const wrongAnswers = [
          question.wrong_answer_1,
          question.wrong_answer_2,
          question.wrong_answer_3
        ];

        // Shuffle wrong answers
        const shuffledWrongAnswers = wrongAnswers.sort(() => Math.random() - 0.5);

        // Create answer array with correct answer in the random position
        const allAnswers = ['', '', '', ''];
        allAnswers[correctAnswerPosition] = question.correct_answer;
        
        // Fill remaining positions with wrong answers
        let wrongAnswerIndex = 0;
        for (let i = 0; i < 4; i++) {
          if (i !== correctAnswerPosition) {
            allAnswers[i] = shuffledWrongAnswers[wrongAnswerIndex];
            wrongAnswerIndex++;
          }
        }

        return {
          game_room_id: newRoom.id,
          question_id: question.id,
          answer_a: allAnswers[0],
          answer_b: allAnswers[1],
          answer_c: allAnswers[2],
          answer_d: allAnswers[3],
          correct_answer_letter: correctAnswerLetter,
          order_number: index + 1
        };
      });

      console.log('Creating game questions:', gameQuestionsData);
      console.log('Number of questions to create:', gameQuestionsData.length);

      // Insert game questions
      const { data: insertedGameQuestions, error: gameQuestionsError } = await supabase
        .from('game_questions')
        .insert(gameQuestionsData)
        .select();

      if (gameQuestionsError) {
        console.error('Error creating game questions:', gameQuestionsError);
        throw gameQuestionsError;
      }

      console.log('Successfully created game questions:', insertedGameQuestions);

      setGameRoom(newRoom);
      setPlayers([]);

    } catch (err) {
      console.error('Error initializing game room:', err);
      setError(err instanceof Error ? err.message : 'Error al inicializar la sala de juego');
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayers(roomId: string) {
    try {
      console.log('Loading players for room:', roomId);
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', roomId)
        .order('created_at', { ascending: true });

      if (playersError) throw playersError;
      
      console.log('Loaded players:', playersData);
      setPlayers(playersData || []);
    } catch (err) {
      console.error('Error loading players:', err);
      setError(err instanceof Error ? err.message : 'Error loading players');
    }
  }

  async function handleStartGame() {
    if (!gameRoom) return;

    try {
      // Update game room status
      const { error: updateError } = await supabase
        .from('game_rooms')
        .update({ status: 'in_progress' })
        .eq('id', gameRoom.id);

      if (updateError) throw updateError;

      // Trigger Pusher event for game start
      const response = await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: getGameChannel(gameRoom.id),
          event: GAME_EVENTS.GAME_STARTED,
          data: { gameRoomId: gameRoom.id }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to notify players about game start');
      }

      // Redirect host to control panel
      router.push(`/host/${gameRoom.id}/control`);
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err instanceof Error ? err.message : 'Error starting game');
    }
  }

  async function handleResetGame() {
    if (!gameRoom) return;

    try {
      // Delete all players
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('game_room_id', gameRoom.id);

      if (deleteError) throw deleteError;

      // Reset game room
      const { error: updateError } = await supabase
        .from('game_rooms')
        .update({
          status: 'waiting',
          current_phase: 'hidden',
          current_question_id: null
        })
        .eq('id', gameRoom.id);

      if (updateError) throw updateError;

      // Reload game room data
      await initializeGameRoom();
    } catch (err) {
      console.error('Error resetting game:', err);
      setError(err instanceof Error ? err.message : 'Error resetting game');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Cargando sala de juego...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => router.push('/admin')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Volver al Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Inicializando sala de juego...</div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/join/${gameRoom.code}`;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-center mb-8">Sala de Juego</h1>

          {/* Game Code and QR */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold mb-2">Código de la Sala</h2>
            <p className="text-4xl font-bold text-blue-600 mb-4">{gameRoom.code}</p>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <p className="text-sm text-gray-500">
              Los jugadores pueden unirse escaneando el código QR o ingresando el código en{' '}
              <span className="font-medium">{window.location.origin}/join</span>
            </p>
          </div>

          {/* Players List */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Jugadores ({players.filter(Boolean).length})</h2>
            {players.filter(Boolean).length === 0 ? (
              <p className="text-center text-gray-500">Esperando jugadores...</p>
            ) : (
              <ul className="space-y-2">
                {players.filter(Boolean).map((player) => (
                  <li
                    key={player.id}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <span className="font-medium">{player.name}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(player.created_at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleResetGame}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Reiniciar Juego
            </button>
            <button
              onClick={handleStartGame}
              disabled={players.length === 0}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Comenzar Juego
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 