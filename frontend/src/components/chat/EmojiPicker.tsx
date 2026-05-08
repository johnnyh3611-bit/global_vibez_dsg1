import { useState } from 'react';
import { motion } from 'framer-motion';
import { Smile } from 'lucide-react';

/**
 * Inline emoji shortcodes — `:vibez_fire:` becomes an <img> in chat messages.
 * Kept in sync with /app/backend/utils/emoji_manifest.py.
 */
export const EMOJI_MANIFEST: Record<string, { label: string; premium: boolean; fallback: string }> = {
  vibez_fire:     { label: 'Vibez Fire',     premium: false, fallback: '🔥' },
  vibez_crown:    { label: 'Vibez Crown',    premium: true,  fallback: '👑' },
  vibez_dice:     { label: 'Vibez Dice',     premium: false, fallback: '🎲' },
  vibez_coin:     { label: 'Vibez Coin',     premium: false, fallback: '🪙' },
  vibez_lightning:{ label: 'Lightning',      premium: false, fallback: '⚡' },
  solar_flare:    { label: 'Solar Flare',    premium: true,  fallback: '☀️' },
  glass_whist:    { label: 'Glasshouse',     premium: true,  fallback: '💎' },
  nova_dealer:    { label: 'Nova Dealer',    premium: true,  fallback: '✨' },
  bid_win:        { label: 'Bid Won',        premium: false, fallback: '🎯' },
  trick_take:     { label: 'Trick Take',     premium: false, fallback: '🃏' },
  all_in:         { label: 'All-In',         premium: false, fallback: '🚀' },
  knock:          { label: 'Knock',          premium: false, fallback: '🚪' },
};

const EMOJI_RE = /:([a-z_]+):/g;

/**
 * MessageRenderer — replaces `:code:` tokens with rendered emojis.
 * Uses Unicode fallback (no asset files required on day 1).
 */
export function MessageRenderer({ text }: { text: string }) {
  const parts: (string | { code: string; fallback: string })[] = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(EMOJI_RE);
  while ((match = re.exec(text)) !== null) {
    const code = match[1];
    if (code in EMOJI_MANIFEST) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push({ code, fallback: EMOJI_MANIFEST[code].fallback });
      lastIndex = match.index + match[0].length;
    }
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  if (parts.length === 0) parts.push(text);

  return (
    <span data-testid="message-renderer">
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <span
            key={i}
            className="inline-block mx-0.5 drop-shadow-[0_0_4px_rgba(168,85,247,0.4)]"
            title={`:${p.code}:`}
            data-testid={`emoji-${p.code}`}
          >
            {/* Prefer a GIF asset if present (set `window.__VIBEZ_EMOJI_ASSETS_READY = true` once /assets/emojis/*.gif are shipped); fall back to Unicode. */}
            {typeof window !== 'undefined' && (window as any).__VIBEZ_EMOJI_ASSETS_READY ? (
              <img
                src={`/assets/emojis/${p.code}.gif`}
                alt={`:${p.code}:`}
                className="inline-block w-6 h-6 align-middle"
                onError={(e) => {
                  // Graceful fallback if an asset is missing
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).insertAdjacentText('afterend', p.fallback);
                }}
              />
            ) : (
              p.fallback
            )}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * EmojiPicker — dropdown that inserts a shortcode into the current message input.
 */
export function EmojiPicker({
  onPick,
  isPremium,
}: {
  onPick: (code: string) => void;
  isPremium?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        data-testid="emoji-picker-toggle"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full hover:bg-white/10 transition"
        aria-label="Open emoji picker"
      >
        <Smile className="w-5 h-5 text-slate-300" />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900/95 backdrop-blur border border-purple-500/40 rounded-xl p-3 shadow-2xl grid grid-cols-4 gap-2 z-50"
          data-testid="emoji-picker-panel"
        >
          {Object.entries(EMOJI_MANIFEST).map(([code, meta]) => {
            const locked = meta.premium && !isPremium;
            return (
              <motion.button
                key={code}
                whileHover={!locked ? { scale: 1.2, rotate: 5 } : undefined}
                whileTap={!locked ? { scale: 0.95 } : undefined}
                onClick={() => {
                  if (locked) return;
                  onPick(`:${code}:`);
                  setOpen(false);
                }}
                data-testid={`emoji-pick-${code}`}
                title={locked ? `${meta.label} (Premium)` : meta.label}
                className={`aspect-square text-2xl rounded-lg flex items-center justify-center transition ${
                  locked ? 'grayscale opacity-40 cursor-not-allowed' : 'hover:bg-purple-500/20 cursor-pointer'
                }`}
              >
                {meta.fallback}
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
