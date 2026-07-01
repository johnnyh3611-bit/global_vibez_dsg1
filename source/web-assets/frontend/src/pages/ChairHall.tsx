/**
 * ChairHall — high-fidelity 3D "Infinity Table" environment for founders.
 *
 * Per `Global_Vibez_Chair_Hall_Implementation.pdf` + the v9 Master Vault
 * Integration Guide, this is a Three.js scene that:
 *  - renders an infinite ring of founder chairs around a central
 *    glass plinth ("the Table"),
 *  - pulses each chair's neon halo based on the live 3-Billion-Coin
 *    Sovereign Economy snapshot (`/api/economy/status`),
 *  - shows holder data pulled from `/api/chairs/wall`.
 *
 * Holder-only visual sweetness: the demo flow still loads (read-only).
 * Mobile camera is dialled back so the scene stays smooth on phones.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Float } from "@react-three/drei";
import { ArrowLeft, Crown, Sparkles, Coins } from "lucide-react";
import { Link } from "react-router-dom";
import * as THREE from "three";

const API = process.env.REACT_APP_BACKEND_URL;

type WallRow = {
  chair_id: number;
  phase: string;
  weight: number;
  holder_handle: string;
  holder_chair_count: number;
};

type EconomyStatus = {
  supply: {
    total_cap: number;
    treasury_reserve: number;
    vault_balance: number;
    circulating_estimate: number;
  };
  constants: {
    sovereign_tax: number;
    viberidez_tax: number;
    ride_split: number;
    ambassador_dividend: number;
    ambassador_override?: number;
  };
  lifetime: {
    volume: number;
    tax_collected: number;
    dividends_paid: number;
  };
  founder_vault?: {
    total: number;
    unlock_chairs: number;
    chairs_sold: number;
    unlocked: boolean;
    released: number;
    remaining_locked: number;
  };
  crew_vault?: { total: number };
};

const PHASE_COLOR: Record<string, string> = {
  Genius: "#f59e0b",
  Genesis: "#10b981",
  "Phase III": "#06b6d4",
  "Phase IV": "#8b5cf6",
  "Phase V": "#ec4899",
  "Sponsor Achievement": "#fb7185",
};

const phaseColor = (phase: string) => PHASE_COLOR[phase] || "#94a3b8";

// ---------- Single chair primitive ---------------------------------------
const ChairOrbMesh = ({
  position,
  color,
  pulseSpeed,
  chairId,
  onClick,
}: {
  position: [number, number, number];
  color: string;
  pulseSpeed: number;
  chairId: number;
  onClick: () => void;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * pulseSpeed;
    if (ref.current) {
      ref.current.rotation.y = t * 0.4;
    }
    if (haloRef.current) {
      const s = 1 + Math.sin(t * 2) * 0.15;
      haloRef.current.scale.set(s, s, s);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(t * 2) * 0.18;
    }
  });

  return (
    <group position={position} onClick={onClick}>
      <mesh ref={ref}>
        <cylinderGeometry args={[0.35, 0.45, 0.6, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          metalness={0.5}
          roughness={0.25}
        />
      </mesh>
      <mesh ref={haloRef} position={[0, 0, 0]}>
        <torusGeometry args={[0.65, 0.045, 12, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </mesh>
      <Html center distanceFactor={10} position={[0, 1.05, 0]} pointerEvents="none">
        <div className="text-[10px] font-mono text-white/80 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm whitespace-nowrap">
          #{String(chairId).padStart(5, "0")}
        </div>
      </Html>
    </group>
  );
};

// ---------- Central Infinity Table ---------------------------------------
const InfinityTable = ({ economy }: { economy: EconomyStatus | null }) => {
  const ringRef = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
  });

  const pct = economy
    ? Math.min(1, economy.supply.vault_balance / Math.max(1, economy.supply.total_cap))
    : 0;

  return (
    <group position={[0, -0.4, 0]}>
      {/* glass plinth */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 0.1, 64]} />
        <meshStandardMaterial color="#0c0a14" emissive="#06b6d4" emissiveIntensity={0.2} metalness={0.9} roughness={0.05} transparent opacity={0.85} />
      </mesh>
      {/* outer rotating economy ring */}
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.04, 16, 80, Math.PI * 2 * Math.max(0.05, pct)]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.02, 16, 80]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.45} />
      </mesh>
      {/* central crown */}
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.4}>
        <mesh position={[0, 0.7, 0]}>
          <icosahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.85} metalness={0.85} roughness={0.15} />
        </mesh>
      </Float>
      <Html center position={[0, -0.35, 0]} pointerEvents="none">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 whitespace-nowrap">
          INFINITY TABLE
        </div>
      </Html>
    </group>
  );
};

