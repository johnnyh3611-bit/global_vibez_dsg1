/**
 * ChairHall — Founder Infinity Table with sculpted chairs + holder IDs.
 *
 * Each parked chair renders as a high-detail seat (not a cylinder orb)
 * with the public holder handle and chair ID on a plaque. Data from
 * `/api/chairs/wall` + economy pulse from `/api/economy/status`.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Float } from "@react-three/drei";
import { ArrowLeft, Crown, Sparkles, Coins, Armchair } from "lucide-react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { chairPhaseLabel } from "@/utils/chairPhaseLabel";

const API = process.env.REACT_APP_BACKEND_URL;

type WallRow = {
  chair_id: number;
  phase: string;
  weight: number;
  holder_handle: string;
  holder_chair_count: number;
  holder_picture?: string | null;
  parked_at?: string;
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
};

const PHASE_COLOR: Record<string, string> = {
  Genius: "#f59e0b",
  Genesis: "#10b981",
  Apex: "#a855f7",
  Floor: "#94a3b8",
  Diamond: "#22d3ee",
  Platinum: "#e2e8f0",
  "Sponsor Achievement": "#fb7185",
};

const phaseColor = (phase: string) => PHASE_COLOR[phase] || "#c4b5fd";

/** Sculpted founder chair — seat, back, arms, legs, glowing plaque. */
function FounderChairMesh({
  position,
  color,
  pulseSpeed,
  row,
  onClick,
}: {
  position: [number, number, number];
  color: string;
  pulseSpeed: number;
  row: WallRow;
  onClick: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);
  const faceTowardCenter = useMemo(() => {
    const [x, , z] = position;
    return Math.atan2(x, z) + Math.PI;
  }, [position]);

  useFrame((state) => {
    const t = state.clock.elapsedTime * pulseSpeed;
    if (haloRef.current) {
      const s = 1 + Math.sin(t * 2) * 0.08;
      haloRef.current.scale.set(s, s, s);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + Math.sin(t * 2) * 0.12;
    }
    if (group.current) {
      group.current.position.y = position[1] + Math.sin(t) * 0.03;
    }
  });

  const matProps = {
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.72,
    roughness: 0.22,
  };

  const idLabel = `#${String(row.chair_id).padStart(5, "0")}`;
  const handle = row.holder_handle || "Anonymous";

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, faceTowardCenter, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Seat cushion */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.72, 0.12, 0.7]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.68, 0.06, 0.66]} />
        <meshStandardMaterial
          color="#1e1b2e"
          emissive={color}
          emissiveIntensity={0.15}
          metalness={0.2}
          roughness={0.55}
        />
      </mesh>

      {/* Backrest */}
      <mesh position={[0, 0.95, -0.28]} castShadow>
        <boxGeometry args={[0.72, 0.95, 0.1]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Curved crown rail */}
      <mesh position={[0, 1.45, -0.28]} rotation={[0.15, 0, 0]}>
        <torusGeometry args={[0.34, 0.05, 10, 24, Math.PI]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Armrests */}
      <mesh position={[-0.4, 0.62, 0.02]}>
        <boxGeometry args={[0.08, 0.08, 0.55]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={[0.4, 0.62, 0.02]}>
        <boxGeometry args={[0.08, 0.08, 0.55]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={[-0.4, 0.52, -0.2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.35, 10]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={[0.4, 0.52, -0.2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.35, 10]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Legs */}
      {[
        [-0.28, 0.2, 0.26],
        [0.28, 0.2, 0.26],
        [-0.28, 0.2, -0.26],
        [0.28, 0.2, -0.26],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.04, 0.05, 0.4, 10]} />
          <meshStandardMaterial color="#0f0a1a" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}

      {/* Floor halo */}
      <mesh ref={haloRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.72, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Avatar medallion on backrest */}
      <Float speed={1.4} floatIntensity={0.15} rotationIntensity={0.1}>
        <mesh position={[0, 1.05, -0.2]}>
          <circleGeometry args={[0.16, 28]} />
          <meshStandardMaterial
            color="#0b0614"
            emissive={color}
            emissiveIntensity={0.5}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      </Float>

      {/* ID plaque + holder name */}
      <Html
        center
        position={[0, 1.85, 0]}
        distanceFactor={9}
        pointerEvents="none"
        zIndexRange={[10, 0]}
      >
        <div
          className="pointer-events-none select-none text-center"
          style={{ width: 140 }}
        >
          <div
            className="mx-auto rounded-xl border px-2.5 py-1.5 shadow-[0_0_24px_rgba(0,0,0,0.55)] backdrop-blur-md"
            style={{
              borderColor: `${color}99`,
              background: "linear-gradient(160deg, rgba(8,6,18,0.92), rgba(20,12,40,0.88))",
            }}
          >
            {row.holder_picture ? (
              <img
                src={row.holder_picture}
                alt=""
                className="w-8 h-8 rounded-full mx-auto mb-1 object-cover border border-white/20"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-[10px] font-black text-black"
                style={{ background: color }}
              >
                {(handle[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="text-[9px] font-mono tracking-widest text-amber-200/90">
              {idLabel}
            </div>
            <div className="text-[11px] font-bold text-white truncate max-w-[120px]">
              {handle}
            </div>
            <div className="text-[8px] uppercase tracking-wider text-white/50 mt-0.5">
              {chairPhaseLabel(row.phase)} · {row.weight}×
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

function InfinityTable({ economy }: { economy: EconomyStatus | null }) {
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
    <group position={[0, -0.35, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.35, 1.55, 0.12, 64]} />
        <meshStandardMaterial
          color="#0c0a14"
          emissive="#06b6d4"
          emissiveIntensity={0.25}
          metalness={0.95}
          roughness={0.08}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.65, 0.045, 16, 80, Math.PI * 2 * Math.max(0.05, pct)]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.65, 0.02, 16, 80]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.4} />
      </mesh>
      <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.35}>
        <mesh position={[0, 0.75, 0]}>
          <icosahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.9}
            metalness={0.9}
            roughness={0.12}
          />
        </mesh>
      </Float>
      <Html center position={[0, -0.4, 0]} pointerEvents="none">
        <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/80 whitespace-nowrap">
          Infinity Table
        </div>
      </Html>
    </group>
  );
}

function Hall({
  chairs,
  economy,
  onSelect,
}: {
  chairs: WallRow[];
  economy: EconomyStatus | null;
  onSelect: (c: WallRow) => void;
}) {
  const positioned = useMemo(() => {
    const radius = 4.4;
    const list = chairs.length ? chairs : [];
    return list.map((c, idx) => {
      const angle = (idx / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        row: c,
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
        color: phaseColor(c.phase),
        pulse: 0.55 + (c.weight || 1) * 0.12,
      };
    });
  }, [chairs]);

  return (
    <>
      <color attach="background" args={["#05030e"]} />
      <fog attach="fog" args={["#05030e", 12, 28]} />
      <ambientLight intensity={0.4} />
      <spotLight position={[0, 10, 0]} angle={0.55} penumbra={0.6} intensity={1.4} color="#fde68a" />
      <pointLight position={[6, 3, 6]} intensity={0.7} color="#22d3ee" />
      <pointLight position={[-6, 3, -6]} intensity={0.7} color="#c084fc" />
      <Stars radius={60} depth={40} count={1600} factor={3.5} fade speed={0.8} />
      <InfinityTable economy={economy} />
      {positioned.map((p) => (
        <FounderChairMesh
          key={p.row.chair_id}
          position={[p.x, p.y, p.z]}
          color={p.color}
          pulseSpeed={p.pulse}
          row={p.row}
          onClick={() => onSelect(p.row)}
        />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <ringGeometry args={[2.2, 6.4, 72]} />
        <meshStandardMaterial
          color="#08061a"
          emissive="#1e1b4b"
          emissiveIntensity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

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
          fetch(`${API}/api/chairs/wall?limit=36`).then((r) => r.json()),
          fetch(`${API}/api/economy/status`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setRows(Array.isArray(w?.rows) ? w.rows : []);
        setEconomy(e || null);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
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
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <Link
            to="/chair-vault"
            className="inline-flex items-center gap-2 text-sm text-amber-300/80 hover:text-amber-200"
            data-testid="chair-hall-back-link"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Chair Vault
          </Link>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.4em] text-amber-300/70 flex items-center justify-end gap-1.5">
              <Armchair className="w-3.5 h-3.5" /> Founder Hall
            </div>
            <h1
              className="text-3xl md:text-5xl font-black bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300 bg-clip-text text-transparent"
              data-testid="chair-hall-title"
            >
              The Chair Hall · Infinity Table
            </h1>
            <p className="text-xs text-white/50 mt-1">
              Every parked chair shows its ID and public holder name.
            </p>
          </div>
        </div>

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
          </div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Chairs on table</div>
            <div className="text-lg font-bold text-emerald-200">{rows.length}</div>
            <div className="text-[10px] text-emerald-300/70">Live wall · limit 36</div>
          </div>
        </div>

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
                Founder Vault · Genius sell-out gate
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {economy.founder_vault.total.toLocaleString()} DSG
              </div>
              <div className="text-[11px] text-fuchsia-200/90 mt-1">
                {economy.founder_vault.unlocked
                  ? `UNLOCKED · ${economy.founder_vault.released.toLocaleString()} released`
                  : `Locked until chair #${economy.founder_vault.unlock_chairs.toLocaleString()} — ${economy.founder_vault.chairs_sold.toLocaleString()} sold`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-fuchsia-200 font-mono" data-testid="chair-hall-vault-progress">
                {Math.min(
                  100,
                  (economy.founder_vault.chairs_sold / economy.founder_vault.unlock_chairs) * 100
                ).toFixed(2)}
                %
              </div>
            </div>
          </div>
        )}

        <div
          className="rounded-2xl overflow-hidden border border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.18)] bg-black/60"
          style={{ height: "min(72vh, 680px)" }}
          data-testid="chair-hall-canvas"
        >
          <Canvas camera={{ position: [0, 5.2, 9.2], fov: 48 }} dpr={[1, 1.75]}>
            <Suspense fallback={null}>
              <Hall chairs={rows} economy={economy} onSelect={setSelected} />
            </Suspense>
            <OrbitControls
              enableZoom
              enablePan={false}
              minDistance={5.5}
              maxDistance={15}
              maxPolarAngle={Math.PI / 2.05}
              target={[0, 0.4, 0]}
            />
          </Canvas>
        </div>

        {error && (
          <div className="mt-3 text-xs text-rose-400" data-testid="chair-hall-error">
            Couldn&apos;t load live data: {error}
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="mt-3 text-sm text-amber-200/80 text-center">
            No chairs parked yet — be the first seat at the Infinity Table.
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Crown className="w-3.5 h-3.5 text-amber-400" /> Tap a chair to inspect ID + holder
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Halo / metal tint scales with phase weight
          </span>
          <span className="inline-flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-emerald-400" /> Center ring tracks treasury vs cap
          </span>
        </div>

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
              <div className="flex items-center gap-3 mb-3">
                {selected.holder_picture ? (
                  <img
                    src={selected.holder_picture}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover border border-amber-400/40"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-black"
                    style={{ background: phaseColor(selected.phase) }}
                  >
                    {(selected.holder_handle?.[0] || "?").toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs text-amber-300 uppercase tracking-widest">
                    Chair #{String(selected.chair_id).padStart(5, "0")} ·{" "}
                    {chairPhaseLabel(selected.phase)}
                  </div>
                  <div className="text-2xl font-bold text-white">{selected.holder_handle}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-white/5 p-2">
                  <div className="text-slate-400 text-[10px]">Earn weight</div>
                  <div className="font-mono text-amber-300">{selected.weight}×</div>
                </div>
                <div className="rounded bg-white/5 p-2">
                  <div className="text-slate-400 text-[10px]">Total owned</div>
                  <div className="font-mono text-cyan-300">{selected.holder_chair_count}</div>
                </div>
              </div>
              <button
                type="button"
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
