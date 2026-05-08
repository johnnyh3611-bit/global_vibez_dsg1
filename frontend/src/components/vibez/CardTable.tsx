/**
 * CardTable + PlayerSlot — 3D elliptical 4-player table per MASTER_RULEBOOK §2.4.
 * Uses perspective-1000 for depth; glassmorphism + cyan glow for the felt.
 */
type Position = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

export const PlayerSlot = ({
  position,
  name,
  isUser = false,
  progress = 0.75,
}: {
  position: Position;
  name: string;
  isUser?: boolean;
  progress?: number;
}) => {
  const posClasses: Record<Position, string> = {
    TOP: "absolute top-4 left-1/2 -translate-x-1/2",
    BOTTOM: "absolute -bottom-12 left-1/2 -translate-x-1/2",
    LEFT: "absolute top-1/2 -left-12 -translate-y-1/2 rotate-90",
    RIGHT: "absolute top-1/2 -right-12 -translate-y-1/2 -rotate-90",
  };
  return (
    <div
      data-testid={`player-slot-${position.toLowerCase()}`}
      className={`${posClasses[position]} flex flex-col items-center gap-2 group`}
    >
      <div className="w-16 h-16 rounded-full border-2 border-cyan-500 p-1 bg-black shadow-[0_0_15px_rgba(6,182,212,0.5)] group-hover:scale-110 transition-transform">
        <div className={`w-full h-full rounded-full bg-gradient-to-tr ${isUser ? "from-cyan-500 to-emerald-500" : "from-purple-500 to-cyan-500"} overflow-hidden`} />
      </div>
      <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-md border border-white/10 text-center">
        <p className="text-[10px] font-bold text-white uppercase tracking-tighter">{name}</p>
        <div className="w-full h-1 bg-gray-800 rounded-full mt-1">
          <div
            className="h-full bg-cyan-400 rounded-full shadow-[0_0_5px_#22d3ee] transition-all"
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const CardTable = ({
  waitingMessage = "Waiting for Bid…",
  players = [
    { pos: "TOP" as Position, name: "Vibe_Bot_1" },
    { pos: "RIGHT" as Position, name: "Guest_77" },
    { pos: "LEFT" as Position, name: "Cyber_Ace" },
    { pos: "BOTTOM" as Position, name: "YOU", isUser: true },
  ],
}: {
  waitingMessage?: string;
  players?: { pos: Position; name: string; isUser?: boolean }[];
}) => {
  return (
    <div
      data-testid="vibez-card-table"
      className="relative w-full h-[60vh] flex items-center justify-center perspective-1000"
    >
      <div className="relative w-[85%] h-[75%] bg-gradient-to-b from-cyan-900/20 to-black border-[3px] border-cyan-500/40 rounded-[150px] shadow-[0_0_100px_rgba(6,182,212,0.15)] flex items-center justify-center overflow-hidden">
        <div className="w-48 h-48 rounded-full border border-dashed border-white/20 flex items-center justify-center bg-white/5">
          <span className="text-cyan-400 font-mono text-sm animate-pulse">{waitingMessage}</span>
        </div>
        {players.map((p) => (
          <PlayerSlot key={p.pos} position={p.pos} name={p.name} isUser={!!p.isUser} />
        ))}
      </div>
    </div>
  );
};
