// Comprehensive Settings Page
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Volume2, 
  Bell, 
  User, 
  Shield,
  Gamepad2,
  Monitor,
  Save,
  Mic,
  MicOff,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SoundSettings } from '@/components/SoundSettings';
import {
  isAIDealerVoiceMuted, setAIDealerVoiceMuted,
} from '@/utils/aiDealerVoice';
import {
  loadLocalLocale, autoDetectLocale, persistLocaleLocally,
  globalVibeSync, type UserLocaleSelection,
} from '@/utils/globalVibeSync';

const API = process.env.REACT_APP_BACKEND_URL as string;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('sound');
  const [aiVoiceMuted, setAiVoiceMutedState] = useState(false);
  const [locale, setLocale] = useState<UserLocaleSelection | null>(null);
  const [countries, setCountries] = useState<Array<{ code: string; name: string; flag: string; default_language: string; default_dialect: string; currency: string; currency_symbol: string; unit_system: string; }>>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [savingLocale, setSavingLocale] = useState(false);
  const [settings, setSettings] = useState({
    // Game Settings
    autoMatchmaking: true,
    showTutorials: true,
    difficultyPreference: 'medium',
    
    // Display Settings
    animations: true,
    particles: true,
    theme: 'dark',
    
    // Notifications
    gameInvites: true,
    tournamentUpdates: true,
    achievements: true,
    
    // Privacy
    showOnlineStatus: true,
    allowFriendRequests: true,
    showGameHistory: true
  });

  // Hydrate AI Dealer + Locale state on mount
  useEffect(() => {
    setAiVoiceMutedState(isAIDealerVoiceMuted());
    const cached = loadLocalLocale();
    if (cached) {
      setLocale(cached);
      setSelectedCountry(cached.countryCode);
    } else {
      autoDetectLocale().then(d => {
        if (d) {
          persistLocaleLocally(d);
          setLocale(d);
          setSelectedCountry(d.countryCode);
        }
      });
    }
    fetch(`${API}/api/localization/countries`).then(r => r.json()).then(d => {
      setCountries(d.countries || []);
    }).catch(() => { /* ignore */ });
  }, []);

  const tabs = [
    { id: 'sound', label: 'Sound & Music', icon: Volume2 },
    { id: 'ai-dealer', label: 'AI Dealer', icon: Mic },
    { id: 'language', label: 'Language & Region', icon: Globe },
    { id: 'game', label: 'Game Settings', icon: Gamepad2 },
    { id: 'display', label: 'Display', icon: Monitor },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield }
  ];

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    alert('Settings saved successfully!');
  };

  // tabs definition rendered above. The two founder-requested testids
  // (settings-ai-dealer-tab, settings-language-tab) live on BOTH the nav
  // button and the content panel so headless tests can query them whether
  // or not the corresponding tab is currently the active one.

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <SettingsIcon className="w-16 h-16 text-cyan-400 mr-4" />
            <h1 className="text-6xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
              Settings
            </h1>
          </div>
          <p className="text-xl text-gray-400">Customize your experience</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Tabs */}
          <div className="space-y-2">
            {tabs.map((tab) => {
              // Founder requested explicit testids on the AI Dealer + Language
              // nav buttons so they're queryable regardless of which tab is active.
              const navTestid =
                tab.id === 'ai-dealer' ? 'settings-ai-dealer-tab'
                : tab.id === 'language' ? 'settings-language-tab'
                : `settings-tab-nav-${tab.id}`;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={navTestid}
                  className={`w-full flex items-center gap-3 px-6 py-4 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                      : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 p-8">
              {/* Sound Settings */}
              {activeTab === 'sound' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <Volume2 className="w-8 h-8 text-cyan-400" />
                    Sound & Music
                  </h2>
                  <SoundSettings />
                </div>
              )}

              {/* AI Dealer Voice — global mute toggle (LOCKED v8.0) */}
              {activeTab === 'ai-dealer' && (
                <div data-testid="settings-ai-dealer-panel">
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    {aiVoiceMuted
                      ? <MicOff className="w-8 h-8 text-red-400" />
                      : <Mic className="w-8 h-8 text-cyan-400" />}
                    AI Dealer
                  </h2>
                  <p className="text-gray-400 mb-8">
                    Mute the AI dealer's voice across every game. Sound effects and music are unaffected.
                  </p>

                  <div className="flex items-center justify-between p-6 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div>
                      <h3 className="font-bold text-lg">Talk to me at the table</h3>
                      <p className="text-sm text-gray-400">
                        {aiVoiceMuted
                          ? 'Currently muted everywhere — toggle on to hear the dealer.'
                          : 'Currently active in Blackjack, Roulette, Baccarat, Bid Whist, Spades and more.'}
                      </p>
                    </div>
                    <Button
                      data-testid="settings-ai-dealer-toggle"
                      onClick={() => {
                        const next = !aiVoiceMuted;
                        setAIDealerVoiceMuted(next);
                        setAiVoiceMutedState(next);
                      }}
                      className={`${aiVoiceMuted ? 'bg-gray-600' : 'bg-green-600'} px-6`}
                    >
                      {aiVoiceMuted ? 'OFF' : 'ON'}
                    </Button>
                  </div>

                  <div className="mt-6 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-sm text-cyan-200/80">
                    Tip: this toggle is the master switch. Individual game rooms still
                    keep their own sound-effect sliders under <strong>Sound & Music</strong>.
                  </div>
                </div>
              )}

              {/* Language & Region — Cultural Hub picker (LOCKED v8.0) */}
              {activeTab === 'language' && (
                <div data-testid="settings-language-panel">
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <Globe className="w-8 h-8 text-cyan-400" />
                    Language & Region
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Pick your country and language. Game tables, the AI dealer's slang,
                    Vibe Ridez units (mi ⇄ km) and Hungry Vibes menus all sync to your choice.
                  </p>

                  {/* Current locale summary */}
                  {locale && (
                    <div className="mb-6 p-5 rounded-xl bg-slate-800/60 border border-slate-700 flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-3xl leading-none">
                        {countries.find(c => c.code === locale.countryCode)?.flag || '🌐'}
                      </span>
                      <div className="flex-1 min-w-[180px]">
                        <div className="font-bold text-white text-lg">{locale.country}</div>
                        <div className="text-gray-400 font-mono text-xs uppercase tracking-wider">
                          {locale.localeCode} · {locale.currencySymbol} {locale.currency} ·{' '}
                          {locale.unitSystem === 'imperial' ? 'mi' : 'km'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Country picker */}
                  <h3 className="font-bold text-lg mb-2">Choose Country</h3>
                  <select
                    data-testid="settings-language-country-select"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white mb-6 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select a country…</option>
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} · {c.currency} · {c.unit_system === 'imperial' ? 'mi' : 'km'}
                      </option>
                    ))}
                  </select>

                  <Button
                    data-testid="settings-language-apply"
                    disabled={!selectedCountry || savingLocale}
                    onClick={async () => {
                      setSavingLocale(true);
                      try {
                        const userId = localStorage.getItem('user_id') || undefined;
                        const next = await globalVibeSync(
                          { countryCode: selectedCountry },
                          userId,
                        );
                        if (next) setLocale(next);
                      } finally {
                        setSavingLocale(false);
                      }
                    }}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold px-6 py-3"
                  >
                    {savingLocale ? 'Syncing…' : 'Apply Vibe'}
                  </Button>

                  <p className="mt-4 text-xs text-gray-500">
                    Heads-up: the persistent 🌐 globe button (bottom-right of every page)
                    opens the same Cultural Hub with extra dialect options.
                  </p>
                </div>
              )}

              {/* Game Settings */}
              {activeTab === 'game' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <Gamepad2 className="w-8 h-8 text-cyan-400" />
                    Game Settings
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">Auto Matchmaking</h3>
                        <p className="text-sm text-gray-400">Automatically find matches</p>
                      </div>
                      <Button
                        onClick={() => updateSetting('autoMatchmaking', !settings.autoMatchmaking)}
                        className={settings.autoMatchmaking ? 'bg-green-600' : 'bg-gray-600'}
                      >
                        {settings.autoMatchmaking ? 'ON' : 'OFF'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">Show Tutorials</h3>
                        <p className="text-sm text-gray-400">Display game tutorials</p>
                      </div>
                      <Button
                        onClick={() => updateSetting('showTutorials', !settings.showTutorials)}
                        className={settings.showTutorials ? 'bg-green-600' : 'bg-gray-600'}
                      >
                        {settings.showTutorials ? 'ON' : 'OFF'}
                      </Button>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg mb-3">AI Difficulty Preference</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {['easy', 'medium', 'hard', 'expert'].map((diff) => (
                          <button
                            key={diff}
                            onClick={() => updateSetting('difficultyPreference', diff)}
                            className={`px-4 py-2 rounded-lg font-medium capitalize ${
                              settings.difficultyPreference === diff
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-700 text-gray-400'
                            }`}
                          >
                            {diff}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Display Settings */}
              {activeTab === 'display' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <Monitor className="w-8 h-8 text-cyan-400" />
                    Display Settings
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">Animations</h3>
                        <p className="text-sm text-gray-400">Enable smooth animations</p>
                      </div>
                      <Button
                        onClick={() => updateSetting('animations', !settings.animations)}
                        className={settings.animations ? 'bg-green-600' : 'bg-gray-600'}
                      >
                        {settings.animations ? 'ON' : 'OFF'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">Particle Effects</h3>
                        <p className="text-sm text-gray-400">Confetti and visual effects</p>
                      </div>
                      <Button
                        onClick={() => updateSetting('particles', !settings.particles)}
                        className={settings.particles ? 'bg-green-600' : 'bg-gray-600'}
                      >
                        {settings.particles ? 'ON' : 'OFF'}
                      </Button>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg mb-3">Theme</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {['dark', 'light', 'auto'].map((theme) => (
                          <button
                            key={theme}
                            onClick={() => updateSetting('theme', theme)}
                            className={`px-4 py-2 rounded-lg font-medium capitalize ${
                              settings.theme === theme
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-700 text-gray-400'
                            }`}
                          >
                            {theme}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'notifications' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <Bell className="w-8 h-8 text-cyan-400" />
                    Notifications
                  </h2>
                  
                  <div className="space-y-6">
                    {[
                      { key: 'gameInvites', label: 'Game Invites', desc: 'When someone invites you to play' },
                      { key: 'tournamentUpdates', label: 'Tournament Updates', desc: 'Bracket updates and results' },
                      { key: 'achievements', label: 'Achievements', desc: 'When you unlock achievements' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg">{item.label}</h3>
                          <p className="text-sm text-gray-400">{item.desc}</p>
                        </div>
                        <Button
                          onClick={() => updateSetting(item.key, !settings[item.key])}
                          className={settings[item.key] ? 'bg-green-600' : 'bg-gray-600'}
                        >
                          {settings[item.key] ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy */}
              {activeTab === 'privacy' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <Shield className="w-8 h-8 text-cyan-400" />
                    Privacy Settings
                  </h2>
                  
                  <div className="space-y-6">
                    {[
                      { key: 'showOnlineStatus', label: 'Show Online Status', desc: 'Let others see when you\'re online' },
                      { key: 'allowFriendRequests', label: 'Allow Friend Requests', desc: 'Accept friend requests from others' },
                      { key: 'showGameHistory', label: 'Show Game History', desc: 'Display your game history publicly' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg">{item.label}</h3>
                          <p className="text-sm text-gray-400">{item.desc}</p>
                        </div>
                        <Button
                          onClick={() => updateSetting(item.key, !settings[item.key])}
                          className={settings[item.key] ? 'bg-green-600' : 'bg-gray-600'}
                        >
                          {settings[item.key] ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="mt-8 pt-6 border-t border-gray-700">
                <Button
                  onClick={saveSettings}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold py-4 text-lg"
                >
                  <Save className="w-5 h-5 mr-2" />
                  Save Settings
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
