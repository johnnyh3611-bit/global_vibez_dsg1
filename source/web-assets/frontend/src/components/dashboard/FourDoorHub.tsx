/**
 * FourDoorHub — first-viewport post-login composition.
 * Exactly four primary action hubs: Play · Date · Watch · Earn.
 */
import { Link } from "react-router-dom";
import { PRIMARY_DOORS } from "@/nav/primaryDoors";
import { triggerHaptic } from "@/hooks/useGestures";

const DOOR_STYLES: Record<string, string> = {
  play: "from-cyan-500/35 to-blue-600/15 border-cyan-400/35 hover:border-cyan-300/60",
  date: "from-pink-500/35 to-rose-600/15 border-pink-400/35 hover:border-pink-300/60",
  watch: "from-red-500/35 to-orange-600/15 border-red-400/35 hover:border-red-300/60",
  earn: "from-emerald-500/35 to-teal-600/15 border-emerald-400/35 hover:border-emerald-300/60",
};

export default function FourDoorHub() {
  return (
    <section
      className="w-full"
      data-testid="four-door-hub"
      aria-label="Primary action hubs"
    >
      <div className="mb-4 text-center sm:text-left">
        <p className="text-[10px] uppercase tracking-[0.35em] text-white/45 font-bold">
          Choose your door
        </p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white">
          Play · Date · Watch · Earn
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Everything else lives in Beta Hub when you want to explore.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PRIMARY_DOORS.map(({ key, route, label, Icon, blurb, tone }) => (
          <Link
            key={key}
            to={route}
            data-testid={`four-door-${key}`}
            onClick={() => triggerHaptic(tone === "earn" ? "medium" : "light")}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-transform hover:scale-[1.02] ${DOOR_STYLES[key] || "border-white/15"}`}
          >
            <Icon
              className={`mb-3 h-7 w-7 ${
                tone === "earn" ? "text-emerald-300" : "text-white"
              }`}
            />
            <p className="text-lg font-black text-white">{label}</p>
            <p className="mt-1 text-xs text-white/65 leading-snug">{blurb}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
