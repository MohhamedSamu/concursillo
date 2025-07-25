'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, type GameRoom, type Question, type GamePhase } from '@/lib/supabase';

export default function GameDisplay() {
  const params = useParams();
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('Setting up display view for game room:', params.id);
    loadInitialData();
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, [params.id]);

  async function loadInitialData() {
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
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los datos del juego');
    } finally {
      setLoading(false);
    }
  }

  function setupRealtimeSubscriptions() {
    console.log('Setting up real-time subscriptions...');
    
    // Subscribe to game room changes
    const gameRoomSubscription = supabase
      .channel('game_room_display_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${params.id}`
      }, async (payload) => {
        console.log('Game room update received:', payload);
        const newGameRoom = payload.new as GameRoom;
        setGameRoom(newGameRoom);

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
      console.log('Cleaning up subscription...');
      gameRoomSubscription.unsubscribe();
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-2xl">Cargando...</div>
      </div>
    );
  }

  if (error || !gameRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="text-red-400 text-2xl">{error || 'Sala de juego no encontrada'}</div>
      </div>
    );
  }

  // Determine what to show based on current phase
  const showQuestion = gameRoom.current_phase !== 'hidden';
  const showAnswerA = ['answer_a', 'answer_b', 'answer_c', 'answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const showAnswerB = ['answer_b', 'answer_c', 'answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const showAnswerC = ['answer_c', 'answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const showAnswerD = ['answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const showCorrect = gameRoom.current_phase === 'reveal';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 p-8 text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4">CONCURSILLO</h1>
          <div className="text-2xl opacity-80">Código de Sala: {gameRoom.code}</div>
        </div>

        {/* Question Section */}
        {currentQuestion && (
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 mb-8">
            {showQuestion ? (
              <div className="text-center">
                <h2 className="text-4xl font-bold mb-8">{currentQuestion.question_text}</h2>
                
                {/* Answers Grid */}
                <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
                  {/* Answer A */}
                  <div className={`p-6 rounded-2xl transition-all duration-500 ${
                    showAnswerA 
                      ? showCorrect && currentQuestion.correct_answer === currentQuestion.wrong_answer_1
                        ? 'bg-green-600 transform scale-105'
                        : 'bg-blue-600'
                      : 'bg-gray-500/30'
                  }`}>
                    <div className="text-2xl font-bold mb-2">A</div>
                    <div className="text-xl">
                      {showAnswerA ? currentQuestion.wrong_answer_1 : '???'}
                    </div>
                  </div>

                  {/* Answer B */}
                  <div className={`p-6 rounded-2xl transition-all duration-500 ${
                    showAnswerB 
                      ? showCorrect && currentQuestion.correct_answer === currentQuestion.wrong_answer_2
                        ? 'bg-green-600 transform scale-105'
                        : 'bg-red-600'
                      : 'bg-gray-500/30'
                  }`}>
                    <div className="text-2xl font-bold mb-2">B</div>
                    <div className="text-xl">
                      {showAnswerB ? currentQuestion.wrong_answer_2 : '???'}
                    </div>
                  </div>

                  {/* Answer C */}
                  <div className={`p-6 rounded-2xl transition-all duration-500 ${
                    showAnswerC 
                      ? showCorrect && currentQuestion.correct_answer === currentQuestion.wrong_answer_3
                        ? 'bg-green-600 transform scale-105'
                        : 'bg-yellow-600'
                      : 'bg-gray-500/30'
                  }`}>
                    <div className="text-2xl font-bold mb-2">C</div>
                    <div className="text-xl">
                      {showAnswerC ? currentQuestion.wrong_answer_3 : '???'}
                    </div>
                  </div>

                  {/* Answer D */}
                  <div className={`p-6 rounded-2xl transition-all duration-500 ${
                    showAnswerD 
                      ? 'bg-green-600 transform scale-105'
                      : 'bg-gray-500/30'
                  }`}>
                    <div className="text-2xl font-bold mb-2">D</div>
                    <div className="text-xl">
                      {showAnswerD ? currentQuestion.correct_answer : '???'}
                      {showCorrect && ' ✓'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">🤔</div>
                <div className="text-3xl">Preparando la siguiente pregunta...</div>
              </div>
            )}
          </div>
        )}

        {/* Phase Indicator */}
        <div className="text-center">
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-3 inline-block">
            <div className="text-lg font-medium">
              {gameRoom.current_phase === 'hidden' && 'Preparando pregunta...'}
              {gameRoom.current_phase === 'question' && 'Mostrando pregunta'}
              {gameRoom.current_phase === 'answer_a' && 'Mostrando respuesta A'}
              {gameRoom.current_phase === 'answer_b' && 'Mostrando respuesta B'}
              {gameRoom.current_phase === 'answer_c' && 'Mostrando respuesta C'}
              {gameRoom.current_phase === 'answer_d' && 'Mostrando respuesta D'}
              {gameRoom.current_phase === 'locked' && 'Respuestas bloqueadas'}
              {gameRoom.current_phase === 'reveal' && '¡Respuesta correcta revelada!'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 