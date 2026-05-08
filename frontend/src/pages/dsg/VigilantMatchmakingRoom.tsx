/**
 * VigilantMatchmakingRoom — v6.5 / v5 / v4 spec.
 *
 * The headline "98% SYNERGY" holographic-card UI. Player picks 2 artist
 * profiles (or pulls 2 from a sample pool); the Apex Sovereign engine
 * computes a synergy score with genre/tempo/flow components.
 *
 * Wires to /api/apex/synergy.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ScanLine, Sparkles, Crown, Music4, Activity, Zap } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface ArtistProfile {
  user_id: string;
  flow_speed: number;
  tempo_bpm: number;
  genre: string;
  rank: string;
}

interface SynergyResult {
  synergy_score: number;
  components: { genre: number; tempo: number; flow: number };
  verdict: "ELITE_DUO" | "STRONG_MATCH" | "WORKABLE" | "MISMATCH";
}

const SAMPLE_POOL: ArtistProfile[] = [
  { user_id: "Vexar",  flow_speed: 0.72, tempo_bpm: 142, genre: "trap",    rank: "LEGEND" },
  { user_id: "Lyric",  flow_speed: 0.40, tempo_bpm: 92,  genre: "rnb",     rank: "ELITE" },
  { user_id: "Astra",  flow_speed: 0.85, tempo_bpm: 168, genre: "drill",   rank: "PRO" },
  { user_id: "Nova",   flow_speed: 0.55, tempo_bpm: 124, genre: "pop",     rank: "LEGEND" },
  { user_id: "Echo",   flow_speed: 0.30, tempo_bpm: 78,  genre: "soul",    rank: "ELITE" },
  { user_id: "Quanta", flow_speed: 0.65, tempo_bpm: 138, genre: "trap",    rank: "ELITE" },
  { user_id: "Pulse",  flow_speed: 0.60, tempo_bpm: 130, genre: "house",   rank: "PRO" },
  { user_id: "Ember",  flow_speed: 0.45, tempo_bpm: 100, genre: "jazz",    rank: "LEGEND" },
];

export default function VigilantMatchmakingRoom() {
  const nav = useNavigate();
  const [a, setA] = useState<ArtistProfile>(SAMPLE_POOL[0]);
  const [b, setB] = useState<ArtistProfile>(SAMPLE_POOL[1]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<SynergyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setResult(null);
    setError(null);
    // Show the scanner sweep for 1.5s before revealing the score
    await new Promise(r => setTimeout(r, 1500));
    try {
      const r = await fetch(`${API}/api/apex/synergy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: SynergyResult = await r.json();
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Synergy scan failed");
    } finally {
      setScanning(false);
    }
  }, [a, b]);

  const verdictColor = result?.verdict === "ELITE_DUO" ? "text-yellow-300" :
                       result?.verdict === "STRONG_MATCH" ? "text-emerald-300" :
                       result?.verdict === "WORKABLE" ? "text-cyan-300" : "text-rose-300";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-fuchsia-950/15 to-black text-white" data-testid="vigilant-room-page">
      {/* HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-fuchsia-500/20">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="vigilant-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-fuchsia-400" />
              <h1 className="text-lg font-black tracking-wide uppercase">Vigilant Matchmaking Room</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/30 px-2 py-0.5 rounded">DSG MUSIC GROUP</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">98% Synergy · Genre × Tempo × Flow · Apex-tier scanner</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6 grid lg:grid-cols-[1fr_auto_1fr] items-start gap-6">
        {/* ARTIST A */}
        <ArtistCard
          label="Artist A"
          profile={a}
          onChange={setA}
          color="fuchsia"
          testid="vigilant-artist-a"
          pool={SAMPLE_POOL}
        />

        {/* CENTER SCANNER */}
        <div className="relative w-72 h-72 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-fuchsia-400/30" />
          <div className="absolute inset-4 rounded-full border-2 border-cyan-400/20" />
          <div className="absolute inset-8 rounded-full border border-yellow-400/20" />

          {/* Scanner sweep line */}
          {scanning && (
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 origin-center pointer-events-none"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 w-px bg-gradient-to-b from-fuchsia-400 via-fuchsia-500/60 to-transparent" />
            </motion.div>
          )}

          {/* CENTER readout */}
          <div className="absolute inset-12 rounded-full bg-gradient-to-br from-fuchsia-950/80 via-purple-950/80 to-black border-2 border-fuchsia-400/50 shadow-[0_0_60px_rgba(232,121,249,0.4)] flex flex-col items-center justify-center text-center">
            <AnimatePresence mode="wait">
              {scanning ? (
                <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ScanLine className="w-8 h-8 text-fuchsia-300 animate-pulse mx-auto mb-1" />
                  <div className="text-[10px] uppercase tracking-widest text-fuchsia-200">Scanning…</div>
                </motion.div>
              ) : result ? (
                <motion.div key="r" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="px-4">
                  <div className="text-5xl font-black tabular-nums" data-testid="vigilant-synergy-score">{result.synergy_score.toFixed(1)}<span className="text-2xl">%</span></div>
                  <div className={`text-[10px] uppercase tracking-widest font-bold mt-1 ${verdictColor}`} data-testid="vigilant-verdict">{result.verdict.replace(/_/g, " ")}</div>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Sparkles className="w-7 h-7 text-fuchsia-300 mx-auto mb-1" />
                  <div className="text-[10px] uppercase tracking-widest text-fuchsia-200">Ready to Scan</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* SCAN BUTTON */}
          <button
            onClick={scan}
            disabled={scanning || a.user_id === b.user_id}
            data-testid="vigilant-scan-btn"
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-black tracking-widest text-xs hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-fuchsia-500/30"
          >
            {scanning ? "SCANNING…" : a.user_id === b.user_id ? "PICK 2 DIFFERENT ARTISTS" : "RUN SYNERGY SCAN"}
          </button>
        </div>

        {/* ARTIST B */}
        <ArtistCard
          label="Artist B"
          profile={b}
          onChange={setB}
          color="cyan"
          testid="vigilant-artist-b"
          pool={SAMPLE_POOL}
        />
      </div>

      {/* COMPONENT BREAKDOWN */}
      <div className="max-w-6xl mx-auto px-5 mt-16">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200" data-testid="vigilant-error">
            {error}
          </div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="vigilant-components">
            <ComponentBar icon={<Music4 className="w-4 h-4" />} label="Genre" pct={result.components.genre} weight={45} color="fuchsia" />
            <ComponentBar icon={<Activity className="w-4 h-4" />} label="Tempo" pct={result.components.tempo} weight={30} color="cyan" />
            <ComponentBar icon={<Zap className="w-4 h-4" />} label="Flow" pct={result.components.flow} weight={25} color="yellow" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ArtistCard({ label, profile, onChange, color, testid, pool }: {
  label: string; profile: ArtistProfile;
  onChange: (p: ArtistProfile) => void;
  color: "fuchsia" | "cyan"; testid: string; pool: ArtistProfile[];
}) {
  const ring = color === "fuchsia" ? "border-fuchsia-500/50 shadow-fuchsia-500/30" : "border-cyan-500/50 shadow-cyan-500/30";
  const accent = color === "fuchsia" ? "text-fuchsia-300" : "text-cyan-300";
  return (
    <div className={`rounded-3xl border-2 ${ring} bg-gradient-to-br from-black via-black/80 to-${color}-950/30 shadow-2xl p-5`} data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${accent}`}>{label}</span>
        <Crown className={`w-4 h-4 ${accent}`} />
      </div>

      <select
        value={profile.user_id}
        onChange={(e) => {
          const p = pool.find(x => x.user_id === e.target.value);
          if (p) onChange(p);
        }}
        data-testid={`${testid}-select`}
        className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 font-mono text-sm mb-3"
      >
        {pool.map(p => <option key={p.user_id} value={p.user_id}>{p.user_id} · {p.genre.toUpperCase()} · {p.rank}</option>)}
      </select>

      <div className="space-y-2 text-xs font-mono">
        <Row label="Genre"  value={profile.genre.toUpperCase()} />
        <Row label="Tempo"  value={`${profile.tempo_bpm} BPM`} />
        <Row label="Flow"   value={`${(profile.flow_speed * 100).toFixed(0)}%`} />
        <Row label="Rank"   value={profile.rank} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between bg-white/5 rounded px-2 py-1">
      <span className="text-neutral-400">{label}</span>
      <b className="text-white">{value}</b>
    </div>
  );
}

function ComponentBar({ icon, label, pct, weight, color }: {
  icon: React.ReactNode; label: string; pct: number; weight: number;
  color: "fuchsia" | "cyan" | "yellow";
}) {
  const bg = color === "fuchsia" ? "bg-fuchsia-500" : color === "cyan" ? "bg-cyan-400" : "bg-yellow-400";
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4" data-testid={`vigilant-component-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-300">
          {icon} {label}
        </div>
        <span className="text-[10px] text-neutral-500">×{weight}%</span>
      </div>
      <div className="text-2xl font-black tabular-nums">{pct.toFixed(1)}%</div>
      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full ${bg} rounded-full`}
        />
      </div>
    </div>
  );
}
