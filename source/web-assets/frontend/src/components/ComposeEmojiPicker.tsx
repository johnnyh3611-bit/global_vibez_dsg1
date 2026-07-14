/**
 * Compose-bar emoji picker: common unicode + Vibez shortcodes from
 * GET /api/messaging/emoji-manifest.
 */
import { useEffect, useState } from 'react';
import { authFetch } from '@/utils/secureAuth';

const API = process.env.REACT_APP_BACKEND_URL;

const COMMON_EMOJIS = [
  '❤️', '😂', '😍', '🔥', '👍', '👏',
  '😊', '🎉', '😢', '😮', '😎', '🤔',
  '💯', '✨', '🙏', '💪', '🎊', '😘',
];

export interface ComposeEmojiPickerProps {
  onPick: (token: string) => void;
  onClose: () => void;
}

export default function ComposeEmojiPicker({ onPick, onClose }: ComposeEmojiPickerProps) {
  const [vibez, setVibez] = useState<Array<{ code: string; shortcode: string; label?: string; unicode_fallback?: string; premium?: boolean }>>([]);

  useEffect(() => {
    authFetch(`${API}/api/messaging/emoji-manifest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.emojis)) setVibez(data.emojis);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-black/95 border border-cyan-500/40 rounded-2xl p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="compose-emoji-picker"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm tracking-wide">Emoji</h3>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white text-xs uppercase">
            Close
          </button>
        </div>

        <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Quick</p>
        <div className="grid grid-cols-6 gap-2 mb-4">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              className="text-2xl hover:scale-125 transition-transform p-1"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        {vibez.length > 0 && (
          <>
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Vibez codes</p>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {vibez.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onPick(item.shortcode || `:${item.code}:`)}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-left"
                  title={item.label || item.code}
                >
                  <span className="text-xl">{item.unicode_fallback || '✨'}</span>
                  <span className="text-[10px] text-cyan-200 truncate">
                    {item.shortcode || `:${item.code}:`}
                    {item.premium ? ' ★' : ''}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
