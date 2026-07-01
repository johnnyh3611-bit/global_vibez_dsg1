/**
 * DSGMusicGroupHub — Pillar 1 of the v8 Marketing OneSheet.
 *
 * "Global Vibez DSG Music Group — The 70/30 Revolution. Artists keep 70%
 * of all revenue forever. Live Freestyle Battles. AI Matchmaking for
 * collabs. Global Totem Pole rankings."
 *
 * This hub aggregates the four Music-Group features into a single landing
 * room so users can "visually go into them and see them" (founder ask
 * 2026-02-16). Each tile deep-links to the dedicated room.
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Music, Trophy, Users, Mic2, Crown, ArrowRight, Zap,
} from 'lucide-react';

const PILLARS = [
  {
    id: 'beat-vault',
    title: 'Beat Vault',
    tagline: 'Auction & buy beats — artists keep 70% forever',
    icon: Music,
    accent: '#FFD33D',
    accentTint: 'rgba(255,211,61,0.15)',
    path: '/dsg/beat-vault',
    cta: 'Enter the Vault',
  },
  {
    id: 'freestyle',
    title: 'Live Freestyle Battles',
    tagline: 'Real-time bar-for-bar battles, judged by the room',
    icon: Mic2,
    accent: '#00E5C7',
    accentTint: 'rgba(0,229,199,0.15)',
    // Freestyle battles live under coliseum / vibe-coliseum
    path: '/vibe-coliseum',
    cta: 'Step on Stage',
  },
  {
    id: 'collab-matchmaker',
    title: 'AI Collab Matchmaker',
    tagline: 'Pair up artists by genre, vibe, and skill',
    icon: Users,
    accent: '#1E40AF',
    accentTint: 'rgba(30,64,175,0.20)',
    path: '/dsg/vigilant-room',
    cta: 'Find a Collaborator',
  },
  {
    id: 'totem-pole',
    title: 'Global Totem Pole',
    tagline: 'Worldwide rankings — climb the leaderboard',
    icon: Trophy,
    accent: '#FF8A1F',
    accentTint: 'rgba(255,138,31,0.15)',
    path: '/dsg/celestial-glasshouse',
    cta: 'View Rankings',
  },
];

export default function DSGMusicGroupHub() {
  const navigate = useNavigate();

  return (
    <div
      data-testid="dsg-music-group-hub"
      className="min-h-screen bg-[#0A0A0F] text-white pb-24"
    >
      {/* Hero */}
      <header className="relative px-6 pt-8 pb-12 overflow-hidden border-b border-[#FFD33D]/20">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(255,211,61,0.18) 0%, rgba(0,0,0,0) 60%)',
          }}
        />
        <button
          onClick={() => navigate('/dashboard')}
          data-testid="dsg-music-back"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>

        <p className="text-xs uppercase tracking-[0.4em] text-[#FFD33D] font-black mb-3">
          Pillar 01 — Music Group
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-3">
          The <span className="text-[#FFD33D]">70/30</span> Revolution
        </h1>
        <p className="text-white/70 max-w-2xl text-base md:text-lg leading-relaxed">
          Artists keep <strong className="text-[#FFD33D]">70%</strong> of all revenue,
          forever. Drop beats, battle in real time, find collaborators, and climb
          the Global Totem Pole.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD33D]/10 border border-[#FFD33D]/40 px-3 py-1 text-xs font-bold text-[#FFD33D]">
            <Crown className="w-3.5 h-3.5" /> Founders Pillar
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00E5C7]/10 border border-[#00E5C7]/40 px-3 py-1 text-xs font-bold text-[#00E5C7]">
            <Zap className="w-3.5 h-3.5" /> Live now
          </span>
        </div>
      </header>

      {/* Pillar tiles */}
      <main className="px-6 py-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PILLARS.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => navigate(p.path)}
              data-testid={`dsg-music-tile-${p.id}`}
              className="group relative text-left rounded-2xl border border-white/10 p-6 overflow-hidden transition-all hover:scale-[1.01] hover:border-white/30"
              style={{ background: p.accentTint }}
            >
              <div className="flex items-start justify-between">
                <p.icon className="w-8 h-8" style={{ color: p.accent }} />
                <ArrowRight
                  className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-transform"
                />
              </div>
              <h3 className="mt-4 text-2xl font-black tracking-tight">{p.title}</h3>
              <p className="mt-1 text-sm text-white/65 leading-relaxed">{p.tagline}</p>
              <p
                className="mt-4 text-[11px] uppercase tracking-widest font-bold"
                style={{ color: p.accent }}
              >
                {p.cta} →
              </p>
            </motion.button>
          ))}
        </div>

        {/* Stats strip */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="dsg-music-stats">
          {[
            { num: '70/30', label: 'Revenue Split' },
            { num: '∞',      label: 'Forever' },
            { num: 'LIVE',   label: 'Battles' },
            { num: '🌍',     label: 'Totem Pole' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/10 bg-black/40 p-4 text-center"
            >
              <div className="text-2xl md:text-3xl font-black text-[#FFD33D] mb-1">{s.num}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50">{s.label}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
