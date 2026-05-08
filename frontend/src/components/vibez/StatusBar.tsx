/**
 * StatusBar — canonical fixed-bottom status bar per MASTER_RULEBOOK §2.2.
 * Pinned to the bottom, blur backdrop, max 20vh scrollable interior so
 * content never covers the table.
 */
export const StatusBar = ({
  connection = "Stable",
  latencyMs = 9,
  gameLogicStatus = "Syncing…",
  agentMessage = "Pathfinder Agent: Verifying Room Assets…",
  version = "GlobalVibez_DSG_v1.0.4",
}: {
  connection?: string;
  latencyMs?: number;
  gameLogicStatus?: string;
  agentMessage?: string;
  version?: string;
}) => {
  return (
    <div
      data-testid="vibez-status-bar"
      className="fixed bottom-0 left-0 w-full z-50 border-t border-cyan-500/30 bg-black/50 backdrop-blur-xl"
    >
      <div className="max-h-[20vh] overflow-y-auto scrollbar-hide p-2">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between max-w-7xl mx-auto px-4 gap-3">
          <div className="flex gap-6 text-xs uppercase tracking-widest text-cyan-400 font-mono">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400">Connection</span>
              <span data-testid="status-connection">{connection} [{latencyMs}ms]</span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-4">
              <span className="text-[10px] text-gray-400">Game Logic</span>
              <span data-testid="status-game-logic">{gameLogicStatus}</span>
            </div>
          </div>
          <div className="hidden md:block text-sm italic text-gray-300">{agentMessage}</div>
          <div className="text-[10px] text-white/40">{version}</div>
        </div>
      </div>
    </div>
  );
};
