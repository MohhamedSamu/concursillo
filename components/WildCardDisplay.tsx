'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Phone, Search, Minus, RotateCcw } from 'lucide-react';

interface WildCardDisplayProps {
  playerId: string;
  gameId: string;
  playerData?: any; // Add player data prop
  onWildCardResult?: (data: any) => void;
}

interface WildCardData {
  phone_call_available: boolean;
  phone_search_available: boolean;
  fifty_fifty_available: boolean;
  roulette_available: boolean;
  fifty_fifty_wrong_answers: string[] | null;
  roulette_wrong_answers: string[] | null;
}

export default function WildCardDisplay({ playerId, gameId, playerData, onWildCardResult }: WildCardDisplayProps) {
  const [wildCardData, setWildCardData] = useState<WildCardData | null>(null);
  const [activeWildCard, setActiveWildCard] = useState<{
    type: string;
    wrongAnswers?: string[];
    wildCardType?: string;
  } | null>(null);

  // Use playerData prop if provided, otherwise load from API
  useEffect(() => {
    if (playerData) {
      // Use the player data from props
      setWildCardData({
        phone_call_available: playerData.phone_call_available,
        phone_search_available: playerData.phone_search_available,
        fifty_fifty_available: playerData.fifty_fifty_available,
        roulette_available: playerData.roulette_available,
        fifty_fifty_wrong_answers: playerData.fifty_fifty_wrong_answers,
        roulette_wrong_answers: playerData.roulette_wrong_answers
      });
    } else {
      // Fallback to loading from API
      loadWildCardData();
    }
  }, [playerData, playerId]);

  // Handle wild card result from props
  useEffect(() => {
    if (onWildCardResult) {
      handleWildCardResult(onWildCardResult);
    }
  }, [onWildCardResult]);

  useEffect(() => {
    if (!playerData) {
      loadWildCardData();
      setupPusherSubscription();
    }
  }, [playerId, gameId, playerData]);

  const loadWildCardData = async () => {
    try {
      const response = await fetch(`/api/players/${playerId}/wildcards`);
      if (response.ok) {
        const data = await response.json();
        setWildCardData(data);
      }
    } catch (error) {
      console.error('Error loading wild card data:', error);
    }
  };

  const setupPusherSubscription = () => {
    // This would be set up in the parent component that manages Pusher
    // For now, we'll handle it through props or context
  };

  const handleWildCardResult = (data: any) => {
    console.log('WildCardDisplay received result:', data);
    
    if (data.type === 'fifty_fifty' || data.type === 'roulette') {
      setActiveWildCard({
        type: data.type,
        wrongAnswers: data.wrongAnswers
      });
    } else if (data.type === 'phone_call' || data.type === 'phone_search') {
      if (data.completed) {
        setActiveWildCard({
          type: data.type
        });
        // Clear after a few seconds
        setTimeout(() => setActiveWildCard(null), 3000);
      }
    } else if (data.type === 'wild_card_revived') {
      console.log('Wild card revived in display:', data.wildCardType);
      // Reload wild card data when a wild card is revived
      loadWildCardData();
      // Show a brief visual feedback
      setActiveWildCard({
        type: 'revived',
        wildCardType: data.wildCardType
      });
      setTimeout(() => setActiveWildCard(null), 2000);
    }
    
    // Call the parent callback if provided
    if (onWildCardResult) {
      onWildCardResult(data);
    }
  };

  const getWildCardIcon = (type: string) => {
    switch (type) {
      case 'phone_call': return <Phone className="w-4 h-4" />;
      case 'phone_search': return <Search className="w-4 h-4" />;
      case 'fifty_fifty': return <Minus className="w-4 h-4" />;
      case 'roulette': return <RotateCcw className="w-4 h-4" />;
      default: return null;
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

  const getWildCardDescription = (type: string) => {
    switch (type) {
      case 'phone_call': return '45 segundos para llamar a un amigo';
      case 'phone_search': return '35 segundos para buscar en internet';
      case 'fifty_fifty': return 'Eliminar 2 respuestas incorrectas';
      case 'roulette': return 'Número aleatorio de respuestas incorrectas eliminadas';
      default: return '';
    }
  };

  if (!wildCardData) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comodines</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {[
          { type: 'phone_call', available: wildCardData.phone_call_available },
          { type: 'phone_search', available: wildCardData.phone_search_available },
          { type: 'fifty_fifty', available: wildCardData.fifty_fifty_available },
          { type: 'roulette', available: wildCardData.roulette_available }
        ].map(({ type, available }) => (
          <Card key={type} className={`${!available ? 'opacity-50' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {getWildCardIcon(type)}
                {getWildCardName(type)}
                {!available && <Badge variant="outline" className="text-xs">Usado</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                {getWildCardDescription(type)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Wild Card Results */}
      {activeWildCard && (
        <Card className="border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="text-sm text-green-700">
              {activeWildCard.type === 'revived' 
                ? `¡Comodín ${activeWildCard.wildCardType === 'fifty_fifty' ? '50/50' : activeWildCard.wildCardType === 'roulette' ? 'Ruleta' : activeWildCard.wildCardType} Revivido!`
                : `${getWildCardName(activeWildCard.type)} Result:`
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeWildCard.type === 'phone_call' && (
              <p className="text-sm">¡Tiempo de llamada terminado!</p>
            )}
            {activeWildCard.type === 'phone_search' && (
              <p className="text-sm">¡Tiempo de búsqueda terminado!</p>
            )}
            {activeWildCard.type === 'fifty_fifty' && activeWildCard.wrongAnswers && (
              <div>
                <p className="text-sm mb-2">Respuestas incorrectas eliminadas:</p>
                <div className="flex gap-2">
                  {activeWildCard.wrongAnswers.map((answer, index) => (
                    <Badge key={index} variant="destructive" className="text-sm">
                      {answer}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {activeWildCard.type === 'roulette' && activeWildCard.wrongAnswers && (
              <div>
                <p className="text-sm mb-2">Respuestas incorrectas eliminadas:</p>
                <div className="flex gap-2">
                  {activeWildCard.wrongAnswers.map((answer, index) => (
                    <Badge key={index} variant="destructive" className="text-sm">
                      {answer}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {activeWildCard.type === 'revived' && (
              <p className="text-sm text-green-600">¡Tu comodín está disponible nuevamente!</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 