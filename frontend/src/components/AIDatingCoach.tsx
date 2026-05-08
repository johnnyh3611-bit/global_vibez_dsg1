
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { Bot, Mic, MicOff, Lightbulb, TrendingUp, MessageCircle, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * AI Dating Coach - Real-time conversation suggestions
 * Powered by GPT-5.1 via Emergent LLM Key
 */
export const AIDatingCoach = ({ 
  matchProfile, 
  conversationHistory = [],
  isActive = true,
  position = 'bottom-right' 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [currentTip, setCurrentTip] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (isActive && conversationHistory.length > 0) {
      getAISuggestions();
    }
  }, [conversationHistory]);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        analyzeConversation(transcript);
      };
    }
  }, []);

  const getAISuggestions = async () => {
    try {
      const response = await fetch(`${API}/api/ai/dating-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          match_profile: matchProfile,
          conversation_history: conversationHistory.slice(-10), // Last 10 messages
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        if (data.current_tip) {
          setCurrentTip(data.current_tip);
        }
      }
    } catch (error) {
      // console.error('AI Coach error:', error);
    }
  };

  const analyzeConversation = (transcript) => {
    // Real-time conversation analysis
    // Triggers new suggestions based on what's being said
    if (transcript.length > 50) {
      getAISuggestions();
    }
  };

  const startListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const positionClasses = {
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'top-right': 'fixed top-20 right-4 z-50',
  };

  if (!isActive) return null;

  return (
    <div className={positionClasses[position]}>
      <AnimatePresence>
        {!minimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            <GlassCard className="w-80 max-h-96 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-400" />
                  <h3 className="text-white font-semibold">AI Dating Coach</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`p-2 rounded-lg transition-colors ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setMinimized(true)}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Current Tip */}
              {currentTip && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-white/10"
                >
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white text-sm font-medium mb-1">💡 Pro Tip</p>
                      <p className="text-slate-300 text-xs">{currentTip}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Suggestions */}
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {suggestions.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Start chatting to get AI suggestions</p>
                  </div>
                )}

                {suggestions.map((suggestion, idx) => (
                  <motion.div
                    key={`suggestions-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group"
                  >
                    <button
                      onClick={() => {
                        // Copy to clipboard or insert into chat
                        navigator.clipboard.writeText(suggestion.text);
                      }}
                      className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-all border border-white/5 hover:border-purple-500/50"
                    >
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-white text-sm">{suggestion.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">{suggestion.category}</span>
                            <span className="text-xs text-green-400">
                              {suggestion.confidence}% match
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-white/10 bg-slate-900/50">
                <p className="text-xs text-slate-400 text-center">
                  {isListening ? '🎤 Listening to conversation...' : 'Powered by AI • Click mic to enable'}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized Button */}
      {minimized && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setMinimized(false)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/50 hover:scale-110 transition-transform"
        >
          <Bot className="w-7 h-7 text-white" />
        </motion.button>
      )}
    </div>
  );
};

export default AIDatingCoach;
