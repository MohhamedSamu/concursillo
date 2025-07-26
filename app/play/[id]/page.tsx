'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import pusherClient, { GAME_EVENTS, getGameChannel } from '@/lib/pusher';
import WildCardDisplay from '@/components/WildCardDisplay';

export default function PlayPage() {
  const params = useParams();
  const [error, setError] = useState<string | null>(null);
  const [gameRoom, setGameRoom] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [wildCardResult, setWildCardResult] = useState<any>(null);
  const [wrongAnswers, setWrongAnswers] = useState<string[]>([]);

  const reloadPlayerData = async () => {
    try {
      const playerName = sessionStorage.getItem(`current_player_name_${params.id}`);
      const storageKey = `game_${params.id}_player_${playerName}_id`;
      const playerId = localStorage.getItem(storageKey);
      
      if (playerId) {
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (!playerError && playerData) {
          console.log('Reloaded player data:', playerData);
          setPlayer(playerData);
        }
      }
    } catch (error) {
      console.error('Error reloading player data:', error);
    }
  };

  useEffect(() => {
    // Get the player name from sessionStorage
    const playerName = sessionStorage.getItem(`current_player_name_${params.id}`);
    console.log('Retrieved player name from session:', playerName);
    
    if (!playerName) {
      setError('No se encontró información del jugador');
      setIsLoading(false);
      return;
    }

    // Get the storage key using the player name
    const storageKey = `game_${params.id}_player_${playerName}_id`;
    console.log('Using storage key:', storageKey);
    
    // Get the player ID using the storage key
    const playerId = localStorage.getItem(storageKey);
    console.log('Retrieved player ID:', playerId);
    
    if (!playerId) {
      setError('No se encontró información del jugador');
      setIsLoading(false);
      return;
    }

    console.log('Loading game data for player:', playerId, 'with name:', playerName);
    loadGameData(playerId);
    
    // Create a unique channel name for this player instance
    const playerChannel = `${getGameChannel(params.id as string)}_${playerId}`;
    console.log('Subscribing to channel:', playerChannel);
    
    const channel = pusherClient.subscribe(playerChannel);
    setupPusherSubscription(playerId, playerChannel);

    // Set up periodic reload of player data to keep wild card status updated
    const interval = setInterval(() => {
      reloadPlayerData();
    }, 2000); // Reload every 2 seconds to match display screen

    return () => {
      console.log('Unsubscribing from channel:', playerChannel);
      pusherClient.unsubscribe(playerChannel);
      clearInterval(interval);
    };
  }, [params.id]);

  async function loadGameData(playerId: string) {
    try {
      // First load the player data
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (playerError) {
        console.error('Error loading player:', playerError);
        throw new Error('Error al cargar datos del jugador');
      }

      if (!playerData) {
        throw new Error('No se encontró el jugador');
      }

      console.log('Loaded player data:', playerData);
      setPlayer(playerData);
      setSelectedAnswer(playerData.current_answer);

      // Then load the game room data
      const { data: gameRoomData, error: gameRoomError } = await supabase
        .from('game_rooms')
        .select(`
          *,
          current_question:current_question_id(*)
        `)
        .eq('id', params.id)
        .single();

      if (gameRoomError) {
        console.error('Error loading game room:', gameRoomError);
        throw new Error('Error al cargar datos del juego');
      }

      console.log('Loaded game room data:', gameRoomData);
      setGameRoom(gameRoomData);

      // Load the current game question (randomized answers)
      const { data: currentGameQuestion, error: gameQuestionError } = await supabase
        .from('game_questions')
        .select('*')
        .eq('game_room_id', params.id)
        .eq('question_id', gameRoomData.current_question_id)
        .single();

      if (gameQuestionError) {
        console.error('Error loading game question:', gameQuestionError);
        throw new Error('Error al cargar la pregunta del juego');
      }

      if (!currentGameQuestion) {
        console.error('No game question found for current question');
        throw new Error('No se encontró la pregunta del juego');
      }

      // Merge original question data with game question data
      const mergedQuestion = {
        ...gameRoomData.current_question, // Original question data (for question_text)
        answer_a: currentGameQuestion.answer_a,
        answer_b: currentGameQuestion.answer_b,
        answer_c: currentGameQuestion.answer_c,
        answer_d: currentGameQuestion.answer_d,
        correct_answer_letter: currentGameQuestion.correct_answer_letter
      };

      console.log('Merged current question:', mergedQuestion);
      setCurrentQuestion(mergedQuestion);
    } catch (err) {
      console.error('Error in loadGameData:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el juego');
    } finally {
      setIsLoading(false);
    }
  }

  function setupPusherSubscription(playerId: string, channelName: string) {
    console.log('Setting up Pusher subscription for player:', playerId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind(GAME_EVENTS.GAME_PHASE_CHANGED, async (data: any) => {
      console.log('Game phase changed event received for player:', playerId, data);
      
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

      // Load the current game question (randomized answers)
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

      if (!currentGameQuestion) {
        console.error('No game question found for current question');
        return;
      }

      // Merge original question data with game question data
      const mergedQuestion = {
        ...gameRoomData.current_question, // Original question data (for question_text)
        answer_a: currentGameQuestion.answer_a,
        answer_b: currentGameQuestion.answer_b,
        answer_c: currentGameQuestion.answer_c,
        answer_d: currentGameQuestion.answer_d,
        correct_answer_letter: currentGameQuestion.correct_answer_letter
      };

      // If it's a new question or hidden phase, reset selected answer and wrong answers
      if (gameRoomData.current_question?.id !== currentQuestion?.id || data.phase === 'hidden') {
        setSelectedAnswer(null);
        setWrongAnswers([]);
      }

      setGameRoom(gameRoomData);
      setCurrentQuestion(mergedQuestion);

      // Reload player data to get updated score
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (!playerError && playerData) {
        console.log('Updated player data:', playerData);
        setPlayer(playerData);
        
        // Ensure selected answer is preserved during locked and reveal phases
        if ((data.phase === 'locked' || data.phase === 'reveal') && playerData.current_answer) {
          console.log('Setting selected answer from player data:', playerData.current_answer);
          setSelectedAnswer(playerData.current_answer);
        }
        
        // Debug logging for reveal phase
        if (data.phase === 'reveal') {
          console.log('Reveal phase - Current state:', {
            selectedAnswer,
            playerCurrentAnswer: playerData.current_answer,
            gamePhase: data.phase
          });
        }
      } else {
        // If we can't get player data, try to preserve the current selected answer during reveal
        if (data.phase === 'reveal' && selectedAnswer) {
          console.log('Preserving current selected answer during reveal:', selectedAnswer);
        }
      }
    });

    // Handle game end
    channel.bind(GAME_EVENTS.GAME_ENDED, async (data: any) => {
      console.log('Game ended event received for player:', playerId, data);
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

    // Handle wild card results
    channel.bind(GAME_EVENTS.WILD_CARD_RESULT, (data: any) => {
      console.log('Wild card result received for player:', playerId, data);
      setWildCardResult(data);
      
      // Handle wrong answers from 50/50 and roulette
      if (data.type === 'fifty_fifty' || data.type === 'roulette') {
        if (data.wrongAnswers) {
          console.log('Setting wrong answers:', data.wrongAnswers);
          setWrongAnswers(data.wrongAnswers);
        }
      }
      
      // Handle wild card revival
      if (data.type === 'wild_card_revived') {
        console.log('Wild card revived:', data.wildCardType);
        // Clear wrong answers if the revived wild card was 50/50 or roulette
        if (data.wildCardType === 'fifty_fifty' || data.wildCardType === 'roulette') {
          setWrongAnswers([]);
        }
        // Show a brief notification to the player
        setTimeout(() => {
          console.log(`¡Tu comodín ${data.wildCardType === 'fifty_fifty' ? '50/50' : data.wildCardType === 'roulette' ? 'Ruleta' : data.wildCardType} ha sido revivido!`);
        }, 100);
      }
      
      // Handle phone call and search completion
      if (data.type === 'phone_call' || data.type === 'phone_search') {
        if (data.completed) {
          console.log(`${data.type} wildcard completed`);
          // Show a brief notification to the player
          setTimeout(() => {
            console.log(`¡Tiempo de ${data.type === 'phone_call' ? 'llamada telefónica' : 'búsqueda en internet'} terminado!`);
          }, 100);
        }
      }
      
      // Reload player data immediately to get updated wild card status
      reloadPlayerData();
    });
  }

  const getAnswerButtonStyle = (answerLetter: string) => {
    const isSelected = selectedAnswer === currentQuestion[`answer_${answerLetter.toLowerCase()}`];
    const isCorrect = gameRoom.current_phase === 'reveal' && currentQuestion.correct_answer_letter === answerLetter;
    const isWrongAnswer = wrongAnswers.includes(answerLetter);
    
    // During reveal phase, also check player's current answer from database
    const playerSelectedAnswer = gameRoom.current_phase === 'reveal' && player?.current_answer;
    const isPlayerSelected = playerSelectedAnswer === currentQuestion[`answer_${answerLetter.toLowerCase()}`];
    
    // Debug logging for reveal phase
    if (gameRoom.current_phase === 'reveal') {
      console.log(`Answer ${answerLetter}:`, {
        answerText: currentQuestion[`answer_${answerLetter.toLowerCase()}`],
        isSelected,
        selectedAnswer,
        playerSelectedAnswer,
        isPlayerSelected,
        isCorrect,
        isWrongAnswer,
        correctAnswer: currentQuestion.correct_answer_letter
      });
    }
    
    // During reveal phase, prioritize showing correct answer and player's wrong choice
    if (gameRoom.current_phase === 'reveal') {
      if (isCorrect) return 'bg-green-500 text-white';
      if ((isSelected || isPlayerSelected) && !isCorrect) return 'bg-red-500 text-white'; // Player's wrong choice
      if (isWrongAnswer) return 'bg-red-500 text-white';
      return 'bg-gray-100';
    }
    
    // During other phases, show normal selection state
    if (isSelected) return 'bg-blue-500 text-white';
    if (isWrongAnswer) return 'bg-red-500 text-white';
    return 'bg-gray-100 hover:bg-gray-200';
  };

  async function handleAnswerSelect(answer: string) {
    if (!player || !gameRoom || gameRoom.current_phase === 'locked') return;

    try {
      const { error: updateError } = await supabase
        .from('players')
        .update({ current_answer: answer })
        .eq('id', player.id);

      if (updateError) throw updateError;

      setSelectedAnswer(answer);

      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: getGameChannel(gameRoom.id),
          event: GAME_EVENTS.ANSWER_SUBMITTED,
          data: { playerId: player.id, answer }
        })
      });
    } catch (err) {
      console.error('Error submitting answer:', err);
      setError('Error al enviar respuesta');
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl">Cargando...</p>
    </div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl text-red-500">{error}</p>
    </div>;
  }

  if (!gameRoom || !player) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl">Esperando datos del juego...</p>
    </div>;
  }

  // Show leaderboard if game ended
  if (gameEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🏆</div>
            <h1 className="text-3xl font-bold mb-2">¡Juego Terminado!</h1>
            <h2 className="text-xl text-gray-300">Resultados Finales</h2>
          </div>

          <div className="space-y-4">
            {leaderboard.map((leaderboardPlayer, index) => (
              <div
                key={leaderboardPlayer.id}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  leaderboardPlayer.id === player.id ? 'ring-2 ring-yellow-400' : ''
                } ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-400 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  'bg-blue-800 text-white'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <span className="font-semibold">
                    {leaderboardPlayer.name}
                    {leaderboardPlayer.id === player.id && ' (Tú)'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">{leaderboardPlayer.score} puntos</div>
                  <div className="text-sm">
                    {index === 0 ? '¡GANADOR!' : 
                     leaderboardPlayer.score === leaderboard[0]?.score ? '¡EMPATE!' : 'Participante'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-300 mb-4">
              {(() => {
                const playerRank = leaderboard.findIndex(p => p.id === player.id);
                if (playerRank === 0) return '¡Felicitaciones! ¡Eres el ganador! 🎉';
                if (playerRank === 1) return '¡Excelente! Obtuviste el segundo lugar! 🥈';
                if (playerRank === 2) return '¡Muy bien! Obtuviste el tercer lugar! 🥉';
                return '¡Gracias por participar! ¡Buen juego! 👏';
              })()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">¡Bienvenido {player.name}!</h1>
          <p className="text-lg">Puntuación: {player.score}</p>
        </div>

        {/* Wild Card Display */}
        <div className="mb-6">
          <WildCardDisplay 
            playerId={player.id}
            gameId={params.id as string}
            playerData={player}
            onWildCardResult={setWildCardResult}
          />
        </div>

        {gameRoom.current_phase === 'waiting' && (
          <div className="text-center py-8">
            <p className="text-xl">Esperando a que comience el juego...</p>
          </div>
        )}

        {gameRoom.current_phase !== 'waiting' && currentQuestion && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {(gameRoom.current_phase === 'question' || gameRoom.current_phase === 'answer_a' || 
              gameRoom.current_phase === 'answer_b' || gameRoom.current_phase === 'answer_c' || 
              gameRoom.current_phase === 'answer_d' || gameRoom.current_phase === 'locked' || 
              gameRoom.current_phase === 'reveal') && (
              <h2 className="text-xl font-semibold mb-4">{currentQuestion.question_text}</h2>
            )}

            {(gameRoom.current_phase === 'answer_a' || gameRoom.current_phase === 'answer_b' || 
              gameRoom.current_phase === 'answer_c' || gameRoom.current_phase === 'answer_d' || 
              gameRoom.current_phase === 'locked' || gameRoom.current_phase === 'reveal') && (
              <div className="space-y-4">
                <button
                  className={`w-full p-4 text-left rounded ${getAnswerButtonStyle('A')}`}
                  onClick={() => handleAnswerSelect(currentQuestion.answer_a)}
                  disabled={gameRoom.current_phase === 'locked' || gameRoom.current_phase === 'reveal'}
                >
                  A: {currentQuestion.answer_a}
                </button>

                {(gameRoom.current_phase === 'answer_b' || gameRoom.current_phase === 'answer_c' || 
                  gameRoom.current_phase === 'answer_d' || gameRoom.current_phase === 'locked' || 
                  gameRoom.current_phase === 'reveal') && (
                  <button
                    className={`w-full p-4 text-left rounded ${getAnswerButtonStyle('B')}`}
                    onClick={() => handleAnswerSelect(currentQuestion.answer_b)}
                    disabled={gameRoom.current_phase === 'locked' || gameRoom.current_phase === 'reveal'}
                  >
                    B: {currentQuestion.answer_b}
                  </button>
                )}

                {(gameRoom.current_phase === 'answer_c' || gameRoom.current_phase === 'answer_d' || 
                  gameRoom.current_phase === 'locked' || gameRoom.current_phase === 'reveal') && (
                  <button
                    className={`w-full p-4 text-left rounded ${getAnswerButtonStyle('C')}`}
                    onClick={() => handleAnswerSelect(currentQuestion.answer_c)}
                    disabled={gameRoom.current_phase === 'locked' || gameRoom.current_phase === 'reveal'}
                  >
                    C: {currentQuestion.answer_c}
                  </button>
                )}

                {(gameRoom.current_phase === 'answer_d' || gameRoom.current_phase === 'locked' || 
                  gameRoom.current_phase === 'reveal') && (
                  <button
                    className={`w-full p-4 text-left rounded ${getAnswerButtonStyle('D')}`}
                    onClick={() => handleAnswerSelect(currentQuestion.answer_d)}
                    disabled={gameRoom.current_phase === 'locked' || gameRoom.current_phase === 'reveal'}
                  >
                    D: {currentQuestion.answer_d}
                  </button>
                )}
              </div>
            )}

            {selectedAnswer && (
              <p className="mt-4 text-center text-lg">
                Has seleccionado tu respuesta. Esperando a los demás jugadores...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 