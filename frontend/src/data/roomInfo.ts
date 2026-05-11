/**
 * roomInfo — single source of truth for the Universal Room Info Cube.
 *
 * Each entry is keyed by a route prefix; matchInfo() picks the most
 * specific matching prefix for the current pathname. Falls back to
 * null when no entry exists (the Info Cube hides itself).
 *
 * Schema:
 *   title:        Short room name
 *   tagline:      One-liner under the title
 *   howItWorks:   Ordered bullets of "what you do here"
 *   earn:         Bullets describing how the user makes ₵ / wins
 *   socialHook:   Optional dating / social cross-link line
 *   safety:       Optional safety / fairness rules
 */
export type RoomInfo = {
  title: string;
  tagline: string;
  howItWorks: string[];
  earn?: string[];
  socialHook?: string;
  safety?: string;
};

export const ROOM_INFO: Record<string, RoomInfo> = {
  "/dashboard": {
    title: "Your Hub",
    tagline: "Every room of Global Vibez DSG, one tap away.",
    howItWorks: [
      "Tap any tile to teleport into a room — games, dating, rides, food, streaming.",
      "Your wallet pill (top-right) shows your current ₵ Vibez Coin balance.",
      "Hit the ride-home row if you need a Vibe Ridez lift right now.",
    ],
    earn: [
      "Every 24 hours you log in, your mining streak grows.",
      "Refer 5 friends → free Chair + 3.5% Sovereign Tax dividend forever.",
    ],
    socialHook: "Cinema dates and dating-portal matches both surface in your hub feed.",
  },
  "/sports-lounge": {
    title: "Vibe Sports Book",
    tagline: "Bet on real games — and policed by the people who watched them.",
    howItWorks: [
      "Pick a stake (₵50 / ₵250 / ₵1,000 / ₵5,000), then tap a team's odds to lock the bet.",
      "Your bet sits in the Vibe Vault Escrow until the game is settled.",
      "When the game ends, the crowd runs a 'Vibe Check': 10 reporters must agree at 75% on the winner before payouts release. Genius chair-holders count for 2 votes.",
      "Bet of the Day pin = the highest-vaulted bet in the past 24h.",
    ],
    earn: [
      "Winnings pay at the locked decimal odds (e.g. 2.10× = ₵250 → ₵525).",
      "13.5% Sovereign Tax applies only to NET winnings, not your bet refund.",
      "Royal / Sovereign tier members get a 15% Owner Fee Reduction.",
    ],
    safety: "Lying on a Vibe Check earns a strike. 3 strikes = permanent ban. We don't need a 3rd-party odds API — the crowd is the oracle.",
  },
  "/underground-casino": {
    title: "The Underground",
    tagline: "High-limit private lounge. ₵5,000 floor on every seat.",
    howItWorks: [
      "Type 'I understand' + confirm you hold ₵5,000 to pass the door.",
      "Pick a table — Velvet Blackjack, Sapphire Baccarat, Brass Roulette, Garnet 3-Card, Obsidian 654, Quantum Vault, or Underground Live.",
      "Every table loads with the ₵5k stake floor enforced on the underlying game.",
    ],
    socialHook: "Royal & Sovereign tier members skip the ₵5,000 floor — same lounge, no minimum.",
  },
  "/underground-live": {
    title: "Underground Live",
    tagline: "Late-night music & dance battles judged by the crowd.",
    howItWorks: [
      "Watch the live POV stream of tonight's contestants.",
      "Tap 'Vote crowd' on the contestant you want to win. Chair-holders count for 2 votes.",
      "The Crowd Meter updates in real time as votes come in.",
      "When the battle closes, the winner takes 70% of the sponsor pool.",
    ],
    earn: ["Voting is FREE — no balance touched. Your reward is the influence on who wins."],
  },
  "/lottery": {
    title: "DSG 6 Quantum Vault",
    tagline: "5+1 ball draw. JACKPOT pool grows until someone hits all six.",
    howItWorks: [
      "Pick 5 core balls from 1-50 + 1 Vibe Ball (RUBY · SAPPHIRE · EMERALD · GOLD · DIAMOND).",
      "Tickets are $2 in ₵ VIBE. 10% maintenance fee applies on entry.",
      "Draw runs daily. 5-match = JACKPOT, 4-match = 10% of pool, 3-match = 3% of pool.",
      "RUBY ball or correct Vibe Ball doubles your payout. Partial Vibe-Ball match = 1.5×.",
    ],
    earn: ["13.5% Sovereign Tax applies on winnings only, not the ticket cost."],
  },
  "/chess-hall": {
    title: "Chess Hall",
    tagline: "5 modes · classic AI · blitz · daily puzzle · tournament · multiplayer.",
    howItWorks: [
      "Classic AI = unlimited free play. Blitz = 5-minute timed matches with adaptive AI.",
      "Daily Puzzle rotates at 00:00 UTC. Submit each move; hint toggle available.",
      "Tournament queues you into a 4-player bracket; instant kickoff when the 4th player joins.",
      "Multiplayer connects you to a human opponent over HTTP/WebSocket.",
    ],
    earn: ["Win-loss-draw tally tracked per mode. Future: leaderboard payouts."],
  },
  "/chess/blitz": {
    title: "Chess Blitz",
    tagline: "5-minute clocks · capture-biased AI · auto-recorded result.",
    howItWorks: [
      "Each side starts with a 5:00 clock that ticks at 100ms resolution.",
      "Make a move on the board; the AI responds within a second.",
      "Game ends on checkmate, stalemate, draw, or clock expiry — result auto-saved.",
    ],
  },
  "/chess/puzzle": {
    title: "Daily Chess Puzzle",
    tagline: "One curated position per UTC day · solve to score.",
    howItWorks: [
      "Today's puzzle loads from a 6-position rotation.",
      "Make the correct move sequence; wrong moves = retry from the start.",
      "Hint toggle reveals the first correct move if you're stuck.",
    ],
  },
  "/chess/tournament": {
    title: "Chess Tournament",
    tagline: "4-player single-elimination bracket · instant kickoff.",
    howItWorks: [
      "Click 'Join queue' — when 3 other players are also queued, the bracket instantly creates.",
      "Round 1 = two 1v1 matches. Final = winners face off.",
      "Champion is announced at the top of the bracket.",
    ],
  },
  "/vibez-654": {
    title: "Vibe 654 Dice",
    tagline: "5 dice · sequential 6→5→4 qualifier ladder · roll-to-stand.",
    howItWorks: [
      "Pick your stake (₵10–₵1,000). Optionally add Side Bets (Triple-6, Straights, Small/Large Straight, etc).",
      "Roll up to 3 times. Each qualifier (6 then 5 then 4) locks one die and removes it from the tray.",
      "Once all 3 are qualified, your remaining dice are your POINT. Stand to bank the score, or roll again to push.",
      "Bigger point = bigger multiplier. Triple-1 or zero qualifiers = bust.",
    ],
    earn: ["Side bets resolve on roll #1 only. Main payout is taxed 13.5% on net winnings."],
  },
  "/vibe-654": {
    title: "Vibe 654 · High Roller",
    tagline: "Tournament version of the 654 protocol.",
    howItWorks: [
      "Same rules as classic 654 with higher stakes and a tournament leaderboard.",
      "Top 24-hour scores feed the High Roller Vault payout pool.",
    ],
  },
  "/cinema-room": {
    title: "The Cinema Room",
    tagline: "Public sync-watch viewer · 7 curated free films · live chat.",
    howItWorks: [
      "Tap a film tile in the lobby — opens a synced room everyone in it watches together.",
      "Live chat sidebar shows who's in the room and lets you react in real time.",
      "Toggle Date Night mode for a private 2-person room (auto-hides from public list).",
      "Order food from HungryVIBEZ via the in-room CTA without pausing playback.",
    ],
    socialHook: "Date Night cinema bookings auto-link to your Dating Universe profile — 98% synergy match-ups surface here first.",
  },
  "/dating": {
    title: "Dating Universe",
    tagline: "98% synergy matching · cultural onboarding · group dates.",
    howItWorks: [
      "Complete the 4-step Cultural Onboarding to unlock your match feed.",
      "Swipe — but compatibility quizzes, profile videos, and dialect signals all weigh in.",
      "Friend matching unlocks at Insider tier; Group Planner unlocks at Tastemaker.",
    ],
    socialHook: "Date Night Cinema + Vibe Spots booking + Vibe Ridez tip-to-skip all integrate.",
  },
  "/matchmaking": {
    title: "Skill-Based Matchmaking",
    tagline: "Game-room pairings calibrated to your ELO.",
    howItWorks: [
      "Pick the game and your stake range — we queue you with players in a tight skill window.",
      "Match accept window is 15 seconds. Auto-skip if you don't accept.",
    ],
  },
  "/cyber-casino": {
    title: "Cyber Casino",
    tagline: "Neon-cyber theme · slots · roulette · blackjack · AI chess.",
    howItWorks: [
      "Pick a game from the lobby — each opens a full-screen room.",
      "The Voice Coach reads board state and suggests next moves (Tastemaker+ tier).",
      "Cyber Casino Battle Mode is the chess vs human-or-AI live duel.",
    ],
  },
  "/vibe-ridez": {
    title: "Vibe Ridez",
    tagline: "Driver-keep-70% rideshare with Spotify Auto-DJ.",
    howItWorks: [
      "Set pickup + dropoff; drivers in your area get the dispatch.",
      "Tip-to-Skip ($1 → 100 ₵) instantly skips the current Spotify track. 70% goes to your driver.",
      "Tip-to-Add ($0.50 → 50 ₵) queues a track you choose.",
      "1.5-mile route-deviation rail keeps drivers honest.",
    ],
    earn: ["Drivers keep 70% of the post-tax fare. 30% VibeRidez Tax replaces the 13.5% Sovereign rate."],
  },
  "/hungryvibes": {
    title: "Hungry VIBEZ",
    tagline: "Local merchant food + drink with receipt-bonus loop.",
    howItWorks: [
      "Browse local merchants in the directory. Tap a card to view their menu.",
      "Order through the app — drivers and dispatch run on the same SmartStack as Vibe Ridez.",
      "Hold onto your receipt — upload it at /receipts for a 15% ₵ kickback.",
    ],
  },
  "/yellow-pages": {
    title: "Vibe Yellow Pages",
    tagline: "Mom & Pop directory + DSG Guard verification.",
    howItWorks: [
      "Search local businesses or browse by category.",
      "Each listing carries a DSG Guard verification badge (or lack thereof).",
      "Boost a merchant by uploading their receipt — they get 30-day priority in search.",
    ],
  },
  "/receipts": {
    title: "Receipt Boost",
    tagline: "Verify a receipt · earn 15% back · boost the merchant.",
    howItWorks: [
      "Paste the URL of your receipt image (any imgur or photo-host link works).",
      "Enter the merchant handle + the amount you spent.",
      "On verification you get +15% of the spend back in ₵ VIBE.",
      "The merchant gets a 30-day boost flag in Yellow Pages search results.",
    ],
    safety: "Daily cap of 5 receipts per user to prevent abuse.",
  },
  "/tiers": {
    title: "Sovereign Tiers",
    tagline: "5 monthly tiers + 1 lifetime ownership tier.",
    howItWorks: [
      "Guest (free) → Insider ($9, first month $1) → Tastemaker ($19 popular) → Royal ($39) → Sovereign ($89).",
      "Each tier doubles the previous one's perks for roughly 2× the price.",
      "Genius Chair = $20 one-time, lifetime asset (all Sovereign perks for life + 2× Vibe Check vote weight).",
      "Annual billing = 2 months free.",
    ],
    earn: ["Royal+ removes maintenance fees, gives ₵ ride credit, and unlocks the Underground without the ₵5k floor."],
  },
  "/pricing": {
    title: "Sovereign Tiers",
    tagline: "Same as /tiers — see Premium ladder.",
    howItWorks: ["See /tiers."],
  },
  "/wallet": {
    title: "Vibe Wallet",
    tagline: "Your ₵ Vibez Coin balance + top-up + Solana bridge.",
    howItWorks: [
      "Top up via Stripe — 4 packs ($5 / $9 / $20 / $35).",
      "Wallet Top-up offers larger packs ($10–$250) for bigger players.",
      "When the bridge is armed, convert ₵ → DSG SPL token at 4:1 (1.5× during Genius Phase).",
    ],
  },
  "/chair-hall": {
    title: "Chair Hall",
    tagline: "3D infinity table · sees every chair holder.",
    howItWorks: [
      "Three.js scene rendering all current Chair Holders around the Sovereign Infinity Table.",
      "Holders only — Guest tier sees a teaser preview.",
      "Mining multiplier (5×), ambassador kickback (3.5%) all tracked on this page.",
    ],
  },
  "/vibe-spots": {
    title: "Vibe Spots",
    tagline: "Date / activity bookings with 35% cancellation protection.",
    howItWorks: [
      "Book a Spot — restaurant, lounge, experience.",
      "If you cancel: 65% refunds to you, 35% to the host.",
      "Solana escrow stub will route real funds post-TGE.",
    ],
  },
  "/vibe-vault-admin": {
    title: "God Mode · Admin",
    tagline: "Founder-only control tower for the entire economy.",
    howItWorks: [
      "Beta waitlist management · bulk invites · weekly digest dispatch.",
      "Sovereign Ops: Bridge / Burn / Reap (all dry-run by default).",
      "Game lock dashboard · staff management · audit logs.",
    ],
  },
  "/admin/cinema-catalog": {
    title: "Cinema Catalog · Admin",
    tagline: "Founder-only override layer on the Cinema Room library.",
    howItWorks: [
      "Add / edit / delete catalog items without a redeploy.",
      "Mongo-backed override replaces seed items by ID; soft-deletes tombstone seeds.",
    ],
  },
  "/practice/play/blackjack": {
    title: "Blackjack",
    tagline: "Classic 21 with double down, split, surrender, insurance.",
    howItWorks: [
      "Dealer hits on soft 17. Blackjack pays 3:2.",
      "Split up to 3 times (4 hands max). Double on any 2 cards.",
      "Insurance offered only when dealer shows an Ace.",
    ],
  },
  "/baccarat": {
    title: "Baccarat",
    tagline: "Bet Banker, Player, or Tie. Closest to 9 wins.",
    howItWorks: [
      "Banker bet has the best odds (~50.7%) but 5% commission on wins.",
      "Player bet pays even money (~49.3%).",
      "Tie pays 8:1 but only hits ~9.5% of hands.",
    ],
  },
  "/spades": {
    title: "Spades",
    tagline: "Classic 4-player trick-taking · spades always trump · bid your tricks.",
    howItWorks: [
      "Each player bids the # tricks they'll take. Beat your bid for points, miss it for -10/bid.",
      "Bags pile up: 10 bags = -100. Nil bid = 100 if you take 0 tricks, -100 if you take any.",
      "Blind Nil doubles the swing. First team to 500 wins.",
    ],
    safety: "13.5% Sovereign Tax applies on wager pots only; pure practice is free.",
  },
  "/bid-whist": {
    title: "Bid Whist",
    tagline: "African-American classic · jokers in play · uptown / downtown direction.",
    howItWorks: [
      "Bid your # tricks + direction (Uptown = high wins, Downtown = low wins).",
      "Big Joker beats Little Joker beats Ace-trump under BOTH directions (jokers inert in No-Trump).",
      "Trick winner leads next. First team to score wins.",
    ],
  },
  "/hearts": {
    title: "Hearts",
    tagline: "Avoid hearts and the Queen of Spades · or shoot the moon.",
    howItWorks: [
      "Each heart = 1 point. Queen of Spades = 13 points. Lowest total wins.",
      "Pass 3 cards each hand: left, right, across, then keep.",
      "Shoot the Moon: take ALL hearts + QofS in one hand → everyone else takes 26 points.",
    ],
  },
};

/**
 * Match the most-specific prefix for a pathname. Returns null when no
 * registered prefix matches.
 */
export function matchInfo(pathname: string): RoomInfo | null {
  // Sort prefixes by length (longest first) so /chess/blitz wins over /chess.
  const keys = Object.keys(ROOM_INFO).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname === key || pathname.startsWith(key + "/") || pathname.startsWith(key + "?")) {
      return ROOM_INFO[key];
    }
  }
  return null;
}
