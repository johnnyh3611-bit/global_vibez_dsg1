import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Gamepad2, Users, MapPin, Star, Sparkles, TrendingUp, Shield, Zap, Video, Trophy, Utensils, ArrowRight, Play } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function Landing() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    // Auto-rotate features
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Heart className="w-12 h-12" />,
      title: "Smart Dating",
      description: "AI-powered compatibility matching with verified profiles",
      color: "from-pink-500 to-red-500"
    },
    {
      icon: <Video className="w-12 h-12" />,
      title: "Live Streaming",
      description: "Stream your dates, gameplay, and personality - go live with matches!",
      color: "from-purple-500 to-indigo-500"
    },
    {
      icon: <Gamepad2 className="w-12 h-12" />,
      title: "Social Gaming",
      description: "16+ games including Chess, UNO, Blackjack, and tournaments",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <MapPin className="w-12 h-12" />,
      title: "Vibez Rides",
      description: "Safe dating transportation with trusted drivers and real-time tracking",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <Utensils className="w-12 h-12" />,
      title: "Date Spot Discovery",
      description: "AI date planner with 500+ verified restaurant recommendations",
      color: "from-orange-500 to-yellow-500"
    },
    {
      icon: <Shield className="w-12 h-12" />,
      title: "100% Verified",
      description: "ID & insurance verification for maximum safety and trust",
      color: "from-cyan-500 to-blue-500"
    }
  ];

  const stats = [
    { number: "16+", label: "Games" },
    { number: "95%", label: "Match Rate" },
    { number: "500+", label: "Date Spots" },
    { number: "100%", label: "Verified" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 overflow-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-20">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className={`relative z-10 max-w-6xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Logo/Brand - Enhanced with More Color & Emotion */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <motion.div 
              onClick={() => navigate('/vibe-vault-admin')}
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="relative cursor-pointer group"
              title=""
            >
              <Heart className="w-20 h-20 text-red-400 fill-red-400 drop-shadow-2xl group-hover:text-cyan-400 group-hover:fill-cyan-400 transition-colors duration-300" />
              <motion.div
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0"
              >
                <Heart className="w-20 h-20 text-pink-300 fill-pink-300 blur-sm group-hover:text-fuchsia-300 group-hover:fill-fuchsia-300 transition-colors duration-300" />
              </motion.div>
              <Sparkles className="w-8 h-8 text-yellow-300 absolute -top-3 -right-3 animate-spin drop-shadow-lg group-hover:text-cyan-300 transition-colors duration-300" />
            </motion.div>
            <div className="text-center">
              <motion.h1 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl md:text-8xl font-black tracking-tight hover:scale-105 transition-transform cursor-pointer"
              >
                <motion.span 
                  animate={{ 
                    textShadow: [
                      '0 0 20px rgba(255,255,255,0.5)',
                      '0 0 40px rgba(255,0,255,0.8)',
                      '0 0 20px rgba(255,255,255,0.5)'
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-block text-white drop-shadow-2xl"
                >
                  Global Vibez
                </motion.span>{' '}
                <motion.span 
                  animate={{ 
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  style={{ backgroundSize: '200% 200%' }}
                  className="inline-block bg-gradient-to-r from-pink-400 via-purple-500 via-blue-500 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-black"
                >
                  DSG
                </motion.span>
                <motion.span
                  animate={{ 
                    color: ['#fbbf24', '#f59e0b', '#fbbf24'],
                    textShadow: [
                      '0 0 10px rgba(251, 191, 36, 0.8)',
                      '0 0 20px rgba(245, 158, 11, 1)',
                      '0 0 10px rgba(251, 191, 36, 0.8)'
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="inline-block"
                >
                  ™
                </motion.span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg md:text-2xl font-bold text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text mt-2"
              >
                Dating • Streaming • Gaming
              </motion.p>
            </div>
          </div>

          {/* Main Tagline */}
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Where <span className="text-pink-300">Dating</span> Meets <span className="text-purple-300">Live Streaming</span>,<br />
            <span className="text-yellow-300">Gaming</span>, and <span className="text-cyan-300">Real Connections</span>
          </h2>

          {/* Social Infrastructure Network — LOCKED Marketing Tagline (v8.0) */}
          <div data-testid="landing-infrastructure-tagline" className="mb-6">
            <p className="text-base md:text-xl font-black tracking-[0.2em] text-[#00E5C7] uppercase">
              THE WORLD'S FIRST SOCIAL INFRASTRUCTURE NETWORK
            </p>
            <p className="text-sm md:text-base italic text-white/60 mt-2 max-w-2xl mx-auto">
              "Right now is the best time to sit at the table, because we are the best seat in the house."
            </p>
          </div>

          <p className="text-xl md:text-2xl text-gray-200 mb-4 max-w-3xl mx-auto">
            The revolutionary social platform with live date streams, 16+ games, verified profiles, and safe transportation.
          </p>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-3 justify-center items-center text-base md:text-lg mb-12"
          >
            <span className="bg-gradient-to-r from-pink-500 to-red-500 px-4 py-2 rounded-full text-white font-bold shadow-lg">
              💕 Smart Dating
            </span>
            <span className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 rounded-full text-white font-bold shadow-lg">
              📹 Live Streaming
            </span>
            <span className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 rounded-full text-white font-bold shadow-lg">
              🎮 16+ Games
            </span>
            <span className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 rounded-full text-white font-bold shadow-lg">
              🚗 Vibez Rides
            </span>
          </motion.div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={() => navigate('/signup')}
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg font-bold rounded-full shadow-2xl hover:scale-105 transition-transform"
            >
              <Play className="w-5 h-5 mr-2" />
              Sign Up Free
            </Button>
            <Button
              onClick={() => navigate('/login')}
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-bold rounded-full"
            >
              Sign In
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={`stats-${idx}`} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-4xl md:text-5xl font-black text-white mb-2">{stat.number}</div>
                <div className="text-gray-200 text-sm md:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-ping"></div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-4">
              Dating • Streaming • Gaming
            </h2>
            <p className="text-xl text-gray-200">
              Live connections, real-time entertainment, endless possibilities
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {features.map((feature, idx) => (
              <Card
                key={`features-${idx}`}
                className={`p-8 bg-white/10 backdrop-blur-lg border-2 transition-all duration-300 cursor-pointer ${
                  activeFeature === idx
                    ? 'border-white scale-105 shadow-2xl'
                    : 'border-white/20 hover:border-white/50'
                }`}
                onMouseEnter={() => setActiveFeature(idx)}
              >
                <div className={`inline-block p-4 rounded-2xl bg-gradient-to-r ${feature.color} mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-200">{feature.description}</p>
              </Card>
            ))}
          </div>

          {/* Feature Spotlight */}
          <Card className="p-12 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg border border-white/30">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className={`inline-block p-4 rounded-2xl bg-gradient-to-r ${features[activeFeature].color} mb-6`}>
                  {features[activeFeature].icon}
                </div>
                <h3 className="text-4xl font-black text-white mb-4">
                  {features[activeFeature].title}
                </h3>
                <p className="text-xl text-gray-200 mb-6">
                  {features[activeFeature].description}
                </p>
                <Button
                  onClick={() => {
                    const redirectUrl = `${window.location.origin}/dashboard`;
                    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
                  }}
                  className="bg-white text-purple-900 hover:bg-gray-100 px-6 py-3 font-bold rounded-full"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <Trophy className="w-8 h-8 text-yellow-300 mb-3" />
                  <p className="text-white font-bold">Tournaments</p>
                  <p className="text-sm text-gray-300">Compete & Win</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <Video className="w-8 h-8 text-pink-300 mb-3" />
                  <p className="text-white font-bold">Video Profiles</p>
                  <p className="text-sm text-gray-300">Show Your Vibe</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <Shield className="w-8 h-8 text-blue-300 mb-3" />
                  <p className="text-white font-bold">Verified</p>
                  <p className="text-sm text-gray-300">100% Safe</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <Zap className="w-8 h-8 text-purple-300 mb-3" />
                  <p className="text-white font-bold">AI Powered</p>
                  <p className="text-sm text-gray-300">Smart Matching</p>
                </div>
              </div>


      {/* Vibez Rides Spotlight Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="py-24 px-4 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-emerald-700 opacity-10"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
                🚗 <span className="text-transparent bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text">Vibez Rides</span>
              </h2>
              <p className="text-2xl text-gray-200 mb-6 font-bold">
                Safe Dating Transportation, Built Right In
              </p>
              <p className="text-xl text-gray-300 mb-8">
                Get a verified, trusted driver for your date. Real-time tracking, transparent pricing, and integrated safety features make Vibez Rides the safest way to meet.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-green-500 rounded-full p-2">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">100% Verified Drivers</h4>
                    <p className="text-gray-300">ID, insurance, and background checks required</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-500 rounded-full p-2">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Live Trip Sharing</h4>
                    <p className="text-gray-300">Share your ride with friends & dates in real-time</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-teal-500 rounded-full p-2">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Smart Pricing</h4>
                    <p className="text-gray-300">Transparent fares, split payments, premium discounts</p>
                  </div>
                </div>
              </div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="mt-8 inline-block"
              >
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-2xl border-2 border-white/20">
                  Coming Soon - Driver & Rider Platforms
                </div>
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-xl rounded-3xl p-8 border-2 border-green-400/30 shadow-2xl">
                <div className="text-center mb-6">
                  <p className="text-6xl mb-4">🚗💨</p>
                  <h3 className="text-3xl font-black text-white mb-2">Ride Share Meets Dating</h3>
                  <p className="text-gray-300">Safe • Verified • Integrated</p>
                </div>
                
                <div className="space-y-4 bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-gray-300">Platform Type</span>
                    <span className="text-white font-bold">Dual (Driver + Rider)</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-gray-300">Real-Time Tracking</span>
                    <span className="text-green-400 font-bold">✓ GPS + Mapping</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-gray-300">Safety Features</span>
                    <span className="text-green-400 font-bold">✓ Emergency SOS</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Split Fare with Date</span>
                    <span className="text-green-400 font-bold">✓ Built-In</span>
                  </div>
                </div>
                
                <div className="mt-6 text-center text-sm text-gray-400">
                  <p>📋 Full requirements documented</p>
                  <p>🚀 Ready for Phase 1 development</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

            </div>
          </Card>
        </div>
      </div>

      {/* Social Proof */}
      <div className="relative py-20 px-4 bg-black/20">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-12">
            Join Thousands Finding Their Vibe
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="p-8 bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="flex mb-4">
                {[1,2,3,4,5].map(i => (
                  <Star key={`star-${i}`} className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                ))}
              </div>
              <p className="text-white mb-4">"Finally, an app that gets it! Gaming dates are the best!"</p>
              <p className="text-gray-300 text-sm">- Sarah, 24</p>
            </Card>
            <Card className="p-8 bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="flex mb-4">
                {[1,2,3,4,5].map(i => (
                  <Star key={`star-${i}`} className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                ))}
              </div>
              <p className="text-white mb-4">"The AI date planner saved our anniversary. Perfect restaurant!"</p>
              <p className="text-gray-300 text-sm">- Mike & Emma</p>
            </Card>
            <Card className="p-8 bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="flex mb-4">
                {[1,2,3,4,5].map(i => (
                  <Star key={`star-${i}`} className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                ))}
              </div>
              <p className="text-white mb-4">"Made amazing friends through the group gaming feature!"</p>
              <p className="text-gray-300 text-sm">- Jason, 28</p>
            </Card>
          </div>
        </div>
      </div>

      {/* 🪧 The Four Pillars — LOCKED v8.0 Marketing OneSheet */}
      <div
        id="pillars"
        data-testid="landing-four-pillars"
        className="relative py-24 px-4 bg-[#0A0A0F]"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs md:text-sm uppercase tracking-[0.4em] text-[#00E5C7] font-black mb-3">
              The Four Pillars
            </p>
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">
              Built on <span className="text-[#FFD33D]">Ownership</span>.<br />
              Powered by <span className="text-[#00E5C7]">Connection</span>.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 1. Music Group — 70/30 Revolution */}
            <Card
              data-testid="pillar-music-group"
              className="p-8 bg-[#0F0F18] border border-[#FFD33D]/20 hover:border-[#FFD33D]/60 transition-colors group"
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
                AI Matchmaking for collabs, and a Global Totem Pole that ranks the planet.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {['Beat Vault', 'Freestyle Battles', 'Collab Matchmaker', 'Global Totem Pole'].map(t => (
                  <span key={t} className="px-2 py-1 rounded-full bg-[#FFD33D]/10 text-[#FFD33D] font-bold">
                    {t}
                  </span>
                ))}
              </div>
            </Card>

            {/* 2. DSG TV */}
            <Card
              data-testid="pillar-dsg-tv"
              className="p-8 bg-[#0F0F18] border border-[#1E40AF]/30 hover:border-[#1E40AF]/70 transition-colors"
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
                  <span key={t} className="px-2 py-1 rounded-full bg-[#1E40AF]/20 text-[#3B82F6] font-bold">
                    {t}
                  </span>
                ))}
              </div>
            </Card>

            {/* 3. Find Your Player Two */}
            <Card
              data-testid="pillar-player-two"
              className="p-8 bg-[#0F0F18] border border-[#00E5C7]/30 hover:border-[#00E5C7]/70 transition-colors"
            >
              <p className="text-xs font-black uppercase tracking-widest text-[#00E5C7] mb-2">
                03 — Find Your Player Two
              </p>
              <h3 className="text-2xl font-black text-white mb-3">
                Vigilant Matchmaking — <span className="text-[#00E5C7]">98%</span> Synergy Logic
              </h3>
              <p className="text-white/70 mb-4 leading-relaxed">
                Meet, chat, and go on <span className="text-[#00E5C7] font-black">Cinema Dates</span>{' '}
                inside the app — with synced movie streaming, voice rooms, and culturally-aware AI dealers.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {['98% Synergy', 'Cinema Dates', 'Synced Streaming', 'Cultural Hub'].map(t => (
                  <span key={t} className="px-2 py-1 rounded-full bg-[#00E5C7]/10 text-[#00E5C7] font-bold">
                    {t}
                  </span>
                ))}
              </div>
            </Card>

            {/* 4. Vibe Yellow Pages */}
            <Card
              data-testid="pillar-yellow-pages"
              className="p-8 bg-[#0F0F18] border border-[#FF8A1F]/30 hover:border-[#FF8A1F]/70 transition-colors"
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
                {['Local Sponsors', 'Hungry Vibes', 'DSG Guard', 'Geo-Pinned'].map(t => (
                  <span key={t} className="px-2 py-1 rounded-full bg-[#FF8A1F]/10 text-[#FF8A1F] font-bold">
                    {t}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* 🪑 Genius Phase — Chair Holder Network (LOCKED v8.0) */}
      <div
        id="genius-phase"
        data-testid="landing-genius-phase"
        className="relative py-24 px-4 bg-gradient-to-b from-[#0A0A0F] via-[#0F0F18] to-[#0A0A0F] border-t border-[#FFD33D]/10"
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
            Genius ($20 · 50K seats) · Genesis ($100 · 100K seats) · Apex ($250 · 50K seats) ·
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
                <div className="text-3xl md:text-4xl font-black text-[#FFD33D] mb-1">
                  {s.num}
                </div>
                <div className="text-xs uppercase tracking-wider text-white/50">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => navigate('/signup')}
            data-testid="landing-secure-chair-btn"
            className="bg-[#FFD33D] hover:bg-[#FFE066] text-black px-10 py-7 text-xl md:text-2xl font-black rounded-full shadow-2xl shadow-[#FFD33D]/20 hover:scale-105 transition-transform"
          >
            SECURE YOUR CHAIR
          </Button>
          <p className="text-white/40 text-xs mt-4 uppercase tracking-widest">
            Scan to join the Genius Phase
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative py-32 px-4 bg-[#0A0A0F]">
        <div className="max-w-4xl mx-auto text-center">
          <h2
            data-testid="landing-final-cta-headline"
            className="text-4xl md:text-7xl font-black mb-6 leading-tight"
          >
            <span className="text-[#FF8A1F]">LOCK IN YOUR VIBE.</span>
            <br />
            <span className="text-white">OWN THE NETWORK.</span>
          </h2>
          <p className="text-xl md:text-2xl text-white/60 mb-12">
            Join the Genius Phase. Get started in 60 seconds — free.
          </p>
          <Button
            onClick={() => {
              const redirectUrl = `${window.location.origin}/dashboard`;
              window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
            }}
            data-testid="landing-final-cta-button"
            className="bg-[#FF8A1F] hover:bg-[#FFA040] text-black px-12 py-8 text-xl md:text-2xl font-black rounded-full shadow-2xl shadow-[#FF8A1F]/30 transform hover:scale-105 transition-all uppercase tracking-wider"
          >
            <Heart className="w-7 h-7 mr-3" />
            Sign Up Free
          </Button>
          <p className="text-white/40 mt-6 text-sm uppercase tracking-widest">
            No credit card required · 100% verified users
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/20 py-8 px-4 relative">
        <div className="max-w-6xl mx-auto text-center text-gray-300">
          <p>© 2026 Global Vibez DSG. All rights reserved.</p>
          <p className="mt-2">
            Powered by <span className="font-semibold text-white">H&S SOLUTIONS GROUP LLC</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
