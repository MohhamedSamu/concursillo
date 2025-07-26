'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import pusherClient, { GAME_EVENTS, getGameChannel } from '@/lib/pusher';

export default function DisplayView({ params }: { params: { id: string } }) {
  const [gameRoom, setGameRoom] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    loadGameData();
    const displayChannel = `${getGameChannel(params.id)}_display`;
    setupPusherSubscription(displayChannel);

    return () => {
      const displayChannel = `${getGameChannel(params.id)}_display`;
      pusherClient.unsubscribe(displayChannel);
    };
  }, [params.id]);

  function setupPusherSubscription(channelName: string) {
    console.log('Display: Setting up subscription to channel:', channelName);
    const channel = pusherClient.subscribe(channelName);

    // Handle phase changes
    channel.bind(GAME_EVENTS.GAME_PHASE_CHANGED, async (data: any) => {
      console.log('Display: Game phase changed:', data);
      
      // If phase changed, we need to reload the game data to get the latest question
      const { data: gameRoomData, error: gameRoomError } = await supabase
        .from('game_rooms')
        .select(`
          *,
          current_question:current_question_id(*)
        `)
        .eq('id', params.id)
        .single();

      if (gameRoomError) {
        console.error('Error reloading game data:', gameRoomError);
        return;
      }

      // Load the current game question to get the randomized answers
      const { data: currentGameQuestion, error: gameQuestionError } = await supabase
        .from('game_questions')
        .select('*')
        .eq('game_room_id', params.id)
        .eq('question_id', gameRoomData.current_question_id)
        .single();

      if (gameQuestionError) {
        console.error('Error loading game question:', gameQuestionError);
        return;
      }

      // Merge the original question with the game question data
      const mergedQuestion = {
        ...gameRoomData.current_question,
        answer_a: currentGameQuestion.answer_a,
        answer_b: currentGameQuestion.answer_b,
        answer_c: currentGameQuestion.answer_c,
        answer_d: currentGameQuestion.answer_d,
        correct_answer_letter: currentGameQuestion.correct_answer_letter
      };

      setGameRoom(gameRoomData);
      setCurrentQuestion(mergedQuestion);

      // Also reload players to get latest scores
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });

      if (!playersError && playersData) {
        setPlayers(playersData);
      }
    });

    // Handle player updates
    channel.bind(GAME_EVENTS.PLAYER_JOINED, (player: any) => {
      console.log('Display: Player joined:', player);
      setPlayers(current => [...current, player]);
    });

    channel.bind(GAME_EVENTS.PLAYER_LEFT, (playerId: string) => {
      console.log('Display: Player left:', playerId);
      setPlayers(current => current.filter(p => p.id !== playerId));
    });

    // Handle game end
    channel.bind(GAME_EVENTS.GAME_ENDED, async (data: any) => {
      console.log('Display: Game ended:', data);
      setGameEnded(true);
      
      // Load final leaderboard
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('players')
        .select('id, name, score')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });

      if (!leaderboardError && leaderboardData) {
        setLeaderboard(leaderboardData);
      }
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
    };
  }

  async function loadGameData() {
    try {
      setLoading(true);
      
      // Load game room and current question
      const { data: gameRoomData, error: gameRoomError } = await supabase
        .from('game_rooms')
        .select(`
          *,
          current_question:current_question_id(*)
        `)
        .eq('id', params.id)
        .single();

      if (gameRoomError) throw gameRoomError;
      
      setGameRoom(gameRoomData);
      setCurrentQuestion(gameRoomData.current_question);

      // Load the current game question to get the randomized answers
      const { data: currentGameQuestion, error: gameQuestionError } = await supabase
        .from('game_questions')
        .select('*')
        .eq('game_room_id', params.id)
        .eq('question_id', gameRoomData.current_question_id)
        .single();

      if (gameQuestionError) throw gameQuestionError;

      // Merge the original question with the game question data
      const mergedQuestion = {
        ...gameRoomData.current_question,
        answer_a: currentGameQuestion.answer_a,
        answer_b: currentGameQuestion.answer_b,
        answer_c: currentGameQuestion.answer_c,
        answer_d: currentGameQuestion.answer_d,
        correct_answer_letter: currentGameQuestion.correct_answer_letter
      };

      setCurrentQuestion(mergedQuestion);

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });

      if (playersError) throw playersError;
      setPlayers(playersData || []);

    } catch (err) {
      console.error('Error loading game data:', err);
      setError(err instanceof Error ? err.message : 'Error loading game data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-2xl">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-2xl text-red-500">{error}</div>
      </div>
    );
  }

  if (!gameRoom || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-6xl mb-6">🎯</div>
          <div className="text-4xl font-bold mb-4">¡Preparados!</div>
          <div className="text-2xl text-gray-400">Esperando la primera pregunta...</div>
        </div>
      </div>
    );
  }

  const showQuestion = gameRoom.current_phase !== 'hidden';
  const showAnswerA = ['answer_a', 'answer_b', 'answer_c', 'answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const showAnswerB = ['answer_b', 'answer_c', 'answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const showAnswerC = ['answer_c', 'answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const showAnswerD = ['answer_d', 'locked', 'reveal'].includes(gameRoom.current_phase);
  const isRevealed = gameRoom.current_phase === 'reveal';
  const isLocked = gameRoom.current_phase === 'locked';

  // Show leaderboard if game ended
  if (gameEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white p-8">
        <div className="max-w-4xl mx-auto mt-20">
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">🏆</div>
            <h1 className="text-5xl font-bold mb-4">¡Juego Terminado!</h1>
            <h2 className="text-3xl text-gray-300">Resultados Finales</h2>
          </div>

          <div className="space-y-6">
            {leaderboard.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-6 rounded-lg text-2xl ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-400 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  'bg-blue-800 text-white'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-4xl mr-4">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <span className="font-bold">{player.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{player.score} puntos</div>
                  <div className="text-lg">
                    {index === 0 ? '¡GANADOR!' : 
                     player.score === leaderboard[0]?.score ? '¡EMPATE!' : 'Participante'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-8">
      {/* Scoreboard */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-50 p-4 rounded-lg">
        <h3 className="text-lg font-bold mb-2">Puntuaciones</h3>
        <div className="space-y-2">
          {players.map(player => (
            <div key={player.id} className="flex justify-between">
              <span>{player.name}</span>
              <span className="ml-4 font-bold">{player.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-20">
        {/* Question */}
        {showQuestion ? (
          <div className="text-4xl font-bold mb-12 text-center">
            {currentQuestion.question_text}
          </div>
        ) : (
          <div className="text-4xl font-bold mb-12 text-center">
            Preparados...
          </div>
        )}

        {/* Answers Grid */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          {/* Answer A */}
          <div className={`transform transition-all duration-500 ${showAnswerA ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className={`p-6 rounded-lg text-2xl ${
              isRevealed && currentQuestion.correct_answer_letter === 'A'
                ? 'bg-green-600' 
                : 'bg-blue-800'
            }`}>
              <span className="font-bold">A:</span> {currentQuestion.answer_a}
              {isRevealed && currentQuestion.correct_answer_letter === 'A' && (
                <span className="ml-2">✓</span>
              )}
            </div>
          </div>

          {/* Answer B */}
          <div className={`transform transition-all duration-500 ${showAnswerB ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className={`p-6 rounded-lg text-2xl ${
              isRevealed && currentQuestion.correct_answer_letter === 'B'
                ? 'bg-green-600' 
                : 'bg-blue-800'
            }`}>
              <span className="font-bold">B:</span> {currentQuestion.answer_b}
              {isRevealed && currentQuestion.correct_answer_letter === 'B' && (
                <span className="ml-2">✓</span>
              )}
            </div>
          </div>

          {/* Answer C */}
          <div className={`transform transition-all duration-500 ${showAnswerC ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className={`p-6 rounded-lg text-2xl ${
              isRevealed && currentQuestion.correct_answer_letter === 'C'
                ? 'bg-green-600' 
                : 'bg-blue-800'
            }`}>
              <span className="font-bold">C:</span> {currentQuestion.answer_c}
              {isRevealed && currentQuestion.correct_answer_letter === 'C' && (
                <span className="ml-2">✓</span>
              )}
            </div>
          </div>

          {/* Answer D */}
          <div className={`transform transition-all duration-500 ${showAnswerD ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className={`p-6 rounded-lg text-2xl ${
              isRevealed && currentQuestion.correct_answer_letter === 'D'
                ? 'bg-green-600' 
                : 'bg-blue-800'
            }`}>
              <span className="font-bold">D:</span> {currentQuestion.answer_d}
              {isRevealed && currentQuestion.correct_answer_letter === 'D' && (
                <span className="ml-2">✓</span>
              )}
            </div>
          </div>
        </div>

        {/* Phase Indicator */}
        {isLocked && (
          <div className="text-3xl text-center mt-12 text-yellow-500">
            ¡Respuestas Bloqueadas!
          </div>
        )}
      </div>
    </div>
  );
} 