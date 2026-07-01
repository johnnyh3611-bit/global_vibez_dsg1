/**
 * InterestTagPicker — first-touch modal that fires the very first
 * time a user joins a Plex room. Captures 12-tag taxonomy → saves
 * to user profile → auto-passes to every future Plex join. This is
 * the missing fuel for the Affinity Engine (icebreaker → neon spark
 * → synergy flare).
 *
 * Persistence: localStorage `gv_user_interests` + (best-effort) PUT
 * /api/users/me. The Plex join flow reads localStorage on every join,
 * so the picker only ever shows once per device.
 */
import { useEffect, useState } from 'react';
import {
  Music2, Spade, Dice5, Crown, Coins, Trophy, Palette,
  Cpu, Plane, Pizza, Gamepad2, Dumbbell, Sparkles, CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'gv_user_interests';

export const INTEREST_TAGS = [
  { key: 'music', label: 'Music', Icon: Music2 },
  { key: 'cards', label: 'Cards', Icon: Spade },
  { key: 'dice', label: 'Dice', Icon: Dice5 },
  { key: 'chess', label: 'Chess', Icon: Crown },
  { key: 'crypto', label: 'Crypto', Icon: Coins },
  { key: 'sports', label: 'Sports', Icon: Trophy },
  { key: 'art', label: 'Art', Icon: Palette },
  { key: 'tech', label: 'Tech', Icon: Cpu },
  { key: 'travel', label: 'Travel', Icon: Plane },
  { key: 'food', label: 'Food', Icon: Pizza },
  { key: 'gaming', label: 'Gaming', Icon: Gamepad2 },
  { key: 'fitness', label: 'Fitness', Icon: Dumbbell },
];

export function loadStoredInterests(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function hasPickedInterests(): boolean {
  return loadStoredInterests().length > 0;
}

export default function InterestTagPicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (picked: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setPicked(loadStoredInterests());
  }, [open]);

  if (!open) return null;

  const toggle = (k: string) =>
    setPicked((prev) =>
      prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k],
    );

  const handleSave = async () => {
    setBusy(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(picked));
      // Best-effort sync to profile — non-blocking if endpoint is missing.
      const token = localStorage.getItem('auth_token');
      if (token) {
        fetch(`${API}/api/users/me/interests`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ interests: picked }),
        }).catch(() => undefined);
      }
      onClose(picked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="interest-tag-picker"
    >
      <Card className="max-w-lg w-full p-6 bg-gradient-to-br from-fuchsia-900/40 via-purple-900/40 to-slate-900 border border-fuchsia-400/40">
        <div className="text-center mb-4">
          <Sparkles className="w-8 h-8 mx-auto text-fuchsia-300" />
          <h2 className="text-xl font-black mt-2">Pick 3 vibes</h2>
          <p className="text-xs text-white/60 mt-1">
            Powers the Affinity Engine. We use overlap with other guests to set the room's ambient state.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="interest-tag-grid">
          {INTEREST_TAGS.map(({ key, label, Icon }) => {
            const isOn = picked.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                data-testid={`interest-chip-${key}`}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  isOn
                    ? 'bg-fuchsia-500/30 border-fuchsia-400/60 text-fuchsia-100 scale-105'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
                {isOn && <CheckCircle2 className="w-3 h-3 absolute mt-7" />}
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-white/40 text-center mt-3" data-testid="interest-picker-count">
          {picked.length} selected · pick at least 1
        </p>

        <div className="flex gap-2 mt-4">
          <Button
            variant="ghost"
            onClick={() => onClose([])}
            className="text-white/60 hover:text-white"
            data-testid="interest-picker-skip"
          >
            Skip
          </Button>
          <Button
            onClick={handleSave}
            disabled={busy || picked.length === 0}
            className="flex-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-black"
            data-testid="interest-picker-save"
          >
            Lock in vibes
          </Button>
        </div>
      </Card>
    </div>
  );
}
