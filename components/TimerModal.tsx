'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

interface TimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  duration: number; // in seconds
  onComplete: () => void;
}

export default function TimerModal({ isOpen, onClose, title, duration, onComplete }: TimerModalProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(duration);
      setIsRunning(false);
      setIsCompleted(false);
    }
  }, [isOpen, duration]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setIsCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const startTimer = () => {
    setIsRunning(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((duration - timeLeft) / duration) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-4">
          <div className="text-6xl font-mono font-bold text-center">
            {formatTime(timeLeft)}
          </div>
          
          <Progress value={progress} className="w-full" />
          
          {!isRunning && !isCompleted && (
            <Button 
              onClick={startTimer}
              className="w-full"
              size="lg"
            >
              Iniciar Temporizador
            </Button>
          )}
          
          {isRunning && (
            <div className="text-center text-sm text-muted-foreground">
              Temporizador en ejecución...
            </div>
          )}
          
          {isCompleted && (
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600 mb-2">
                ¡Se acabó el tiempo!
              </div>
              <div className="space-y-2">
                <Button onClick={onComplete} className="w-full">
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