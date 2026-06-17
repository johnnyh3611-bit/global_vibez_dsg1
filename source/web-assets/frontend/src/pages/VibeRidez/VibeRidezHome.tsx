import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Users, ArrowRight, Power, Glasses, Coins, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function VibeRidezHome() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Power className="w-8 h-8" />,
      title: 'Kill-Switch Privacy',
      description:
        'Instant Blackout severs the WebRTC stream while keeping the ride active. AI masking blurs minors and non-consenting passengers in real time.',
      color: 'from-rose-500 to-pink-500',
      testid: 'vrh-feature-kill-switch',
    },
    {
      icon: <Glasses className="w-8 h-8" />,
      title: 'AR/VR Streaming HUD',
      description:
        'Drivers wear AR glasses. The Celestial Glasshouse HUD puts navigation + chat in their line of sight — no handheld phone, no distraction.',
      color: 'from-cyan-500 to-blue-500',
      testid: 'vrh-feature-vr-hud',
    },
    {
      icon: <Coins className="w-8 h-8" />,
      title: 'Solana Fare Splitter',
      description:
        '70% to driver · 20% platform · 10% community Liquidity Pool. On-chain Rust contract executes the split the moment Safety Check-In is validated.',
      color: 'from-emerald-500 to-green-500',
      testid: 'vrh-feature-fare-splitter',
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'VibeXP → $DSG',
      description:
        'Earn 100 XP per safe ride · 10 XP per streamed mile · variable XP from passenger tips. Converts to $DSG tokens at TGE.',
      color: 'from-amber-500 to-orange-500',
      testid: 'vrh-feature-vibexp',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50" />
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-6xl md:text-7xl font-black text-white mb-6">
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Vibe Ridez
              </span>
            </h1>
            <p className="text-2xl md:text-3xl text-gray-300 mb-8 font-light">
              The Creator Fleet · Drive. Stream. Earn.
            </p>
            <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
              The first ride-share network where drivers earn from rides,
              live streams, AND virtual gifts on the same trip — secured by
              an on-chain Solana fare splitter and absolute Kill-Switch privacy.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/vibe-ridez/search')}
                size="lg"
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white px-8 py-6 text-lg"
              >
                <Users className="mr-2 h-6 w-6" />
                Find a Ride
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => navigate('/vibe-ridez/driver-registration')}
                size="lg"
                variant="outline"
                className="border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white px-8 py-6 text-lg"
              >
                <Car className="mr-2 h-6 w-6" />
                Become a Driver
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            Why Choose <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Vibe Ridez</span>?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            We're not just about getting from A to B. We're about the journey.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={`features-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                data-testid={feature.testid}
              >
                <Card className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800/70 transition-all hover:scale-105 h-full">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 text-white`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* How It Works */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Drive in <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">3 Steps</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center" data-testid="vrh-step-sync">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Sync Your Identity</h3>
              <p className="text-gray-400">
                Open the Driver Portal and link your Solana wallet to receive
                $DSG earnings.
              </p>
            </div>

            <div className="text-center" data-testid="vrh-step-gear">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Setup Your Gear</h3>
              <p className="text-gray-400">
                5G phone, dashboard mount, AR/VR viewers, RGB interior, mic.
                Run the Creator Gear Checklist (BYOD).
              </p>
            </div>

            <div className="text-center" data-testid="vrh-step-golive">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Hit "Start Vibe"</h3>
              <p className="text-gray-400">
                Go live, accept rides within the 15-second window, broadcast
                to your followers, get paid.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 border-0 p-12 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Start Your Journey?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Join thousands of travelers sharing rides and making connections across the country.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/vibe-ridez/search')}
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg font-bold"
              >
                Find Your Ride Now
              </Button>
              <Button
                onClick={() => navigate('/vibe-ridez/post-ride')}
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-purple-600 px-8 py-6 text-lg font-bold"
              >
                Post a Ride
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}