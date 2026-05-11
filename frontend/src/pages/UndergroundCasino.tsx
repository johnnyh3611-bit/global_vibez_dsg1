/**
 * /underground-casino — Private high-limit lounge (founder ask 2026-05-10).
 *
 * Theme: deep-jewel velvet + brass + amber lighting (option 2a).
 * Stake floor: ₵5,000 minimum (option 1a).
 * Game lineup: everything from `/cyber-casino` but at higher-limit tables
 *   with a distinct theme overlay (option 3c). When player picks a game,
 *   they're routed to the existing room with a `?stake_floor=5000` query
 *   that the room's bet picker respects.
 *
 * Entry gate (password-style):
 *   • Player must possess at least ₵5,000 in their wallet to enter.
 *   • A short rules pass-phrase confirmation locks in stake-floor consent.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Diamond, Lock, Crown, Spade, Heart, Coins, Loader2, ArrowLeft } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const STAKE_FLOOR_VIBE = 5000;
const PASS_PHRASE = "I understand";

type Wallet = { credits_balance?: number; token_balance?: number };

const TABLES = [
  { id: "blackjack", label: "Velvet Blackjack", path: "/blackjack", icon: Spade, sub: "₵5k minimum · 1-deck table" },
  { id: "baccarat", label: "Sapphire Baccarat", path: "/baccarat", icon: Diamond, sub: "₵5k buy-in · single-shoe" },
  { id: "roulette", label: "Brass Roulette", path: "/practice/play/roulette", icon: Coins, sub: "₵5k inside max · European" },
  { id: "three-card-poker", label: "Garnet 3-Card", path: "/three-card-poker", icon: Heart, sub: "₵5k ante · pair-plus on" },
  { id: "vibez-654", label: "Obsidian 654", path: "/vibez-654", icon: Crown, sub: "₵5k stake · max 12 score" },
  { id: "lottery", label: "Quantum Vault", path: "/lottery", icon: Diamond, sub: "Multi-ticket bundles" },
];

export default function UndergroundCasino() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${API}/api/auth/me`);
        const d = await r.json();
        setWallet({ credits_balance: d?.credits_balance ?? 0, token_balance: d?.token_balance ?? 0 });
      } catch (e) {
        setError("Sign in to enter the lounge.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const balance = Math.max(wallet?.credits_balance ?? 0, wallet?.token_balance ?? 0);
  const passesGate = balance >= STAKE_FLOOR_VIBE && phrase.trim().toLowerCase() === PASS_PHRASE.toLowerCase();

  const handleEnter = () => {
    if (!passesGate) {
      setError(balance < STAKE_FLOOR_VIBE
        ? `Need at least ₵${STAKE_FLOOR_VIBE.toLocaleString()} on the table to enter.`
        : `Type "${PASS_PHRASE}" exactly.`);
      return;
    }
    setError(null);
    setUnlocked(true);
  };

  return (
    <div
      className="min-h-screen text-amber-50 relative overflow-x-hidden"
      style={{
        // Deep-jewel velvet base + amber-cast cigar-lounge feel.
        background: "radial-gradient(ellipse at top, #2a0810 0%, #150307 55%, #050203 100%)",
      }}
      data-testid="underground-casino-shell"
    >
      {/* Velvet vignette + brass particle layer */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, rgba(245,158,11,0.08), transparent 35%), radial-gradient(circle at 80% 70%, rgba(190,18,60,0.10), transparent 40%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-amber-700/30 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-amber-100/70 hover:text-amber-50" data-testid="ugc-back">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <h1 className="text-base md:text-xl tracking-[0.4em] uppercase font-black flex items-center gap-3" style={{ color: "#f5c177", textShadow: "0 0 24px rgba(245,158,11,0.45)" }}>
          <Diamond className="w-5 h-5" />
          The Underground
          <Diamond className="w-5 h-5" />
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-amber-200/40 hidden md:block">
          Private · ₵{STAKE_FLOOR_VIBE.toLocaleString()}+
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {!unlocked && (
          <div
            data-testid="ugc-entry-gate"
            className="rounded-3xl p-8 text-center"
            style={{
              background: "linear-gradient(180deg, rgba(58,18,26,0.85) 0%, rgba(28,8,12,0.95) 100%)",
              border: "1px solid rgba(245,158,11,0.35)",
              boxShadow: "0 0 80px -20px rgba(245,158,11,0.3), inset 0 0 60px -30px rgba(190,18,60,0.4)",
            }}
          >
            <Lock className="w-12 h-12 mx-auto" style={{ color: "#f5c177" }} />
            <h2 className="text-3xl font-black mt-4" style={{ color: "#f5c177" }}>Private Door</h2>
            <p className="text-amber-100/70 text-sm mt-3 leading-relaxed max-w-md mx-auto">
              The Underground is a high-limit lounge. <span className="text-amber-300 font-bold">₵{STAKE_FLOOR_VIBE.toLocaleString()}</span> minimum on the table. AI host <span className="text-amber-300 font-bold">Lou</span> will be at your side once you're in.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-lg p-3 border border-amber-700/30 bg-black/30">
                <p className="text-[10px] uppercase tracking-widest text-amber-300/70">Your balance</p>
                <p className="text-xl font-black text-amber-100 tabular-nums" data-testid="ugc-balance">
                  {loading ? "…" : `₵${balance.toLocaleString()}`}
                </p>
              </div>
              <div className="rounded-lg p-3 border border-amber-700/30 bg-black/30">
                <p className="text-[10px] uppercase tracking-widest text-amber-300/70">House floor</p>
                <p className="text-xl font-black text-amber-100 tabular-nums">₵{STAKE_FLOOR_VIBE.toLocaleString()}</p>
              </div>
            </div>

            <label className="block text-left mt-6">
              <span className="text-[10px] uppercase tracking-widest text-amber-300/80">
                Type the pass-phrase: <em className="text-amber-200">"{PASS_PHRASE}"</em>
              </span>
              <input
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                data-testid="ugc-pass-phrase"
                className="mt-1.5 w-full rounded-lg bg-black/60 border border-amber-700/40 px-3 py-2 text-amber-50 placeholder-amber-100/30 focus:outline-none focus:border-amber-400"
                placeholder="I understand"
                autoComplete="off"
              />
            </label>

            {error && <p className="text-rose-300 text-xs mt-3" data-testid="ugc-error">{error}</p>}

            <button
              onClick={handleEnter}
              disabled={loading}
              data-testid="ugc-enter"
              className="mt-5 px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
              style={{
                background: "linear-gradient(90deg, #f5c177 0%, #d97706 50%, #f5c177 100%)",
                color: "#1a0306",
                boxShadow: "0 0 24px -4px rgba(245,158,11,0.6)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter The Underground"}
            </button>
          </div>
        )}

        {unlocked && (
          <div data-testid="ugc-lobby">
            <div className="rounded-2xl p-5 mb-6 text-center" style={{
              background: "linear-gradient(180deg, rgba(58,18,26,0.7) 0%, rgba(28,8,12,0.9) 100%)",
              border: "1px solid rgba(245,158,11,0.25)",
            }}>
              <p className="text-[10px] uppercase tracking-widest text-amber-300/80">Lou says:</p>
              <p className="text-amber-100/95 text-sm mt-1 italic max-w-xl mx-auto">
                "Welcome back to the lounge. Velvet's been waiting. Pick your table — every seat here starts at five thousand."
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="ugc-tables">
              {TABLES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`${t.path}?stake_floor=${STAKE_FLOOR_VIBE}&lounge=underground`)}
                    data-testid={`ugc-table-${t.id}`}
                    className="text-left rounded-2xl p-5 transition-transform hover:scale-[1.02] active:scale-95 group"
                    style={{
                      background: "linear-gradient(180deg, rgba(75,30,40,0.55) 0%, rgba(35,12,18,0.85) 100%)",
                      border: "1px solid rgba(245,158,11,0.25)",
                      boxShadow: "inset 0 0 40px -20px rgba(245,158,11,0.25)",
                    }}
                  >
                    <Icon className="w-6 h-6 mb-2" style={{ color: "#f5c177" }} />
                    <p className="text-base font-black" style={{ color: "#f5c177" }}>{t.label}</p>
                    <p className="text-[11px] text-amber-100/60 mt-0.5">{t.sub}</p>
                    <p className="text-[10px] uppercase tracking-widest mt-2 text-amber-300/40 group-hover:text-amber-200 transition-colors">
                      Take seat →
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
