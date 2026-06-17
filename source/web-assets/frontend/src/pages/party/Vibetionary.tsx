/**
 * Vibetionary — collaborative drawing room (Party Hub Blueprint §1).
 *
 * MVP: 2D canvas with neon-light brush + AI prompt + guess-to-stake
 * payout. The PDF calls for "3D ray-traced" — we ship the 2D shipping
 * canvas with neon shaders for the beta and let the 3D upgrade ride
 * on a Three.js follow-up. The economics + flow are identical.
 *
 * Each correct guess fires a `BUFF` tip through the Streamer Action
 * Hub (1.5x stake multiplier per PDF), so the same ledger applies.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Brush, RotateCcw, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const PROMPTS = [
  'sunset over Miami', 'a hype crowd at Power Hour',
  'the $DSG logo as a constellation', 'a Vibe Yellow Pages neon sign',
  'two phones high-fiving', 'a dealer cracking a smile',
];

export default function Vibetionary() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [prompt, setPrompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [guess, setGuess] = useState('');
  const [stake, setStake] = useState(0);
  const [winner, setWinner] = useState(false);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }, []);

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14;
    ctx.lineTo(((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height);
    ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const reset = () => {
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, c.width, c.height);
    setWinner(false);
  };

  const submitGuess = async () => {
    const correct = guess.trim().toLowerCase() === prompt.toLowerCase();
    if (correct) {
      setWinner(true);
      const reward = 100 + Math.floor(stake * 1.5); // 1.5x multiplier per PDF
      setStake(reward);
      toast.success(`Correct! +$${(reward / 100).toFixed(2)} (1.5× stake)`);
      try {
        const t = localStorage.getItem('auth_token');
        await fetch(`${API}/api/streamer-actions/tip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
          body: JSON.stringify({
            streamer_id: 'vibetionary_room',
            action_kind: 'BUFF',
            amount_cents: reward,
            metadata: { game: 'vibetionary', prompt, guess },
          }),
        });
      } catch {}
    } else {
      const penalty = 25;
      setStake((s) => s + penalty);
      toast.error(`Not quite. +$${(penalty / 100).toFixed(2)} into the pot`);
    }
    setGuess('');
  };

  const reroll = () => {
    setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
    reset();
    setStake(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-cyan-950/30 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-cyan-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="vibetionary-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300">Party Hub · Celestial Glasshouse</div>
          <div className="text-lg font-black bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
            Vibe-tionary
          </div>
        </div>
        <button onClick={reroll} data-testid="reroll-prompt" className="text-xs font-bold text-cyan-300 px-3 py-1.5 border border-cyan-500/40 rounded-lg hover:bg-cyan-500/10">
          New Prompt
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-cyan-500/10 border border-cyan-400/40 p-4 mb-4 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-cyan-300" />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">AI Prompt</div>
            <div className="text-xl font-black" data-testid="vibetionary-prompt">"{prompt}"</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Pot</div>
            <div className="font-mono font-black text-amber-300" data-testid="vibetionary-pot">${(stake / 100).toFixed(2)}</div>
          </div>
        </motion.div>

        <div className="rounded-2xl border-2 border-cyan-500/40 overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.2)]">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            data-testid="vibetionary-canvas"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="w-full h-auto cursor-crosshair touch-none"
            style={{ background: '#0a0a14' }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={reset} data-testid="vibetionary-clear" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm">
            <RotateCcw className="w-4 h-4" /> Clear
          </button>
          <div className="flex-1 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center gap-2 text-sm">
            <Brush className="w-4 h-4 text-cyan-300" /> Neon Light brush
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-stone-900/60 border border-fuchsia-500/30 p-4">
          <div className="text-[10px] uppercase tracking-widest text-fuchsia-300/80 mb-2">Make a Guess</div>
          <div className="flex gap-2">
            <input
              data-testid="vibetionary-guess-input"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type your guess..."
              className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400"
              onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
            />
            <button data-testid="vibetionary-submit-guess" onClick={submitGuess} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 font-bold">
              <Send className="w-4 h-4" /> Stake
            </button>
          </div>
          {winner && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-center font-black text-amber-200" data-testid="vibetionary-winner">
              ✨ Winner! 1.5× stake unlocked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
