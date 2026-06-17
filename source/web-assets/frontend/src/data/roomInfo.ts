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
  "/voice-mirror": {
    title: "Voice Mirror",
    tagline: "Train your inner dealer / coach voice · paired AI feedback room.",
    howItWorks: [
      "Speak into the mic — the AI mirrors your voice back with cleaner cadence and confidence cues.",
      "Pair with another user via `/voice-mirror/pair` for synchronized practice sessions.",
      "Used by streamers, dealers, and dating-portal candidates to sharpen presence.",
    ],
    socialHook: "Used heavily during Speed Dating prep — the better your mirror score, the higher you rank in match algorithms.",
  },
  "/dsg/beat-vault": {
    title: "Beat Vault",
    tagline: "Sealed-bid beat marketplace · artists keep 70% forever.",
    howItWorks: [
      "Browse the catalog of available beats from verified producers.",
      "Place a sealed bid — highest bid wins when the auction window closes.",
      "Winner gets exclusive rights to the beat. Producer keeps 70% of the sale forever (no recoupment).",
      "Already-finished tracks can mint as Beat DLC NFTs for collectors.",
    ],
    earn: ["13.5% Sovereign Tax applies on the buyer's payment. Producer's 70% is post-tax."],
  },
  "/beat-vault/dlc": {
    title: "Beat Vault DLC",
    tagline: "Finished-track Vibe DLC minting flow.",
    howItWorks: [
      "Producers package a finished track as a DLC drop with rarity tiers.",
      "Fans buy editions; SIMULATED mint until founder confirms project_complete safe phrase.",
      "On-chain hand-off uses the identical schema once mainnet is armed.",
    ],
  },
  "/dsg/memory-bank": {
    title: "Memory Bank",
    tagline: "Synced movie watching with your match · keep date-night memories.",
    howItWorks: [
      "Browse founder-curated films and create a private sync-watch room.",
      "Both partners' video states stay in sync — pause one side, both pause.",
      "Chat sidebar and reaction emojis preserve the moment.",
      "Memorable clips can be saved to your shared 'Memory Bank' gallery.",
    ],
    socialHook: "Distinct from the public Cinema Room — Memory Bank is FOR DATES. Auto-promotes to private when both users are in a confirmed match.",
  },
  "/dsg/music-group": {
    title: "Music Group",
    tagline: "70/30 Revolution — beats, battles, collab matchmaker.",
    howItWorks: [
      "Producers, artists, and battlers all share one rail.",
      "Live freestyle battles judged by the crowd.",
      "Collab Matchmaker pairs you with complementary artists for studio sessions.",
    ],
  },
  "/dsg/matchmaking": {
    title: "DSG Matchmaking",
    tagline: "98% synergy matching across games AND dating.",
    howItWorks: [
      "Calibrated to your ELO, language, cultural profile, and play style.",
      "Cross-domain: queues for card games + matchmaking for dates use the same synergy engine.",
    ],
  },
  "/music/collab-matchmaker": {
    title: "Collab Matchmaker",
    tagline: "Duo Up voting · Private Studios.",
    howItWorks: [
      "Vote on which two artists should collab next.",
      "When two artists hit critical mass, they spawn a Private Studio together.",
    ],
  },
  "/music/glasshouse": {
    title: "Lyric Glasshouse",
    tagline: "3D bardic arena · songwriting battles in a translucent dome.",
    howItWorks: [
      "Enter the glass dome — your lyric performance is visualized as crystal-pulse fragments.",
      "Audience reacts with crowd applause; loudest reaction wins the round.",
    ],
  },
  "/music/sound-check": {
    title: "Sound-Check Gauntlet",
    tagline: "5-stage live mic gauntlet — survive all 5, advance.",
    howItWorks: [
      "Each stage tightens the time limit and raises the crowd judge bar.",
      "Survive all 5 stages to unlock featured slot on Vibe TV Totem Pole.",
    ],
  },
  "/music/totem-battles": {
    title: "Totem Pole Battles",
    tagline: "Survival-format music battles · 70/30 split locked.",
    howItWorks: [
      "Climb the totem pole — beat the artist above you to take their slot.",
      "Top of the pole wins the weekly prize pool. 70% to the artist, 30% to the network.",
    ],
  },
  "/music/vibe-suite": {
    title: "Vibe Suite",
    tagline: "Agora RTC private studio · 4-mic capacity.",
    howItWorks: [
      "Create a private suite, invite up to 4 mics, record the session.",
      "Real-time low-latency audio for cypher sessions, podcast tapings, collabs.",
    ],
  },
  "/vibe-tv": {
    title: "Vibe TV",
    tagline: "24/7 channel — your continuity stream.",
    howItWorks: [
      "Always-on broadcast assembles the best of the platform: highlights, battles, ads.",
      "Tip-to-Shield ($2 / 5min) blocks ads for everyone watching that segment.",
    ],
  },
  "/tv/totem-pole": {
    title: "Vibe TV Totem Pole",
    tagline: "Survival-format TV slots — same rail as music battles.",
    howItWorks: [
      "Streamers climb the pole. Top streamer gets prime-time slot.",
      "Crowd kicks the boring ones off via vote.",
    ],
  },
  "/jftn": {
    title: "Just for the Night",
    tagline: "One-shot premium events · pay once, party tonight.",
    howItWorks: [
      "Browse tonight's events; each is a one-shot premium room (no monthly commitment).",
      "Includes hosted card tables, themed parties, late-night cinema.",
    ],
  },
  "/just-for-the-night": { title: "Just for the Night", tagline: "Same as /jftn.", howItWorks: ["See /jftn."] },
  "/vibe-stakes": {
    title: "Vibe Stakes",
    tagline: "Watch-and-wager spectator betting on live game rooms.",
    howItWorks: [
      "Spectators place free predictions on which player will win.",
      "Correct calls earn +5 ₵ (5/day cap). Helps build the social proof loop.",
    ],
  },
  "/watch-and-wager": {
    title: "Watch & Wager",
    tagline: "Live free-stake spectator betting.",
    howItWorks: [
      "Open any active card or dice room — bet free on the outcome.",
      "Hit-rate leaderboard rewards consistent spectators.",
    ],
  },
  "/sports-betting": { title: "Sports Betting", tagline: "See /sports-lounge.", howItWorks: ["Routes to /sports-lounge."] },
  "/sportsbook": { title: "Sports Book", tagline: "See /sports-lounge.", howItWorks: ["Same as Sports Lounge."] },
  "/vr-dating": {
    title: "VR Dating",
    tagline: "WebXR · meet in 3D before you meet in person.",
    howItWorks: [
      "Put on your VR headset (or use mouse-look on desktop).",
      "Pick a room — beach, lounge, cinema. Walk around, talk via voice chat.",
      "Persistent state preserves your room layout for return visits.",
    ],
  },
  "/streamer/setup-guide": {
    title: "Streamer Setup Guide",
    tagline: "Step-by-step onboarding for new streamers.",
    howItWorks: [
      "Wires your OBS / Streamlabs overlay to your tip-to-action rail.",
      "DSG Guard verification badge + Tip-to-Shield $2/5min ad block.",
    ],
  },
  "/live": {
    title: "Live Streaming",
    tagline: "Go live or browse other live streams.",
    howItWorks: [
      "Tap 'Go Live' to start broadcasting. Real-time chat + reactions.",
      "Viewers can tip in ₵; streamer keeps 70% after the 13.5% Sovereign Tax.",
    ],
  },
  "/live-streaming": { title: "Live Streaming", tagline: "See /live.", howItWorks: ["Same as /live."] },
  "/browse-streams": {
    title: "Browse Streams",
    tagline: "Discover live streamers across the network.",
    howItWorks: [
      "Filter by category. Tap a card to enter the stream.",
      "Tip the streamer; 70% to creator after Sovereign Tax.",
    ],
  },
  "/tournaments": {
    title: "Tournaments",
    tagline: "Bracketed competitions across every game room.",
    howItWorks: [
      "Browse open tournaments — each has a buy-in, prize pool, and bracket size.",
      "Top finishers split the pool (70% to winners, 30% to the network).",
    ],
  },
  "/trivia": {
    title: "Trivia",
    tagline: "Solo or live multiplayer trivia rounds.",
    howItWorks: [
      "Pick a difficulty; multiple-choice questions auto-advance.",
      "Top scores hit the global leaderboard.",
    ],
  },
  "/card-royale": {
    title: "Card Royale",
    tagline: "Battle Royale across card-game disciplines.",
    howItWorks: [
      "32 players · last survivor wins · format changes each round.",
      "Run-based — survive multiple matches to claim the prize pool.",
    ],
  },
  "/speed-dating": {
    title: "Speed Dating",
    tagline: "Cycle through 3-minute video dates with verified matches.",
    howItWorks: [
      "Enter the lobby — system pairs you 1:1 in 3-minute rounds.",
      "After each round you both rate; mutual yes triggers a follow-up chat.",
    ],
  },
  "/cultural-onboarding": {
    title: "Cultural Onboarding",
    tagline: "4-step quiz that unlocks the Dating match feed.",
    howItWorks: [
      "Origin → Linguistic → Dialect → Cultural Values.",
      "Quiz feeds the 98% synergy engine — better answers, better matches.",
    ],
  },
  "/dating/cultural-onboarding": { title: "Cultural Onboarding", tagline: "See /cultural-onboarding.", howItWorks: ["Same as /cultural-onboarding."] },
  "/age-verification": {
    title: "Age Verification",
    tagline: "Required once before card / casino rooms unlock.",
    howItWorks: [
      "Upload a photo ID. Verification is one-time; status persists across sessions.",
    ],
  },
  "/verification": { title: "Verification", tagline: "Your identity check status.", howItWorks: ["View pending / approved verifications. Required for high-stake rooms + tournament payouts ≥ $600."] },
  "/profile/edit": {
    title: "Edit Profile",
    tagline: "Your face to the network.",
    howItWorks: [
      "Update name, photo, bio, location.",
      "Your profile carries across Dating, Card rooms, Streaming, and VibeRidez (driver view).",
    ],
  },
  "/settings": {
    title: "Settings",
    tagline: "Notifications · privacy · accessibility.",
    howItWorks: [
      "Toggle photosensitive-safe mode (WCAG 2.3.1 compliant).",
      "Manage notification preferences per channel.",
      "Connect external accounts (Spotify, Smartcar, etc).",
    ],
  },
  "/treasury": {
    title: "Treasury",
    tagline: "Public 40-30-30 split transparency dashboard.",
    howItWorks: [
      "See real-time treasury balance and recent inflows.",
      "Split: 40% rewards · 30% liquidity · 30% growth.",
    ],
  },
  "/chess": { title: "Chess", tagline: "Routes to Chess Hall.", howItWorks: ["See /chess-hall."] },
  "/practice": { title: "Practice", tagline: "Free practice mode for every card game.", howItWorks: ["No-stake practice rooms across Spades, Bid Whist, Hearts, Blackjack, Baccarat, Poker, Uno, Euchre, Pinochle, Gin Rummy, War, Crazy Eights, Go Fish, Rummy."] },
  "/practice/play": { title: "Practice Play", tagline: "Pick a game and play vs AI.", howItWorks: ["Tap the game you want; AI calibrates to your skill."] },
  "/admin": {
    title: "Admin · God Mode",
    tagline: "Founder-only control tower.",
    howItWorks: [
      "Treasury operations · Bridge / Burn / Reap (dry-run by default).",
      "Beta waitlist · bulk invites · weekly digest dispatch.",
      "Staff management · audit logs · game lock status.",
    ],
    safety: "Every Sovereign operation requires a 'project complete' safe-phrase before going live on mainnet.",
  },
  "/vibe-vault-admin": { title: "Vibe Vault Admin", tagline: "Same as /admin.", howItWorks: ["See /admin."] },
  "/vibe-drive": {
    title: "Vibe Drive",
    tagline: "Driver-side dispatch HUD for Vibe Ridez.",
    howItWorks: [
      "See pending fares + accept within 15 seconds.",
      "Tip-to-Skip / Tip-to-Add events trigger live ₵ credits to your wallet.",
      "1.5-mi route deviation lock prevents off-route abuse.",
    ],
  },
  "/vibe-tv/main": { title: "Vibe TV · Main", tagline: "See /vibe-tv.", howItWorks: ["Main 24/7 stream — see /vibe-tv."] },
  "/yellow-pages/new": {
    title: "New Yellow Pages Listing",
    tagline: "Add a Mom & Pop business to the directory.",
    howItWorks: [
      "Enter business name, category, address, hours, photos.",
      "DSG Guard verification kicks off automatically; badge appears once approved.",
    ],
  },
  "/dashboard-volumetric": {
    title: "Volumetric Galaxy",
    tagline: "3D dashboard alternative · drag the galaxy to navigate.",
    howItWorks: [
      "6 planets float around a star — each is a category.",
      "Drag to spin the galaxy. Tap a planet to dive in and see its rooms orbit.",
      "Tap any orbiting room tile to launch it.",
      "Top-left 'Classic view' returns you to the standard dashboard.",
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
