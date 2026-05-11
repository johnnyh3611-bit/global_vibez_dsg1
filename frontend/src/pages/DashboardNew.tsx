import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Globe, Heart, LogOut, Settings, Sparkles, Crown, MessageCircle, Gamepad2,
  Trophy, Utensils, Car, Wallet, TrendingUp, Moon, Music, Film, Pizza,
  Languages, Mic, MapPin, BookMarked,
  // May 2026 PDF batch
  PenTool, Smile, Search, Eye, ShoppingBag, Disc3, Radio,
  // Music Arena + TV Totem Pole batch
  Mic2, Tv, Headphones, Swords, Sparkle,
  // Cyber Casino tile (Unity WebGL, see CyberCasinoRoom.tsx)
  Joystick,
} from 'lucide-react';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import Logo from '@/components/Logo';
import CreditBalance from '@/components/CreditBalance';
import AppFooter from '@/components/AppFooter';
import NotificationBanner from '@/components/NotificationBanner';
import ChairHolderVoteBanner from '@/components/dashboard/ChairHolderVoteBanner';
import RideHomeButton from '@/components/common/RideHomeButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Use Bearer token from localStorage (the auth flow stores it on
        // login/demo-login). Sending credentials:'include' would be blocked
        // by the edge gateway's Allow-Origin:* CORS header.
        const token = localStorage.getItem('auth_token');
        if (!token) throw new Error('No auth token');
        const response = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Not authenticated');

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Clear local Bearer fallback so we don't re-auth with a stale token
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
      navigate('/');
    } catch (error) {
      // console.error('Logout error:', error);
    }
  };

  const rooms = [
    {
      id: 'dating',
      name: 'Dating Universe',
      description: 'Find your perfect match with AI-powered compatibility',
      icon: Heart,
      gradient: 'from-pink-600 via-rose-500 to-purple-600',
      glow: 'rgba(225,29,72,0.5)',
      image: 'https://images.unsplash.com/photo-1567888818654-8e77698cdd4d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwzfHxkaXZlcnNlJTIwaGFwcHklMjBjb3VwbGUlMjBkYXRpbmclMjByb29tYW50aWMlMjBsaWdodGluZyUyMHRhYmxlfGVufDB8fHx8MTc3MzY5OTMxN3ww&ixlib=rb-4.1.0&q=85',
      path: '/discover',
      stats: { count: user?.match_count || 0, label: 'Matches' }
    },
    {
      id: 'gamer_dating',
      name: 'Find Your Player 2',
      description: 'Match with gamers and play together - dating through gaming',
      icon: Heart,
      gradient: 'from-pink-500 via-fuchsia-500 to-purple-600',
      glow: 'rgba(236,72,153,0.5)',
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw2fHxjb3VwbGUlMjBkYXRpbmd8ZW58MHx8fHwxNzM5NTU2MDE2fDA&ixlib=rb-4.1.0&q=85',
      path: '/dating/profile/setup',
      stats: { count: 'NEW', label: 'Feature' }
    },
    {
      id: 'myvibez',
      name: 'MY VIBEZ',
      description: 'TikTok-style viral content - watch & create trending videos',
      icon: TrendingUp,
      gradient: 'from-cyan-400 via-blue-500 to-purple-600',
      glow: 'rgba(34,211,238,0.6)',
      image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?crop=entropy&cs=srgb&fm=jpg&ixid=M3w0NDExMzZ8MHwxfHNlYXJjaHwxfHx0aWt0b2slMjB2aXJhbCUyMHZpZGVvJTIwY29udGVudCUyMGNyZWF0b3J8ZW58MHx8fHwxNzQxNTczNTkzfDA&ixlib=rb-4.1.0&q=85',
      path: '/my-vibez',
      stats: { count: '🔥', label: 'Trending' }
    },
    {
      id: 'games',
      name: 'Game Arena',
      description: 'Play 34+ games including Casino, Arcade, Board & Card games',
      icon: Gamepad2,
      gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
      glow: 'rgba(14,165,233,0.5)',
      image: 'https://images.unsplash.com/photo-1672224745017-a9b54ad9188f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw0fHxuZW9uJTIwZnV0dXJpc3RpYyUyMGdhbWUlMjByb29tJTIwM2R8ZW58MHx8fHwxNzczNjk5MzE2fDA&ixlib=rb-4.1.0&q=85',
      path: '/practice',
      stats: { count: '34', label: 'Games' }
    },
    {
      id: 'tournaments',
      name: 'Tournament Hall',
      description: 'Compete in couples & friends tournaments for prizes',
      icon: Trophy,
      gradient: 'from-amber-400 via-orange-500 to-purple-700',
      glow: 'rgba(245,158,11,0.5)',
      image: 'https://images.unsplash.com/photo-1728488447889-13f95adcf5a0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBnb2xkJTIwZGFyayUyMHZpcCUyMGxvdW5nZSUyMGludGVyaW9yfGVufDB8fHx8MTc3MzY5OTMyOXww&ixlib=rb-4.1.0&q=85',
      path: '/tournaments',
      stats: { count: '$', label: 'Win Credits' }
    },
    {
      id: 'social',
      name: 'Social Lounge',
      description: 'Connect with matches and make new friends',
      icon: MessageCircle,
      gradient: 'from-orange-500 via-pink-500 to-rose-500',
      glow: 'rgba(249,115,22,0.5)',
      image: 'https://images.unsplash.com/photo-1753674693617-0d5beec33f28?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHw0fHxkaXZlcnNlJTIwaGFwcHklMjBjb3VwbGUlMjBkYXRpbmclMjByb21hbnRpYyUyMGxpZ2h0aW5nfGVufDB8fHx8MTc3MzY5OTMxN3ww&ixlib=rb-4.1.0&q=85',
      path: '/matches',
      stats: { count: user?.message_count || 0, label: 'Messages' }
    },
    {
      id: 'datespot',
      name: 'Date Spot Finder',
      description: 'AI-powered restaurant recommendations',
      icon: Utensils,
      gradient: 'from-orange-400 via-red-500 to-pink-600',
      glow: 'rgba(251,146,60,0.5)',
      image: 'https://images.unsplash.com/photo-1760662503661-5f3781cd2a87?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwzfHxyZXN0YXVyYW50JTIwZGlubmVyJTIwcm9tYW50aWMlMjBsaWdodGluZyUyMHRhYmxlfGVufDB8fHx8MTc3MzY5OTMzMXww&ixlib=rb-4.1.0&q=85',
      // FIXED 2026-02-16: was '/date-spots' (404). Real route is '/date-spot-finder'.
      path: '/date-spot-finder',
      stats: { count: '500+', label: 'Venues' }
    },
    // ─────── New tiles surfaced 2026-02-16 (founder asked: "I don't see none of the stuff we added") ───────
    {
      id: 'just_for_the_night',
      name: 'Just For The Night',
      description: 'Live now-or-never connections — vanish at sunrise',
      icon: Moon,
      gradient: 'from-purple-500 via-fuchsia-500 to-pink-600',
      glow: 'rgba(168,85,247,0.5)',
      image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?crop=entropy&cs=srgb&fm=jpg',
      path: '/just-for-the-night',
      stats: { count: 'NEW', label: 'After 9PM' }
    },
    {
      id: 'hungry_vibez',
      name: 'Hungry Vibez',
      description: 'Food delivery on the same fleet as VibeRidez',
      icon: Pizza,
      gradient: 'from-orange-500 via-red-500 to-fuchsia-600',
      glow: 'rgba(249,115,22,0.5)',
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?crop=entropy&cs=srgb&fm=jpg',
      path: '/hungryvibes',
      stats: { count: '24/7', label: 'Delivery' }
    },
    {
      id: 'vibez_tv',
      name: 'Global Vibez DSG TV',
      description: 'Your 24/7 personal network — 30-min episodes',
      icon: Film,
      gradient: 'from-indigo-500 via-blue-600 to-cyan-500',
      glow: 'rgba(99,102,241,0.5)',
      image: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?crop=entropy&cs=srgb&fm=jpg',
      path: '/vibe-tv',
      stats: { count: 'LIVE', label: 'Streaming' }
    },
    {
      id: 'dsg_music_group',
      name: 'DSG Music Group',
      description: '70/30 Revolution — beats, battles, collab matchmaker',
      icon: Music,
      gradient: 'from-yellow-400 via-amber-500 to-orange-600',
      glow: 'rgba(251,191,36,0.5)',
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/music-group',
      stats: { count: '70/30', label: 'Pillar 01' }
    },
    {
      id: 'yellow_pages',
      name: 'Vibe Yellow Pages',
      description: 'Mom & Pop directory — DSG Guard verified · hyper-local',
      icon: BookMarked,
      gradient: 'from-yellow-400 via-yellow-500 to-orange-500',
      glow: 'rgba(253,224,71,0.5)',
      image: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?crop=entropy&cs=srgb&fm=jpg',
      path: '/yellow-pages',
      stats: { count: 'NEW', label: 'Pillar 04' }
    },
    {
      id: 'beat_vault',
      name: 'Beat Vault',
      description: 'Auction & buy beats — artists keep 70% forever',
      icon: Music,
      gradient: 'from-yellow-400 via-amber-500 to-orange-600',
      glow: 'rgba(251,191,36,0.5)',
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/beat-vault',
      stats: { count: '70/30', label: 'Revolution' }
    },
    {
      id: 'memory_bank',
      name: 'Memory Bank',
      description: 'Sync-watch movies on Cinema Dates with your match',
      icon: Heart,
      gradient: 'from-rose-500 via-pink-600 to-purple-700',
      glow: 'rgba(244,63,94,0.5)',
      image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/memory-bank',
      stats: { count: '∞', label: 'Date Nights' }
    },
    {
      id: 'vigilant_matchmaking',
      name: 'Vigilant Matchmaking',
      description: '98% synergy logic — find your true Player 2',
      icon: Sparkles,
      gradient: 'from-cyan-400 via-teal-500 to-emerald-500',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/matchmaking',
      stats: { count: '98%', label: 'Synergy' }
    },
    {
      id: 'cultural_onboarding',
      name: 'Cultural Profile',
      description: 'Set your home, dialect & cultural values for 200% global fit',
      icon: Languages,
      gradient: 'from-emerald-400 via-cyan-500 to-blue-600',
      glow: 'rgba(20,184,166,0.5)',
      image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?crop=entropy&cs=srgb&fm=jpg',
      path: '/dating/cultural-onboarding',
      stats: { count: '4', label: 'Steps' }
    },
    {
      id: 'voice_mirror',
      name: 'Voice Mirror',
      description: 'Pair your voice with a partner — chat hands-free',
      icon: Mic,
      gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
      glow: 'rgba(217,70,239,0.5)',
      image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?crop=entropy&cs=srgb&fm=jpg',
      path: '/voice-mirror',
      stats: { count: '🎙', label: 'Pair Up' }
    },
    {
      id: 'rides',
      name: 'Vibes Rides',
      description: 'Safe, verified transportation for dates',
      icon: Car,
      gradient: 'from-blue-600 via-sky-500 to-cyan-400',
      glow: 'rgba(59,130,246,0.5)',
      image: 'https://images.unsplash.com/photo-1673293964910-1a7dc4d5aa47?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwxfHx0cnVzdHdvcnRoeSUyMHNhZmUlMjBkcml2ZXIlMjBjYXIlMjBpbnRlcmlvciUyMG1vZGVybnxlbnwwfHx8fDE3NzM2OTkzMTl8MA&ixlib=rb-4.1.0&q=85',
      path: '/rides',
      stats: { count: '100%', label: 'Verified' }
    },
    // ─────── May 2026 PDF batch (Streamer Revenue / Master Tech /
    //         Party Hub blueprints). Each room runs on the already-
    //         shipped /api/streamer-actions/* + /api/dsg-guard/* rails.
    {
      id: 'vibetionary',
      name: 'Vibe-tionary',
      description: 'Collaborative neon-light drawing — guess the AI prompt for 1.5× stake',
      icon: PenTool,
      gradient: 'from-cyan-400 via-fuchsia-500 to-amber-300',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?crop=entropy&cs=srgb&fm=jpg',
      path: '/party/vibe-tionary',
      stats: { count: 'NEW', label: 'Party Hub' }
    },
    {
      id: 'meme_matchmaker',
      name: 'Meme Matchmaker',
      description: 'Underground Club — vote with 3D Glass Emojis · 86.5% winner share',
      icon: Smile,
      gradient: 'from-fuchsia-500 via-pink-500 to-amber-400',
      glow: 'rgba(217,70,239,0.5)',
      image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?crop=entropy&cs=srgb&fm=jpg',
      path: '/party/meme-matchmaker',
      stats: { count: 'NEW', label: 'Vote-to-Earn' }
    },
    {
      id: 'hide_seek',
      name: 'Vibe-Hide & Seek',
      description: 'Geo-spatial hunt across local Yellow Pages merchants — 5% kickback',
      icon: Search,
      gradient: 'from-emerald-400 via-cyan-500 to-amber-300',
      glow: 'rgba(16,185,129,0.5)',
      image: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?crop=entropy&cs=srgb&fm=jpg',
      path: '/party/hide-seek',
      stats: { count: 'NEW', label: 'Local Mining' }
    },
    {
      id: 'blind_auction',
      name: 'Blind Auction',
      description: 'Frost-filtered profiles · highest bid vs 98% synergy auto-bridge',
      icon: Eye,
      gradient: 'from-rose-500 via-pink-500 to-amber-300',
      glow: 'rgba(244,63,94,0.5)',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=srgb&fm=jpg',
      path: '/dating/blind-auction',
      stats: { count: 'NEW', label: 'Game Show' }
    },
    {
      id: 'vibeshopper',
      name: 'VibeShopper Hunt',
      description: 'Daily Odd Item Loop · 1.5× VibeXP boost · Vibe Vault escrow',
      icon: ShoppingBag,
      gradient: 'from-amber-400 via-orange-500 to-fuchsia-500',
      glow: 'rgba(245,158,11,0.5)',
      image: 'https://images.unsplash.com/photo-1601598704991-eef6114775c3?crop=entropy&cs=srgb&fm=jpg',
      path: '/vibeshopper',
      stats: { count: 'NEW', label: 'Direct-to-Shelf' }
    },
    {
      id: 'beat_vault_dlc',
      name: 'Beat Vault DLC',
      description: 'Mint finished tracks as Vibe DLC — artist keeps 70% forever',
      icon: Disc3,
      gradient: 'from-amber-500 via-orange-500 to-yellow-300',
      glow: 'rgba(217,119,6,0.5)',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?crop=entropy&cs=srgb&fm=jpg',
      path: '/beat-vault/dlc',
      stats: { count: 'NEW', label: '70/30' }
    },
    {
      id: 'streamer_overlay',
      name: 'Streamer Overlay',
      description: 'OBS browser source — heckle / buff / hype meter live FX',
      icon: Radio,
      gradient: 'from-violet-500 via-fuchsia-500 to-pink-500',
      glow: 'rgba(139,92,246,0.5)',
      image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?crop=entropy&cs=srgb&fm=jpg',
      path: '/streamer/overlay/demo',
      stats: { count: 'OBS', label: 'Live FX' }
    },
    // ─────── May 2026 — Music Arena + TV Totem Pole Blueprints ───────
    {
      id: 'sound_check',
      name: 'Sound-Check Gauntlet',
      description: '15-second flips · Vibe / No-Vibe swipe · Live Pilot Slot reward',
      icon: Headphones,
      gradient: 'from-fuchsia-500 via-pink-500 to-amber-300',
      glow: 'rgba(217,70,239,0.5)',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/sound-check',
      stats: { count: 'NEW', label: 'Music Arena' }
    },
    {
      id: 'collab_matchmaker',
      name: 'Collab Matchmaker',
      description: '98% Synergy Logic · pair producers with vocalists in Vibe Suites',
      icon: Mic2,
      gradient: 'from-cyan-400 via-fuchsia-500 to-amber-300',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/collab-matchmaker',
      stats: { count: '98%', label: 'Synergy' }
    },
    {
      id: 'totem_battles',
      name: 'Totem Pole Battles',
      description: '1v1 music-video battles · audience gifts decide · Power Hour ×1.5',
      icon: Swords,
      gradient: 'from-orange-500 via-rose-500 to-amber-300',
      glow: 'rgba(249,115,22,0.5)',
      image: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/totem-battles',
      stats: { count: 'LIVE', label: 'Battles' }
    },
    {
      id: 'tv_totem_pole',
      name: 'Vibe TV · Totem Pole',
      description: 'Audience-survival queue · Tip-to-Shield · 18+ age gating',
      icon: Tv,
      gradient: 'from-purple-500 via-pink-500 to-amber-300',
      glow: 'rgba(168,85,247,0.5)',
      image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?crop=entropy&cs=srgb&fm=jpg',
      path: '/tv/totem-pole',
      stats: { count: 'NEW', label: 'PG-13 / 18+' }
    },
    {
      id: 'vibe_suite',
      name: 'Vibe Suite',
      description: 'Live producer↔vocalist co-recording · Agora RTC · Pay-to-Suggest',
      icon: Mic2,
      gradient: 'from-cyan-400 via-fuchsia-500 to-rose-400',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/vibe-suite/demo',
      stats: { count: 'LIVE', label: 'Agora RTC' }
    },
    {
      id: 'lyric_glasshouse',
      name: 'Lyric Glasshouse',
      description: '3D frequency-reactive visualizer — drop into OBS as a scene',
      icon: Sparkle,
      gradient: 'from-cyan-300 via-fuchsia-400 to-amber-300',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/glasshouse',
      stats: { count: '3D', label: 'WebGL' }
    },
    {
      id: 'cyber_casino',
      name: 'Cyber Casino',
      description: 'Unity WebGL casino games · 72-hour God-Mode escrow rewards',
      icon: Joystick,
      gradient: 'from-violet-500 via-fuchsia-500 to-cyan-400',
      glow: 'rgba(139,92,246,0.5)',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?crop=entropy&cs=srgb&fm=jpg',
      path: '/cyber-casino',
      stats: { count: 'WebGL', label: 'Unity' }
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <motion.div 
          className="text-white text-xl"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading your universe...
        </motion.div>
      </div>
    );
  }

  return (
    <RoomLayout theme="games" showStars={true}>
      {/* Notification Banner - Only shows after login */}
      <NotificationBanner />
      

      {/* Header */}
      <header className="relative z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-white">Global Vibez DSG</h1>
              <p className="text-xs text-slate-300">The Social Multiverse</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <CreditBalance />
            
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-fuchsia-200 hover:text-white hover:bg-fuchsia-500/20 border border-fuchsia-400/40 rounded-full px-3 md:px-4 py-1.5 text-[10px] md:text-xs uppercase tracking-widest animate-pulse"
              onClick={() => {
                // 2026-05-12: persist Volumetric as the user's preferred dashboard.
                localStorage.setItem("gv_dashboard_view", "volumetric");
                navigate("/dashboard");
              }}
              aria-label="Switch to volumetric view"
              data-testid="dashboard-try-volumetric"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">Try Volumetric</span>
              <span className="sm:hidden">3D</span>
            </Button>

            <GlassCard className="px-4 py-2" hoverable={false}>
              <div className="text-white text-sm">
                <span className="font-semibold">{user?.name}</span>
                {user?.membership_type !== 'free' && (
                  <Crown className="w-4 h-4 inline-block ml-2 text-yellow-400" />
                )}
              </div>
            </GlassCard>
            
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => navigate('/profile/edit')}
              aria-label="Settings"
              title="Settings"
              data-testid="dashboard-settings-btn"
            >
              <Settings className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              data-testid="dashboard-logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Welcome Section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Welcome Back, <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0]}</span>
          </h2>
          <p className="text-xl text-slate-300">
            Choose your destination in the Global Vibez DSG universe
          </p>
        </motion.div>

        {/* 🌌 Volumetric preview banner — founder ask 2026-05-12 ("build it
            first to see what it looks like; if I don't like it, take it
            off"). Big, can't-miss A/B toggle into the new Three.js dashboard. */}
        <motion.button
          type="button"
          onClick={() => {
            localStorage.setItem("gv_dashboard_view", "volumetric");
            navigate("/dashboard");
          }}
          data-testid="dashboard-volumetric-banner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="group relative w-full mb-8 overflow-hidden rounded-2xl border-2 border-fuchsia-400/50 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/30 to-cyan-600/30 backdrop-blur-md px-5 py-5 text-left hover:scale-[1.005] active:scale-[0.995] transition-transform shadow-[0_0_40px_-10px_rgba(217,70,239,0.6)]"
        >
          <div className="absolute -inset-px bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/30 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="text-4xl md:text-5xl animate-pulse">🌌</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-300 font-bold flex items-center gap-2">
                NEW · Founder Preview
                <span className="bg-amber-400 text-amber-950 text-[8px] px-2 py-0.5 rounded-full font-black">A/B</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-white mt-1">
                Try the Volumetric Galaxy Dashboard
              </div>
              <div className="text-xs sm:text-sm text-fuchsia-100/80 mt-1">
                6 emissive planets · drag to spin · tap to dive in. Don't like it? One tap brings you back to Classic.
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-fuchsia-200 text-xs uppercase tracking-widest font-black">
              Open 3D →
            </div>
          </div>
        </motion.button>

        {/* Chair-holder vote banner — chair holders only, auto-hides if no open polls */}
        <ChairHolderVoteBanner />

        {/* What's New — May 2026 PDF batch (Streamer Revenue / Master
            Tech / Party Hub blueprints). Surfaces the seven new rooms
            shipped this week so the founder/users can find them. */}
        <motion.div
          data-testid="whats-new-banner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mb-10 rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/10 via-cyan-500/5 to-amber-500/10 backdrop-blur-md px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-amber-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-300 font-bold">
                What's New · May 2026
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                15 new rooms live — Vibe-tionary, Meme Matchmaker, Hide & Seek (now with Mapbox),
                Blind Auction, VibeShopper Hunt, Beat Vault DLC, Streamer Overlay,
                Sound-Check Gauntlet, Collab Matchmaker, Totem Pole Battles, Vibe TV Totem Pole,
                Vibe Suite (Agora RTC), Lyric Glasshouse (3D), Cyber Casino (Unity WebGL)
              </div>
              <div className="text-xs text-white/70 mt-1">
                Powered by the <span className="text-cyan-300 font-bold">Streamer Action Hub</span>, <span className="text-amber-300 font-bold">DSG Guard</span>, and <span className="text-fuchsia-300 font-bold">Totem Pole rails</span> ·
                70/13.5/10 split locked · Power Hour ×1.5 · 98% Synergy · Tip-to-Shield $2/5min ·
                {' '}
                <a href="/streamer/setup-guide" className="underline text-emerald-300">Streamer Setup Guide →</a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Ride Home — Roadmap PDF §3. One-tap geo-locked ride from
            the lobby. Hands off to /rides with lat/lng pre-filled. */}
        <div
          data-testid="dashboard-ride-home-row"
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-950/60 via-slate-950/40 to-cyan-950/40 backdrop-blur p-4"
        >
          <div className="text-white/90">
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-cyan-300">Need a lift?</p>
            <p className="text-base sm:text-lg font-black">One-tap Ride Home from anywhere on the platform.</p>
          </div>
          <RideHomeButton />
        </div>

        {/* Room Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {rooms.map((room, index) => {
            const Icon = room.icon;
            
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <GlassCard
                  hoverable={true}
                  onClick={() => navigate(room.path)}
                  glow={true}
                  glowColor={room.glow}
                  className="group overflow-hidden h-full"
                >
                  {/* Background Image */}
                  <div className="relative h-48 overflow-hidden">
                    <div 
                      className="absolute inset-0 bg-cover bg-center transform group-hover:scale-110 transition-transform duration-500"
                      style={{ backgroundImage: `url(${room.image})` }}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${room.gradient} opacity-60 group-hover:opacity-40 transition-opacity duration-300`} />
                    
                    {/* Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <Icon className="w-20 h-20 text-white drop-shadow-2xl" />
                      </motion.div>
                    </div>

                    {/* Stats Badge */}
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full">
                      <span className="text-white font-mono font-bold">{room.stats.count}</span>
                      <span className="text-slate-300 text-sm ml-1">{room.stats.label}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {room.name}
                    </h3>
                    <p className="text-slate-300 mb-4">
                      {room.description}
                    </p>
                    
                    <div className={`inline-flex items-center gap-2 text-white font-semibold px-4 py-2 rounded-full bg-gradient-to-r ${room.gradient}`}>
                      <span>Enter</span>
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <GlassCard className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {user?.membership_type === 'free' ? 'Unlock Premium Features' : 'Your Premium Status'}
                </h3>
                <p className="text-slate-300">
                  {user?.membership_type === 'free' 
                    ? 'Get unlimited access to all rooms, games, and exclusive features'
                    : 'You have access to all premium features across the universe'
                  }
                </p>
              </div>
              
              <div className="flex gap-4">
                {user?.membership_type === 'free' && (
                  <NeonButton
                    variant="gradient"
                    onClick={() => navigate('/pricing')}
                  >
                    <Crown className="w-5 h-5 inline-block mr-2" />
                    Upgrade Now
                  </NeonButton>
                )}
                
                <NeonButton
                  variant="ghost"
                  onClick={() => navigate('/practice')}
                >
                  <Gamepad2 className="w-5 h-5 inline-block mr-2" />
                  Practice Mode
                </NeonButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <AppFooter />
    </RoomLayout>
  );
}
