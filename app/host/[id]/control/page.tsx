'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import pusherClient, { GAME_EVENTS, getGameChannel } from '@/lib/pusher';
import WildCardManager from '@/components/WildCardManager';

export default function HostControlPanel({ params }: { params: { id: string } }) {
  interface GameRoom {
    id: string;
    current_phase: string;
    current_question_id: string;
    [key: string]: any;
  }

  interface Player {
    id: string;
    name: string;
    current_answer: string | null;
    score: number;
    // Wild card availability
    phone_call_available: boolean;
    phone_search_available: boolean;
    fifty_fifty_available: boolean;
    roulette_available: boolean;
    // Wild card usage tracking
    phone_call_used_at: string | null;
    phone_search_used_at: string | null;
    fifty_fifty_used_at: string | null;
    roulette_used_at: string | null;
    // Wild card results
    fifty_fifty_wrong_answers: string[] | null;
    roulette_wrong_answers: string[] | null;
    [key: string]: any;
  }

  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    loadGameData();
    setupPusherSubscription();
    
    // Set up periodic reload of players to keep wild card status updated
    const interval = setInterval(() => {
      reloadPlayers();
    }, 2000); // Reload every 2 seconds

    return () => clearInterval(interval);
  }, [params.id]);

  function setupPusherSubscription() {
    const channel = pusherClient.subscribe(getGameChannel(params.id));

    channel.bind(GAME_EVENTS.PLAYER_JOINED, (player: any) => {
      console.log('Player joined:', player);
      setPlayers(current => [...current, player]);
    });

    channel.bind(GAME_EVENTS.PLAYER_LEFT, (playerId: string) => {
      console.log('Player left:', playerId);
      setPlayers(current => current.filter(p => p.id !== playerId));
    });

    channel.bind(GAME_EVENTS.ANSWER_SUBMITTED, (data: any) => {
      console.log('Answer submitted:', data);
      setPlayers(current => 
        current.map(p => 
          p.id === data.playerId 
            ? { ...p, current_answer: data.answer }
            : p
        )
      );
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(getGameChannel(params.id));
    };
  }

  async function handleCreateGameQuestions() {
    try {
      setLoading(true);
      console.log('Manually creating game questions for room:', params.id);

      // Get all questions for this questionnaire
      const { data: allQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', gameRoom?.questionnaire_id)
        .order('order_number');

      if (questionsError) throw questionsError;

      if (!allQuestions || allQuestions.length === 0) {
        throw new Error('No hay preguntas en este cuestionario');
      }

      // Create game questions
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
          game_room_id: params.id,
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

      const { error: insertError } = await supabase
        .from('game_questions')
        .insert(gameQuestionsData);

      if (insertError) throw insertError;

      console.log('Successfully created game questions');
      
      // Reload the data
      await loadGameData();
    } catch (err) {
      console.error('Error creating game questions:', err);
      setError(err instanceof Error ? err.message : 'Error creating game questions');
    } finally {
      setLoading(false);
    }
  }

  async function calculateScores() {
    try {
      console.log('Calculating scores for current question...');
      
      if (!currentQuestion) {
        console.error('No current question to calculate scores for');
        return;
      }

      // Get all players with their current answers
      const { data: playersWithAnswers, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', params.id);

      if (playersError) throw playersError;

      console.log('Players with answers:', playersWithAnswers);

      // Calculate scores for each player
      for (const player of playersWithAnswers) {
        if (!player.current_answer) {
          console.log(`Player ${player.name} has no answer, skipping`);
          continue;
        }

        // Determine which answer letter the player selected
        let selectedLetter = null;
        if (player.current_answer === currentQuestion.answer_a) selectedLetter = 'A';
        else if (player.current_answer === currentQuestion.answer_b) selectedLetter = 'B';
        else if (player.current_answer === currentQuestion.answer_c) selectedLetter = 'C';
        else if (player.current_answer === currentQuestion.answer_d) selectedLetter = 'D';

        console.log(`Player ${player.name} selected: ${player.current_answer} (Letter: ${selectedLetter})`);
        console.log(`Correct answer letter: ${currentQuestion.correct_answer_letter}`);

        // Check if answer is correct
        const isCorrect = selectedLetter === currentQuestion.correct_answer_letter;
        const newScore = isCorrect ? player.score + 1 : player.score;

        console.log(`Player ${player.name} answer is ${isCorrect ? 'CORRECT' : 'WRONG'}, new score: ${newScore}`);

        // Update player score
        const { error: updateError } = await supabase
          .from('players')
          .update({ score: newScore })
          .eq('id', player.id);

        if (updateError) {
          console.error(`Error updating score for player ${player.name}:`, updateError);
        }
      }

      // Only reload players data, not the entire game data
      const { data: updatedPlayers, error: playersReloadError } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });

      if (playersReloadError) {
        console.error('Error reloading players:', playersReloadError);
      } else {
        setPlayers(updatedPlayers || []);
        console.log('Players data updated with new scores');
      }

      console.log('Scores calculated and updated successfully');
    } catch (err) {
      console.error('Error calculating scores:', err);
      setError(err instanceof Error ? err.message : 'Error calculating scores');
    }
  }

  async function loadGameData() {
    try {
      setLoading(true);
      
      console.log('Loading game data for room:', params.id);
      
      // Load game room and current question
      const { data: gameRoomData, error: gameRoomError } = await supabase
        .from('game_rooms')
        .select(`
          *,
          current_question:current_question_id(*),
          questionnaire:questionnaire_id(*)
        `)
        .eq('id', params.id)
        .single();

      if (gameRoomError) throw gameRoomError;
      
      console.log('Game room data:', gameRoomData);
      setGameRoom(gameRoomData);

      // Load game questions for this game room
      let { data: gameQuestionsData, error: gameQuestionsError } = await supabase
        .from('game_questions')
        .select('*')
        .eq('game_room_id', params.id)
        .order('order_number', { ascending: true });

      if (gameQuestionsError) throw gameQuestionsError;
      
      console.log('Game questions data:', gameQuestionsData);
      
      // If no game questions found, wait a bit and try again (in case they're being created)
      if (!gameQuestionsData || gameQuestionsData.length === 0) {
        console.log('No game questions found, waiting 2 seconds and retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: retryGameQuestionsData, error: retryError } = await supabase
          .from('game_questions')
          .select('*')
          .eq('game_room_id', params.id)
          .order('order_number', { ascending: true });

        if (retryError) throw retryError;
        
        console.log('Retry game questions data:', retryGameQuestionsData);
        
        if (retryGameQuestionsData && retryGameQuestionsData.length > 0) {
          gameQuestionsData = retryGameQuestionsData;
        }
      }
      
      setAllQuestions(gameQuestionsData || []);

      // Load original questions to get their text
      const { data: originalQuestions, error: originalQuestionsError } = await supabase
        .from('questions')
        .select('id, question_text')
        .eq('questionnaire_id', gameRoomData.questionnaire_id)
        .order('order_number', { ascending: true });

      if (originalQuestionsError) throw originalQuestionsError;

      // Merge game questions with original question text
      const mergedGameQuestions = gameQuestionsData?.map(gameQuestion => {
        const originalQuestion = originalQuestions?.find(q => q.id === gameQuestion.question_id);
        return {
          ...gameQuestion,
          question_text: originalQuestion?.question_text || `Pregunta ${gameQuestion.order_number}`
        };
      }) || [];

      console.log('Merged game questions:', mergedGameQuestions);
      setAllQuestions(mergedGameQuestions);

      // Find the current game question
      const currentGameQuestion = mergedGameQuestions?.find(q => q.question_id === gameRoomData.current_question_id);
      if (currentGameQuestion) {
        console.log('Current game question:', currentGameQuestion);
        setCurrentQuestion(currentGameQuestion);
      } else {
        console.log('No current game question found, using original question');
        setCurrentQuestion(gameRoomData.current_question);
      }

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

  async function reloadPlayers() {
    try {
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });

      if (playersError) throw playersError;
      setPlayers(playersData || []);
    } catch (err) {
      console.error('Error reloading players:', err);
    }
  }

  async function handlePhaseChange(newPhase: string) {
    try {
      const { error: updateError } = await supabase
        .from('game_rooms')
        .update({ current_phase: newPhase })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Notify the display screen
      const displayChannel = `${getGameChannel(params.id)}_display`;
      console.log('Notifying display on channel:', displayChannel);
      
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: displayChannel,
          event: GAME_EVENTS.GAME_PHASE_CHANGED,
          data: { phase: newPhase }
        })
      });

      // Notify each player individually
      for (const player of players) {
        const playerChannel = `${getGameChannel(params.id)}_${player.id}`;
        console.log('Notifying player:', player.name, 'on channel:', playerChannel);
        
        const response = await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: playerChannel,
            event: GAME_EVENTS.GAME_PHASE_CHANGED,
            data: { phase: newPhase }
          })
        });

        if (!response.ok) {
          console.error('Failed to notify player:', player.name);
        }
      }

      // Update local state
      setGameRoom(prev => prev ? { ...prev, current_phase: newPhase } : null);

      // Automatically calculate scores if the phase is 'reveal'
      if (newPhase === 'reveal') {
        await calculateScores();
      }
    } catch (err) {
      console.error('Error changing phase:', err);
      setError(err instanceof Error ? err.message : 'Error changing phase');
    }
  }

  async function handleNextQuestion() {
    try {
      console.log('Moving to next question...');
      console.log('Current question:', currentQuestion);
      console.log('All questions:', allQuestions);
      
      // Find next question - use question_id from currentQuestion (which is the original question ID)
      const currentIndex = allQuestions.findIndex(q => q.question_id === currentQuestion?.question_id);
      console.log('Current index:', currentIndex);
      
      const nextGameQuestion = allQuestions[currentIndex + 1];
      console.log('Next game question:', nextGameQuestion);

      if (!nextGameQuestion) {
        setError('No hay más preguntas');
        return;
      }

      // Update game room
      const { error: updateError } = await supabase
        .from('game_rooms')
        .update({
          current_question_id: nextGameQuestion.question_id,
          current_phase: 'hidden'
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Clear player answers
      await supabase
        .from('players')
        .update({ current_answer: null })
        .eq('game_room_id', params.id);

      // Notify the display screen
      const displayChannel = `${getGameChannel(params.id)}_display`;
      console.log('Notifying display about next question on channel:', displayChannel);
      
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: displayChannel,
          event: GAME_EVENTS.GAME_PHASE_CHANGED,
          data: { phase: 'hidden' }
        })
      });

      // Notify each player individually
      for (const player of players) {
        const playerChannel = `${getGameChannel(params.id)}_${player.id}`;
        console.log('Notifying player about next question:', player.name, 'on channel:', playerChannel);
        
        await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: playerChannel,
            event: GAME_EVENTS.GAME_PHASE_CHANGED,
            data: { phase: 'hidden' }
          })
        });
      }

      // Update local state
      setCurrentQuestion(nextGameQuestion);
      setGameRoom(prev => prev ? {
        ...prev,
        current_question_id: nextGameQuestion.question_id,
        current_phase: 'hidden'
      } : null);
      setPlayers(prev => prev.map(p => ({ ...p, current_answer: null })));
      
      console.log('Successfully moved to next question:', nextGameQuestion);
    } catch (err) {
      console.error('Error moving to next question:', err);
      setError(err instanceof Error ? err.message : 'Error moving to next question');
    }
  }

  async function handleResetGame() {
    try {
      // Reset to first question
      const firstGameQuestion = allQuestions[0];
      if (!firstGameQuestion) {
        setError('No hay preguntas disponibles');
        return;
      }

      // Update game room
      const { error: updateError } = await supabase
        .from('game_rooms')
        .update({
          current_question_id: firstGameQuestion.question_id,
          current_phase: 'hidden'
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Reset player scores and answers
      await supabase
        .from('players')
        .update({ score: 0, current_answer: null })
        .eq('game_room_id', params.id);

      // Reset game end state
      setGameEnded(false);
      setLeaderboard([]);

      // Notify the display screen
      const displayChannel = `${getGameChannel(params.id)}_display`;
      console.log('Notifying display about reset on channel:', displayChannel);
      
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: displayChannel,
          event: GAME_EVENTS.GAME_PHASE_CHANGED,
          data: { phase: 'hidden' }
        })
      });

      // Notify each player individually
      for (const player of players) {
        const playerChannel = `${getGameChannel(params.id)}_${player.id}`;
        console.log('Notifying player about reset:', player.name, 'on channel:', playerChannel);
        
        await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: playerChannel,
            event: GAME_EVENTS.GAME_PHASE_CHANGED,
            data: { phase: 'hidden' }
          })
        });
      }

      // Update local state
      setCurrentQuestion(firstGameQuestion);
      setGameRoom(prev => prev ? {
        ...prev,
        current_question_id: firstGameQuestion.question_id,
        current_phase: 'hidden'
      } : null);
      setPlayers(prev => prev.map(p => ({ ...p, score: 0, current_answer: null })));
    } catch (err) {
      console.error('Error resetting game:', err);
      setError(err instanceof Error ? err.message : 'Error resetting game');
    }
  }

  async function handleRandomizeAnswers() {
    try {
      if (!currentQuestion) return;

      // Find the current game question
      const currentGameQuestion = allQuestions.find(q => q.question_id === currentQuestion.id);
      if (!currentGameQuestion) {
        setError('No se encontró la pregunta actual');
        return;
      }

      console.log('Randomizing answers for game question:', currentGameQuestion);

      // Get all answers from the original question
      const originalQuestion = currentQuestion;
      const allAnswers = [
        originalQuestion.wrong_answer_1,
        originalQuestion.wrong_answer_2,
        originalQuestion.wrong_answer_3,
        originalQuestion.correct_answer
      ];

      // Shuffle answers
      const shuffledAnswers = allAnswers.sort(() => Math.random() - 0.5);

      // Generate random position for correct answer (1-4)
      const correctAnswerPosition = Math.floor(Math.random() * 4) + 1;
      const correctAnswerLetter = ['A', 'B', 'C', 'D'][correctAnswerPosition - 1];

      console.log('Correct answer position:', correctAnswerPosition, 'Letter:', correctAnswerLetter);

      // Update game question with new answer order
      const updateData = {
        answer_a: shuffledAnswers[0],
        answer_b: shuffledAnswers[1],
        answer_c: shuffledAnswers[2],
        answer_d: shuffledAnswers[3],
        correct_answer_letter: correctAnswerLetter
      };

      console.log('Updating game question with:', updateData);

      const { error: updateError } = await supabase
        .from('game_questions')
        .update(updateData)
        .eq('id', currentGameQuestion.id);

      if (updateError) throw updateError;

      // Update local state
      const updatedGameQuestion = { ...currentGameQuestion, ...updateData };
      setCurrentQuestion(updatedGameQuestion);
      setAllQuestions(prev => prev.map(q => 
        q.id === currentGameQuestion.id ? updatedGameQuestion : q
      ));

      // Reset game phase to hidden
      await handlePhaseChange('hidden');
    } catch (err) {
      console.error('Error randomizing answers:', err);
      setError(err instanceof Error ? err.message : 'Error randomizing answers');
    }
  }

  async function handleFinishGame() {
    try {
      console.log('Finishing game...');
      setGameEnded(true);

      // Update game room phase to 'finished'
      const { error: updateError } = await supabase
        .from('game_rooms')
        .update({ current_phase: 'finished' })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Notify the display screen
      const displayChannel = `${getGameChannel(params.id)}_display`;
      console.log('Notifying display about game finished on channel:', displayChannel);
      
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: displayChannel,
          event: GAME_EVENTS.GAME_ENDED,
          data: { gameEnded: true }
        })
      });

      // Notify each player individually
      for (const player of players) {
        const playerChannel = `${getGameChannel(params.id)}_${player.id}`;
        console.log('Notifying player about game finished:', player.name, 'on channel:', playerChannel);
        
        await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: playerChannel,
            event: GAME_EVENTS.GAME_ENDED,
            data: { gameEnded: true }
          })
        });
      }

      // Load leaderboard
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('players')
        .select('id, name, score')
        .eq('game_room_id', params.id)
        .order('score', { ascending: false });

      if (leaderboardError) throw leaderboardError;
      setLeaderboard(leaderboardData || []);

      console.log('Game finished and leaderboard loaded');
    } catch (err) {
      console.error('Error finishing game:', err);
      setError(err instanceof Error ? err.message : 'Error finishing game');
    }
  }

  function openDisplayScreen() {
    window.open(`/host/${params.id}/display`, '_blank', 'fullscreen=yes');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl text-gray-600">Cargando panel de control...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with Display Screen Button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Panel de Control</h1>
          <button
            onClick={openDisplayScreen}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Abrir Pantalla de Visualización
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button
                onClick={loadGameData}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {!loading && allQuestions.length === 0 && !error && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            <div className="flex justify-between items-center">
              <span>No se encontraron preguntas del juego. Esto puede suceder si la sala fue creada antes de la actualización.</span>
              <div className="flex space-x-2">
                <button
                  onClick={loadGameData}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                >
                  Recargar
                </button>
                <button
                  onClick={handleCreateGameQuestions}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Crear Preguntas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Controles del Juego</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => handlePhaseChange('hidden')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Ocultar
            </button>
            <button
              onClick={() => handlePhaseChange('question')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Pregunta
            </button>
            <button
              onClick={() => handlePhaseChange('answer_a')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Respuesta A
            </button>
            <button
              onClick={() => handlePhaseChange('answer_b')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Respuesta B
            </button>
            <button
              onClick={() => handlePhaseChange('answer_c')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Respuesta C
            </button>
            <button
              onClick={() => handlePhaseChange('answer_d')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Respuesta D
            </button>
            <button
              onClick={() => handlePhaseChange('locked')}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Bloquear
            </button>
            <button
              onClick={() => handlePhaseChange('reveal')}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded"
            >
              Revelar
            </button>
          </div>
          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleNextQuestion}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
            >
              Siguiente Pregunta
            </button>
            <button
              onClick={handleResetGame}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
            >
              Reiniciar Juego
            </button>
            <button
              onClick={handleRandomizeAnswers}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded"
            >
              Randomizar Respuestas
            </button>
            {/* <button
              onClick={calculateScores}
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded"
            >
              Calcular Puntuaciones
            </button> */}
          </div>
        </div>

          {/* Current Question Info */}
          {currentQuestion && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Pregunta Actual</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-lg mb-4">
                  {currentQuestion.question_text}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {/* <div className="p-3 rounded bg-blue-50">
                    <span className="font-bold">A:</span> {currentQuestion.answer_a}
                  </div>
                  <div className="p-3 rounded bg-blue-50">
                    <span className="font-bold">B:</span> {currentQuestion.answer_b}
                  </div>
                  <div className="p-3 rounded bg-blue-50">
                    <span className="font-bold">C:</span> {currentQuestion.answer_c}
                  </div>
                  <div className="p-3 rounded bg-green-50">
                    <span className="font-bold">D:</span> {currentQuestion.answer_d}
                  </div> */}
                  <div className={`p-3 rounded font-medium ${
                    currentQuestion.correct_answer_letter === 'A' ? 'bg-green-100' : 'bg-blue-100'
                  }`}> <span className="font-bold">A:</span> {currentQuestion.answer_a}</div>
                  <div className={`p-3 rounded font-medium ${
                    currentQuestion.correct_answer_letter === 'B' ? 'bg-green-100' : 'bg-blue-100'
                  }`}> <span className="font-bold">B:</span> {currentQuestion.answer_b}</div>
                  <div className={`p-3 rounded font-medium ${
                    currentQuestion.correct_answer_letter === 'C' ? 'bg-green-100' : 'bg-blue-100'
                  }`}> <span className="font-bold">C:</span> {currentQuestion.answer_c}</div> 
                  <div className={`p-3 rounded font-medium ${
                    currentQuestion.correct_answer_letter === 'D' ? 'bg-green-100' : 'bg-blue-100'
                  }`}> <span className="font-bold">D:</span> {currentQuestion.answer_d}</div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Respuesta correcta: {currentQuestion.correct_answer_letter}
                </div>
              </div>
            </div>
          )}

        {/* Finish Game Button - Only show when no more questions */}
        {!gameEnded && currentQuestion && (() => {
          const currentIndex = allQuestions.findIndex(q => q.question_id === currentQuestion?.question_id);
          const isLastQuestion = currentIndex === allQuestions.length - 1;
          
          return isLastQuestion && gameRoom?.current_phase === 'reveal' ? (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-center">¡Última Pregunta Completada!</h2>
              <div className="text-center">
                <button
                  onClick={handleFinishGame}
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-lg text-lg font-semibold"
                >
                  Finalizar Juego
                </button>
              </div>
            </div>
          ) : null;
        })()}

        {/* Game End Leaderboard */}
        {gameEnded && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-center mb-6">🏆 Resultados Finales</h2>
            <div className="space-y-4">
              {leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' :
                    index === 1 ? 'bg-gray-100 border-2 border-gray-400' :
                    index === 2 ? 'bg-orange-100 border-2 border-orange-400' :
                    'bg-blue-50'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <span className="font-semibold text-lg">{player.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{player.score} puntos</div>
                    <div className="text-sm text-gray-600">
                      {index === 0 ? '¡GANADOR!' : 
                       player.score === leaderboard[0]?.score ? '¡EMPATE!' : 'Participante'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={handleResetGame}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded"
              >
                Jugar de Nuevo
              </button>
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Jugadores ({players.length})</h2>
          {players.length === 0 ? (
            <p className="text-center text-gray-500">Esperando jugadores...</p>
          ) : (
            <div className="space-y-2">
              {players.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{player.name}</span>
                      <span className="font-bold">{player.score} puntos</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm">
                        {player.current_answer ? `Respuesta: ${player.current_answer}` : 'Sin responder'}
                      </span>
                      <div className="flex gap-1">
                        {!player.phone_call_available && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">📞</span>
                        )}
                        {!player.phone_search_available && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">🔍</span>
                        )}
                        {!player.fifty_fifty_available && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">50:50</span>
                        )}
                        {!player.roulette_available && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">🎰</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wild Card Manager */}
        {players.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <WildCardManager 
              gameId={params.id}
              players={players}
              currentQuestion={currentQuestion}
            />
          </div>
        )}

        {/* All Questions Preview */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Lista de Preguntas</h2>
          <div className="space-y-4">
            {allQuestions.map((gameQuestion, index) => (
              <div
                key={gameQuestion.id}
                className={`p-4 rounded-lg ${
                  currentQuestion?.id === gameQuestion.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">Pregunta {index + 1}</span>
                  {currentQuestion?.id === gameQuestion.id && (
                    <span className="text-blue-600 font-medium">Pregunta Actual</span>
                  )}
                </div>
                <p className="text-gray-800 mb-2">{gameQuestion.question_text}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`font-medium ${
                    gameQuestion.correct_answer_letter === 'A' ? 'text-green-600' : 'text-gray-600'
                  }`}>A: {gameQuestion.answer_a}</div>
                  <div className={`font-medium ${
                    gameQuestion.correct_answer_letter === 'B' ? 'text-green-600' : 'text-gray-600'
                  }`}>B: {gameQuestion.answer_b}</div>
                  <div className={`font-medium ${
                    gameQuestion.correct_answer_letter === 'C' ? 'text-green-600' : 'text-gray-600'
                  }`}>C: {gameQuestion.answer_c}</div>
                  <div className={`font-medium ${
                    gameQuestion.correct_answer_letter === 'D' ? 'text-green-600' : 'text-gray-600'
                  }`}>D: {gameQuestion.answer_d}</div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Correcta: {gameQuestion.correct_answer_letter}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}