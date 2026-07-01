/**
 * /artist/onboarding — 60-second creator funnel.
 *
 * Three steps:
 *   1. Track metadata (title + display name)
 *   2. Audio URL paste (and optional cover art)
 *   3. Confirm → auto-publishes via /api/media/artist/me/tracks and
 *      lands the track in Audio Unlock Nodes immediately.
 *
 * After confirmation: deep-link straight to the Creator Studio so the
 * artist sees their first tip the moment a fan sends one.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Music2, Mic2, CheckCircle2, Loader2, Crown, Sparkles, Disc3,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ArtistOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [artistName, setArtistName] = useState<string>('');
  const [trackTitle, setTrackTitle] = useState<string>('');

  // Step 2
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [coverArtUrl, setCoverArtUrl] = useState<string>('');

  // Step 3 — confirm
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishedTrack, setPublishedTrack] = useState<any>(null);

  const canAdvance1 = trackTitle.trim().length >= 1 && artistName.trim().length >= 1;
  const canAdvance2 = audioUrl.trim().length >= 4 && audioUrl.startsWith('http');

  const handlePublish = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/auth');
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch(`${API}/api/media/artist/me/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          track_title: trackTitle,
          audio_url: audioUrl,
          cover_art_url: coverArtUrl || null,
          artist_display_name: artistName,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setPublishedTrack(data.track);
        setStep(4);
      } else {
        toast.error(data?.detail || 'Publish failed.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080f] text-white" data-testid="artist-onboarding-page">
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 border-b border-amber-400/20 backdrop-blur-md bg-[#06080f]/95">
        <button
          onClick={() => navigate(-1)}
          className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
          data-testid="artist-onboarding-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-3">
          <Crown className="w-5 h-5" /> Artist Onboarding
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40" data-testid="artist-onboarding-step">
          Step {step} of 4
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              data-testid={`artist-onboarding-dot-${n}`}
              className={`w-8 h-1 rounded-full ${
                n <= step ? 'bg-amber-400' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step 1 — Metadata */}
        {step === 1 && (
          <Card
            className="p-6 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 border border-amber-400/30"
            data-testid="artist-onboarding-step-1"
          >
            <Mic2 className="w-8 h-8 text-amber-300 mb-2" />
            <h2 className="text-xl font-black">Who's dropping?</h2>
            <p className="text-xs text-white/60 mt-1 mb-5">
              Your name on tips. Your track's title on the Vibez chart. Real names land more tips.
            </p>

            <label className="text-[10px] uppercase tracking-widest text-amber-300">
              Artist display name
            </label>
            <Input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="DJ Nova Drift"
              className="bg-white/5 border-amber-400/30 mt-1 mb-4"
              data-testid="artist-onboarding-name"
            />

            <label className="text-[10px] uppercase tracking-widest text-amber-300">
              Track title
            </label>
            <Input
              value={trackTitle}
              onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="Recirculation Anthem"
              className="bg-white/5 border-amber-400/30 mt-1 mb-5"
              data-testid="artist-onboarding-title"
            />

            <Button
              onClick={() => setStep(2)}
              disabled={!canAdvance1}
              className="w-full bg-amber-400 text-black hover:bg-amber-300 font-black"
              data-testid="artist-onboarding-next-1"
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        )}

        {/* Step 2 — Audio URL */}
        {step === 2 && (
          <Card
            className="p-6 bg-gradient-to-br from-fuchsia-500/10 to-purple-700/10 border border-fuchsia-400/30"
            data-testid="artist-onboarding-step-2"
          >
            <Music2 className="w-8 h-8 text-fuchsia-300 mb-2" />
            <h2 className="text-xl font-black">Drop the audio</h2>
            <p className="text-xs text-white/60 mt-1 mb-5">
              Paste the MP3 / M4A URL. Cover art is optional but converts higher in the Vibe DJ overlay.
            </p>

            <label className="text-[10px] uppercase tracking-widest text-fuchsia-300">
              Audio URL <span className="text-rose-400">*</span>
            </label>
            <Input
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value.trim())}
              placeholder="https://cdn.example.com/track.mp3"
              className="bg-white/5 border-fuchsia-400/30 font-mono text-xs mt-1 mb-4"
              data-testid="artist-onboarding-audio"
            />

            <label className="text-[10px] uppercase tracking-widest text-fuchsia-300">
              Cover art URL (optional)
            </label>
            <Input
              value={coverArtUrl}
              onChange={(e) => setCoverArtUrl(e.target.value.trim())}
              placeholder="https://cdn.example.com/cover.jpg"
              className="bg-white/5 border-fuchsia-400/30 font-mono text-xs mt-1 mb-5"
              data-testid="artist-onboarding-cover"
            />

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} data-testid="artist-onboarding-prev-2">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canAdvance2}
                className="flex-1 bg-fuchsia-500 text-black hover:bg-fuchsia-400 font-black"
                data-testid="artist-onboarding-next-2"
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <Card
            className="p-6 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-400/30"
            data-testid="artist-onboarding-step-3"
          >
            <Disc3 className="w-8 h-8 text-emerald-300 mb-2" />
            <h2 className="text-xl font-black">Confirm + publish</h2>
            <p className="text-xs text-white/60 mt-1 mb-5">
              When you tap Publish, your track lands in Audio Unlock Nodes immediately. Fans can tip in ₵ from any Plex room.
            </p>

            <div className="rounded-lg bg-black/40 border border-white/10 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Artist</span><span className="font-bold">{artistName}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Track</span><span className="font-bold">{trackTitle}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Audio</span><span className="font-mono text-xs text-emerald-300 truncate max-w-[260px]">{audioUrl}</span></div>
              {coverArtUrl && (
                <div className="flex justify-between"><span className="text-white/50">Cover</span><span className="font-mono text-xs text-emerald-300 truncate max-w-[260px]">{coverArtUrl}</span></div>
              )}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30 text-xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
              <p className="text-amber-100">
                <span className="font-bold">Your take:</span> 80% of every tip lands in your Creator Studio balance.
                Cash out anytime via the Gas-Out Accelerator. Zero in-app burn.
              </p>
            </div>

            <div className="flex gap-2 mt-5">
              <Button variant="ghost" onClick={() => setStep(2)} data-testid="artist-onboarding-prev-3">
                Back
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="flex-1 bg-emerald-500 text-black hover:bg-emerald-400 font-black"
                data-testid="artist-onboarding-publish"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Publish track
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4 — Done */}
        {step === 4 && publishedTrack && (
          <Card
            className="p-6 bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-400/40"
            data-testid="artist-onboarding-step-4"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/30 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-9 h-9 text-emerald-300" />
              </div>
              <h2 className="text-2xl font-black">You're live.</h2>
              <p className="text-xs text-white/70 mt-2">
                <span className="font-bold text-amber-200">{publishedTrack.track_title}</span> is now in the Vibez discovery rotation.
              </p>
              <p className="text-[10px] text-white/40 font-mono mt-1">{publishedTrack.track_id}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
              <Button
                onClick={() => navigate('/artist/dashboard')}
                className="bg-amber-400 text-black hover:bg-amber-300 font-black"
                data-testid="artist-onboarding-cta-studio"
              >
                Open Creator Studio
              </Button>
              <Button
                onClick={() => {
                  // Reset for another track
                  setStep(1);
                  setTrackTitle('');
                  setAudioUrl('');
                  setCoverArtUrl('');
                  setPublishedTrack(null);
                }}
                variant="outline"
                className="border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10"
                data-testid="artist-onboarding-cta-another"
              >
                Drop another track
              </Button>
            </div>

            <p className="text-[10px] text-white/40 text-center mt-5">
              Your track is currently in the lowest-momentum tier (Anti-Payola Discovery). Tip activity will surface it to more rooms.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
