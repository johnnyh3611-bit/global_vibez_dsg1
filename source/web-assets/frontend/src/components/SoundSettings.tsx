// Sound Settings Component
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Music, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function SoundSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('soundSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      setSoundEnabled(settings.soundEnabled ?? true);
      setVolume(settings.volume ?? 0.7);
      setMusicEnabled(settings.musicEnabled ?? false);
      setNotificationsEnabled(settings.notificationsEnabled ?? true);
    }
  }, []);

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('soundSettings', JSON.stringify({
      soundEnabled,
      volume,
      musicEnabled,
      notificationsEnabled
    }));
  }, [soundEnabled, volume, musicEnabled, notificationsEnabled]);

  return (
    <Card className="bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 p-6 max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Volume2 className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white">Sound Settings</h2>
      </div>

      {/* Master Sound Toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {soundEnabled ? <Volume2 className="w-5 h-5 text-green-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}
            <span className="text-white">Sound Effects</span>
          </div>
          <Button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`${soundEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            {soundEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>

        {/* Volume Slider */}
        {soundEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-8"
          >
            <label className="text-sm text-gray-300 block mb-2">
              Volume: {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </motion.div>
        )}

        {/* Background Music */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className={`w-5 h-5 ${musicEnabled ? 'text-purple-400' : 'text-gray-500'}`} />
            <span className="text-white">Background Music</span>
          </div>
          <Button
            onClick={() => setMusicEnabled(!musicEnabled)}
            className={`${musicEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            {musicEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className={`w-5 h-5 ${notificationsEnabled ? 'text-blue-400' : 'text-gray-500'}`} />
            <span className="text-white">Notifications</span>
          </div>
          <Button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`${notificationsEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            {notificationsEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      {/* Test Sounds */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <p className="text-sm text-gray-400 mb-3">Test Sounds:</p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            onClick={() => {
              // Would trigger test sound
            }}
            className="bg-slate-700 hover:bg-slate-600"
          >
            🎲 Dice
          </Button>
          <Button
            size="sm"
            onClick={() => {
            }}
            className="bg-slate-700 hover:bg-slate-600"
          >
            ♟️ Move
          </Button>
          <Button
            size="sm"
            onClick={() => {
            }}
            className="bg-slate-700 hover:bg-slate-600"
          >
            🏆 Win
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Hook to get sound settings
export function useSoundSettings() {
  const [settings, setSettings] = useState({
    soundEnabled: true,
    volume: 0.7,
    musicEnabled: false,
    notificationsEnabled: true
  });

  useEffect(() => {
    const saved = localStorage.getItem('soundSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }

    // Listen for changes
    const handleStorage = (e) => {
      if (e.key === 'soundSettings') {
        setSettings(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return settings;
}
