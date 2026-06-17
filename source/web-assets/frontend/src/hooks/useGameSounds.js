// Sound Effects Hook for Games
import { useCallback, useRef } from 'react';

// Sound effect URLs (using Web Audio API with data URLs for instant playback)
const SOUNDS = {
  diceRoll: {
    frequency: 200,
    duration: 0.2,
    type: 'square'
  },
  move: {
    frequency: 440,
    duration: 0.1,
    type: 'sine'
  },
  capture: {
    frequency: 600,
    duration: 0.15,
    type: 'sawtooth'
  },
  win: {
    frequencies: [523, 659, 784, 1047],
    duration: 0.3,
    type: 'sine'
  },
  lose: {
    frequencies: [400, 350, 300],
    duration: 0.4,
    type: 'triangle'
  },
  click: {
    frequency: 800,
    duration: 0.05,
    type: 'sine'
  },
  notification: {
    frequency: 880,
    duration: 0.1,
    type: 'sine'
  }
};

export function useGameSounds(enabled = true) {
  const audioContext = useRef(null);

  // Initialize audio context on first use
  const getAudioContext = useCallback(() => {
    if (!audioContext.current && typeof window !== 'undefined') {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext.current;
  }, []);

  const playSound = useCallback((soundType) => {
    if (!enabled) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const sound = SOUNDS[soundType];
      if (!sound) return;

      if (Array.isArray(sound.frequencies)) {
        // Play sequence of tones (for win/lose)
        sound.frequencies.forEach((freq, index) => {
          setTimeout(() => {
            playTone(ctx, freq, sound.duration, sound.type);
          }, index * sound.duration * 1000);
        });
      } else {
        // Play single tone
        playTone(ctx, sound.frequency, sound.duration, sound.type);
      }
    } catch (error) {
    }
  }, [enabled, getAudioContext]);

  const playTone = (ctx, frequency, duration, type) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  };

  return {
    playDiceRoll: () => playSound('diceRoll'),
    playMove: () => playSound('move'),
    playCapture: () => playSound('capture'),
    playWin: () => playSound('win'),
    playLose: () => playSound('lose'),
    playClick: () => playSound('click'),
    playNotification: () => playSound('notification'),
  };
}
