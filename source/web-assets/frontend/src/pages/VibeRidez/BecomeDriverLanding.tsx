/**
 * /become-a-driver — public hero landing page that pitches the
 * platform-assisted Vibe Ridez driver experience and funnels qualified
 * users into /vibe-ridez/register.
 *
 * Why exists: rather than dropping a cold registration form on people,
 * this page sells the value (₵-rewards, no surge gouging, you keep more
 * vs. Uber/Lyft), gates by quick eligibility self-check (age, license,
 * vehicle), then forwards to the existing DriverRegistration form.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Car,
  Coins,
  Shield,
  Zap,
  CheckCircle2,
  Bolt,
  ArrowRight,
  Award,
  ChevronRight,
} from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

const PERKS = [
  {
    icon: Coins,
    title: "Keep 90% of every fare",
    body:
      "Riders pay you in ₵ Vibez Coins. We take 10%. No 35% commission, no booking fees, no Acceptance-Rate guilt-trip nags.",
  },
  {
    icon: Bolt,
    title: "Instant payout into your wallet",
    body:
      "The minute a rider taps Complete, escrow releases into your daily total. Cash out to Solana whenever — no $1 instant-pay fee.",
  },
  {
    icon: Shield,
    title: "We have your back",
    body:
      "Real human dispatch support. No deactivation-by-algorithm. Two-strike review process before any account action.",
  },
  {
    icon: Award,
    title: "Status you actually keep",
    body:
      "Once you hit Diamond Driver you keep it for the season — not reset every 90 days like the legacy apps.",
  },
];

const ELIGIBILITY = [
  "21+ years old",
  "Valid driver's license (3+ years)",
  "Personal-use car ≤ 12 years old",
  "Clean MVR (no DUI in past 7 years)",
  "Smartphone with GPS",
];

type Application = {
  driver_id?: string;
  status: "none" | "pending_review" | "approved" | "rejected";
  message?: string;
};

export default function BecomeDriverLanding() {
  const navigate = useNavigate();
  const [eligibilityChecked, setEligibilityChecked] = useState<boolean[]>(
    Array(ELIGIBILITY.length).fill(false),
  );
  const [app, setApp] = useState<Application>({ status: "none" });

  // Check whether the signed-in user already has an active driver profile.
  useEffect(() => {
    const fetchApp = async () => {
      const uid = getUserId();
      if (!uid) return;
      try {
        const r = await authFetch(`${API}/api/vibe-ridez/driver/me`);
        if (r.ok) {
          const d = await r.json();
          if (d?.driver) {
            setApp({
              driver_id: d.driver.driver_id,
              status: d.driver.license_verified ? "approved" : "pending_review",
            });
          }
        }
      } catch {
        /* anon — keep default */
      }
    };
    fetchApp();
  }, []);

  const allChecked = eligibilityChecked.every(Boolean);

  return (
    <div className="min-h-screen bg-[#050507] text-cyan-100 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.18) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.10),transparent_55%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/30 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
            <Car className="w-3 h-3" /> Vibe Ridez · Now hiring
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mt-4 leading-tight">
            Drive on the network{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
              built for drivers
            </span>
            .
          </h1>
          <p className="text-base sm:text-lg text-cyan-300/80 mt-4 max-w-2xl mx-auto">
            We pay you in ₵ Vibez Coins, cap our take at 10%, and have human
            support. Keep more, drive less, finally feel like the boss of
            your own car.
          </p>
        </motion.section>

        {/* Status pill if already onboarded */}
        {app.status !== "none" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 max-w-xl mx-auto bg-emerald-500/10 border border-emerald-400/40 rounded-2xl p-4 text-center"
            data-testid="become-driver-status"
          >
            <p className="text-[10px] uppercase tracking-widest text-emerald-300">
              Your Application
            </p>
            <p className="text-xl font-black text-white mt-1">
              {app.status === "approved"
                ? "Active Driver — go online"
                : "Pending Review"}
            </p>
            <p className="text-xs text-emerald-200/70 mt-1">
              {app.status === "approved"
                ? "You're cleared. Hit Driver Console below to start earning."
                : "Our team is reviewing your license + vehicle. Usually within 24h."}
            </p>
            <button
              onClick={() => navigate("/vibe-ridez/dispatch")}
              className="mt-3 px-4 py-2 rounded-full bg-emerald-500 text-black text-xs font-black uppercase tracking-widest"
              data-testid="become-driver-go-console"
            >
              Driver Console <ChevronRight className="inline w-3 h-3" />
            </button>
          </motion.div>
        )}

        {/* Perks grid */}
        <section className="grid sm:grid-cols-2 gap-4 mt-12">
          {PERKS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="bg-black/60 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-5"
              data-testid={`become-driver-perk-${i}`}
            >
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center">
                <p.icon className="w-5 h-5 text-cyan-300" />
              </div>
              <h3 className="text-lg font-bold text-white mt-3">{p.title}</h3>
              <p className="text-sm text-cyan-300/70 mt-2 leading-relaxed">
                {p.body}
              </p>
            </motion.div>
          ))}
        </section>

        {/* Eligibility self-check */}
        {app.status === "none" && (
          <section
            className="mt-14 max-w-2xl mx-auto bg-black/70 border border-amber-500/30 rounded-3xl p-6"
            data-testid="become-driver-eligibility"
          >
            <h2 className="text-2xl font-black text-amber-300 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" /> Are you eligible?
            </h2>
            <p className="text-xs text-cyan-500 uppercase tracking-widest mt-1">
              Quick 30-second self-check — tick all that apply.
            </p>
            <ul className="mt-4 space-y-2">
              {ELIGIBILITY.map((line, i) => (
                <li
                  key={line}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    eligibilityChecked[i]
                      ? "bg-emerald-500/10 border border-emerald-400/40"
                      : "bg-cyan-500/[0.04] border border-cyan-500/20 hover:bg-cyan-500/10"
                  }`}
                  onClick={() =>
                    setEligibilityChecked((prev) => {
                      const next = [...prev];
                      next[i] = !next[i];
                      return next;
                    })
                  }
                  data-testid={`become-driver-eligibility-${i}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      eligibilityChecked[i]
                        ? "bg-emerald-400 border-emerald-300"
                        : "border-cyan-500/40"
                    }`}
                  >
                    {eligibilityChecked[i] && (
                      <CheckCircle2 className="w-3 h-3 text-black" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      eligibilityChecked[i] ? "text-emerald-100" : "text-cyan-200"
                    }`}
                  >
                    {line}
                  </span>
                </li>
              ))}
            </ul>

            <button
              disabled={!allChecked}
              onClick={() => navigate("/vibe-ridez/register")}
              className={`mt-6 w-full py-3 rounded-full font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all ${
                allChecked
                  ? "bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 text-black hover:scale-[1.01]"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
              data-testid="become-driver-cta"
            >
              {allChecked ? (
                <>
                  Continue Application <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                "Tick all to continue"
              )}
            </button>
            <p className="text-[10px] text-cyan-500/60 text-center mt-3 uppercase tracking-widest">
              We assist with the rest — license verification typically clears
              within 24h.
            </p>
          </section>
        )}

        {/* Footer copy */}
        <section className="mt-16 grid sm:grid-cols-3 gap-4 text-center">
          {[
            { k: "Avg ₵/hour", v: "₵420 / hr" },
            { k: "Platform take", v: "10%" },
            { k: "Active drivers", v: "Growing" },
          ].map((s) => (
            <div
              key={s.k}
              className="border border-cyan-500/20 rounded-2xl p-4 bg-black/40"
              data-testid={`become-driver-stat-${s.k}`}
            >
              <p className="text-2xl font-black text-white">{s.v}</p>
              <p className="text-[10px] uppercase tracking-widest text-cyan-500 mt-1">
                {s.k}
              </p>
            </div>
          ))}
        </section>

        <p className="mt-12 text-center text-[10px] text-cyan-500/50 uppercase tracking-widest">
          <Zap className="inline w-3 h-3 mr-1" /> Vibe Ridez · GlobalVibe DSG
        </p>
      </div>
    </div>
  );
}
