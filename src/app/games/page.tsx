import { GlobalCard } from "@/components/ui/GlobalCard";

export const metadata = {
  title: "Global Vibez DSG — Game Lobby",
};

const GAMES = [
  {
    name: "Spade Plus",
    suit: "\u2660",
    tagline: "High-stakes partnership spades",
    description: "Bid, set, and run the board in the modern take on classic spades.",
    gradient: "from-brand-primary/40 to-brand-accent/20",
  },
  {
    name: "Bid Whist",
    suit: "\u2665",
    tagline: "Trick-taking, uptown rules",
    description: "Call the trump, take your books, and out-strategize the table.",
    gradient: "from-rose-500/40 to-brand-primary/20",
  },
] as const;

export default function GamesLobbyPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] w-full bg-background-deep px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-accent">
            Game Lobby
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Pick your table</h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            Sit down at a high-fidelity table. More games join the floor soon.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {GAMES.map((game) => (
            <GlobalCard key={game.name} interactive className="group p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-glass bg-gradient-to-br ${game.gradient} text-3xl shadow-brand-glow`}
                  aria-hidden
                >
                  {game.suit}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">{game.name}</h2>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-accent">
                    {game.tagline}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-white/70">
                {game.description}
              </p>

              <div className="mt-6 flex items-center justify-between">
                <span className="inline-flex min-h-8 items-center rounded-full border border-surface-glass-border bg-surface-glass px-3 text-xs font-medium text-white/60">
                  Coming soon
                </span>
                <span className="text-sm font-semibold text-brand-accent transition-transform group-hover:translate-x-1">
                  Enter table &rarr;
                </span>
              </div>
            </GlobalCard>
          ))}
        </div>
      </div>
    </main>
  );
}
