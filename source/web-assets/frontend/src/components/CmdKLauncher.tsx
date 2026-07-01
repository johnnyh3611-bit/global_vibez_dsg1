/**
 * CmdKLauncher — Spotlight-style global search modal.
 * Opens with Cmd+K (Mac) or Ctrl+K (Win/Linux) from anywhere on the
 * platform. Searches the Explore registry and navigates instantly.
 *
 * Mount once at the App shell level. Listens to a global keydown
 * handler. No prop wiring needed per-page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command } from 'lucide-react';
import { EXPLORE_REGISTRY } from '@/pages/Explore';

export default function CmdKLauncher() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EXPLORE_REGISTRY.slice(0, 10);
    return EXPLORE_REGISTRY.filter((e) => {
      const hay = `${e.title} ${e.subtitle} ${e.route} ${e.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 12);
  }, [query]);

  const go = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24"
      onClick={() => setOpen(false)}
      data-testid="cmdk-launcher"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-4 bg-[#0a0a14] border border-fuchsia-400/40 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="w-4 h-4 text-fuchsia-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[activeIdx]) go(results[activeIdx].route);
              }
            }}
            placeholder="Jump to any room… (Cmd+K)"
            className="flex-1 bg-transparent text-white outline-none text-sm"
            data-testid="cmdk-input"
          />
          <kbd className="text-[10px] uppercase tracking-widest text-white/40 px-2 py-0.5 rounded bg-white/5 border border-white/10">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto" data-testid="cmdk-results">
          {results.length === 0 ? (
            <p className="p-6 text-center text-xs text-white/40">
              No matches. Try a broader term.
            </p>
          ) : (
            results.map((e, idx) => {
              const isActive = idx === activeIdx;
              return (
                <button
                  key={e.route}
                  type="button"
                  onClick={() => go(e.route)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  data-testid={`cmdk-result-${idx}`}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                    isActive ? 'bg-fuchsia-500/20' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{e.title}</p>
                    <p className="text-[11px] text-white/50 truncate">{e.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-mono text-white/30 flex-shrink-0 ml-3">
                    {e.route}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40">
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" /> + K to toggle
          </span>
          <span>↑ ↓ to navigate · Enter to go</span>
        </div>
      </div>
    </div>
  );
}
