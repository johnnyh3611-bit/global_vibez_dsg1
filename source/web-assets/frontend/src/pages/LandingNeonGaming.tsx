import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Gamepad2, Video, MapPin, Sparkles, Play, ArrowRight, Zap, Users, Shield, Moon, Crown, BookOpen, Map, Cpu, Rocket, Car, Armchair, DollarSign, UtensilsCrossed, Pizza, Home, Tv, Music, BookMarked } from 'lucide-react';
import MissionBriefing from '../components/landing/MissionBriefing';
import UtilityRoomsDock from '../components/landing/UtilityRoomsDock';
import NewThisDrop from '../components/landing/NewThisDrop';
import EarningsSnapshot from '../components/landing/EarningsSnapshot';
import LatestAdditions from '../components/landing/LatestAdditions';
import TokenRoadmap from '../components/landing/TokenRoadmap';
import ChairExpansionPlan from '../components/landing/ChairExpansionPlan';
import WelcomeLetter from '../components/landing/WelcomeLetter';
import RecirculationVelocityWidget from '@/components/RecirculationVelocityWidget';
import PublicHealthBadge from '../components/landing/PublicHealthBadge';
import EvolutionCountdown from '../components/landing/EvolutionCountdown';
import WinnerTicker from '../components/common/WinnerTicker';
import LandingAccordion from '../components/landing/LandingAccordion';
import { setBearerToken } from '@/utils/secureAuth';
import EcosystemMechanics from '../components/landing/EcosystemMechanics';
import PricingMasterVault from '../components/landing/PricingMasterVault';
import WhatsNext from '../components/landing/WhatsNext';
import VibeRidezSpotlight from '../components/landing/VibeRidezSpotlight';
import HungryVibezSpotlight from '../components/landing/HungryVibezSpotlight';
import VibeVenuesSpotlight from '../components/landing/VibeVenuesSpotlight';
import ChairWallTeaser from '../components/landing/ChairWallTeaser';
import WaysToEarn from '../components/landing/WaysToEarn';
import LandingLanguageSwitcher from '../components/LandingLanguageSwitcher';
import LandingHeaderEnhanced, { type RoomKey } from '../components/landing/LandingHeaderEnhanced';
import LandingFeatureAccordions from '../components/landing/LandingFeatureAccordions';
import LandingTourVideo from '../components/landing/LandingTourVideo';
import LandingOrbitGlobe from '../components/landing/LandingOrbitGlobe';
import PageActionStrip from '@/components/common/PageActionStrip';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LandingNeonGaming() {
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);
  // PDF §2 "Room Transitions" — when a nav link is hovered, shift the
  // page's ambient background tint to evoke the target room.
  const [hoveredRoom, setHoveredRoom] = useState<RoomKey>(null);

  const runDemoLogin = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    localStorage.setItem('auth_in_progress', '1');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API}/api/auth/demo-login`, {
        method: 'POST',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.token && data.user_id) {
        setBearerToken(data.token);
        localStorage.setItem('user_id', data.user_id);
        if (data.name) localStorage.setItem('username', data.name);
        window.location.href = '/dashboard';
        return;
      }
    } catch {
      // fall through to login page
    } finally {
      clearTimeout(timeoutId);
      localStorage.removeItem('auth_in_progress');
      setDemoLoading(false);
    }
    navigate('/login');
  };

  const ROOM_TINT: Record<Exclude<RoomKey, null>, string> = {
    game_logic: "rgba(34, 211, 238, 0.18)",   // cyan — Cyber-Casino
    tokenomics: "rgba(251, 191, 36, 0.18)",   // amber — vault
    lifestyle:  "rgba(232, 121, 249, 0.18)",  // fuchsia — lifestyle
  };

  return (
    <div className="min-h-screen bg-black relative">
      {/* AAA-game-style landing nav. Founder directive 2026-02-09:
          NO STICK — header just scrolls away with the page. */}
      <LandingHeaderEnhanced onRoomHover={setHoveredRoom} />

      {/* PDF §2 — room-transition tint overlay. Non-interactive; only
          fades in when a nav link is hovered. Stays fixed because it
          IS a viewport-wide ambient effect, not a UI chrome element. */}
      <motion.div
        aria-hidden
        className="fixed inset-0 z-[1] pointer-events-none"
        animate={{
          backgroundColor: hoveredRoom ? ROOM_TINT[hoveredRoom] : "rgba(0,0,0,0)",
        }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        data-testid="landing-room-tint-overlay"
      />

      {/* Platform Live Wins Ticker — flows in document order, no sticky. */}
      <WinnerTicker className="relative z-40" />

      {/* Founder directive 2026-02-09 — Quick Access menu sits right
          under the Live Wins ticker. Inline (NOT fixed), scrolls with
          the page. Replaces the old floating chrome bar. */}
      <div className="relative z-30 px-6 pt-3 pb-1 max-w-7xl mx-auto">
        <PageActionStrip align="end" />
      </div>

      {/* Apex Evolution countdown banner — auto-hides if no event configured */}
      <EvolutionCountdown />
      
      {/* Animated Purple Grid Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(168, 85, 247, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(168, 85, 247, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'center top',
          }}
        />
        
        {/* Purple Glow Spots */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600 rounded-full blur-[120px]"
        />
      </div>

      {/* Header — replaced by <LandingHeaderEnhanced /> mounted at the
          top of this page (LandingPage_Enhancement.pdf §1+§2). */}

      {/* Hero Section */}
      <section className="relative z-10 px-4 sm:px-6 py-8 sm:py-12 lg:py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center">

          {/* Left - Main Text */}
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="order-1 lg:order-1"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              {/* Public health badge — live trust signal */}
              <div className="mb-4">
                <PublicHealthBadge />
              </div>

              {/* GLOBAL VIBEZ DSG with Motion Graphics — left column.
                  Planet + DSG orbit live on the opposite (right) side. */}
              <div className="relative mb-4 sm:mb-6">
                {/* Glitch Background Layer */}
                <motion.span
                  animate={{
                    x: [0, -2, 2, 0],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
                  className="absolute top-0 left-0 w-full text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black leading-none text-cyan-500 pointer-events-none select-none text-left"
                  style={{ filter: 'blur(2px)' }}
                  aria-hidden
                >
                  GLOBAL
                  <br />
                  VIBEZ <span className="text-fuchsia-500">DSG</span>
                </motion.span>

                {/* Main Text with Animations */}
                <h2 className="relative text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black leading-none">
                  {/* GLOBAL - Letter by letter reveal */}
                  <span className="inline-block">
                    {'GLOBAL'.split('').map((letter, i) => (
                      <motion.span
                        key={`letter-${i}`}
                        initial={{ opacity: 0, y: 50, rotateX: -90 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{
                          delay: i * 0.1,
                          duration: 0.5,
                          type: 'spring',
                          stiffness: 200,
                        }}
                        className="inline-block text-white"
                        style={{
                          textShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
                        }}
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </span>
                  <br />
                  
                  {/* VIBEZ - with pulsing glow */}
                  <span className="inline-block">
                    {'VIBEZ'.split('').map((letter, i) => (
                      <motion.span
                        key={`letter-${i}`}
                        initial={{ opacity: 0, y: 50, rotateX: -90 }}
                        animate={{ 
                          opacity: 1, 
                          y: 0, 
                          rotateX: 0,
                        }}
                        transition={{
                          delay: 0.6 + i * 0.1,
                          duration: 0.5,
                          type: 'spring',
                          stiffness: 200,
                        }}
                        className="inline-block text-white"
                      >
                        <motion.span
                          animate={{
                            textShadow: [
                              '0 0 20px rgba(255, 255, 255, 0.5)',
                              '0 0 40px rgba(255, 255, 255, 0.8)',
                              '0 0 20px rgba(255, 255, 255, 0.5)',
                            ],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                          className="inline-block"
                        >
                          {letter}
                        </motion.span>
                      </motion.span>
                    ))}
                  </span>{' '}
                  
                  {/* DSG - with gradient animation and scale pulse */}
                  <span className="inline-block relative">
                    {'DSG'.split('').map((letter, i) => (
                      <motion.span
                        key={`letter-${i}`}
                        initial={{ opacity: 0, scale: 0, rotate: -180 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1, 
                          rotate: 0,
                        }}
                        transition={{
                          delay: 1.1 + i * 0.15,
                          duration: 0.6,
                          type: 'spring',
                          stiffness: 150,
                        }}
                        className="inline-block"
                      >
                        <motion.span
                          animate={{
                            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                            scale: [1, 1.05, 1],
                          }}
                          transition={{
                            backgroundPosition: {
                              duration: 3,
                              repeat: Infinity,
                              ease: 'linear',
                            },
                            scale: {
                              duration: 2,
                              repeat: Infinity,
                              delay: i * 0.2,
                            },
                          }}
                          className="inline-block text-transparent bg-clip-text font-black"
                          style={{
                            backgroundImage: 'linear-gradient(90deg, #d946ef, #a855f7, #d946ef, #a855f7)',
                            backgroundSize: '200% 100%',
                            textShadow: '0 0 80px rgba(217, 70, 239, 0.8)',
                          }}
                        >
                          {letter}
                        </motion.span>
                      </motion.span>
                    ))}
                    
                    {/* Animated underline glow */}
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 1.6, duration: 0.8 }}
                      className="absolute -bottom-2 left-0 right-0 h-1 origin-left"
                    >
                      <motion.div
                        animate={{
                          opacity: [0.5, 1, 0.5],
                          boxShadow: [
                            '0 0 20px rgba(217, 70, 239, 0.8)',
                            '0 0 40px rgba(217, 70, 239, 1)',
                            '0 0 20px rgba(217, 70, 239, 0.8)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-full h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-full"
                      />
                    </motion.div>
                  </span>
                </h2>

                {/* Floating particles around DSG */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={`item-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      y: [0, -50, -100],
                      x: [0, Math.sin(i) * 50, Math.sin(i) * 100],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: 2 + i * 0.3,
                      ease: 'easeOut',
                    }}
                    className="absolute top-0 right-0 w-2 h-2 bg-fuchsia-500 rounded-full"
                    style={{
                      boxShadow: '0 0 10px rgba(217, 70, 239, 1)',
                    }}
                  />
                ))}
              </div>
              
              <div className="space-y-3 mb-8">
                <p className="text-lg sm:text-xl lg:text-2xl text-purple-300 font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-fuchsia-500" />
                  Four jobs. One hub. Start in under a minute.
                </p>
                <p className="text-base sm:text-xl text-gray-400">
                  Gaming · Dating · Streams · Earn
                </p>
                <p className="text-sm sm:text-base text-gray-500 max-w-xl pt-2">
                  Demo Login or email signup → dashboard Job Board → play,
                  match, watch, or earn. Wallet linking is optional after
                  you&apos;re in. Explore rides, venues, and music further down.
                </p>
              </div>
            </motion.div>

            {/* CTA Buttons — ship-core FTU */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 sm:flex sm:flex-row sm:flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-10"
            >
              <button
                type="button"
                onClick={runDemoLogin}
                disabled={demoLoading}
                data-testid="landing-cta-demo-login"
                className="group col-span-2 w-full sm:w-auto px-4 sm:px-10 py-2.5 sm:py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black text-sm sm:text-base font-black rounded-lg hover:scale-105 transition-transform shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-2 border-2 border-emerald-300 disabled:opacity-60"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                {demoLoading ? 'Starting demo…' : 'Demo Login'}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                data-testid="landing-cta-sign-in"
                className="w-full sm:w-auto px-4 sm:px-10 py-2.5 sm:py-3.5 bg-purple-900/50 backdrop-blur-xl text-purple-300 text-sm sm:text-base font-black rounded-lg hover:bg-purple-800/50 transition-all border-2 border-purple-500 hover:border-fuchsia-500 flex items-center justify-center gap-2"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                data-testid="landing-cta-sign-up"
                className="w-full sm:w-auto px-4 sm:px-10 py-2.5 sm:py-3.5 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-sm sm:text-base font-black rounded-lg hover:scale-105 transition-transform shadow-2xl shadow-fuchsia-500/50 flex items-center justify-center gap-2 border-2 border-fuchsia-400"
              >
                Sign Up Free
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = document.querySelector('[data-testid="landing-tour-video"]');
                  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                data-testid="landing-cta-watch-tour"
                className="w-full sm:w-auto px-4 sm:px-8 py-2.5 sm:py-3.5 bg-black/60 backdrop-blur-xl text-white text-sm sm:text-base font-black rounded-lg hover:bg-black/80 transition-all border-2 border-cyan-400 hover:border-fuchsia-400 flex items-center justify-center gap-2 shadow-[0_0_30px_-8px_rgba(34,211,238,0.5)]"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" />
                Watch Tour
              </button>
            </motion.div>

            {/* Core loop shortcuts — what you can do today */}
            <div
              className="grid grid-cols-2 gap-3 mt-6"
              data-testid="landing-core-loop"
              aria-label="What you can do today"
            >
              {[
                {
                  id: 'games',
                  path: '/games',
                  label: 'Gaming',
                  hint: 'Spades · Bid Whist · Dice',
                  Icon: Gamepad2,
                  tone: 'border-cyan-500/40 from-cyan-500/10 to-blue-500/5 text-cyan-300',
                },
                {
                  id: 'dating',
                  path: '/dating/discover',
                  label: 'Dating',
                  hint: 'Discover · match · play',
                  Icon: Heart,
                  tone: 'border-pink-500/40 from-pink-500/10 to-rose-500/5 text-pink-300',
                },
                {
                  id: 'streams',
                  path: '/streams',
                  label: 'Streams',
                  hint: 'Watch live · go live',
                  Icon: Tv,
                  tone: 'border-red-500/40 from-red-500/10 to-orange-500/5 text-red-300',
                },
                {
                  id: 'earn',
                  path: '/earn',
                  label: 'Earn',
                  hint: 'Chairs · referrals · wins',
                  Icon: DollarSign,
                  tone: 'border-emerald-500/40 from-emerald-500/10 to-green-500/5 text-emerald-300',
                },
              ].map(({ id, path, label, hint, Icon, tone }) => (
                <motion.button
                  key={id}
                  type="button"
                  onClick={() => navigate(path)}
                  data-testid={`landing-cta-${id}`}
                  whileHover={{ scale: 1.02 }}
                  className={`group flex items-center gap-3 rounded-xl border-2 bg-gradient-to-br p-4 text-left transition-all hover:brightness-110 ${tone}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/40">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-white">{label}</div>
                    <div className="truncate text-xs opacity-70">{hint}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70 transition-transform group-hover:translate-x-1" />
                </motion.button>
              ))}
            </div>

            {/* Live Coin Velocity — recirculation readout (replaces burn counter) */}
            <div className="mt-6">
              <RecirculationVelocityWidget />
            </div>
          </motion.div>

          {/* Right — planet with rooms inside + DSG in orbit.
              Fills the empty slot opposite GLOBAL VIBEZ DSG (game cards removed). */}
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative flex items-center justify-center min-h-[220px] sm:min-h-[300px] lg:min-h-[480px] order-2 lg:order-2 overflow-visible"
          >
            <LandingOrbitGlobe />
          </motion.div>
        </div>
      </section>

      {/* (Removed May 2026 per founder request — the "All-In-One Gaming
           Dating Platform" 6-card grid duplicated content already shown
           in the Utility Rooms Dock + Hero pills below. Removing it
           lightens the page without losing any category.) */}

      {/* Explore / beta pillars — below the core Job Board loop. */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-10 pb-2 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-white/40">
          Explore more · beta &amp; lifestyle pillars
        </p>
        <p className="mt-2 text-sm text-white/50">
          Rides, food, venues, music, and Yellow Pages sit under Explore —
          the four jobs above are what to do first.
        </p>
      </div>
      <UtilityRoomsDock />

      {/* PDF §3 — Progressive Information Compression accordions
          (Game Logic / Tokenomics / Lifestyle Hub). Mounted right after
          the rooms dock so first-time visitors who scroll past the hero
          land on click-to-expand explanations of how the platform works. */}
      <LandingFeatureAccordions />

      {/* 🪧 Social Infrastructure Network — LOCKED v8.0 Marketing OneSheet */}
      <section
        data-testid="landing-infrastructure-tagline"
        className="relative z-10 px-6 py-16 border-y border-[#00E5C7]/20 bg-gradient-to-b from-black via-[#0A0A0F] to-black"
      >
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs md:text-sm uppercase tracking-[0.5em] text-[#00E5C7] font-black mb-4">
            ⚡ Locked In · Genius Phase
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            THE WORLD'S FIRST{' '}
            <span className="text-[#00E5C7]">SOCIAL INFRASTRUCTURE NETWORK</span>
          </h2>
          <p className="text-base md:text-xl italic text-white/60 max-w-3xl mx-auto">
            "Right now is the best time to sit at the table, because we are the best seat in the house."
          </p>
        </div>
      </section>

      {/* 🏛 The Four Pillars — LOCKED v8.0 Marketing OneSheet */}
      <section
        id="pillars"
        data-testid="landing-four-pillars"
        className="relative z-10 px-6 py-20 bg-black"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs md:text-sm uppercase tracking-[0.4em] text-[#00E5C7] font-black mb-3">
              The Four Pillars
            </p>
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">
              Built on <span className="text-[#FFD33D]">Ownership</span>.{' '}
              Powered by <span className="text-[#00E5C7]">Connection</span>.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 1. Music Group — 70/30 Revolution */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              data-testid="pillar-music-group"
              className="p-8 bg-[#0F0F18] rounded-2xl border border-[#FFD33D]/20 hover:border-[#FFD33D]/60 transition-colors"
            >
              <p className="text-xs font-black uppercase tracking-widest text-[#FFD33D] mb-2">
                01 — Music Group
              </p>
              <h3 className="text-2xl font-black text-white mb-3">
                The 70/30 Revolution
              </h3>
              <p className="text-white/70 mb-4 leading-relaxed">
                Artists keep <span className="text-[#FFD33D] font-black">70%</span> of all revenue
                <span className="text-[#FFD33D] font-black"> forever</span>. Live Freestyle Battles,
                AI Matchmaking for collabs, Global Totem Pole rankings.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {['Beat Vault', 'Freestyle Battles', 'Collab Matchmaker', 'Totem Pole'].map(t => (
                  <span key={t} className="px-2 py-1 rounded-full bg-[#FFD33D]/10 text-[#FFD33D] font-bold">{t}</span>
                ))}
              </div>
            </motion.div>

            {/* 2. DSG TV */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              data-testid="pillar-dsg-tv"
              className="p-8 bg-[#0F0F18] rounded-2xl border border-[#1E40AF]/30 hover:border-[#3B82F6]/70 transition-colors"
            >
              <p className="text-xs font-black uppercase tracking-widest text-[#3B82F6] mb-2">
                02 — Global Vibez DSG TV
              </p>
              <h3 className="text-2xl font-black text-white mb-3">
                Your 24/7 Personal Network
              </h3>
              <p className="text-white/70 mb-4 leading-relaxed">
                Continuous <span className="text-[#3B82F6] font-black">30-minute episodes</span>,
                independent movies, talk shows. The future of lean-back entertainment.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {['Vibe TV Channel', 'Memory Bank Cinema', 'Indie Movies', 'AI-Targeted Ads'].map(t => (
                  <span key={t} className="px-2 py-1 rounded-full bg-[#1E40AF]/20 text-[#3B82F6] font-bold">{t}</span>
                ))}
              </div>
            </motion.div>

            {/* 3. Find Your Player Two */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              data-testid="pillar-player-two"
              className="p-8 bg-[#0F0F18] rounded-2xl border border-[#00E5C7]/30 hover:border-[#00E5C7]/70 transition-colors"
            >
              <p className="text-xs font-black uppercase tracking-widest text-[#00E5C7] mb-2">
                03 — Find Your Player Two
              </p>
              <h3 className="text-2xl font-black text-white mb-3">
                <span className="text-[#00E5C7]">98%</span> Synergy Logic Matchmaking
              </h3>
              <p className="text-white/70 mb-4 leading-relaxed">
                Meet, chat, and go on <span className="text-[#00E5C7] font-black">Cinema Dates</span>{' '}
                inside the app — synced movie streaming, voice rooms, culturally-aware AI dealers.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {['Vigilant MM', 'Cinema Dates', 'Synced Streaming', 'Cultural Hub'].map(t => (
                  <span key={t} className="px-2 py-1 rounded-full bg-[#00E5C7]/10 text-[#00E5C7] font-bold">{t}</span>
                ))}
              </div>
            </motion.div>

            {/* 4. Vibe Yellow Pages */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              data-testid="pillar-yellow-pages"
              className="p-8 bg-[#0F0F18] rounded-2xl border border-[#FF8A1F]/30 hover:border-[#FF8A1F]/70 transition-colors"
            >
              <p className="text-xs font-black uppercase tracking-widest text-[#FF8A1F] mb-2">
                04 — Vibe Yellow Pages
              </p>
              <h3 className="text-2xl font-black text-white mb-3">
                Mom & Pop, Hyper-Local
              </h3>
              <p className="text-white/70 mb-4 leading-relaxed">
                Supporting local Mom & Pop businesses with hyper-local sponsorship and the{' '}
                <span className="text-[#FF8A1F] font-black">Global Vibez DSG Guard</span>{' '}
                safety protocol.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {['Local Sponsors', 'Hunger Vibez', 'DSG Guard', 'Geo-Pinned'].map(t => (
                  <span key={t} className="px-2 py-1 rounded-full bg-[#FF8A1F]/10 text-[#FF8A1F] font-bold">{t}</span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ~3-minute narrated tour — sits below the 4-pillars grid (which
          contains the DSG VIBE TV pillar at position 02). Founder
          directive 2026-05-09: surplus video for visitors who don't
          scroll the full landing page. Onyx-narrated · 4 looped MP4
          clips · live captions · play / pause / mute / restart. */}
      <LandingTourVideo onJoinBeta={() => navigate('/beta-tester')} />

      {/* 🏅 Ambassador Care Package — Founder's Circle landing pitch.
          Added Feb 2026 (Ambassador_Care_Package.pdf): surfaces "Walking
          Advertisements" + 3-Month Diamond Challenge + 4 ways to earn so
          landing-page traffic sees the passive-income story before
          scrolling further. CTA routes to /ambassador. */}
      <section
        id="ambassador-care"
        data-testid="landing-ambassador-care"
        className="relative z-10 px-6 py-20 md:py-24 bg-gradient-to-b from-black via-[#1a0a05] to-black border-y border-amber-400/15"
      >
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs md:text-sm uppercase tracking-[0.4em] text-amber-300 font-black mb-3">
            🏅 Founder's Circle · Ambassador Care Package
          </p>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-3">
            You Don't Just Use the App.{" "}
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              You Own the Streets.
            </span>
          </h2>
          <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-10">
            Become a <span className="text-amber-300 font-black">Walking Advertisement</span>{" "}
            — scan vendors, onboard sponsors, earn forever. Turn your Founder Chairs into a lifetime of passive income.
          </p>

          {/* 4 earnings preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {[
              { num: "30%", label: "Chair Dividends · Quarterly" },
              { num: "$VIBEZ", label: "Referral Bounty per Setup" },
              { num: "%", label: "Override Commissions" },
              { num: "90d", label: "Diamond Challenge · Tier-2" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.03] p-4"
              >
                <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                  {s.num}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-white/50 mt-2">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            data-testid="landing-ambassador-cta"
            onClick={() => navigate("/ambassador")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-black text-sm md:text-base font-black uppercase tracking-wider shadow-[0_0_30px_-8px_rgba(251,146,60,0.6)] transition-all"
          >
            Open Care Package →
          </button>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mt-4">
            3-Month Diamond Challenge · 50k Block Vote · Pit Boss Unlock
          </p>
        </div>
      </section>

      {/* 🪑 Genius Phase — Chair Holder Network (LOCKED v8.0) */}
      <section
        id="genius-phase"
        data-testid="landing-genius-phase"
        className="relative z-10 px-6 py-24 bg-gradient-to-b from-black via-[#0F0F18] to-black border-y border-[#FFD33D]/10"
      >
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs md:text-sm uppercase tracking-[0.4em] text-[#FFD33D] font-black mb-3">
            ⚡ Genius Phase — Limited Supply
          </p>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-4">
            Limited to <span className="text-[#FFD33D]">1,000,000</span> Chairs
          </h2>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-3">
            Globally. Forever. The first cohort to sit at the table owns the network.
          </p>
          <p className="text-xs text-white/40 max-w-xl mx-auto mb-10">
            Genius ($20 × 50K cap) · then live revenue-driven valuation ($18 Floor → $99 Genesis → $360 Diamond → $1,800 Platinum) ·
            800K Reserve Vault releases after Chair #50,000.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
            {[
              { num: '70/30', label: 'Artist Revolution' },
              { num: '98%',   label: 'Synergy Logic' },
              { num: '1M',    label: 'Chair Cap' },
              { num: '30 min', label: 'TV Episodes' },
            ].map((s) => (
              <div
                key={s.label}
                data-testid={`landing-marketing-stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
                className="rounded-xl border border-white/10 bg-black/40 p-4 hover:border-[#FFD33D]/40 transition-colors"
              >
                <div className="text-3xl md:text-4xl font-black text-[#FFD33D] mb-1">{s.num}</div>
                <div className="text-xs uppercase tracking-wider text-white/50">{s.label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/signup')}
            data-testid="landing-secure-chair-btn"
            className="px-10 py-5 bg-[#FFD33D] hover:bg-[#FFE066] text-black text-xl md:text-2xl font-black rounded-full shadow-2xl shadow-[#FFD33D]/30 hover:scale-105 transition-transform uppercase tracking-wider"
          >
            SECURE YOUR CHAIR
          </button>
          <p className="text-white/40 text-xs mt-4 uppercase tracking-widest">
            Scan to join the Genius Phase
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-10 px-6 py-16 border-y border-purple-500/30 bg-purple-900/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: '4', label: 'Core Jobs' },
              { number: '27+', label: 'Games' },
              { number: '4', label: 'Earn Paths' },
              { number: '₵', label: 'In-App Credits' },
            ].map((stat, i) => (
              <motion.div
                key={`item-${i}`}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-5xl font-black text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text mb-2">
                  {stat.number}
                </p>
                <p className="text-sm font-bold text-purple-400 uppercase tracking-wider">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-20 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          className="relative"
        >
          {/* Neon Glow Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-[3rem] blur-3xl opacity-50" />
          
          {/* Content */}
          <div className="relative bg-black/80 backdrop-blur-xl p-12 rounded-[3rem] border-2 border-fuchsia-500">
            <h3
              data-testid="landing-final-cta-headline"
              className="text-4xl md:text-6xl font-black mb-6 leading-tight"
            >
              <span className="text-[#FF8A1F]">LOCK IN YOUR VIBE.</span>
              <br />
              <span className="text-white">OWN THE NETWORK.</span>
            </h3>
            <p className="text-xl text-purple-300 mb-8 font-medium">
              Demo Login or email signup — dashboard Job Board in under a minute.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={runDemoLogin}
                disabled={demoLoading}
                data-testid="landing-final-cta-demo"
                className="group px-12 py-5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black text-xl font-black rounded-xl hover:scale-105 transition-transform shadow-2xl shadow-emerald-500/40 flex items-center gap-3 uppercase tracking-wider disabled:opacity-60"
              >
                <Play className="w-6 h-6" />
                {demoLoading ? 'Starting…' : 'Demo Login'}
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                data-testid="landing-final-cta-button"
                className="group px-12 py-5 bg-[#FF8A1F] hover:bg-[#FFA040] text-black text-xl font-black rounded-xl hover:scale-105 transition-transform shadow-2xl shadow-[#FF8A1F]/40 flex items-center gap-3 uppercase tracking-wider"
              >
                Sign Up Free
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-12 py-5 bg-purple-900/50 backdrop-blur-xl text-purple-300 text-xl font-black rounded-xl hover:bg-purple-800/50 transition-all border-2 border-purple-500 hover:border-fuchsia-500"
              >
                Sign In
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* New This Drop — Feature Showcase + Spotify unlock (above the fold-below-hero) */}
      <NewThisDrop />

      {/* Earnings Snapshot — all 12 earn paths visible without a click (Founder directive 2026-05-04) */}
      <EarningsSnapshot />

      {/* Quick-jump accordion stack — keeps the landing page short.
          Each section is one click to expand. Visitors pick what they
          care about instead of scrolling 12 screens of content. */}

      {/* Mission Briefing — the platform's elevator pitch */}
      <LandingAccordion
        title="Mission Briefing"
        subtitle="What Global Vibez is and why it exists"
        Icon={Sparkles}
        tone="cyan"
        testId="acc-mission-briefing"
      >
        <MissionBriefing />
      </LandingAccordion>

      {/* Welcome Letter — narrative onboarding for first-time visitors.
          Plain-English explainer of what a chair is, why pricing ramps,
          and the Apex ceiling reveal. */}
      <LandingAccordion
        title="A Letter from the Founder"
        subtitle="What a chair is, why pricing ramps, and the Apex ceiling"
        Icon={BookOpen}
        tone="amber"
        testId="acc-welcome-letter"
      >
        <WelcomeLetter />
      </LandingAccordion>

      {/* Ecosystem Mechanics — Engagement Mining + Loyalty Loop + Currency Stack */}
      <LandingAccordion
        title="Ecosystem Mechanics"
        subtitle="How Engagement Mining + the 72-hour Loyalty Loop work"
        Icon={Cpu}
        tone="cyan"
        testId="acc-ecosystem-mechanics"
      >
        <EcosystemMechanics />
      </LandingAccordion>

      {/* Pricing Master Vault — 6 Vibe Packs · 4:1 DSG bridge · tier-gated */}
      <LandingAccordion
        title="Pricing Master Vault · v1.0"
        subtitle="Six Vibe Packs · $1 = 2,500 ₵ · 4:1 $DSG bridge · 13.5% Sovereign Tax"
        Icon={Cpu}
        tone="violet"
        testId="acc-pricing-master-vault"
      >
        <PricingMasterVault />
      </LandingAccordion>

      {/* Ways to Earn — full earnings explainer + monthly scenarios */}
      <LandingAccordion
        title="All The Ways You Can Earn"
        subtitle="Eight earn paths · real production rates · monthly scenarios"
        Icon={DollarSign}
        tone="emerald"
        testId="acc-ways-to-earn"
      >
        <WaysToEarn />
      </LandingAccordion>

      {/* VibeRidez — Creator Fleet driver/rider network spotlight */}
      <LandingAccordion
        title="VibeRidez · The Creator Fleet"
        subtitle="Drive, stream, earn — Kill-Switch privacy + Solana fare splits"
        Icon={Car}
        tone="violet"
        testId="acc-vibe-ridez"
      >
        <VibeRidezSpotlight />
      </LandingAccordion>

      {/* Hungry Vibez — same fleet, food delivery task type */}
      <LandingAccordion
        title="Hungry Vibez · Same Fleet, Second Task Type"
        subtitle="Mom & Pop kitchens · Flat $30/mo partners · 70% driver split in $DSG"
        Icon={UtensilsCrossed}
        tone="amber"
        testId="acc-hungry-vibez"
      >
        <HungryVibezSpotlight />
      </LandingAccordion>

      {/* Vibe Venues — hourly private-space rentals + Vibe Artisans */}
      <LandingAccordion
        title="Vibe Venues · Rent by the Hour, Live by the Vibe"
        subtitle="Hourly blocks [3 · 6 · 9 · 12 · 24 hr] · $20/mo Artisans · $DSG smart escrow"
        Icon={Home}
        tone="fuchsia"
        testId="acc-vibe-venues"
      >
        <VibeVenuesSpotlight />
      </LandingAccordion>

      {/* Chair Expansion Plan — already has its own internal
          dropdown UI, so leave un-wrapped to avoid double-nesting. */}
      <ChairExpansionPlan />

      {/* Chair Wall — public believer wall preview + CTA to /chair-wall */}
      <LandingAccordion
        title="The Chair Wall"
        subtitle="Every chair has a unique ID — see who parked which seat"
        Icon={Armchair}
        tone="amber"
        testId="acc-chair-wall"
      >
        <ChairWallTeaser />
      </LandingAccordion>

      {/* What's Next — Live Now / Coming Soon / Post-Milestone trio */}
      <LandingAccordion
        title="What's Next"
        subtitle="Live Now · Coming Soon · Post-Milestone"
        Icon={Rocket}
        tone="emerald"
        testId="acc-whats-next"
      >
        <WhatsNext />
      </LandingAccordion>

      {/* Token & Treasury Roadmap — live on-chain status */}
      <LandingAccordion
        title="Token & Treasury Roadmap"
        subtitle="Path to TGE — live on-chain status"
        Icon={Map}
        tone="violet"
        testId="acc-token-roadmap"
      >
        <TokenRoadmap />
      </LandingAccordion>

      {/* Latest Additions — full feature index */}
      <LandingAccordion
        title="The Full Feature Index"
        subtitle="Everything we've shipped so far"
        Icon={Crown}
        tone="fuchsia"
        testId="acc-latest-additions"
      >
        <LatestAdditions />
      </LandingAccordion>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 text-center border-t border-purple-500/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            {/* Brand logo image — PNG is chroma-keyed transparent
                (Feb 2026). No blend-mode / border / bg classes needed. */}
            <img
              src="/global-vibez-logo.png?v=11"
              alt="Global Vibez DSG Logo"
              className="h-12 w-auto object-contain drop-shadow-[0_0_14px_rgba(217,70,239,0.55)]"
            />
            <h2 className="text-2xl font-black">
              <span className="text-white">GLOBAL VIBEZ</span>{' '}
              <span className="text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
                DSG
              </span>
            </h2>
          </div>
          <p className="text-purple-400 font-medium mb-2">
            Gaming · Dating · Streams · Earn
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-4 text-sm"
            aria-label="Legal"
          >
            <a href="/privacy" className="text-gray-400 hover:text-fuchsia-300 transition-colors">
              Privacy
            </a>
            <a href="/terms" className="text-gray-400 hover:text-fuchsia-300 transition-colors">
              Terms
            </a>
            <a href="/age-verification" className="text-gray-400 hover:text-fuchsia-300 transition-colors">
              18+ Age verification
            </a>
          </nav>
          <p className="text-sm text-gray-600">
            © 2026 Global Vibez DSG · Adults 18+ only
          </p>
        </div>
      </footer>
    </div>
  );
}
