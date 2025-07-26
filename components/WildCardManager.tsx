'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import TimerModal from './TimerModal';
import RouletteModal from './RouletteModal';
import { supabase } from '@/lib/supabase';
import { GAME_EVENTS, getGameChannel } from '@/lib/pusher';

interface Player {
  id: string;
  name: string;
  phone_call_available: boolean;
  phone_search_available: boolean;
  fifty_fifty_available: boolean;
  roulette_available: boolean;
}

interface WildCardManagerProps {
  gameId: string;
  players: Player[];
  currentQuestion: any;
}

export default function WildCardManager({ gameId, players, currentQuestion }: WildCardManagerProps) {
  const [activeWildCard, setActiveWildCard] = useState<{
    playerId: string;
    playerName: string;
    type: 'phone_call' | 'phone_search' | 'fifty_fifty' | 'roulette';
  } | null>(null);

  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showRouletteModal, setShowRouletteModal] = useState(false);
  const [showFiftyFiftyModal, setShowFiftyFiftyModal] = useState(false);
  const [timerType, setTimerType] = useState<'phone_call' | 'phone_search'>('phone_call');
  const [fiftyFiftyResult, setFiftyFiftyResult] = useState<string[] | null>(null);
  const [localPlayers, setLocalPlayers] = useState(players);

  // Update local players when props change
  useEffect(() => {
    setLocalPlayers(players);
  }, [players]);

  const handleWildCardRequest = async (playerId: string, playerName: string, type: 'phone_call' | 'phone_search' | 'fifty_fifty' | 'roulette') => {
    setActiveWildCard({ playerId, playerName, type });

    if (type === 'phone_call') {
      setTimerType('phone_call');
      setShowTimerModal(true);
    } else if (type === 'phone_search') {
      setTimerType('phone_search');
      setShowTimerModal(true);
    } else if (type === 'fifty_fifty') {
      await handleFiftyFifty(playerId);
      setShowFiftyFiftyModal(true);
    } else if (type === 'roulette') {
      setShowRouletteModal(true);
    }
  };

  const handleTimerComplete = async () => {
    if (!activeWildCard) return;

    // Mark wild card as used
    await markWildCardAsUsed(activeWildCard.playerId, activeWildCard.type);
    
    // Notify player that timer is complete
    await notifyPlayer(activeWildCard.playerId, {
      type: activeWildCard.type,
      completed: true
    });

    setShowTimerModal(false);
    setActiveWildCard(null);
  };

  const handleRouletteResult = async (wrongAnswersCount: number) => {
    if (!activeWildCard) return;

    await handleRoulette(activeWildCard.playerId, wrongAnswersCount);
    setShowRouletteModal(false);
    setActiveWildCard(null);
  };

  const handleFiftyFifty = async (playerId: string) => {
    if (!currentQuestion) return;

    // Get wrong answers (excluding correct answer)
    const wrongAnswers = ['A', 'B', 'C', 'D'].filter(letter => 
      letter !== currentQuestion.correct_answer_letter
    );

    // Randomly select 2 wrong answers
    const selectedWrongAnswers = wrongAnswers
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    setFiftyFiftyResult(selectedWrongAnswers);
  };

  const handleFiftyFiftyComplete = async () => {
    if (!activeWildCard || !fiftyFiftyResult) return;

    // Mark wild card as used
    await markWildCardAsUsed(activeWildCard.playerId, 'fifty_fifty', fiftyFiftyResult);

    // Notify player
    await notifyPlayer(activeWildCard.playerId, {
      type: 'fifty_fifty',
      wrongAnswers: fiftyFiftyResult
    });

    setShowFiftyFiftyModal(false);
    setActiveWildCard(null);
    setFiftyFiftyResult(null);
  };

  const handleRoulette = async (playerId: string, wrongAnswersCount: number) => {
    if (!currentQuestion) return;

    // Get wrong answers (excluding correct answer)
    const wrongAnswers = ['A', 'B', 'C', 'D'].filter(letter => 
      letter !== currentQuestion.correct_answer_letter
    );

    // Randomly select the number of wrong answers from roulette result
    const selectedWrongAnswers = wrongAnswers
      .sort(() => Math.random() - 0.5)
      .slice(0, wrongAnswersCount);

    // Mark wild card as used
    await markWildCardAsUsed(playerId, 'roulette', selectedWrongAnswers);

    // Notify player
    await notifyPlayer(playerId, {
      type: 'roulette',
      wrongAnswers: selectedWrongAnswers
    });
  };

  const markWildCardAsUsed = async (playerId: string, type: string, wrongAnswers?: string[]) => {
    const updateData: any = {
      [`${type}_available`]: false,
      [`${type}_used_at`]: new Date().toISOString()
    };

    if (wrongAnswers) {
      updateData[`${type}_wrong_answers`] = wrongAnswers;
    }

    const { error } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId);

    if (error) {
      console.error('Error marking wild card as used:', error);
    } else {
      // Update local state immediately
      setLocalPlayers(prev => prev.map(player => 
        player.id === playerId 
          ? { ...player, ...updateData }
          : player
      ));
    }
  };

  const reviveWildCard = async (playerId: string, type: string) => {
    const updateData: any = {
      [`${type}_available`]: true,
      [`${type}_used_at`]: null
    };

    // Only include wrong_answers fields for 50/50 and roulette
    if (type === 'fifty_fifty' || type === 'roulette') {
      updateData[`${type}_wrong_answers`] = null;
    }

    const { error } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId);

    if (error) {
      console.error('Error reviving wild card:', error);
    } else {
      // Update local state immediately
      setLocalPlayers(prev => prev.map(player => 
        player.id === playerId 
          ? { ...player, ...updateData }
          : player
      ));

      // Notify the player that their wild card has been revived
      await notifyPlayer(playerId, {
        type: 'wild_card_revived',
        wildCardType: type
      });
    }
  };

  const notifyPlayer = async (playerId: string, data: any) => {
    const playerChannel = `${getGameChannel(gameId)}_${playerId}`;
    
    try {
      console.log('Sending wildcard notification to player:', playerId, 'on channel:', playerChannel, 'with data:', data);
      
      const response = await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: playerChannel,
          event: GAME_EVENTS.WILD_CARD_RESULT,
          data
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send wildcard notification:', errorData);
        throw new Error(`Failed to send notification: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log('Wildcard notification sent successfully:', result);
    } catch (error) {
      console.error('Error sending wildcard notification:', error);
      // You might want to show a toast or alert to the host here
    }
  };

  const getWildCardIcon = (type: string) => {
    switch (type) {
      case 'phone_call': return '📞';
      case 'phone_search': return '🔍';
      case 'fifty_fifty': return '50:50';
      case 'roulette': return '🎰';
      default: return '❓';
    }
  };

  const getWildCardName = (type: string) => {
    switch (type) {
      case 'phone_call': return 'Llamada Telefónica';
      case 'phone_search': return 'Búsqueda en Internet';
      case 'fifty_fifty': return '50/50';
      case 'roulette': return 'Ruleta';
      default: return 'Desconocido';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comodines</h3>
      
      {localPlayers.map((player) => (
        <Card key={player.id} className="p-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{player.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'phone_call', available: player.phone_call_available },
                { type: 'phone_search', available: player.phone_search_available },
                { type: 'fifty_fifty', available: player.fifty_fifty_available },
                { type: 'roulette', available: player.roulette_available }
              ].map(({ type, available }) => (
                <div key={type} className="flex flex-col space-y-1">
                  <Button
                    variant={available ? "default" : "secondary"}
                    size="sm"
                    disabled={!available}
                    onClick={() => handleWildCardRequest(player.id, player.name, type as any)}
                    className="justify-start"
                  >
                    <span className="mr-2">{getWildCardIcon(type)}</span>
                    {getWildCardName(type)}
                    {!available && <Badge variant="outline" className="ml-auto">Usado</Badge>}
                  </Button>
                  {!available && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reviveWildCard(player.id, type)}
                      className="text-xs h-6"
                    >
                      🔄 Revivir
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Timer Modal for Phone Call and Phone Search */}
      <TimerModal
        isOpen={showTimerModal}
        onClose={() => {
          setShowTimerModal(false);
          setActiveWildCard(null);
        }}
        title={`${activeWildCard?.playerName} - ${getWildCardName(timerType)}`}
        duration={timerType === 'phone_call' ? 45 : 35}
        onComplete={handleTimerComplete}
      />

      {/* 50/50 Modal */}
      {showFiftyFiftyModal && fiftyFiftyResult && (
        <Dialog open={showFiftyFiftyModal} onOpenChange={() => setShowFiftyFiftyModal(false)}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-center">
                {activeWildCard?.playerName} - 50/50
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex flex-col items-center space-y-6 py-4">
              <div className="text-center">
                <div className="text-lg font-semibold mb-4">
                  Respuestas incorrectas eliminadas:
                </div>
                <div className="flex gap-4 justify-center">
                  {fiftyFiftyResult.map((answer, index) => (
                    <Badge key={index} variant="destructive" className="text-lg px-4 py-2">
                      {answer}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2 w-full">
                <Button onClick={handleFiftyFiftyComplete} className="w-full">
                  Finalizar Comodín
                </Button>
                <Button 
                  onClick={() => setShowFiftyFiftyModal(false)} 
                  variant="outline" 
                  className="w-full"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Roulette Modal */}
      <RouletteModal
        isOpen={showRouletteModal}
        onClose={() => {
          setShowRouletteModal(false);
          setActiveWildCard(null);
        }}
        onResult={handleRouletteResult}
      />
    </div>
  );
} 