// ---------- The Hall (chairs + table) ------------------------------------
const Hall = ({
  chairs,
  economy,
  onSelect,
}: {
  chairs: WallRow[];
  economy: EconomyStatus | null;
  onSelect: (c: WallRow) => void;
}) => {
  const positioned = useMemo(() => {
    const radius = 4;
    return chairs.map((c, idx) => {
      const angle = (idx / Math.max(1, chairs.length)) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      return { row: c, x, y: 0, z, color: phaseColor(c.phase), pulse: 0.6 + (c.weight || 1) * 0.15 };
    });
  }, [chairs]);

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 6, 0]} intensity={1.5} color="#fbbf24" />
      <pointLight position={[6, 2, 6]} intensity={0.6} color="#06b6d4" />
      <pointLight position={[-6, 2, -6]} intensity={0.6} color="#a855f7" />
      <Stars radius={50} depth={50} count={1200} factor={4} fade speed={1} />
      <InfinityTable economy={economy} />
      {positioned.map((p) => (
        <ChairOrbMesh
          key={p.row.chair_id}
          position={[p.x, p.y, p.z]}
          color={p.color}
          pulseSpeed={p.pulse}
          chairId={p.row.chair_id}
          onClick={() => onSelect(p.row)}
        />
      ))}
      {/* circular felt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
        <ringGeometry args={[2.0, 6.0, 64]} />
        <meshStandardMaterial color="#0a0a14" emissive="#1e1b4b" emissiveIntensity={0.18} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};

// ---------- Page wrapper -------------------------------------------------
export default function ChairHall() {
  const [rows, setRows] = useState<WallRow[]>([]);
  const [economy, setEconomy] = useState<EconomyStatus | null>(null);
  const [selected, setSelected] = useState<WallRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, e] = await Promise.all([
          fetch(`${API}/api/chairs/wall?limit=24`).then((r) => r.json()),
          fetch(`${API}/api/economy/status`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setRows(Array.isArray(w?.rows) ? w.rows : []);
        setEconomy(e || null);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cap = economy?.supply.total_cap || 0;
  const vault = economy?.supply.vault_balance || 0;
  const pct = cap ? ((vault / cap) * 100).toFixed(4) : "0.0000";

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-br from-[#05030e] via-[#0a0418] to-[#03020a] text-slate-100"
      data-testid="chair-hall-page"
    >
      <div className="max-w-7xl mx-auto p-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <Link
            to="/chair-vault"
            className="inline-flex items-center gap-2 text-sm text-amber-300/80 hover:text-amber-200"
            data-testid="chair-hall-back-link"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Chair Vault
          </Link>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.4em] text-amber-300/70">
              Founder Hall
            </div>
            <h1
              className="text-3xl md:text-5xl font-black bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300 bg-clip-text text-transparent"
              data-testid="chair-hall-title"
            >
              The Chair Hall · Infinity Table
            </h1>
          </div>
        </div>

        {/* Live economy strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" data-testid="chair-hall-economy-strip">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-amber-300/80">Total Supply</div>
            <div className="text-lg font-bold text-amber-200" data-testid="chair-hall-supply-cap">
              {cap.toLocaleString()} ₵
            </div>
          </div>
          <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-cyan-300/80">Treasury Vault</div>
            <div className="text-lg font-bold text-cyan-200" data-testid="chair-hall-vault-balance">
              {vault.toLocaleString()} ₵
            </div>
            <div className="text-[10px] text-cyan-300/70">{pct}% of cap</div>
          </div>
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-rose-300/80">Sovereign Tax</div>
            <div className="text-lg font-bold text-rose-200">
              {economy ? `${(economy.constants.sovereign_tax * 100).toFixed(1)}%` : "—"}
            </div>
            <div className="text-[10px] text-rose-300/70">
              Ambassador kickback {economy ? `${(economy.constants.ambassador_dividend * 100).toFixed(1)}%` : "—"}
              {economy?.constants.ambassador_override
                ? ` + ${(economy.constants.ambassador_override * 100).toFixed(1)}% override`
                : ""}
            </div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Lifetime Volume</div>
            <div className="text-lg font-bold text-emerald-200">
              {(economy?.lifetime.volume || 0).toLocaleString()} ₵
            </div>
            <div className="text-[10px] text-emerald-300/70">
              Tax: {(economy?.lifetime.tax_collected || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* v12 Founder Vault strip — locked until 50k chairs sell */}
        {economy?.founder_vault && (
          <div
            className={`rounded-lg p-3 mb-4 border flex flex-wrap items-center justify-between gap-3 ${
              economy.founder_vault.unlocked
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-fuchsia-500/10 border-fuchsia-500/30"
            }`}
            data-testid="chair-hall-founder-vault"
          >
            <div>
              <div className="text-[10px] uppercase tracking-widest text-fuchsia-300/80">
                Founder Vault · v12 Constitution
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {economy.founder_vault.total.toLocaleString()} DSG
              </div>
              <div className="text-[11px] text-fuchsia-200/90 mt-1">
                {economy.founder_vault.unlocked
                  ? `UNLOCKED · ${economy.founder_vault.released.toLocaleString()} released / ${economy.founder_vault.remaining_locked.toLocaleString()} still dripping`
                  : `Locked until chair #${economy.founder_vault.unlock_chairs.toLocaleString()} — ${economy.founder_vault.chairs_sold.toLocaleString()} sold so far`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-fuchsia-300/70">
                Unlock progress
              </div>
              <div className="text-lg font-bold text-fuchsia-200 font-mono" data-testid="chair-hall-vault-progress">
                {(
                  Math.min(
                    100,
                    (economy.founder_vault.chairs_sold / economy.founder_vault.unlock_chairs) * 100
                  )
                ).toFixed(2)}
                %
              </div>
            </div>
          </div>
        )}

        {/* 3D scene */}
        <div
          className="rounded-2xl overflow-hidden border border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.18)] bg-black/60"
          style={{ height: "min(70vh, 640px)" }}
          data-testid="chair-hall-canvas"
        >
          <Canvas camera={{ position: [0, 4.2, 8.5], fov: 55 }} dpr={[1, 1.6]}>
            <Suspense fallback={null}>
              <Hall chairs={rows} economy={economy} onSelect={setSelected} />
            </Suspense>
            <OrbitControls
              enableZoom
              enablePan={false}
              minDistance={5}
              maxDistance={14}
              maxPolarAngle={Math.PI / 2.05}
            />
          </Canvas>
        </div>

        {error && (
          <div className="mt-3 text-xs text-rose-400" data-testid="chair-hall-error">
            Couldn't load live data: {error}
          </div>
        )}

        {/* Footer / legend */}
        <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-amber-400" /> Click any chair to inspect</span>
          <span className="inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Halo pulses scale with chair weight</span>
          <span className="inline-flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-emerald-400" /> Outer ring tracks treasury vs cap</span>
        </div>

        {/* Detail modal */}
        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
            data-testid="chair-hall-detail-modal"
          >
            <div
              className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-black p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs text-amber-300 uppercase tracking-widest">
                Chair #{String(selected.chair_id).padStart(5, "0")} · {selected.phase}
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{selected.holder_handle}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-white/5 p-2">
                  <div className="text-slate-400 text-[10px]">Weight</div>
                  <div className="font-mono text-amber-300">{selected.weight}×</div>
                </div>
                <div className="rounded bg-white/5 p-2">
                  <div className="text-slate-400 text-[10px]">Total Owned</div>
                  <div className="font-mono text-cyan-300">{selected.holder_chair_count}</div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="mt-4 w-full rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-2"
                data-testid="chair-hall-detail-close-btn"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
