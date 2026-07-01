/**
 * UtilityRoomsDock — single click-through grid for every Global Vibez
 * utility room. Replaces the cluttered top-nav row of buttons.
 *
 * Lives BELOW the hero on the landing page so the homepage isn't
 * overstuffed, and gets duplicated inside the dashboard sidebar so
 * logged-in users always have a one-click route to any room.
 */
import { useNavigate } from "react-router-dom";
import {
  Gamepad2,
  MapPin,
  Pizza,
  Home,
  Moon,
  Car,
  ChefHat,
  Crown,
} from "lucide-react";

type Room = {
  to: string;
  label: string;
  blurb: string;
  Icon: React.ElementType;
  gradient: string;
  testid: string;
};

const ROOMS: Room[] = [
  {
    to: "/games-menu",
    label: "Games",
    blurb: "27+ skill-based rooms",
    Icon: Gamepad2,
    gradient: "from-cyan-500 to-blue-600",
    testid: "dock-games",
  },
  {
    to: "/date-spot-finder",
    label: "Date Spot Finder",
    blurb: "Mom & Pop venues + entertainment",
    Icon: MapPin,
    gradient: "from-fuchsia-500 to-purple-600",
    testid: "dock-date-spot",
  },
  {
    to: "/hungry-vibez",
    label: "Hungry Vibez",
    blurb: "Food delivery on the same fleet",
    Icon: Pizza,
    gradient: "from-orange-500 to-fuchsia-600",
    testid: "dock-hungry-vibez",
  },
  {
    to: "/vibe-venues",
    label: "Vibe Venues",
    blurb: "Hourly homes + Vibe Artisans",
    Icon: Home,
    gradient: "from-fuchsia-500 to-purple-700",
    testid: "dock-vibe-venues",
  },
  {
    to: "/viberidez",
    label: "VibeRidez",
    blurb: "Drive · stream · earn",
    Icon: Car,
    gradient: "from-emerald-500 to-cyan-600",
    testid: "dock-viberidez",
  },
  {
    to: "/just-for-the-night",
    label: "Just For The Night",
    blurb: "Live now-or-never connections",
    Icon: Moon,
    gradient: "from-purple-500 to-pink-600",
    testid: "dock-jftn",
  },
  {
    to: "/vibe-venues/host",
    label: "Host a House",
    blurb: "Hourly rental · 80% to host",
    Icon: Crown,
    gradient: "from-fuchsia-500 to-orange-500",
    testid: "dock-host-house",
  },
  {
    to: "/vibe-venues/artisan",
    label: "Become a Vibe Artisan",
    blurb: "Chef / decorator · $20/mo",
    Icon: ChefHat,
    gradient: "from-orange-500 to-amber-500",
    testid: "dock-become-artisan",
  },
];

export default function UtilityRoomsDock() {
  const navigate = useNavigate();
  return (
    <section
      className="relative px-6 py-16 border-t border-purple-500/20"
      data-testid="utility-rooms-dock"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Utility Rooms
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-1">
              Pick where you're earning today.
            </h2>
            <p className="text-sm text-purple-300/70 mt-2 max-w-xl">
              One token, one wallet, six rooms. Tap in.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ROOMS.map((r) => {
            const Icon = r.Icon;
            return (
              <button
                key={r.to}
                onClick={() => navigate(r.to)}
                className="group relative overflow-hidden text-left p-4 rounded-2xl bg-[#0F0720] border border-fuchsia-500/15 hover:border-fuchsia-400/50 transition-all hover:-translate-y-0.5"
                data-testid={r.testid}
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center mb-3 shadow-[0_0_18px_rgba(217,70,239,0.35)]`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-base font-black text-white">{r.label}</p>
                <p className="text-xs text-purple-300/70 mt-1 leading-snug">
                  {r.blurb}
                </p>
                <span className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 to-fuchsia-500/0 group-hover:from-fuchsia-500/5 transition-all rounded-2xl pointer-events-none" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
