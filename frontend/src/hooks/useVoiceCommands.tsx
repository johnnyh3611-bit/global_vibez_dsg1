
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Volume2, Command } from 'lucide-react';

/**
 * Voice Command System - Control everything with your voice
 * "Play Ace of Spades", "Swipe right", "Bid 5"
 */
export const useVoiceCommands = (onCommand) => {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event) => {
      const last = event.results.length - 1;
      const command = event.results[last][0].transcript.toLowerCase().trim();
      
      setLastCommand(command);
      processCommand(command);
    };

    recognitionRef.current.onerror = (event) => {
      // console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Auto-restart if no speech detected
        setTimeout(() => {
          if (isListening) {
            recognitionRef.current?.start();
          }
        }, 1000);
      }
    };

    recognitionRef.current.onend = () => {
      // Auto-restart if still in listening mode
      if (isListening) {
        try {
          recognitionRef.current?.start();
        } catch (e) {
          // console.error('Restart error:', e);
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const processCommand = (command) => {
    // Game commands
    if (command.includes('play') || command.includes('place')) {
      const cardMatch = command.match(/(ace|king|queen|jack|[\d]+)\s*(of\s*)?(spades|hearts|diamonds|clubs)/i);
      if (cardMatch) {
        onCommand({ 
          type: 'play_card', 
          card: { rank: cardMatch[1], suit: cardMatch[3] } 
        });
        speak('Playing card');
        return;
      }
    }

    // Bidding
    if (command.includes('bid')) {
      const bidMatch = command.match(/bid\s*(\d+)/i);
      if (bidMatch) {
        onCommand({ type: 'bid', amount: parseInt(bidMatch[1]) });
        speak(`Bidding ${bidMatch[1]}`);
        return;
      }
    }

    // Swiping
    if (command.includes('swipe right') || command.includes('like')) {
      onCommand({ type: 'swipe', action: 'like' });
      speak('Swiped right');
      return;
    }

    if (command.includes('swipe left') || command.includes('pass')) {
      onCommand({ type: 'swipe', action: 'pass' });
      speak('Passed');
      return;
    }

    // Navigation
    if (command.includes('go to') || command.includes('open')) {
      if (command.includes('game')) {
        onCommand({ type: 'navigate', to: '/games' });
        speak('Opening games');
        return;
      }
      if (command.includes('discover') || command.includes('swipe')) {
        onCommand({ type: 'navigate', to: '/discover' });
        speak('Opening discover');
        return;
      }
      if (command.includes('tournament')) {
        onCommand({ type: 'navigate', to: '/tournaments' });
        speak('Opening tournaments');
        return;
      }
    }

    // General
    if (command.includes('help')) {
      speak('Say: play card, bid number, swipe right, swipe left, or go to games');
      return;
    }

    // If no match, send raw command
    onCommand({ type: 'custom', command });
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.2;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startListening = () => {
    try {
      recognitionRef.current?.start();
      setIsListening(true);
      speak('Voice commands activated');
    } catch (error) {
      // console.error('Start listening error:', error);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    speak('Voice commands deactivated');
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    isListening,
    lastCommand,
    startListening,
    stopListening,
    toggleListening,
    speak
  };
};

/**
 * Voice Command UI Component
 */
export const VoiceCommandUI = ({ isListening, lastCommand, onToggle }) => {
  return (
    <div className="fixed bottom-20 right-4 z-50">
      <AnimatePresence>
        {lastCommand && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-2 mr-2"
          >
            <div className="bg-slate-900 backdrop-blur-lg border border-white/20 rounded-lg px-4 py-2 shadow-2xl">
              <div className="flex items-center gap-2">
                <Command className="w-4 h-4 text-blue-400" />
                <p className="text-white text-sm">{lastCommand}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onToggle}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${
          isListening
            ? 'bg-gradient-to-br from-red-500 to-pink-500 shadow-red-500/50 animate-pulse'
            : 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-blue-500/50'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isListening ? (
          <Volume2 className="w-8 h-8 text-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </motion.button>

      {isListening && (
        <motion.div
          className="absolute inset-0 rounded-full bg-red-500"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </div>
  );
};
