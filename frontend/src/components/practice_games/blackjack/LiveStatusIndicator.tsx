interface LiveStatusIndicatorProps {
  connected: boolean;
  playerCount?: number;
  spectatorCount?: number;
}

export const LiveStatusIndicator = ({
  connected,
  playerCount = 0,
  spectatorCount = 0,
}: LiveStatusIndicatorProps) => (
  <div
    className="fixed top-20 right-5 z-40 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20"
    data-testid="live-status"
  >
    <div
      className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
    />
    <span className="text-white text-xs font-semibold">{connected ? 'LIVE' : 'OFFLINE'}</span>
    {playerCount > 0 && (
      <span className="text-white/60 text-xs ml-2">
        {playerCount} player{playerCount === 1 ? '' : 's'}
        {spectatorCount > 0 ? ` • ${spectatorCount} watching` : ''}
      </span>
    )}
  </div>
);

export default LiveStatusIndicator;
