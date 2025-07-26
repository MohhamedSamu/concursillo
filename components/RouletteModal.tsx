'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface RouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (wrongAnswersCount: number) => void;
}

export default function RouletteModal({ isOpen, onClose, onResult }: RouletteModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Roulette segments: Updated to match visual layout from top, clockwise
  // Based on image: Light Green (2), Yellow (3), Pink (1), Light Green (2), Pink (1), Red (0), etc.
  const segments = [2, 3, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1];
  const colors = ['#90EE90', '#FFFF00', '#FF6B9D', '#90EE90', '#FF6B9D', '#FF2900', '#90EE90', '#FF6B9D', '#90EE90', '#FF2900', '#FF6B9D', '#90EE90', '#FF6B9D', '#FF2900', '#90EE90', '#FF6B9D'];

  useEffect(() => {
    if (!isOpen) {
      setRotation(0);
      setResult(null);
      setIsSpinning(false);
      setManualInput('');
    }
  }, [isOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw segments
    const segmentAngle = (2 * Math.PI) / segments.length;
    
    segments.forEach((number, index) => {
      const startAngle = index * segmentAngle + rotation;
      const endAngle = (index + 1) * segmentAngle + rotation;
      
      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[index];
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw number
      const textAngle = startAngle + segmentAngle / 2;
      const textX = centerX + (radius * 0.7) * Math.cos(textAngle);
      const textY = centerY + (radius * 0.7) * Math.sin(textAngle);
      
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(textAngle + Math.PI / 2);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number.toString(), 0, 0);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw center icon (X with circle)
    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', centerX, centerY);

    // Draw pointer at the top (12 o'clock position) pointing inward (downward)
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY - radius - 10);
    ctx.lineTo(centerX + 15, centerY - radius - 10);
    ctx.lineTo(centerX, centerY - radius + 10);
    ctx.closePath();
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [rotation, isOpen]);

  const spinRoulette = () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    setResult(null);
    setManualInput('');
    
    // Random number of full rotations (3-5) plus random segment
    const fullRotations = Math.random() * 2 + 3; // 3-5 full rotations
    const randomSegment = Math.random() * segments.length;
    const targetRotation = -(fullRotations * 2 * Math.PI + randomSegment * (2 * Math.PI / segments.length));
    
    // Animate rotation
    const startRotation = rotation;
    const startTime = Date.now();
    const duration = 5000; // 5 seconds for animation
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentRotation = startRotation + (targetRotation - startRotation) * easeOut;
      setRotation(currentRotation);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
      }
    };
    
    requestAnimationFrame(animate);
  };

  const handleManualSubmit = () => {
    const inputValue = parseInt(manualInput);
    if (!isNaN(inputValue) && inputValue >= 0 && inputValue <= 3) {
      setResult(inputValue);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-center">Comodín Ruleta</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="border-2 border-gray-300 rounded-full"
            />
          </div>
          
          {!isSpinning && result === null && (
            <Button 
              onClick={spinRoulette}
              className="w-full"
              size="lg"
            >
              Girar Ruleta
            </Button>
          )}
          
          {isSpinning && (
            <div className="text-center text-lg font-semibold">
              Girando...
            </div>
          )}
          
          {!isSpinning && result === null && (
            <div className="w-full space-y-4">
              <div className="text-center text-sm text-gray-600">
                ¿Qué número ves en el segmento donde se detuvo la ruleta?
              </div>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="3"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="0, 1, 2, o 3"
                  className="flex-1"
                />
                <Button onClick={handleManualSubmit} disabled={!manualInput}>
                  Confirmar
                </Button>
              </div>
            </div>
          )}
          
          {result !== null && (
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">
                Resultado: {result} respuestas incorrectas
              </div>
              <div className="space-y-2">
                <Button onClick={() => onResult(result)} className="w-full">
                  Finalizar Comodín
                </Button>
                <Button onClick={onClose} variant="outline" className="w-full">
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 