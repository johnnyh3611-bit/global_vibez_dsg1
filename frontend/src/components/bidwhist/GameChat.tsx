import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Quick-pick emoji palette for the inline picker (input bar) AND for
// per-message reactions. Kept short so it fits the cyan glass aesthetic.
const QUICK_EMOJIS = [
  '❤️', '😂', '😍', '🔥', '👍', '👏',
  '😊', '🎉', '😢', '😮', '😎', '🤔',
  '💯', '✨', '🙏', '💪', '🎊', '😘',
  '♠️', '♥️', '♣️', '♦️', '🃏', '🎲',
];

type ChatMessage = {
  id?: string;
  sender: string;
  text: string;
  time: string;
  timestamp?: number;
  reactions?: Record<string, string[]>; // emoji → list of user names
};

export default function GameChat({
  gameId,
  playerName,
  socket,
  onClose,
  onNewMessage,
}: {
  gameId?: any;
  playerName?: any;
  socket?: any;
  onClose?: any;
  onNewMessage?: any;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-welcome',
      sender: 'System',
      text: 'Game started! Good luck!',
      time: new Date().toLocaleTimeString(),
      reactions: {},
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for new messages + reactions via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { message: ChatMessage }) => {
      setMessages((prev) => [...prev, { ...data.message, reactions: data.message.reactions || {} }]);
      if (onNewMessage) onNewMessage();
    };

    const handleReaction = (data: {
      message_id: string;
      emoji: string;
      user: string;
      action: 'add' | 'remove';
    }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== data.message_id) return m;
          const reactions = { ...(m.reactions || {}) };
          const current = reactions[data.emoji] || [];
          if (data.action === 'add') {
            if (!current.includes(data.user)) reactions[data.emoji] = [...current, data.user];
          } else {
            const next = current.filter((u) => u !== data.user);
            if (next.length) reactions[data.emoji] = next;
            else delete reactions[data.emoji];
          }
          return { ...m, reactions };
        })
      );
    };

    socket.on('game_chat', handleNewMessage);
    socket.on('game_chat_reaction', handleReaction);

    return () => {
      socket.off('game_chat', handleNewMessage);
      socket.off('game_chat_reaction', handleReaction);
    };
  }, [socket, onNewMessage]);

  const insertEmoji = (emoji: string) => {
    setInputMessage((prev) => prev + emoji);
    setShowPicker(false);
  };

  const handleSendMessage = () => {
    const text = inputMessage.trim();
    if (!text) return;

    const newMessage: ChatMessage = {
      id: `${playerName}-${Date.now()}`,
      sender: playerName,
      text,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      reactions: {},
    };

    setMessages((prev) => [...prev, newMessage]);

    if (socket) {
      socket.emit('game_chat', { game_id: gameId, message: newMessage });
    }

    setInputMessage('');
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const current = reactions[emoji] || [];
        const had = current.includes(playerName);
        const action: 'add' | 'remove' = had ? 'remove' : 'add';
        if (had) {
          const next = current.filter((u) => u !== playerName);
          if (next.length) reactions[emoji] = next;
          else delete reactions[emoji];
        } else {
          reactions[emoji] = [...current, playerName];
        }
        if (socket) {
          socket.emit('game_chat_reaction', {
            game_id: gameId,
            message_id: messageId,
            emoji,
            user: playerName,
            action,
          });
        }
        return { ...m, reactions };
      })
    );
    setReactionPickerForId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 400 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 400 }}
        className="fixed right-6 top-24 z-40 w-80 h-96 bg-slate-900/95 backdrop-blur-xl rounded-2xl border-2 border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden"
        data-testid="game-chat-panel"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-white" />
            <h3 className="font-bold text-white">Game Chat</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white"
            aria-label="Close chat"
            data-testid="game-chat-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg, idx) => {
            const mid = msg.id || `msg-${msg.timestamp || idx}`;
            const reactionEntries = Object.entries(msg.reactions || {});
            return (
              <motion.div
                key={mid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group relative ${
                  msg.sender === 'System'
                    ? 'bg-amber-900/20 border-l-4 border-amber-500'
                    : msg.sender === playerName
                    ? 'bg-cyan-900/30 border-l-4 border-cyan-500'
                    : 'bg-slate-800/50 border-l-4 border-slate-600'
                } p-3 rounded-lg`}
                data-testid={`game-chat-msg-${idx}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-cyan-300">{msg.sender}</span>
                  <span className="text-[10px] text-slate-500">{msg.time}</span>
                </div>
                <p className="text-sm text-slate-200 break-words">{msg.text}</p>

                {/* React-button (visible on hover or when picker is open for this msg) */}
                {msg.sender !== 'System' && (
                  <button
                    onClick={() =>
                      setReactionPickerForId(reactionPickerForId === mid ? null : mid)
                    }
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800/95 border border-cyan-500/40 text-slate-300 hover:text-cyan-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label="React with emoji"
                    data-testid={`game-chat-react-btn-${idx}`}
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Reaction picker popover for this message */}
                {reactionPickerForId === mid && (
                  <div
                    className="absolute right-0 -top-12 z-50 bg-slate-950/95 border border-cyan-500/40 rounded-xl px-2 py-1.5 shadow-xl flex gap-1 flex-wrap max-w-[14rem]"
                    data-testid={`game-chat-react-picker-${idx}`}
                  >
                    {QUICK_EMOJIS.slice(0, 12).map((e) => (
                      <button
                        key={e}
                        onClick={() => toggleReaction(mid, e)}
                        className="text-lg hover:scale-125 transition-transform leading-none"
                        aria-label={`React ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                {/* Inline reaction badges */}
                {reactionEntries.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {reactionEntries.map(([emoji, users]) => {
                      const mine = users.includes(playerName);
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(mid, emoji)}
                          className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                            mine
                              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                              : 'bg-slate-800/60 border-slate-600/40 text-slate-300 hover:bg-cyan-500/10'
                          }`}
                          title={users.join(', ')}
                        >
                          {emoji} {users.length}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Inline emoji picker (input bar) */}
        {showPicker && (
          <div
            className="px-3 pb-2 flex flex-wrap gap-1 bg-slate-800/70 border-t border-cyan-500/20"
            data-testid="game-chat-emoji-picker"
          >
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => insertEmoji(e)}
                className="text-xl hover:scale-125 transition-transform leading-none p-1"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 bg-slate-800/50 border-t border-slate-700">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowPicker((v) => !v)}
              className={`p-2 rounded-lg transition-colors ${
                showPicker
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-700/40'
              }`}
              aria-label="Toggle emoji picker"
              data-testid="game-chat-emoji-toggle"
            >
              <Smile className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message…"
              className="flex-1 bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-cyan-500 focus:outline-none text-sm"
              data-testid="game-chat-input"
            />
            <Button
              onClick={handleSendMessage}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
              data-testid="game-chat-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
