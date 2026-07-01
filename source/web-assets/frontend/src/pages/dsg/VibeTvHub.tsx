/**
 * VibeTvHub — Pillar 2 landing room of the v8 Marketing OneSheet.
 *
 * "Global Vibez DSG TV — your 24/7 personal network. Continuous
 * 30-min episodes, indie movies, talk shows."
 *
 * Aggregates Vibe TV channels, Memory Bank Cinema dates, and the
 * existing VibeTvScheduler into one room so users can "visually go
 * into them and see them" (founder ask 2026-02-16).
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Tv, Film, Heart, Calendar, ArrowRight, Radio,
} from 'lucide-react';

const SECTIONS = [
  {
    id: 'live-now',
    title: 'Live Now',
    tagline: '24/7 channel — drop in any time',
    icon: Radio,
    accent: '#FF8A1F',
    accentTint: 'rgba(255,138,31,0.15)',
    // Vibe TV live channel — uses /vibe-tv/main per GameVoiceDockMounter
    path: '/vibe-tv/main',
    cta: 'Tune In',
  },
  {
    id: 'episodes',
    title: '30-Minute Episodes',
    tagline: 'Indie shows + talk shows on rotation',
    icon: Tv,
    accent: '#00E5C7',
    accentTint: 'rgba(0,229,199,0.15)',
    path: '/vibe-tv/episodes',
    cta: 'Browse Library',
  },
  {
    id: 'memory-bank',
    title: 'Cinema Dates',
    tagline: 'Sync-watch movies with your match',
    icon: Heart,
    accent: '#FFD33D',
    accentTint: 'rgba(255,211,61,0.15)',
    path: '/dsg/memory-bank',
    cta: 'Pick a Movie',
  },
  {
    id: 'scheduler',
    title: 'Vibe TV Scheduler',
    tagline: 'Pin episodes, schedule premieres',
    icon: Calendar,
    accent: '#1E40AF',
    accentTint: 'rgba(30,64,175,0.20)',
    path: '/dsg/vibe-tv-scheduler',
    cta: 'Open Scheduler',
  },
];

export default function VibeTvHub() {
  const navigate = useNavigate();

  return (
    <div
      data-testid="vibe-tv-hub"
      className="min-h-screen bg-[#0A0A0F] text-white pb-24"
    >
      <header className="relative px-6 pt-8 pb-12 overflow-hidden border-b border-[#3B82F6]/20">
        <div
          className="absolute inset-0 -z-10 opacity-50"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(59,130,246,0.18) 0%, rgba(0,0,0,0) 60%)',
          }}
        />
        <button
          onClick={() => navigate('/dashboard')}
          data-testid="vibe-tv-back"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>

        <p className="text-xs uppercase tracking-[0.4em] text-[#3B82F6] font-black mb-3">
          Pillar 02 — Vibez TV
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-3">
          Your <span className="text-[#3B82F6]">24/7</span> Personal Network
        </h1>
        <p className="text-white/70 max-w-2xl text-base md:text-lg leading-relaxed">
          Continuous <strong className="text-[#3B82F6]">30-minute episodes</strong>,
          indie movies, talk shows, and Cinema Dates with your match. The future
          of lean-back entertainment.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FF8A1F]/15 border border-[#FF8A1F]/40 px-4 py-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[#FF8A1F]" />
          <span className="text-[11px] uppercase tracking-widest font-black text-[#FF8A1F]">
            On Air Now
          </span>
        </div>
      </header>

      <main className="px-6 py-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SECTIONS.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => navigate(s.path)}
              data-testid={`vibe-tv-tile-${s.id}`}
              className="group relative text-left rounded-2xl border border-white/10 p-6 overflow-hidden transition-all hover:scale-[1.01] hover:border-white/30"
              style={{ background: s.accentTint }}
            >
              <div className="flex items-start justify-between">
                <s.icon className="w-8 h-8" style={{ color: s.accent }} />
                <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="mt-4 text-2xl font-black tracking-tight">{s.title}</h3>
              <p className="mt-1 text-sm text-white/65 leading-relaxed">{s.tagline}</p>
              <p
                className="mt-4 text-[11px] uppercase tracking-widest font-bold"
                style={{ color: s.accent }}
              >
                {s.cta} →
              </p>
            </motion.button>
          ))}
        </div>
      </main>
    </div>
  );
}
