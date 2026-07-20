import { Route, Navigate } from "react-router-dom";
import { lazy } from "react";
import StabilityGuard from "@/components/StabilityGuard";

const Games = lazy(() => import("@/pages/GamesNew"));
const GamePlay = lazy(() => import("@/pages/GamePlay"));
const GameDemo = lazy(() => import("@/pages/GameDemo"));
const WouldYouRather = lazy(() => import("@/pages/WouldYouRather"));
const TriviaLobby = lazy(() => import("@/pages/TriviaLobby"));
const TriviaGame = lazy(() => import("@/pages/TriviaGame"));
const TriviaResults = lazy(() => import("@/pages/TriviaResults"));
const TriviaLeaderboard = lazy(() => import("@/pages/TriviaLeaderboard"));
const SpadesAAA = lazy(() => import("@/pages/games/SpadesAAA"));
const BidWhistAAA = lazy(() => import("@/pages/games/BidWhistAAA"));
const CrazyEightsAAA = lazy(() => import("@/pages/games/CrazyEightsAAA"));
const ThirtyOne = lazy(() => import("@/pages/games/ThirtyOne"));
const Yahtzee = lazy(() => import("@/pages/games/Yahtzee"));
const VibesSlots = lazy(() => import("@/pages/games/VibesSlots"));
const Bingo = lazy(() => import("@/pages/games/Bingo"));
const CaribbeanStud = lazy(() => import("@/pages/games/CaribbeanStud"));
const SicBo = lazy(() => import("@/pages/games/SicBo"));
const Craps = lazy(() => import("@/pages/games/Craps"));
const VibesWheel = lazy(() => import("@/pages/games/VibesWheel"));
const Keno = lazy(() => import("@/pages/games/Keno"));
const ThreeCardPoker = lazy(() => import("@/pages/games/ThreeCardPoker"));
const PaiGow = lazy(() => import("@/pages/games/PaiGow"));
const CasinoWar = lazy(() => import("@/pages/games/CasinoWar"));
const CheminDeFer = lazy(() => import("@/pages/games/CheminDeFer"));
const EuropeanRoulette = lazy(() => import("@/pages/games/EuropeanRoulette"));
const Hazard = lazy(() => import("@/pages/games/Hazard"));
const ChuckALuck = lazy(() => import("@/pages/games/ChuckALuck"));
const BigSixWheel = lazy(() => import("@/pages/games/BigSixWheel"));
const JacksOrBetter = lazy(() => import("@/pages/games/JacksOrBetter"));
// May 2026 PDF batch — new rooms backed by already-shipped DSG Guard
const StreamerOverlay = lazy(() => import("@/pages/streamer/StreamerOverlay"));
const Vibetionary = lazy(() => import("@/pages/party/Vibetionary"));
const MemeMatchmaker = lazy(() => import("@/pages/party/MemeMatchmaker"));
const VibeHideSeek = lazy(() => import("@/pages/party/VibeHideSeek"));
const BlindAuctionDating = lazy(() => import("@/pages/dating/BlindAuctionDating"));
const VibeShopperHunt = lazy(() => import("@/pages/dsg/VibeShopperHunt"));
const BeatVaultDLC = lazy(() => import("@/pages/dsg/BeatVaultDLC"));
// Music Arena + TV Totem Pole batch (May 2026 PDFs).
const SoundCheckGauntlet = lazy(() => import("@/pages/music/SoundCheckGauntlet"));
const CollabMatchmaker = lazy(() => import("@/pages/music/CollabMatchmaker"));
const TotemPoleBattles = lazy(() => import("@/pages/music/TotemPoleBattles"));
const TotemPoleQueue = lazy(() => import("@/pages/tv/TotemPoleQueue"));
const StreamerSetupGuide = lazy(() => import("@/pages/streamer/StreamerSetupGuide"));
const VibeSuite = lazy(() => import("@/pages/music/VibeSuite"));
const LyricGlasshouse = lazy(() => import("@/pages/music/LyricGlasshouse"));
const FanTan = lazy(() => import("@/pages/games/FanTan"));
const Faro = lazy(() => import("@/pages/games/Faro"));
const VibesDarts = lazy(() => import("@/pages/games/VibesDarts"));
const EuchreAAA = lazy(() => import("@/pages/games/EuchreAAA"));
const CardMpRoomPage = lazy(() => import("@/pages/games/CardMpRoomPage"));
const GinRummyAAA = lazy(() => import("@/pages/games/GinRummyAAA"));
const GoFishAAA = lazy(() => import("@/pages/games/GoFishAAA"));
const HeartsAAA = lazy(() => import("@/pages/games/HeartsAAA"));
const RummyAAA = lazy(() => import("@/pages/games/RummyAAA"));
const UnoAAA = lazy(() => import("@/pages/games/UnoAAA"));
const WarAAA = lazy(() => import("@/pages/games/WarAAA"));
const DominoesAAA = lazy(() => import("@/pages/games/DominoesAAA"));
const DominoesMP = lazy(() => import("@/pages/games/DominoesMP"));
const PinochleAAA = lazy(() => import("@/pages/games/PinochleAAA"));
// Spades legacy imports removed May 2026. SpadesAAA is now the single canonical room.
const BigWheelLounge = lazy(() => import("@/pages/games/BigWheelLounge"));
const Vibez654Game = lazy(() => import("@/pages/games/Vibez654Game"));
const BlackjackUniversal = lazy(() => import("@/pages/games/BlackjackUniversal"));
const AiJudgeRoom = lazy(() => import("@/components/pages/AiJudgeRoom"));
const PokerPractice = lazy(() => import("@/pages/games/PokerPractice"));
const BaccaratPremium = lazy(() => import("@/pages/games/BaccaratPremium"));
const CyberCasino = lazy(() => import("@/pages/games/CyberCasino"));
const CyberCasinoRoulette = lazy(() => import("@/pages/games/CyberCasinoRoulette"));
const CyberCasinoSlots = lazy(() => import("@/pages/games/CyberCasinoSlots"));
const CyberCasinoBlackjack = lazy(() => import("@/pages/games/CyberCasinoBlackjack"));
const VibeSuitesDiscovery = lazy(() => import("@/pages/VibeSuitesDiscovery"));
const CreateVibeSuite = lazy(() => import("@/pages/CreateVibeSuite"));
// UndergroundSpades legacy import removed May 2026.
const UndergroundClub = lazy(() => import("@/pages/UndergroundClub"));
const ARCardPreview = lazy(() => import("@/pages/ARCardPreview"));
const JazzClubLobby = lazy(() => import("@/pages/JazzClubLobby"));
const PracticeMode = lazy(() => import("@/pages/PracticeMode"));
const CyberCasinoRoom = lazy(() => import("@/pages/cyber-casino/CyberCasinoRoom"));
const PracticeGamePlay = lazy(() => import("@/pages/PracticeGamePlay"));
const PracticeStats = lazy(() => import("@/pages/PracticeStats"));
const HttpMultiplayerLobby = lazy(() => import("@/pages/HttpMultiplayerLobby"));
const HttpGameRouter = lazy(() => import("@/pages/HttpGameRouter"));
const TournamentsListPage = lazy(() => import("@/pages/TournamentsListPage"));
const TournamentDetailsPage = lazy(() => import("@/pages/TournamentDetailsPage"));
const TournamentHub = lazy(() => import("@/pages/TournamentHub"));
const CouplesTournaments = lazy(() => import("@/pages/CouplesTournaments"));
const FriendsTournaments = lazy(() => import("@/pages/FriendsTournaments"));
const CardRoyaleLobby = lazy(() => import("@/pages/CardRoyaleLobby"));
const GauntletRunner = lazy(() => import("@/pages/GauntletRunner"));
const VoiceMirror = lazy(() => import("@/pages/VoiceMirror"));
const VoiceMirrorPairPage = lazy(() => import("@/pages/VoiceMirrorPairPage"));
const TGEOptIn = lazy(() => import("@/pages/TGEOptIn"));
const LeaderboardPage = lazy(() => import("@/pages/LeaderboardPage"));
const MarathonLeaderboardPage = lazy(() => import("@/pages/MarathonLeaderboardPage"));
const SmartcarConnect = lazy(() => import("@/pages/SmartcarConnect"));
const SmartcarCallback = lazy(() => import("@/pages/SmartcarCallback"));
const SpotifyConnect = lazy(() => import("@/pages/SpotifyConnect"));
const SpotifyCallback = lazy(() => import("@/pages/SpotifyCallback"));
const VibeDrive = lazy(() => import("@/pages/VibeDrive"));
const VibeDriveHUD = lazy(() => import("@/pages/VibeDriveHUD"));
const AIPracticeMode = lazy(() => import("@/pages/AIPracticeMode"));
const NOVADealerTest = lazy(() => import("@/pages/NOVADealerTest"));
const ModernGamesShowcase = lazy(() => import("@/pages/ModernGamesShowcase"));
const DealerShowcase = lazy(() => import("@/pages/DealerShowcase"));
const TableDesignShowcase = lazy(() => import("@/pages/TableDesignShowcase"));
const ProfessionalDealerShowcase = lazy(() => import("@/pages/ProfessionalDealerShowcase"));
const ProfessionalTablePreview = lazy(() => import("@/pages/ProfessionalTablePreview"));
const PlayerStats = lazy(() => import("@/pages/PlayerStats"));
const VRCelestialSlots = lazy(() => import("@/components/vr/VRCelestialSlots"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const MultiplayerRoom = lazy(() => import("@/pages/MultiplayerRoom"));
const MyVibezFeed = lazy(() => import("@/pages/MyVibezFeed"));
const MyVibezUpload = lazy(() => import("@/pages/MyVibezUpload"));
const MyVibez = lazy(() => import("@/pages/MyVibez").then(m => ({ default: m.MyVibez })));
const VideoPlayer = lazy(() => import("@/pages/VideoPlayer").then(m => ({ default: m.VideoPlayer })));
const WatchAndWager = lazy(() => import("@/pages/WatchAndWager").then(m => ({ default: m.WatchAndWager })));
const MyBetsHistory = lazy(() => import("@/pages/MyBetsHistory").then(m => ({ default: m.MyBetsHistory })));
const SpectateGame = lazy(() => import("@/pages/SpectateGame").then(m => ({ default: m.SpectateGame })));
const MultiplayerPoker = lazy(() => import("@/pages/MultiplayerPoker"));
const UniversalGameRoom = lazy(() => import("@/pages/games/UniversalGameRoom"));
const VibesCasinoBlackjack = lazy(() => import("@/pages/VibesCasinoBlackjack"));
const BlackjackGameAAA = lazy(() => import("@/components/practice_games/BlackjackGameAAA"));
const BlackjackGameSimple = lazy(() => import("@/components/practice_games/BlackjackGameSimple"));
const RouletteGameAAA = lazy(() => import("@/components/practice_games/RouletteGameAAA"));
const CelestialSlots = lazy(() => import("@/components/practice_games/CelestialSlots"));
const MultiplayerCelestialSlots = lazy(() => import("@/components/practice_games/MultiplayerCelestialSlots"));
const VideoCallDemo = lazy(() => import("@/pages/VideoCallDemo"));
const PracticeBaccarat = lazy(() => import("@/components/practice_games/PracticeBaccarat"));
const VibeDice654Premium = lazy(() => import("@/pages/games/VibeDice654Premium"));
const Vibe654Hall = lazy(() => import("@/pages/games/Vibe654Hall"));
const Vibe654Prescription = lazy(() => import("@/pages/games/Vibe654Prescription"));
const Vibe654TournamentLobby = lazy(() => import("@/pages/games/Vibe654TournamentLobby"));
const Vibe654TournamentTable = lazy(() => import("@/pages/games/Vibe654TournamentTable"));
const VibeColiseum = lazy(() => import("@/pages/games/VibeColiseum"));
const VibeSoloHighRoller = lazy(() => import("@/pages/games/VibeSoloHighRoller"));
const DSG6Lottery = lazy(() => import("@/pages/games/DSG6Lottery"));
const UndergroundCasino = lazy(() => import("@/pages/UndergroundCasino"));
const ChessHall = lazy(() => import("@/pages/games/ChessHall"));
const ChessBlitz = lazy(() => import("@/pages/games/ChessBlitz"));
const ChessPuzzle = lazy(() => import("@/pages/games/ChessPuzzle"));
const ChessTournament = lazy(() => import("@/pages/games/ChessTournament"));
const HttpMultiplayerChess = lazy(() => import("@/pages/games/HttpMultiplayerChess"));
const SportsLounge = lazy(() => import("@/pages/SportsLounge"));
const AdminCinemaCatalog = lazy(() => import("@/pages/AdminCinemaCatalog"));
const PricingTiers = lazy(() => import("@/pages/PricingTiers"));
const SovereignTiers = lazy(() => import("@/pages/SovereignTiers"));
const VibeWallet = lazy(() => import("@/pages/VibeWallet"));
const CommunitySlots = lazy(() => import("@/pages/CommunitySlots"));
const SmartTables = lazy(() => import("@/pages/SmartTables"));
const TournamentWinnings = lazy(() => import("@/pages/TournamentWinnings"));
const LeaderboardRewards = lazy(() => import("@/pages/LeaderboardRewards"));
const AnalyticsDashboard = lazy(() => import("@/pages/AnalyticsDashboard"));
// import PracticeBaccaratAAA from "@/components/practice_games/PracticeBaccaratAAA";
// import PracticeBaccaratPremium3D from "@/components/practice_games/PracticeBaccaratPremium3D";

export const gamesRoutes = (ProtectedRoute) => (
  <>
    {/* Main Games */}
    <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
    <Route path="/games-menu" element={<Games />} />
    <Route path="/games/cyber-casino" element={<CyberCasino />} />
    <Route path="/games/cyber-casino/roulette" element={<CyberCasinoRoulette />} />
    <Route path="/games/cyber-casino/slots" element={<ProtectedRoute><CyberCasinoSlots /></ProtectedRoute>} />
    <Route path="/games/cyber-casino/blackjack" element={<ProtectedRoute><CyberCasinoBlackjack /></ProtectedRoute>} />
    <Route path="/game-demo" element={<GameDemo />} />
    <Route path="/games/play/:gameId" element={<ProtectedRoute><GamePlay /></ProtectedRoute>} />
    <Route path="/games/would-you-rather" element={<ProtectedRoute><WouldYouRather /></ProtectedRoute>} />
    <Route path="/dealers" element={<ProtectedRoute><DealerShowcase /></ProtectedRoute>} />
    <Route path="/dealer-showcase" element={<ProtectedRoute><ProfessionalDealerShowcase /></ProtectedRoute>} />
    <Route path="/professional-table" element={<ProfessionalTablePreview />} />
    <Route path="/table-designs" element={<ProtectedRoute><TableDesignShowcase /></ProtectedRoute>} />
    <Route path="/player-stats" element={<ProtectedRoute><PlayerStats /></ProtectedRoute>} />
    <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
    <Route path="/multiplayer" element={<ProtectedRoute><HttpMultiplayerLobby /></ProtectedRoute>} />
    <Route path="/multiplayer/room/:roomCode" element={<ProtectedRoute><MultiplayerRoom /></ProtectedRoute>} />
    <Route path="/vibez" element={<ProtectedRoute><MyVibezFeed /></ProtectedRoute>} />
    <Route path="/vibez/upload" element={<ProtectedRoute><MyVibezUpload /></ProtectedRoute>} />
    
    {/* Real-Time Multiplayer Poker */}
    <Route path="/multiplayer-poker" element={<ProtectedRoute><MultiplayerPoker /></ProtectedRoute>} />
    <Route path="/multiplayer-poker/:roomCode" element={<ProtectedRoute><MultiplayerPoker /></ProtectedRoute>} />
    
    {/* Real-Time Multiplayer Blackjack - Vibez Casino Edition */}
    <Route path="/multiplayer-blackjack" element={<ProtectedRoute><VibesCasinoBlackjack /></ProtectedRoute>} />
    <Route path="/multiplayer-blackjack/:roomCode" element={<ProtectedRoute><VibesCasinoBlackjack /></ProtectedRoute>} />
    
    {/* Real-Time Multiplayer UNO */}
    {/* Legacy UNO premium routes redirect to new UNO AAA */}
    <Route path="/multiplayer-uno" element={<Navigate to="/uno" replace />} />
    <Route path="/multiplayer-uno/:roomCode" element={<Navigate to="/uno" replace />} />



    
    {/* Trivia — /games/trivia aliases match canonical /api/games/trivia paths */}
    <Route path="/trivia" element={<ProtectedRoute><TriviaLobby /></ProtectedRoute>} />
    <Route path="/games/trivia" element={<ProtectedRoute><TriviaLobby /></ProtectedRoute>} />
    <Route path="/trivia/play/:gameId" element={<ProtectedRoute><TriviaGame /></ProtectedRoute>} />
    <Route path="/games/trivia/play/:gameId" element={<ProtectedRoute><TriviaGame /></ProtectedRoute>} />
    <Route path="/trivia/results/:gameId" element={<ProtectedRoute><TriviaResults /></ProtectedRoute>} />
    <Route path="/games/trivia/results/:gameId" element={<ProtectedRoute><TriviaResults /></ProtectedRoute>} />
    <Route path="/trivia/leaderboard" element={<ProtectedRoute><TriviaLeaderboard /></ProtectedRoute>} />
    <Route path="/games/trivia/leaderboard" element={<ProtectedRoute><TriviaLeaderboard /></ProtectedRoute>} />
    
    {/* 3D Lobby */}
    <Route path="/lobby" element={<ProtectedRoute><JazzClubLobby /></ProtectedRoute>} />
    <Route path="/jazz-club-lobby" element={<ProtectedRoute><JazzClubLobby /></ProtectedRoute>} />
    
    {/* Card Games */}
    {/* Spades AAA — single canonical room. Every legacy Spades route below
        redirects here so existing bookmarks never 404. */}
    <Route path="/spades" element={<ProtectedRoute><SpadesAAA /></ProtectedRoute>} />
    <Route path="/spades/premium" element={<ProtectedRoute><SpadesAAA /></ProtectedRoute>} />
    <Route path="/spades/premium/:gameId" element={<ProtectedRoute><SpadesAAA /></ProtectedRoute>} />
    <Route path="/spades-aaa" element={<ProtectedRoute><SpadesAAA /></ProtectedRoute>} />
    <Route path="/spades-aaa/:gameId" element={<ProtectedRoute><SpadesAAA /></ProtectedRoute>} />
    {/* Legacy redirects → SpadesAAA */}
    <Route path="/spades/:gameId" element={<Navigate to="/spades" replace />} />
    <Route path="/spades-practice" element={<Navigate to="/spades" replace />} />
    <Route path="/spades-premium-legacy" element={<Navigate to="/spades" replace />} />
    <Route path="/spades/big-wheel" element={<BigWheelLounge />} />    {/* Vibez 654 — Florida Flow dice game */}
    <Route path="/vibez-654" element={<ProtectedRoute><Vibez654Game /></ProtectedRoute>} />
    <Route path="/games/vibez-654" element={<ProtectedRoute><Vibez654Game /></ProtectedRoute>} />
    <Route path="/vibe-654-hall" element={<ProtectedRoute><Vibe654Hall /></ProtectedRoute>} />
    <Route path="/games/vibe-654-hall" element={<Navigate to="/vibe-654-hall" replace />} />
    <Route path="/vibe-654/prescription" element={<ProtectedRoute><Vibe654Prescription /></ProtectedRoute>} />
    <Route path="/games/vibe654/prescription" element={<Navigate to="/vibe-654/prescription" replace />} />
    <Route path="/blackjack-universal" element={<ProtectedRoute><BlackjackUniversal /></ProtectedRoute>} />
    <Route path="/network/judge" element={<ProtectedRoute><AiJudgeRoom /></ProtectedRoute>} />
    <Route path="/poker-practice" element={<ProtectedRoute><PokerPractice /></ProtectedRoute>} />
    {/* Legacy /rummy-practice URL → new Rummy AAA */}
    <Route path="/rummy-practice" element={<Navigate to="/rummy" replace />} />
    <Route path="/underground-club" element={<ProtectedRoute><UndergroundClub /></ProtectedRoute>} />
    
    {/* Bid Whist AAA — single canonical room (matches Spades AAA universal
        prototype). Every legacy Bid Whist route redirects here so existing
        bookmarks never 404. */}
    <Route path="/bid-whist" element={<ProtectedRoute><BidWhistAAA /></ProtectedRoute>} />
    <Route path="/bid-whist/:gameId" element={<ProtectedRoute><BidWhistAAA /></ProtectedRoute>} />
    {/* Legacy redirects → BidWhistAAA */}
    <Route path="/bid-whist-aaa" element={<Navigate to="/bid-whist" replace />} />
    <Route path="/bid-whist-aaa/:gameId" element={<Navigate to="/bid-whist" replace />} />
    <Route path="/bid-whist-lobby" element={<Navigate to="/bid-whist" replace />} />
    <Route path="/bid-whist-practice" element={<Navigate to="/bid-whist" replace />} />
    <Route path="/bid-whist-premium" element={<Navigate to="/bid-whist" replace />} />
    <Route path="/bid-whist-premium/:gameId" element={<Navigate to="/bid-whist" replace />} />

    {/* Hearts AAA — universal 4P prototype, crimson variant */}
    <Route path="/hearts" element={<ProtectedRoute><HeartsAAA /></ProtectedRoute>} />
    <Route path="/hearts/:gameId" element={<ProtectedRoute><HeartsAAA /></ProtectedRoute>} />
    <Route path="/hearts-aaa" element={<Navigate to="/hearts" replace />} />
    <Route path="/multiplayer-hearts" element={<Navigate to="/hearts" replace />} />
    {/* Feb 2026 unification — stale /multiplayer-* + /http-multiplayer/*
        canonical card-game paths redirect to the AAA rooms. */}
    <Route path="/multiplayer-rummy" element={<Navigate to="/rummy" replace />} />
    <Route path="/multiplayer-gin-rummy" element={<Navigate to="/gin-rummy" replace />} />
    <Route path="/multiplayer-gin_rummy" element={<Navigate to="/gin-rummy" replace />} />
    <Route path="/multiplayer-war" element={<Navigate to="/war" replace />} />
    <Route path="/multiplayer-gofish" element={<Navigate to="/go-fish" replace />} />
    <Route path="/multiplayer-go-fish" element={<Navigate to="/go-fish" replace />} />
    <Route path="/multiplayer-crazy-eights" element={<Navigate to="/crazy-eights" replace />} />
    <Route path="/multiplayer-crazy_eights" element={<Navigate to="/crazy-eights" replace />} />
    <Route path="/multiplayer-euchre" element={<Navigate to="/euchre" replace />} />
    <Route path="/multiplayer-pinochle" element={<Navigate to="/pinochle" replace />} />
    <Route path="/http-multiplayer/hearts" element={<Navigate to="/hearts" replace />} />
    <Route path="/http-multiplayer/rummy" element={<Navigate to="/rummy" replace />} />
    <Route path="/http-multiplayer/gin-rummy" element={<Navigate to="/gin-rummy" replace />} />
    <Route path="/http-multiplayer/gin_rummy" element={<Navigate to="/gin-rummy" replace />} />
    <Route path="/http-multiplayer/war" element={<Navigate to="/war" replace />} />
    <Route path="/http-multiplayer/gofish" element={<Navigate to="/go-fish" replace />} />
    <Route path="/http-multiplayer/go-fish" element={<Navigate to="/go-fish" replace />} />
    <Route path="/http-multiplayer/crazy-eights" element={<Navigate to="/crazy-eights" replace />} />
    <Route path="/http-multiplayer/crazy_eights" element={<Navigate to="/crazy-eights" replace />} />
    <Route path="/http-multiplayer/euchre" element={<Navigate to="/euchre" replace />} />
    <Route path="/http-multiplayer/pinochle" element={<Navigate to="/pinochle" replace />} />
    <Route path="/practice/play/hearts" element={<Navigate to="/hearts" replace />} />

    {/* Crazy Eights AAA — universal 4P prototype, onyx variant */}
    <Route path="/crazy-eights" element={<ProtectedRoute><CrazyEightsAAA /></ProtectedRoute>} />
    <Route path="/crazy-eights/:gameId" element={<ProtectedRoute><CrazyEightsAAA /></ProtectedRoute>} />
    <Route path="/thirty-one" element={<ProtectedRoute><ThirtyOne /></ProtectedRoute>} />
    <Route path="/yahtzee" element={<ProtectedRoute><Yahtzee /></ProtectedRoute>} />
    <Route path="/vibes-slots" element={<ProtectedRoute><VibesSlots /></ProtectedRoute>} />
    <Route path="/bingo" element={<ProtectedRoute><Bingo /></ProtectedRoute>} />
    <Route path="/caribbean-stud" element={<ProtectedRoute><CaribbeanStud /></ProtectedRoute>} />
    <Route path="/sic-bo" element={<ProtectedRoute><SicBo /></ProtectedRoute>} />
    <Route path="/craps" element={<ProtectedRoute><Craps /></ProtectedRoute>} />
    <Route path="/vibes-wheel" element={<ProtectedRoute><VibesWheel /></ProtectedRoute>} />
    <Route path="/keno" element={<ProtectedRoute><Keno /></ProtectedRoute>} />
    <Route path="/three-card-poker" element={<ProtectedRoute><ThreeCardPoker /></ProtectedRoute>} />
    <Route path="/pai-gow" element={<ProtectedRoute><PaiGow /></ProtectedRoute>} />
    <Route path="/casino-war" element={<ProtectedRoute><CasinoWar /></ProtectedRoute>} />
    <Route path="/chemin-de-fer" element={<ProtectedRoute><CheminDeFer /></ProtectedRoute>} />
    <Route path="/european-roulette" element={<ProtectedRoute><EuropeanRoulette /></ProtectedRoute>} />
    <Route path="/hazard" element={<ProtectedRoute><Hazard /></ProtectedRoute>} />
    <Route path="/chuck-a-luck" element={<ProtectedRoute><ChuckALuck /></ProtectedRoute>} />
    <Route path="/big-six-wheel" element={<ProtectedRoute><BigSixWheel /></ProtectedRoute>} />
    <Route path="/big-six" element={<Navigate to="/big-six-wheel" replace />} />
    <Route path="/jacks-or-better" element={<ProtectedRoute><JacksOrBetter /></ProtectedRoute>} />
    <Route path="/fan-tan" element={<ProtectedRoute><FanTan /></ProtectedRoute>} />
    <Route path="/faro" element={<ProtectedRoute><Faro /></ProtectedRoute>} />
    <Route path="/vibes-darts" element={<ProtectedRoute><VibesDarts /></ProtectedRoute>} />
    <Route path="/crazy-eights-aaa" element={<Navigate to="/crazy-eights" replace />} />
    <Route path="/practice/play/crazy_eights" element={<Navigate to="/crazy-eights" replace />} />

    {/* Go Fish AAA — universal 4P prototype, ocean variant */}
    <Route path="/go-fish" element={<ProtectedRoute><GoFishAAA /></ProtectedRoute>} />
    <Route path="/go-fish/:gameId" element={<ProtectedRoute><GoFishAAA /></ProtectedRoute>} />
    <Route path="/go-fish-aaa" element={<Navigate to="/go-fish" replace />} />
    <Route path="/practice/play/go_fish" element={<Navigate to="/go-fish" replace />} />
    <Route path="/practice/play/gofish" element={<Navigate to="/go-fish" replace />} />

    {/* Gin Rummy AAA — universal 2P prototype, gold variant */}
    <Route path="/gin-rummy" element={<ProtectedRoute><GinRummyAAA /></ProtectedRoute>} />
    <Route path="/gin-rummy/:gameId" element={<ProtectedRoute><GinRummyAAA /></ProtectedRoute>} />
    <Route path="/gin-rummy-aaa" element={<Navigate to="/gin-rummy" replace />} />
    <Route path="/practice/play/gin_rummy" element={<Navigate to="/gin-rummy" replace />} />

    {/* Rummy AAA — universal 2-4P prototype, jade variant */}
    <Route path="/rummy" element={<ProtectedRoute><RummyAAA /></ProtectedRoute>} />
    <Route path="/rummy/:gameId" element={<ProtectedRoute><RummyAAA /></ProtectedRoute>} />
    <Route path="/rummy-aaa" element={<Navigate to="/rummy" replace />} />
    <Route path="/practice/play/rummy" element={<Navigate to="/rummy" replace />} />

    {/* War AAA — universal 2P prototype, ruby variant */}
    <Route path="/war" element={<ProtectedRoute><WarAAA /></ProtectedRoute>} />
    <Route path="/war/:gameId" element={<ProtectedRoute><WarAAA /></ProtectedRoute>} />
    <Route path="/war-aaa" element={<Navigate to="/war" replace />} />
    <Route path="/practice/play/war" element={<Navigate to="/war" replace />} />

    {/* UNO AAA — universal 4P prototype, neon variant */}
    <Route path="/uno" element={<ProtectedRoute><UnoAAA /></ProtectedRoute>} />
    <Route path="/uno/:gameId" element={<ProtectedRoute><UnoAAA /></ProtectedRoute>} />
    <Route path="/uno-aaa" element={<Navigate to="/uno" replace />} />
    <Route path="/practice/play/uno" element={<Navigate to="/uno" replace />} />

    {/* Euchre AAA — universal 4P prototype, gold variant */}
    <Route path="/euchre" element={<ProtectedRoute><EuchreAAA /></ProtectedRoute>} />
    <Route path="/euchre/:gameId" element={<ProtectedRoute><EuchreAAA /></ProtectedRoute>} />
    {/* Euchre + Pinochle live HTTP multiplayer rooms (Feb 2026) */}
    <Route path="/card-mp/:gameType/:roomId" element={<ProtectedRoute><CardMpRoomPage /></ProtectedRoute>} />
    <Route path="/euchre-aaa" element={<Navigate to="/euchre" replace />} />
    <Route path="/practice/play/euchre" element={<Navigate to="/euchre" replace />} />

    {/* Dominoes AAA — universal 2P prototype, onyx "Arena" variant.
        Replaces the legacy `PracticeDominoes` component and the
        unrouted `HttpMultiplayerDominoes` page (Feb 2026). */}
    <Route path="/dominoes" element={<ProtectedRoute><DominoesAAA /></ProtectedRoute>} />
    <Route path="/dominoes/:gameId" element={<ProtectedRoute><DominoesAAA /></ProtectedRoute>} />
    <Route path="/dominoes-aaa" element={<Navigate to="/dominoes" replace />} />
    <Route path="/practice/play/dominoes" element={<Navigate to="/dominoes" replace />} />
    <Route path="/http-multiplayer-game/dominoes/:gameId" element={<Navigate to="/dominoes" replace />} />
    {/* Live multiplayer dominoes (head-to-head WS room). */}
    <Route path="/dominoes-mp" element={<ProtectedRoute><DominoesMP /></ProtectedRoute>} />

    {/* Pinochle AAA — universal 4P prototype, pearl variant. 48-card
        single-deck partnership (Feb 2026). */}
    <Route path="/pinochle" element={<ProtectedRoute><PinochleAAA /></ProtectedRoute>} />
    <Route path="/pinochle/:gameId" element={<ProtectedRoute><PinochleAAA /></ProtectedRoute>} />
    <Route path="/pinochle-aaa" element={<Navigate to="/pinochle" replace />} />
    <Route path="/practice/play/pinochle" element={<Navigate to="/pinochle" replace />} />
    
    <Route path="/underground-spades" element={<Navigate to="/spades" replace />} />
    <Route path="/underground-spades/:roomCode" element={<Navigate to="/spades" replace />} />
    
    {/* AR/VR */}
    <Route path="/ar-cards" element={<ProtectedRoute><ARCardPreview /></ProtectedRoute>} />
    
    {/* Practice Mode - dedicated AI/solo practice lobby */}
    <Route path="/practice" element={<ProtectedRoute><PracticeMode /></ProtectedRoute>} />
    <Route path="/practice/play/:gameId" element={<ProtectedRoute><PracticeGamePlay /></ProtectedRoute>} />
    <Route path="/practice/stats" element={<ProtectedRoute><PracticeStats /></ProtectedRoute>} />
    {/* Defensive redirect — beta-blocker fix (2026-02-09): older
        GamesMenu link + bookmarks point to '/practice/chess'. Send
        them to the canonical '/practice/play/chess' (which renders
        PracticeChess with Voice Coach + Roguelite Trial + Battle
        Mode toggle). */}
    <Route path="/practice/chess" element={<Navigate to="/practice/play/chess" replace />} />
    {/* Top-level /chess alias → canonical practice route (founder ask
        2026-05-09 visual sweep — bookmark / direct-link to /chess
        was returning NotFound before this redirect). */}
    <Route path="/chess" element={<Navigate to="/practice/play/chess" replace />} />

    {/* DSG 6 Quantum Vault Lottery — Genius Phase PDF (May 2026) */}
    <Route path="/lottery" element={<ProtectedRoute><DSG6Lottery /></ProtectedRoute>} />
    <Route path="/dsg6" element={<Navigate to="/lottery" replace />} />

    {/* The Underground — Private high-limit lounge (May 2026 founder ask) */}
    <Route path="/underground-casino" element={<ProtectedRoute><UndergroundCasino /></ProtectedRoute>} />
    <Route path="/underground" element={<Navigate to="/underground-casino" replace />} />

    {/* Chess Hall — lobby + Blitz / Daily Puzzle / Tournament / Multiplayer (May 2026) */}
    <Route path="/chess-hall" element={<ProtectedRoute><ChessHall /></ProtectedRoute>} />
    <Route path="/chess/blitz" element={<ProtectedRoute><ChessBlitz /></ProtectedRoute>} />
    <Route path="/chess/puzzle" element={<ProtectedRoute><ChessPuzzle /></ProtectedRoute>} />
    <Route path="/chess/tournament" element={<ProtectedRoute><ChessTournament /></ProtectedRoute>} />
    <Route path="/chess/multiplayer" element={<ProtectedRoute><HttpMultiplayerChess /></ProtectedRoute>} />

    {/* Sports Lounge — Vibe Sports Book (May 2026) */}
    <Route path="/sports-lounge" element={<ProtectedRoute><SportsLounge /></ProtectedRoute>} />
    <Route path="/sportsbook" element={<Navigate to="/sports-lounge" replace />} />

    {/* Admin Cinema Catalog CRUD (May 2026) */}
    <Route path="/admin/cinema-catalog" element={<ProtectedRoute><AdminCinemaCatalog /></ProtectedRoute>} />

    {/* Sovereign Tiers — math-anchored 6-tier premium pricing page (May 2026 rework) */}
    <Route path="/pricing" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/tiers" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/pricing-legacy" element={<PricingTiers />} />
    
    {/* AAA Casino Games - Updated to use WebSocket-enabled components */}
    <Route path="/practice/play/blackjack-aaa" element={<ProtectedRoute><BlackjackGameAAA /></ProtectedRoute>} />
    <Route path="/practice/play/blackjack" element={<ProtectedRoute><BlackjackGameSimple /></ProtectedRoute>} />
    <Route path="/practice/play/baccarat" element={<ProtectedRoute><PracticeBaccarat /></ProtectedRoute>} />
    <Route path="/practice/play/baccarat_premium" element={<ProtectedRoute><BaccaratPremium /></ProtectedRoute>} />
    <Route path="/baccarat-premium" element={<ProtectedRoute><BaccaratPremium /></ProtectedRoute>} />
    <Route path="/baccarat" element={<ProtectedRoute><BaccaratPremium /></ProtectedRoute>} />
    <Route path="/baccarat-aaa" element={<ProtectedRoute><BaccaratPremium /></ProtectedRoute>} />
    <Route path="/practice/play/roulette" element={<ProtectedRoute><RouletteGameAAA /></ProtectedRoute>} />
    <Route path="/practice/play/slots" element={<ProtectedRoute><CelestialSlots /></ProtectedRoute>} />
    <Route path="/multiplayer-slots" element={<ProtectedRoute><MultiplayerCelestialSlots /></ProtectedRoute>} />
    <Route path="/video-call-demo" element={<VideoCallDemo />} />
    
    {/* Multiplayer Lobby - HTTP Polling (Primary System) */}
    <Route path="/multiplayer" element={<ProtectedRoute><HttpMultiplayerLobby /></ProtectedRoute>} />
    <Route path="/http-multiplayer" element={<ProtectedRoute><HttpMultiplayerLobby /></ProtectedRoute>} />
    <Route path="/http-multiplayer-game/:gameType/:gameId" element={<ProtectedRoute><HttpGameRouter /></ProtectedRoute>} />
    
    {/* Tournaments */}
    <Route path="/tournaments" element={<ProtectedRoute><TournamentsListPage /></ProtectedRoute>} />
    <Route path="/tournament/:tournamentId" element={<ProtectedRoute><TournamentDetailsPage /></ProtectedRoute>} />
    <Route path="/tournament-hub" element={<ProtectedRoute><TournamentHub /></ProtectedRoute>} />
    <Route path="/couples-tournaments" element={<ProtectedRoute><CouplesTournaments /></ProtectedRoute>} />
    <Route path="/friends-tournaments" element={<ProtectedRoute><FriendsTournaments /></ProtectedRoute>} />

    {/* Daily Card Royale — multi-game tournaments (tournament_engine.py) */}
    <Route path="/card-royale" element={<ProtectedRoute><CardRoyaleLobby /></ProtectedRoute>} />
    <Route path="/card-royale/:tournamentId/run" element={<ProtectedRoute><GauntletRunner /></ProtectedRoute>} />

    {/* Voice Mirror — Whisper → Translate → TTS */}
    <Route path="/voice-mirror" element={<ProtectedRoute><VoiceMirror /></ProtectedRoute>} />
    <Route path="/voice-mirror/pair" element={<ProtectedRoute><VoiceMirrorPairPage /></ProtectedRoute>} />

    {/* $DSG TGE opt-in (user) */}
    <Route path="/tge" element={<ProtectedRoute><TGEOptIn /></ProtectedRoute>} />

    {/* Public $DSG Top 100 Leaderboard */}
    <Route path="/vibez-leaderboard" element={<LeaderboardPage />} />
    <Route path="/marathon" element={<MarathonLeaderboardPage />} />
    <Route path="/marathon-leaderboard" element={<MarathonLeaderboardPage />} />

    {/* Smartcar — live OAuth + vehicle control */}
    <Route path="/smartcar" element={<ProtectedRoute><SmartcarConnect /></ProtectedRoute>} />
    <Route path="/smartcar/callback" element={<ProtectedRoute><SmartcarCallback /></ProtectedRoute>} />

    {/* Spotify — live OAuth + now-playing + push-to-car */}
    <Route path="/spotify" element={<ProtectedRoute><SpotifyConnect /></ProtectedRoute>} />
    <Route path="/spotify/callback" element={<ProtectedRoute><SpotifyCallback /></ProtectedRoute>} />

    {/* Vibe Drive — $DSG for verified miles on curated playlists */}
    <Route path="/vibe-drive" element={<ProtectedRoute><VibeDrive /></ProtectedRoute>} />
    <Route path="/vibe-drive/hud" element={<ProtectedRoute><VibeDriveHUD /></ProtectedRoute>} />
    
    {/* AI Practice */}
    <Route path="/ai-practice" element={<ProtectedRoute><AIPracticeMode /></ProtectedRoute>} />
    
    {/* Showcases */}
    <Route path="/games-showcase" element={<ModernGamesShowcase />} />
    
    {/* MY VIBEZ Content Room */}
    <Route path="/my-vibez" element={<ProtectedRoute><MyVibez /></ProtectedRoute>} />
    <Route path="/my-vibez/watch/:videoId" element={<ProtectedRoute><VideoPlayer /></ProtectedRoute>} />
    
    {/* Watch-and-Wager */}
    <Route path="/watch-and-wager" element={<ProtectedRoute><WatchAndWager /></ProtectedRoute>} />
    <Route path="/spectate/:gameId" element={<ProtectedRoute><SpectateGame /></ProtectedRoute>} />
    <Route path="/my-bets" element={<ProtectedRoute><MyBetsHistory /></ProtectedRoute>} />
    
    {/* VR Games */}
    <Route path="/vr/slots" element={<ProtectedRoute><VRCelestialSlots /></ProtectedRoute>} />
    <Route 
      path="/community-slots" 
      element={<ProtectedRoute><CommunitySlots /></ProtectedRoute>} 
    />
    <Route 
      path="/smart-tables" 
      element={<ProtectedRoute><SmartTables /></ProtectedRoute>} 
    />
    <Route 
      path="/tournament-winnings" 
      element={<ProtectedRoute><TournamentWinnings /></ProtectedRoute>} 
    />
    <Route 
      path="/leaderboard-rewards" 
      element={<ProtectedRoute><LeaderboardRewards /></ProtectedRoute>} 
    />
    <Route 
      path="/analytics" 
      element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} 
    />
    <Route 
      path="/dice" 
      element={<ProtectedRoute><VibeDice654Premium /></ProtectedRoute>} 
    />
    <Route 
      path="/games/vibe654/tournament" 
      element={<ProtectedRoute><Vibe654TournamentLobby /></ProtectedRoute>} 
    />
    <Route 
      path="/games/vibe654/tournament/table/:tableId" 
      element={<ProtectedRoute><VibeColiseum /></ProtectedRoute>} 
    />
    {/* Dual Arena routes — Breadwinner Coliseum + 1vAI Solo Vault (Feb 2026) */}
    <Route
      path="/vibe-654/coliseum/:tableId"
      element={<ProtectedRoute><VibeColiseum /></ProtectedRoute>}
    />
    <Route
      path="/vibe-654/solo"
      element={<ProtectedRoute><VibeSoloHighRoller /></ProtectedRoute>}
    />
    <Route
      path="/vibe-654/legacy-table/:tableId"
      element={<ProtectedRoute><Vibe654TournamentTable /></ProtectedRoute>}
    />
    {/* 2026-05-12: /wallet route consolidated under miscRoutes.tsx so the
        new Wallet.tsx (with Phantom Connect row) renders instead of the
        legacy VibeWallet. Legacy preserved at /wallet-legacy for now. */}
    <Route 
      path="/wallet-legacy" 
      element={<ProtectedRoute><VibeWallet /></ProtectedRoute>} 
    />
    <Route 
      path="/nova-test" 
      element={<NOVADealerTest />} 
    />
    <Route 
      path="/vibe-suites" 
      element={<ProtectedRoute><VibeSuitesDiscovery /></ProtectedRoute>} 
    />
    <Route 
      path="/vibe-suites/create" 
      element={<ProtectedRoute><CreateVibeSuite /></ProtectedRoute>} 
    />
    
    {/* Universal Card Game Engine Route */}
    <Route 
      path="/game/:gameType/:roomCode" 
      element={
        <ProtectedRoute>
          <StabilityGuard>
            <UniversalGameRoom />
          </StabilityGuard>
        </ProtectedRoute>
      } 
    />

    {/* Legacy URL redirects — keep bookmarked links working */}
    <Route path="/blackjack" element={<Navigate to="/practice/play/blackjack" replace />} />
    <Route path="/blackjack-aaa" element={<Navigate to="/practice/play/blackjack-aaa" replace />} />
    <Route path="/vibe-dice" element={<Navigate to="/dice" replace />} />
    <Route path="/vibedice" element={<Navigate to="/dice" replace />} />
    <Route path="/games/vibedice654" element={<Navigate to="/dice" replace />} />

    {/* Cyber Casino — Unity WebGL externally-hosted games */}
    <Route
      path="/cyber-casino"
      element={
        <ProtectedRoute>
          <CyberCasinoRoom />
        </ProtectedRoute>
      }
    />
    <Route
      path="/cyber-casino/:gameId"
      element={
        <ProtectedRoute>
          <CyberCasinoRoom />
        </ProtectedRoute>
      }
    />

    {/* ───────── May 2026 PDF batch (Streamer Revenue / Master Tech /
        Party Hub blueprints). Each new room is a thin frontend page
        on top of the already-shipped `/api/streamer-actions/*` and
        `/api/dsg-guard/*` rails. */}
    <Route path="/streamer/overlay/:streamerId" element={<StreamerOverlay />} />
    <Route path="/streamer/setup-guide"   element={<StreamerSetupGuide />} />
    <Route path="/party/vibe-tionary"   element={<ProtectedRoute><Vibetionary /></ProtectedRoute>} />
    <Route path="/party/meme-matchmaker" element={<ProtectedRoute><MemeMatchmaker /></ProtectedRoute>} />
    <Route path="/party/hide-seek"      element={<ProtectedRoute><VibeHideSeek /></ProtectedRoute>} />
    <Route path="/dating/blind-auction" element={<ProtectedRoute><BlindAuctionDating /></ProtectedRoute>} />
    <Route path="/vibeshopper"          element={<ProtectedRoute><VibeShopperHunt /></ProtectedRoute>} />
    <Route path="/beat-vault/dlc"       element={<ProtectedRoute><BeatVaultDLC /></ProtectedRoute>} />
    {/* Music Arena + TV Totem Pole rooms (May 2026 PDFs) */}
    <Route path="/music/sound-check"      element={<ProtectedRoute><SoundCheckGauntlet /></ProtectedRoute>} />
    <Route path="/music/collab-matchmaker" element={<ProtectedRoute><CollabMatchmaker /></ProtectedRoute>} />
    <Route path="/music/totem-battles"    element={<ProtectedRoute><TotemPoleBattles /></ProtectedRoute>} />
    <Route path="/music/vibe-suite"       element={<ProtectedRoute><VibeSuite /></ProtectedRoute>} />
    <Route path="/music/vibe-suite/:suiteId" element={<ProtectedRoute><VibeSuite /></ProtectedRoute>} />
    <Route path="/music/glasshouse"       element={<ProtectedRoute><LyricGlasshouse /></ProtectedRoute>} />
    <Route path="/tv/totem-pole"          element={<ProtectedRoute><TotemPoleQueue /></ProtectedRoute>} />

  </>
);