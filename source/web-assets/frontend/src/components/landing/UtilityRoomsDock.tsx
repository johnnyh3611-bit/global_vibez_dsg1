/**
 * UtilityRoomsDock — compact Explore / beta lifestyle grid below the
 * ship-core hero (Gaming · Dating · Streams · Earn).
 */
import { useNavigate } from "react-router-dom";
import {
  Pizza,
  Home,
  Car,
  BookMarked,
} from "lucide-react";

type Room = {
  to: string;
  label: string;
  blurb: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  gradient: string;
  testid: string;
};

/** Keep this short — core jobs live in the hero, not here. */
const ROOMS: Room[] = [
  {
    to: "/vibe-ridez",
    label: "VibeRidez",
    blurb: "Drive · stream · tip",
    Icon: Car,
    gradient: "from-emerald-500 to-cyan-600",
    testid: "dock-viberidez",
  },
  {
    to: "/hungryvibes",
    label: "Hungry Vibez",
    blurb: "Food on the same fleet",
    Icon: Pizza,
    gradient: "from-orange-500 to-fuchsia-600",
    testid: "dock-hungry-vibez",
  },
  {
    to: "/vibe-venues",
    label: "Vibe Venues",
    blurb: "Hourly spaces + hosts",
    Icon: Home,
    gradient: "from-fuchsia-500 to-purple-700",
    testid: "dock-vibe-venues",
  },
  {
    to: "/yellow-pages",
    label: "Yellow Pages",
    blurb: "Local verified businesses",
    Icon: BookMarked,
    gradient: "from-yellow-500 to-orange-600",
    testid: "dock-yellow-pages",
  },
];

export default function UtilityRoomsDock() {
  const navigate = useNavigate();
  return (
    <section
      className="relative border-t border-purple-500/20 px-6 py-12"
      data-testid="utility-rooms-dock"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-white/40">
            Explore · beta pillars
          </p>
          <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">
            Lifestyle extras
          </h2>
          <p className="mt-2 max-w-xl text-sm text-purple-300/70">
            Optional after you&apos;ve tried the four jobs — Games, Dating,
            Streams, and Earn.
          </p>
        </div>
        <div className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-4">
          {ROOMS.map((r) => {
            const Icon = r.Icon;
            return (
              <button
                key={r.to}
                type="button"
                onClick={() => navigate(r.to)}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                data-testid={r.testid}
              >
                <div
                  className={`mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${r.gradient}`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-black text-white">{r.label}</p>
                <p className="mt-1 flex-1 text-xs leading-snug text-white/50">
                  {r.blurb}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
