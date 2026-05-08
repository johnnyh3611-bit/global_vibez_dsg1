/**
 * Generic minimal-UI casino game frontend factory.
 * Usage: <GenericCasinoGame {...config} />
 *
 * For all the simpler Coming-Soon games — Casino War, Hazard, Chuck-A-Luck,
 * Big Six Wheel, Fan-Tan, Faro — we don't need a custom screen-by-screen
 * layout. A single configurable shell keeps the codebase tight while still
 * delivering a real, fully-wired playable experience.
 */
import { ReactNode, useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy } from "lucide-react";
import TurnIndicator from "@/components/games/TurnIndicator";
import HotColdStrip from "@/components/games/HotColdStrip";
import { BallSpin } from "@/components/games/CasinoCinematics";
import CasinoTableEnhancer, { ChipStakeSelector, CasinoPhase } from "@/components/games/CasinoTableEnhancer";
import cardSoundManager from "@/utils/cardSoundManager";

/**
 * European Roulette wheel order (LOCKED 2026-02-16) — pocket positions
 * around the wheel rim, NOT sequential numbers. Index = clockwise slot;
 * value = printed pocket number. Used by BallSpin to compute a real
 * landing angle so the ball settles on the actual pocket position
 * rather than a sequential approximation.
 */
const EU_WHEEL_ORDER: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
  8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];
const POCKET_DEG = 360 / EU_WHEEL_ORDER.length;

function landingAngleForNumber(n: number): number {
  const idx = EU_WHEEL_ORDER.indexOf(n);
  return idx >= 0 ? idx * POCKET_DEG : 0;
}

const API = process.env.REACT_APP_BACKEND_URL;

export interface BetField {
  label: string;
  testid: string;
  options: { label: string; value: string | number }[];
  defaultValue: string | number;
}

export interface GenericGameProps {
  testid: string;
  title: string;
  tagline: string;
  themeBg: string;       // e.g. "from-black via-rose-950/15 to-black"
  themeButton: string;   // e.g. "from-rose-500 to-orange-500"
  iconText: string;      // emoji or short label for hero
  endpoint: string;      // e.g. "/api/games/casino-war/play"
  bets: BetField[];
  buildBody: (values: Record<string, string | number>, stake: number) => Record<string, unknown>;
  renderResult?: (result: any) => ReactNode;
}

export default function GenericCasinoGame(props: GenericGameProps) {
  const nav = useNavigate();
  const [stake, setStake] = useState(10);
  const initial: Record<string, string | number> = {};
  for (const b of props.bets) initial[b.label] = b.defaultValue;
  const [values, setValues] = useState<Record<string, string | number>>(initial);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Recent winning numbers — used by the HotColdStrip on number-pick
   * games (Roulette / Hazard / Chuck-A-Luck / Big Six). When the
   * backend returns `result.winning_number` (or `.outcome` cast to int)
   * we tack it onto this rolling buffer.
   */
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!result) return;
    const n = (result as any).winning_number ?? (result as any).number ?? null;
    if (typeof n === 'number' && Number.isFinite(n)) {
      setHistory((h) => [...h.slice(-19), n]);
    }
  }, [result]);

  const play = useCallback(async () => {
    setBusy(true); setResult(null);
    const body = props.buildBody(values, stake);
    const res = await fetch(`${API}${props.endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stake }),
    }).then(r => r.json());
    setResult(res);
    setBusy(false);
  }, [props, values, stake]);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${props.themeBg} text-white pb-28 md:pb-8`} data-testid={props.testid}>
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid={`${props.testid}-back-btn`} className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{props.iconText}</span>
              <h1 className="text-lg font-black tracking-wide truncate">{props.title}</h1>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">{props.tagline}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-5">
        {/* AAA enhancer: phase-aware turn indicator + sound effects + recent
             results history. Wired 2026-02-17 Late × 5 (founder ask). */}
        <CasinoTableEnhancer
          gameId={props.testid}
          phase={busy ? 'rolling' : (result ? (result.gross > 0 ? 'won' : 'lost') : 'betting')}
          history={history}
        />

        {/* Phase 3 cinematic — Roulette ball spin (LOCKED 2026-02-16).
             Renders only on number-pick rooms (where backend returns a
             `landed` int) so card / wheel rooms with non-numeric
             outcomes don't show a stale wheel. */}
        {busy && typeof result?.landed !== 'number' && (
          <div className="flex justify-center" data-testid="casino-spin-stage">
            <BallSpin active size={180} />
          </div>
        )}
        {!busy && typeof result?.landed === 'number' && (
          <div className="flex justify-center" data-testid="casino-landing-stage">
            <BallSpin active size={180} landingAngle={landingAngleForNumber(result.landed)} />
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 space-y-4">
          {props.bets.map(b => (
            <label key={b.label} className="flex flex-col text-xs">
              <span className="text-neutral-400 uppercase tracking-widest mb-1">{b.label}</span>
              <select
                value={values[b.label]}
                onChange={e => setValues(prev => ({ ...prev, [b.label]: isNaN(parseFloat(e.target.value)) ? e.target.value : parseFloat(e.target.value) }))}
                disabled={busy}
                data-testid={b.testid}
                className="bg-black border border-white/20 rounded-lg px-3 py-2 font-mono"
              >
                {b.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
          <div className="flex flex-col gap-2">
            <span className="text-neutral-400 uppercase tracking-widest text-xs">Chip Stake</span>
            <ChipStakeSelector
              stake={stake}
              onChange={(n) => { cardSoundManager.playChipClink?.(); setStake(n); }}
              disabled={busy}
              testid={`${props.testid}-stake`}
            />
          </div>
          {/* Inline play (desktop) — mobile gets the sticky-bottom CTA too. */}
          <button
            onClick={play}
            disabled={busy}
            data-testid={`${props.testid}-play-btn`}
            className={`hidden md:block w-full py-3 rounded-full bg-gradient-to-r ${props.themeButton} text-white font-black tracking-widest hover:brightness-110 disabled:opacity-50`}
          >
            {busy ? "RESOLVING…" : "PLAY"}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              data-testid={`${props.testid}-result`}
              className={`rounded-2xl border-2 p-4 sm:p-5 ${result.gross > 0 ? "border-emerald-400 bg-emerald-900/20" : "border-rose-500/40 bg-rose-950/10"}`}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className={`w-5 h-5 ${result.gross > 0 ? "text-emerald-300" : "text-rose-400"}`} />
                <h3 className="font-bold uppercase tracking-widest">{result.gross > 0 ? "WINNER!" : "Try again"}</h3>
              </div>
              {props.renderResult ? props.renderResult(result) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm font-mono">
                  <div><div className="text-[10px] text-neutral-500">GROSS</div><b className={result.gross >= 0 ? "text-emerald-300" : "text-rose-300"}>${(result.gross ?? 0).toFixed(2)}</b></div>
                  <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">${(result.tax ?? 0).toFixed(2)}</b></div>
                  <div><div className="text-[10px] text-neutral-500">NET</div><b className={result.net >= 0 ? "text-emerald-300" : "text-rose-300"}>${(result.net ?? 0).toFixed(2)}</b></div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile-only sticky play CTA — accessible without scrolling. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          onClick={play}
          disabled={busy}
          data-testid={`${props.testid}-play-btn-mobile`}
          className={`w-full py-3 rounded-full bg-gradient-to-r ${props.themeButton} text-white font-black tracking-widest disabled:opacity-50`}
        >
          {busy ? "RESOLVING…" : `PLAY · $${stake}`}
        </button>
      </div>
    </div>
  );
}
