/**
 * StreamerSetupGuide — onboarding one-pager for streamers.
 *
 * Public route (no auth). The founder asked for this as a marketing
 * page that converts streamers in <60 seconds. It documents the
 * exact OBS Browser Source flow + a one-click copy of their unique
 * overlay URL + a live preview iframe so they can see exactly how
 * the frost / hype-bar / toast stack will look on stream.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Check, Radio, Zap, ArrowRight, ExternalLink, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const SITE = typeof window !== 'undefined' ? window.location.origin : 'https://globalvibezdsg.com';

const STEPS = [
  {
    n: 1,
    title: 'Open OBS Studio',
    body: 'Click the + on your Sources panel and pick "Browser Source". Name it "Vibez Overlay".',
    Icon: Radio,
  },
  {
    n: 2,
    title: 'Paste your unique overlay URL',
    body: 'Drop the URL below into the URL field. Resolution: 1920×1080. Tick "Refresh browser when scene becomes active".',
    Icon: ExternalLink,
  },
  {
    n: 3,
    title: 'Make sure background is transparent',
    body: 'In the OBS Custom CSS field paste:  body { background: transparent !important; }  — that\'s already the default but be safe.',
    Icon: ShieldCheck,
  },
  {
    n: 4,
    title: 'Test with a fake tip',
    body: 'Send yourself a $1 tip from a second account. The hype meter at the top should fill, and a confetti toast should fly in from the right.',
    Icon: Zap,
  },
  {
    n: 5,
    title: 'Connect your wallet for payouts',
    body: 'Tips clear instantly to your Vibez Credits. Convert to fiat from /wallet. 70% to you, 13.5% sovereign tax, 10% liquidity, 6.5% platform.',
    Icon: Wallet,
  },
];

export default function StreamerSetupGuide() {
  const [copied, setCopied] = useState(false);
  const [streamerId, setStreamerId] = useState('demo');

  useEffect(() => {
    const uid = localStorage.getItem('user_id');
    if (uid) setStreamerId(uid);
  }, []);

  const url = `${SITE}/streamer/overlay/${streamerId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('URL copied — paste into OBS Browser Source');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Copy failed — long-press the URL to select it manually');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-violet-950/30 to-black text-white" data-testid="streamer-setup-guide">
      {/* Hero */}
      <header className="relative px-4 sm:px-8 pt-16 pb-12 max-w-5xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-violet-300 hover:text-violet-200">
          ← Back to Dashboard
        </Link>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight"
        >
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
            Make money on every tip.
          </span>
          <br />
          <span className="text-white">Live in 60 seconds.</span>
        </motion.h1>
        <p className="mt-5 text-lg sm:text-xl text-white/70 max-w-3xl">
          The Global Vibez DSG Streamer Overlay turns your OBS layout into a tip-to-action canvas.
          Heckle filters, hype meters, and confetti toasts that fire automatically when fans send credits — no plugins, no node-red, no API keys.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href="https://obsproject.com/download"
            target="_blank"
            rel="noreferrer"
            data-testid="setup-cta-obs"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-500 hover:bg-violet-400 text-white font-black"
          >
            Download OBS <ExternalLink className="w-4 h-4" />
          </a>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/30 hover:bg-white/10 font-bold"
          >
            Sign in & get my URL <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Unique URL block */}
      <section className="px-4 sm:px-8 max-w-5xl mx-auto" data-testid="setup-url-block">
        <div className="rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-amber-500/10 p-5 sm:p-7 backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-fuchsia-300">Your overlay URL</div>
          <div className="mt-2 flex flex-col sm:flex-row gap-3 items-stretch">
            <code
              data-testid="overlay-url"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-black/60 border border-white/10 font-mono text-sm sm:text-base text-cyan-300 break-all"
            >
              {url}
            </code>
            <button
              onClick={copy}
              data-testid="copy-overlay-url"
              className={`shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition ${copied ? 'bg-emerald-500 text-black' : 'bg-white text-black hover:bg-white/90'}`}
            >
              {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">
            URL is unique to <span className="text-fuchsia-300 font-mono">{streamerId}</span>.
            Sign in to lock it to your real account so payouts route correctly.
          </p>
        </div>
      </section>

      {/* Step-by-step */}
      <section className="px-4 sm:px-8 max-w-5xl mx-auto py-14" data-testid="setup-steps">
        <h2 className="text-2xl sm:text-3xl font-black mb-6">Setup in 5 steps</h2>
        <ol className="grid gap-3">
          {STEPS.map((s) => {
            const Icon = s.Icon;
            return (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: s.n * 0.05 }}
                data-testid={`setup-step-${s.n}`}
                className="rounded-2xl bg-stone-900/60 border border-white/10 p-5 flex gap-4"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-black text-xl">
                  {s.n}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-fuchsia-300" />
                    <h3 className="font-black">{s.title}</h3>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{s.body}</p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </section>

      {/* Action catalog */}
      <section className="px-4 sm:px-8 max-w-5xl mx-auto pb-14" data-testid="setup-actions">
        <h2 className="text-2xl sm:text-3xl font-black mb-6">7 ways your fans pay you</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            ['HECKLE', 'Frost filter overlay across the canvas', 'cyan'],
            ['BUFF', 'Golden glow burst — buff your run', 'amber'],
            ['ROUTE_TIP', 'Pin a destination on your map', 'emerald'],
            ['DJ_INTERCEPT', 'Skip / queue a Beat Vault track', 'fuchsia'],
            ['VOICE_INTERCEPT', '15-second pay-to-speak window', 'violet'],
            ['INSTRUMENT_GIFT', 'Add a stem to your live remix', 'yellow'],
            ['HECKLE_GALLERY', '3D Glass Emoji vote spree', 'rose'],
          ].map(([kind, body, color]) => (
            <div
              key={kind as string}
              data-testid={`setup-action-${(kind as string).toLowerCase()}`}
              className={`rounded-2xl bg-${color}-500/10 border border-${color}-400/30 p-4`}
            >
              <div className={`text-[10px] uppercase tracking-widest font-black text-${color}-300`}>{kind}</div>
              <div className="mt-1 text-sm">{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pro tip — second OBS scene */}
      <section className="px-4 sm:px-8 max-w-5xl mx-auto pb-10" data-testid="setup-protip-glasshouse">
        <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 via-fuchsia-500/10 to-amber-500/10 p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center font-black text-xl">
              ⚡
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.4em] font-black text-cyan-300 mb-1">Pro tip · Free 3D backdrop</div>
              <div className="font-black text-lg sm:text-xl">
                Drop <code className="bg-black/60 px-2 py-0.5 rounded font-mono text-cyan-300">{SITE}/music/glasshouse</code> into a SECOND OBS browser source for an instant 3D backdrop while you're recording.
              </div>
              <p className="text-sm text-white/70 mt-2">
                Transparent background by default. Mic-reactive frequency bars + glass crystal that pulses to your voice.
                Stack it underneath your overlay scene and you've got a free music-video-grade studio with zero plugins.
              </p>
              <Link
                to="/music/glasshouse"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/40 text-sm font-bold"
                data-testid="setup-protip-glasshouse-cta"
              >
                Preview the Glasshouse <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Earnings note */}
      <section className="px-4 sm:px-8 max-w-5xl mx-auto pb-20">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-amber-500/15 border border-emerald-400/30 p-6 text-center" data-testid="setup-earnings">
          <div className="text-[10px] uppercase tracking-[0.4em] text-emerald-300 font-black">The 70/30 Revolution</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">
            70% to you · 13.5% sovereign tax · 10% liquidity · 6.5% platform
          </div>
          <p className="mt-3 text-sm text-white/70 max-w-3xl mx-auto">
            Locked at the protocol level. Same split for every action kind, every tier, every stream.
            Cash out from <Link to="/wallet" className="underline">Wallet</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
