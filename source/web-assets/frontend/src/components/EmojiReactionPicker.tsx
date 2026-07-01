
import { useState } from 'react';

const COMMON_EMOJIS = [
  '❤️', '😂', '😍', '🔥', '👍', '👏', 
  '😊', '🎉', '😢', '😮', '😎', '🤔',
  '💯', '✨', '🙏', '💪', '🎊', '😘'
];

export interface EmojiReactionPickerProps {
  messageId: string;
  onReact: (messageId: string, emoji: string, action: 'add' | 'remove') => void | Promise<void>;
  currentReactions?: Record<string, string[]>;
  currentUserId?: string;
}

export default function EmojiReactionPicker({ messageId, onReact, currentReactions = {}, currentUserId }: EmojiReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReact = async (emoji: string) => {
    // Check if user already reacted with this emoji
    const userReacted = currentUserId ? currentReactions[emoji]?.includes(currentUserId) : false;
    
    if (userReacted) {
      // Remove reaction
      await onReact(messageId, emoji, 'remove');
    } else {
      // Add reaction
      await onReact(messageId, emoji, 'add');
    }
    
    setShowPicker(false);
  };

  return (
    <div className="relative">
      {/* Reaction Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="text-gray-400 hover:text-cyan-400 transition-colors"
        title="Add reaction"
      >
        😊
      </button>

      {/* Emoji Picker Popup */}
      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3 shadow-lg z-50">
            <div className="grid grid-cols-6 gap-2">
              {COMMON_EMOJIS.map((emoji) => {
                const userReacted = currentReactions[emoji]?.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`text-2xl hover:scale-125 transition-transform ${
                      userReacted ? 'bg-cyan-500/20 rounded' : ''
                    }`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Display Reactions */}
      {Object.keys(currentReactions).length > 0 && (
        <div className="flex gap-1 mt-1">
          {(Object.entries(currentReactions) as Array<[string, string[]]>).map(([emoji, userIds]) => {
            if (!userIds || userIds.length === 0) return null;
            const userReacted = currentUserId ? userIds.includes(currentUserId) : false;
            
            return (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  userReacted
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                <span>{emoji}</span>
                <span className="font-semibold">{userIds.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
