/**
 * BetaTester — public waitlist signup page at /beta-tester.
 *
 * Founder ask 2026-02-17: clean way to gate early access + collect
 * feedback during beta period before the mainnet flip.
 *
 * Founder ask 2026-02-17 Late × 3: viral referral leaderboard.
 * Each signup gets their own /beta-tester?ref=CODE link. Top
 * referrers earn an Ambassador badge at 5+ referrals.
 *
 * Three states:
 *  1) form  — email/name/interests + live waitlist counter
 *  2) done  — "you're #N on the list" + share-URL box + leaderboard
 *  3) leaderboard widget always visible at the bottom
 *
 * Public route. No auth. POSTs to /api/beta-waitlist/signup which
 * dispatches a Resend confirmation email.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Check, Mail, Crown, Zap, Heart,
  Gamepad2, Trophy, Users, ArrowRight, Copy, Share2, Trophy as TrophyIcon,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL as string;

interface SignupResponse {
  ok: boolean;
  already_on_list: boolean;
  position: number;
  email_sent?: boolean;
  message: string;
  referral_code?: string | null;
  referred_by?: string | null;
}

interface CountResponse {
  total_signups: number;
  invited: number;
  waitlisted: number;
}

interface LeaderboardRow {
  rank: number;
  name: string;
  referred_count: number;
  is_ambassador: boolean;
  position?: number;
}

interface LeaderboardResponse {
  rows: LeaderboardRow[];
  ambassador_threshold: number;
  total_ambassadors: number;
}

interface MyReferralResponse {
  ok: boolean;
  name: string;
  position: number;
  referral_code: string;
  referred_count: number;
  is_ambassador: boolean;
  ambassador_threshold: number;
}

const INTERESTS: { id: string; label: string; icon: typeof Heart }[] = [
  { id: 'casino',       label: 'Casino + Card Games', icon: Gamepad2 },
  { id: 'dating',       label: 'Dating + Cinema Dates', icon: Heart },
  { id: 'streaming',    label: 'DSG TV + Streaming', icon: Sparkles },
  { id: 'tournaments',  label: 'Tournaments', icon: Trophy },
  { id: 'rides',        label: 'VibeRidez', icon: Zap },
  { id: 'ambassador',   label: 'Ambassador Program', icon: Crown },
];

export default function BetaTester() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refFromUrl = (searchParams.get('ref') || '').toUpperCase().slice(0, 20);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [referral, setReferral] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SignupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [myReferral, setMyReferral] = useState<MyReferralResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Live counter — refreshes every 30s for theatrical "demand" feel.
  useEffect(() => {
    let alive = true;
    const fetchCount = () => {
      fetch(`${API}/api/beta-waitlist/count`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: CountResponse | null) => {
          if (alive && d) setCount(d.total_signups);
        })
        .catch(() => { /* fail silent */ });
    };
    const fetchBoard = () => {
      fetch(`${API}/api/beta-waitlist/leaderboard`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: LeaderboardResponse | null) => {
          if (alive && d) setLeaderboard(d);
        })
        .catch(() => { /* fail silent */ });
    };
    fetchCount(); fetchBoard();
    const id = setInterval(() => { fetchCount(); fetchBoard(); }, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // After successful signup, fetch the live my-referral payload (live tally).
  useEffect(() => {
    if (!result || !result.referral_code) return;
    fetch(`${API}/api/beta-waitlist/my-referral?email=${encodeURIComponent(email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MyReferralResponse | null) => {
        if (d) setMyReferral(d);
      })
      .catch(() => { /* keep result */ });
  }, [result, email]);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim() || !name.trim()) {
      setError('Email and name are both required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/beta-waitlist/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          interests: [...picked],
          referral: referral.trim() || null,
          ref_code: refFromUrl || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail;
        setError(typeof detail === 'string' ? detail : 'Something went wrong. Try again?');
        return;
      }
      setResult(body as SignupResponse);
      setCount((c) => Math.max(c + 1, (body as SignupResponse).position));
    } catch (err) {
      setError('Network error — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = useMemo(() => {
    const code = result?.referral_code || myReferral?.referral_code;
    if (!code) return '';
    return `${window.location.origin}/beta-tester?ref=${code}`;
  }, [result, myReferral]);

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // best-effort
    }
  };

  const tweetUrl = useMemo(() => {
    if (!shareUrl) return '';
    const text = encodeURIComponent(
      "I just joined the Global Vibez DSG private beta — 34+ casino games, Cinema Dates, and the first Social Infrastructure Network. Lock in your seat:",
    );
    return `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`;
  }, [shareUrl]);

  return (
    <div
      data-testid="beta-tester-page"
      className="min-h-screen bg-[#0A0A0F] text-white relative overflow-hidden"
    >
      {/* Backdrop ambience — radial glow + subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(255,138,31,0.18) 0%, rgba(0,0,0,0) 55%), ' +
            'radial-gradient(ellipse at bottom, rgba(0,229,199,0.10) 0%, rgba(0,0,0,0) 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="max-w-3xl mx-auto px-6 pt-14 pb-24">
        {/* Tiny brand crumb */}
        <button
          onClick={() => navigate('/')}
          data-testid="beta-tester-back-home"
          className="text-xs uppercase tracking-[0.4em] text-white/50 hover:text-white transition-colors"
        >
          ← Global Vibez DSG
        </button>

        {/* HERO */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mt-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FF8A1F]/15 border border-[#FF8A1F]/40 px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#FF8A1F] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#FF8A1F]">
              Private Beta · Waitlist Open
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
            Get early access to the <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg,#FFD33D 0%,#FF8A1F 50%,#FC2A82 100%)' }}
            >
              Social Infrastructure Network.
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/70 max-w-prose leading-relaxed">
            34+ casino games · Cinema Dates · 98% Synergy Matching · Ambassador
            Program · 5 ways to earn ₵ Vibez Coins. We're inviting our first beta
            cohort right now — drop your email to claim your seat.
          </p>

          {/* Live counter + referral banner */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div
              data-testid="beta-tester-counter"
              className="inline-flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm"
            >
              <Users className="w-4 h-4 text-[#00E5C7]" />
              <span className="text-white/70">
                <strong
                  className="text-white text-base tabular-nums"
                  data-testid="beta-tester-counter-value"
                >
                  {count.toLocaleString()}
                </strong>{' '}
                testers already on the list
              </span>
            </div>
            {refFromUrl && (
              <div
                data-testid="beta-tester-ref-banner"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/40 px-4 py-2.5 text-sm"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span className="text-amber-200 font-bold">
                  Invited via <span className="font-mono text-amber-300">{refFromUrl}</span>
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* RESULT or FORM */}
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="done"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.4 }}
              data-testid="beta-tester-success"
              className="mt-12 rounded-3xl border-2 border-[#00E5C7]/40 p-8 sm:p-10"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,229,199,0.10) 0%, rgba(0,229,199,0.02) 100%)',
              }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00E5C7] mb-5">
                <Check className="w-8 h-8 text-black" strokeWidth={3} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
                You're #{result.position} on the list.
              </h2>
              <p className="text-white/70 leading-relaxed mb-5" data-testid="beta-tester-success-message">
                {result.message}
              </p>
              {result.referred_by && (
                <p className="text-xs text-amber-300/80 mb-5" data-testid="beta-tester-credited-to">
                  ★ Your seat was credited to <strong>{result.referred_by}</strong>'s referral count.
                </p>
              )}
              {result.email_sent === false && (
                <p
                  data-testid="beta-tester-email-warning"
                  className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-5 inline-block"
                >
                  ⚠ We couldn't dispatch the confirmation email right now — but
                  you're locked in. Watch your inbox in the next 24 hours.
                </p>
              )}

              {/* SHARE BOX — viral hook */}
              {shareUrl && (
                <div
                  data-testid="beta-tester-share-box"
                  className="mt-3 mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Share2 className="w-4 h-4 text-amber-300" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-300">
                      Your referral link
                    </span>
                  </div>
                  <p className="text-sm text-white/70 mb-3 leading-relaxed">
                    Share this link with friends. Every signup boosts your rank on the leaderboard.{' '}
                    <strong className="text-amber-300">
                      Hit {myReferral?.ambassador_threshold ?? 5} referrals to unlock the Ambassador badge
                    </strong>{' '}
                    + bonus ₵ Vibez Coins on launch day.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      data-testid="beta-tester-share-url"
                      className="flex-1 rounded-lg bg-black/50 border border-white/15 px-3 py-2.5 text-xs font-mono text-white/90 select-all"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={copyShareUrl}
                      data-testid="beta-tester-copy-btn"
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
                      style={{
                        background: copied
                          ? '#00E5C7'
                          : 'linear-gradient(135deg,#FF8A1F 0%,#FFD33D 100%)',
                        color: '#0A0A0F',
                      }}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    {tweetUrl && (
                      <a
                        href={tweetUrl}
                        target="_blank"
                        rel="noreferrer"
                        data-testid="beta-tester-tweet-btn"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 hover:border-white/40 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-colors text-white"
                      >
                        Post on X
                      </a>
                    )}
                  </div>
                  {myReferral && myReferral.referred_count > 0 && (
                    <div
                      data-testid="beta-tester-my-tally"
                      className="mt-4 flex items-center gap-3 text-sm"
                    >
                      <TrophyIcon className="w-4 h-4 text-amber-300" />
                      <span className="text-white/70">
                        <strong className="text-amber-300 tabular-nums">
                          {myReferral.referred_count}
                        </strong>{' '}
                        {myReferral.referred_count === 1 ? 'friend has' : 'friends have'} already
                        joined via your link.
                      </span>
                      {myReferral.is_ambassador && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
                          <Crown className="w-3 h-3" /> Ambassador
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/')}
                  data-testid="beta-tester-back-to-landing"
                  className="px-5 py-2.5 rounded-full bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-white/90 transition-colors"
                >
                  Back to landing
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                    setEmail('');
                    setName('');
                    setPicked(new Set());
                    setReferral('');
                  }}
                  data-testid="beta-tester-add-friend"
                  className="px-5 py-2.5 rounded-full border border-white/20 hover:border-white/40 text-white text-xs uppercase tracking-widest transition-colors"
                >
                  Add a friend
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              onSubmit={submit}
              data-testid="beta-tester-form"
              className="mt-12 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur p-6 sm:p-8 space-y-6"
            >
              {/* Name + Email row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-white/50 font-black">
                    Your Name
                  </span>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="beta-tester-name-input"
                    className="mt-1.5 w-full rounded-xl bg-black/50 border border-white/15 px-4 py-3 text-base text-white placeholder-white/30 focus:border-[#FFD33D] focus:outline-none transition-colors"
                    maxLength={80}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-white/50 font-black">
                    Email
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="beta-tester-email-input"
                    className="mt-1.5 w-full rounded-xl bg-black/50 border border-white/15 px-4 py-3 text-base text-white placeholder-white/30 focus:border-[#FFD33D] focus:outline-none transition-colors"
                    required
                  />
                </label>
              </div>

              {/* Interests */}
              <div>
                <span className="text-[11px] uppercase tracking-widest text-white/50 font-black">
                  What are you most excited for? <span className="text-white/30">(pick a few)</span>
                </span>
                <div className="mt-2.5 flex flex-wrap gap-2" data-testid="beta-tester-interests">
                  {INTERESTS.map((it) => {
                    const on = picked.has(it.id);
                    return (
                      <button
                        type="button"
                        key={it.id}
                        onClick={() => togglePick(it.id)}
                        data-testid={`beta-tester-interest-${it.id}`}
                        aria-pressed={on}
                        className={
                          'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all ' +
                          (on
                            ? 'bg-[#FFD33D] text-black border-[#FFD33D] shadow-[0_0_16px_rgba(255,211,61,0.3)]'
                            : 'bg-white/[0.04] text-white/80 border-white/15 hover:border-white/40')
                        }
                      >
                        <it.icon className="w-3.5 h-3.5" />
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Referral / How did you hear */}
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-white/50 font-black">
                  How did you hear about us? <span className="text-white/30">(optional)</span>
                </span>
                <input
                  type="text"
                  placeholder="Twitter, friend's invite, podcast…"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                  data-testid="beta-tester-referral-input"
                  className="mt-1.5 w-full rounded-xl bg-black/50 border border-white/15 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-[#FFD33D] focus:outline-none transition-colors"
                  maxLength={120}
                />
              </label>

              {/* Error banner */}
              {error && (
                <div
                  data-testid="beta-tester-error"
                  className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-3 py-2"
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                data-testid="beta-tester-submit-btn"
                className="group w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-black text-sm uppercase tracking-[0.3em] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg,#FF8A1F 0%,#FFD33D 100%)',
                  color: '#0A0A0F',
                  boxShadow: '0 10px 40px -10px rgba(255,138,31,0.6)',
                }}
              >
                {submitting ? (
                  <>
                    <Mail className="w-4 h-4 animate-pulse" />
                    Securing your seat…
                  </>
                ) : (
                  <>
                    Lock in my seat
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Fine print */}
              <p className="text-[11px] text-white/40 leading-relaxed text-center">
                By joining, you agree to receive a confirmation email + occasional
                beta updates. We never sell your data, and you can unsubscribe from
                every email with one click.
              </p>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Perk grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="beta-tester-perks">
          {[
            { icon: Crown,    title: 'Founder Status',     body: 'Beta testers are publicly credited as Founding Members on the leaderboard.' },
            { icon: Zap,      title: 'Early ₵ Mining',     body: 'Daily ₵ rewards from day-1 — your wallet pre-loads before public launch.' },
            { icon: Sparkles, title: 'Direct Founder Line', body: 'Reply to any beta email and it lands in our team chat. Real conversation.' },
          ].map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <p.icon className="w-5 h-5 text-[#FFD33D] mb-2" />
              <h4 className="text-sm font-black tracking-tight mb-1">{p.title}</h4>
              <p className="text-xs text-white/55 leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>

        {/* LEADERBOARD widget */}
        <div className="mt-12" data-testid="beta-tester-leaderboard">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.4em] text-amber-300 font-black mb-1">
                Top Referrers
              </div>
              <h3 className="text-2xl font-black">Ambassador Leaderboard</h3>
              <p className="text-xs text-white/50 mt-1">
                Refer {leaderboard?.ambassador_threshold ?? 5}+ to unlock the Ambassador badge ·{' '}
                <span className="text-amber-300 font-bold">
                  {leaderboard?.total_ambassadors ?? 0}
                </span>{' '}
                {(leaderboard?.total_ambassadors ?? 0) === 1 ? 'ambassador' : 'ambassadors'} so far
              </p>
            </div>
          </div>
          {(leaderboard?.rows || []).length === 0 ? (
            <div
              data-testid="beta-tester-leaderboard-empty"
              className="rounded-2xl border border-dashed border-white/15 bg-white/[0.01] p-8 text-center"
            >
              <Trophy className="w-8 h-8 text-white/30 mx-auto mb-2" />
              <p className="text-sm text-white/50">
                No referrals yet — sign up and share your link to claim the #1 spot.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/5">
              {leaderboard!.rows.map((row, i) => (
                <motion.div
                  key={`${row.rank}-${row.name}`}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  data-testid={`beta-tester-leaderboard-row-${row.rank}`}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <span
                    className={
                      'w-9 h-9 rounded-full flex items-center justify-center text-xs font-black tabular-nums shrink-0 ' +
                      (row.rank === 1
                        ? 'bg-amber-400 text-black'
                        : row.rank === 2
                        ? 'bg-slate-300 text-black'
                        : row.rank === 3
                        ? 'bg-orange-400 text-black'
                        : 'bg-white/10 text-white/60 border border-white/10')
                    }
                  >
                    #{row.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold truncate">{row.name}</span>
                      {row.is_ambassador && (
                        <span
                          data-testid={`beta-tester-leaderboard-ambassador-${row.rank}`}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-black uppercase tracking-widest px-2 py-0.5"
                        >
                          <Crown className="w-3 h-3" /> Ambassador
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-amber-300 tabular-nums">
                      {row.referred_count}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40">
                      referrals
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
