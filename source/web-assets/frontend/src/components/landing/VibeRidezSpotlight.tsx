/**
 * VibeRidezSpotlight — landing-page accordion body for the VibeRidez
 * driver/rider network. Sourced verbatim from the user's "VibeRidez
 * Complete Infrastructure" + "VibeRidez Integration Guide" PDFs
 * (Apr 30 2026 drop). Highlights the four pillars that make VibeRidez
 * different from a generic rideshare:
 *
 *   01. Kill-Switch Privacy   — instant blackout, AI masking, opt-in handshake
 *   02. AR/VR Streaming HUD   — Celestial Glasshouse line-of-sight overlay
 *   03. Solana Fare Splitter  — 70 / 20 / 10 (driver / platform / liquidity)
 *   04. VibeXP → $DSG       — earn-while-driving point system
 *
 * Plus a 3-step driver onboarding card and a creator-gear checklist
 * (BYOD) so the landing visitor knows exactly what's required to go
 * live as a driver.
 *
 * Routes referenced (already wired in `routes/ridesRoutes.tsx`):
 *   /vibe-ridez                       → rider/driver hub
 *   /vibe-ridez/become-a-driver       → driver onboarding marketing page
 *   /vibe-ridez/driver-registration   → KYC / wallet-link form
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Power,
  Glasses,
  Coins,
  TrendingUp,
  Smartphone,
  Wifi,
  ArrowRight,
  CheckCircle2,
  Lock,
  Shield,
} from "lucide-react";

const PILLARS = [
  {
    id: "kill-switch",
    num: "01",
    Icon: Power,
    title: "Kill-Switch Privacy",
    body:
      'Designed for absolute privacy control. Instant Blackout severs the WebRTC stream while keeping the ride active. Digital Consent Handshake requires the passenger to broadcast an Opt-In before any POV camera engages. AI-Driven Masking blurs sensitive individuals (especially minors) detected in the car interior in real time.',
    tone: "border-rose-500/40 bg-rose-950/15 text-rose-300",
  },
  {
    id: "vr-hud",
    num: "02",
    Icon: Glasses,
    title: "AR/VR Streaming HUD",
    body:
      'Drivers wear AR/VR glasses to keep their eyes on the road while broadcasting. The Celestial Glasshouse HUD shows navigation + social chat directly in their line of sight — no handheld phone needed. Hardware calibration ensures the stream never distracts from driving.',
    tone: "border-cyan-500/40 bg-cyan-950/15 text-cyan-300",
  },
  {
    id: "fare-splitter",
    num: "03",
    Icon: Coins,
    title: "Solana Fare Splitter",
    body:
      'A Rust smart contract executes a fair, on-chain split the moment the Safety Check-In is validated: 70% to the driver, 20% to the platform, 10% into the community Liquidity Pool. Funds sit in the Vibe Vault escrow until both GPS pings match the drop-off point.',
    tone: "border-emerald-500/40 bg-emerald-950/15 text-emerald-300",
  },
  {
    id: "vibexp",
    num: "04",
    Icon: TrendingUp,
    title: "VibeXP → $DSG",
    body:
      'A centralized point system that converts to $DSG tokens at major project milestones. Safe Ride Completion = 100 XP. POV Streaming = 10 XP per mile. Passenger Engagement (virtual gifts) = variable. Drive smart, stream clean, get paid twice.',
    tone: "border-amber-500/40 bg-amber-950/15 text-amber-300",
  },
];

const ONBOARDING = [
  {
    n: "1",
    title: "Sync Your Identity",
    body:
      "Open the Driver Portal and link your Solana wallet to receive $DSG earnings.",
  },
  {
    n: "2",
    title: "Setup Your Gear",
    body:
      "Arrange your streaming + VR-ready setup using the Creator Gear Checklist.",
  },
  {
    n: "3",
    title: 'Hit "Start Vibe"',
    body:
      "Go live, accept ride requests within the 15-second acceptance window, broadcast to followers.",
  },
];

const GEAR_CHECKLIST = [
  "5G-Capable Smartphone",
  "Dashboard or Neck Mount",
  "USB Multi-Port Hub",
  "RGB LED Interior Strips",
  "Back-Seat Tablet Mount",
  "Universal VR Viewers",
  "External Microphone",
  "Interior Tripod / Suction Mount",
];

const SAFETY_NOTES = [
  "Route deviations >1.5 miles auto-trigger a security check-in.",
  '"Just for the Night" handoff has a 15-second acceptance window; unaccepted requests rotate within a 5-mile radius.',
  "MongoDB 2D-Sphere geo-spatial indexing powers the driver-rotation engine.",
  "Payments held in Vibe Vault escrow until both parties' GPS coordinates match the drop-off.",
];

export default function VibeRidezSpotlight() {
  return (
    <div className="p-6 space-y-6" data-testid="vibe-ridez-spotlight-body">
      {/* Lede */}
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-black to-fuchsia-950/30 p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-violet-300 mb-2">
          The Creator Fleet
        </p>
        <p className="text-sm text-neutral-200 leading-relaxed">
          VibeRidez is a driver-rider network powered by AR/VR streaming,
          Solana on-chain fare splits, and the Global Vibez economy. Drivers
          earn from rides, streams, AND virtual gifts — three revenue streams
          on a single trip.
        </p>
      </div>

      {/* 4 pillars */}
      <div className="grid sm:grid-cols-2 gap-3">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-4 ${p.tone}`}
            data-testid={`vibe-ridez-pillar-${p.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono opacity-60 text-white">
                {p.num}
              </span>
              <p.Icon className="w-5 h-5 opacity-90" />
            </div>
            <h3 className="text-base font-black text-white mb-1.5 leading-tight">
              {p.title}
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {p.body}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Driver onboarding 3-step */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-cyan-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-cyan-200">
            Drive in 3 steps
          </h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {ONBOARDING.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-cyan-700/30 bg-black/40 p-3"
              data-testid={`vibe-ridez-onboard-${s.n}`}
            >
              <p className="text-2xl font-black text-cyan-300 leading-none">
                {s.n}
              </p>
              <p className="text-xs font-bold text-white mt-1.5">{s.title}</p>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Creator Gear Checklist */}
      <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-950/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-4 h-4 text-fuchsia-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-fuchsia-200">
            Creator Gear Checklist (BYOD)
          </h3>
        </div>
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          data-testid="vibe-ridez-gear-checklist"
        >
          {GEAR_CHECKLIST.map((item) => (
            <div
              key={item}
              className="flex items-start gap-1.5 rounded-lg border border-fuchsia-700/20 bg-black/40 px-2.5 py-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-fuchsia-300 mt-0.5 flex-shrink-0" />
              <span className="text-[11px] text-neutral-200 leading-snug">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Safety + compliance */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-200">
            Safety &amp; Escrow
          </h3>
        </div>
        <ul className="space-y-1.5">
          {SAFETY_NOTES.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <Lock className="w-3 h-3 text-amber-300 mt-1 flex-shrink-0" />
              <span className="text-xs text-neutral-300 leading-relaxed">
                {note}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Dual CTAs */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          to="/vibe-ridez/become-a-driver"
          data-testid="vibe-ridez-cta-driver"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600 to-cyan-600 p-4 hover:brightness-110 transition"
        >
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-100">
              For drivers
            </p>
            <p className="text-base font-black text-white">
              Join the Creator Fleet
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-white" />
        </Link>
        <Link
          to="/vibe-ridez"
          data-testid="vibe-ridez-cta-rider"
          className="flex items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-600 to-violet-600 p-4 hover:brightness-110 transition"
        >
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-100">
              For riders
            </p>
            <p className="text-base font-black text-white">
              Find a VibeRide
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-white" />
        </Link>
      </div>
    </div>
  );
}
