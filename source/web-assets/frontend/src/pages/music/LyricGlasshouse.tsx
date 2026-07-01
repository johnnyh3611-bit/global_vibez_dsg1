/**
 * LyricGlasshouse — 3D frequency-reactive visualizer.
 * Music Arena Blueprint §4 ("Lyric Glasshouse: 3D visualizers that
 * react to the artist's frequency in real-time").
 *
 * Uses react-three-fiber (already in package.json) to render a glass
 * dodecahedron at the center of a particle field. Bars around it
 * pulse to live FFT data captured from the user's microphone via
 * the Web Audio API. No backend dependency — purely client-side.
 *
 * Mounted as a stand-alone room so it can also be used as an OBS
 * scene by streamers (clean transparent black background).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Sparkles } from 'lucide-react';

const BAR_COUNT = 32;

interface BarProps {
  index: number;
  level: () => number;
}

const Bar: React.FC<BarProps> = ({ index, level }) => {
  const ref = useRef<THREE.Mesh>(null);
  const angle = (index / BAR_COUNT) * Math.PI * 2;
  const radius = 3.2;
  useFrame(() => {
    const m = ref.current; if (!m) return;
    const target = 0.5 + level() * 4.5;
    m.scale.y = THREE.MathUtils.lerp(m.scale.y || 0.5, target, 0.25);
    const hue = (index / BAR_COUNT + level() * 0.3) % 1;
    (m.material as THREE.MeshStandardMaterial).color.setHSL(hue, 0.85, 0.55);
    (m.material as THREE.MeshStandardMaterial).emissive.setHSL(hue, 1.0, 0.4);
  });
  return (
    <mesh ref={ref} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
      <boxGeometry args={[0.18, 1, 0.18]} />
      <meshStandardMaterial emissiveIntensity={0.8} roughness={0.2} metalness={0.6} />
    </mesh>
  );
};

const CenterCrystal: React.FC<{ pulse: () => number }> = ({ pulse }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const m = ref.current; if (!m) return;
    m.rotation.y += dt * 0.4;
    m.rotation.x += dt * 0.15;
    const s = 1 + pulse() * 0.4;
    m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, s, 0.2));
  });
  return (
    <Float speed={1.2} rotationIntensity={0.6} floatIntensity={1.4}>
      <mesh ref={ref}>
        <dodecahedronGeometry args={[1.2, 0]} />
        <meshPhysicalMaterial
          color="#22d3ee"
          metalness={0.6}
          roughness={0.05}
          transmission={0.85}
          thickness={1.2}
          ior={1.5}
          emissive="#a855f7"
          emissiveIntensity={0.4}
        />
      </mesh>
    </Float>
  );
};

export default function LyricGlasshouse() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array>(new Uint8Array(0));
  const streamRef = useRef<MediaStream | null>(null);

  // Levels feed: 32 bars take their amplitude from FFT bins.
  const getBarLevel = useMemo(() => {
    return (i: number) => {
      const a = analyserRef.current; const d = dataRef.current;
      if (!a) return 0;
      a.getByteFrequencyData(d);
      const binStart = Math.floor((i / BAR_COUNT) * d.length * 0.7);
      const binEnd   = Math.floor(((i + 1) / BAR_COUNT) * d.length * 0.7);
      let sum = 0;
      for (let k = binStart; k < binEnd; k++) sum += d[k];
      return (sum / Math.max(1, binEnd - binStart)) / 255;
    };
  }, []);
  const getPulse = useMemo(() => () => {
    const a = analyserRef.current; const d = dataRef.current;
    if (!a) return 0;
    a.getByteFrequencyData(d);
    let sum = 0;
    for (let k = 0; k < Math.min(d.length, 8); k++) sum += d[k];
    return (sum / 8) / 255;
  }, []);

  const enable = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      setEnabled(true);
    } catch (e: any) {
      setError(`Mic blocked: ${e?.message || 'permission denied'}`);
    }
  };
  const disable = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    analyserRef.current = null;
    setEnabled(false);
  };
  useEffect(() => () => disable(), []);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden" data-testid="lyric-glasshouse">
      <div className="absolute top-0 left-0 right-0 z-30 px-4 py-3 flex items-center gap-3 bg-black/40 backdrop-blur-md border-b border-cyan-500/30">
        <button onClick={() => navigate('/dashboard')} data-testid="lg-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300">Music Arena · 3D Visualizer</div>
          <div className="text-lg font-black bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
            Lyric Glasshouse
          </div>
        </div>
        <button
          onClick={enabled ? disable : enable}
          data-testid="lg-mic-toggle"
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold ${enabled ? 'bg-emerald-500 text-black' : 'bg-white/10 hover:bg-white/20'}`}
        >
          {enabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {enabled ? 'Live' : 'Enable Mic'}
        </button>
      </div>

      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 1.5, 6], fov: 55 }}>
          <ambientLight intensity={0.4} />
          <pointLight position={[5, 5, 5]} intensity={1.2} color="#22d3ee" />
          <pointLight position={[-5, -2, 5]} intensity={0.9} color="#d946ef" />
          <Stars radius={50} depth={50} count={2000} factor={3} fade speed={0.5} />
          <CenterCrystal pulse={getPulse} />
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <Bar key={i} index={i} level={() => getBarLevel(i)} />
          ))}
        </Canvas>
      </div>

      {!enabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-x-0 bottom-10 z-30 flex justify-center pointer-events-none"
        >
          <div className="rounded-full bg-black/70 backdrop-blur-md px-5 py-3 border border-cyan-400/30 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            Tap "Enable Mic" — the glasshouse reacts to your voice in real time.
          </div>
        </motion.div>
      )}

      {error && (
        <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center" data-testid="lg-error">
          <div className="rounded-xl bg-rose-500/20 border border-rose-400/40 px-4 py-2 text-sm text-rose-200">{error}</div>
        </div>
      )}
    </div>
  );
}
