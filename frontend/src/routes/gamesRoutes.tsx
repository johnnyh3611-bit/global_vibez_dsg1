import { Route, Navigate } from "react-router-dom";
import Games from "@/pages/GamesNew";
import GamePlay from "@/pages/GamePlay";
import GameDemo from "@/pages/GameDemo";
import WouldYouRather from "@/pages/WouldYouRather";
import TriviaLobby from "@/pages/TriviaLobby";
import TriviaGame from "@/pages/TriviaGame";
import TriviaResults from "@/pages/TriviaResults";
import TriviaLeaderboard from "@/pages/TriviaLeaderboard";
import SpadesAAA from "@/pages/games/SpadesAAA";
import BidWhistAAA from "@/pages/games/BidWhistAAA";
import CrazyEightsAAA from "@/pages/games/CrazyEightsAAA";
import ThirtyOne from "@/pages/games/ThirtyOne";
import Yahtzee from "@/pages/games/Yahtzee";
import VibesSlots from "@/pages/games/VibesSlots";
import Bingo from "@/pages/games/Bingo";
import CaribbeanStud from "@/pages/games/CaribbeanStud";
import SicBo from "@/pages/games/SicBo";
import Craps from "@/pages/games/Craps";
import VibesWheel from "@/pages/games/VibesWheel";
import Keno from "@/pages/games/Keno";
import ThreeCardPoker from "@/pages/games/ThreeCardPoker";
import PaiGow from "@/pages/games/PaiGow";
import CasinoWar from "@/pages/games/CasinoWar";
import CheminDeFer from "@/pages/games/CheminDeFer";
import EuropeanRoulette from "@/pages/games/EuropeanRoulette";
import Hazard from "@/pages/games/Hazard";
import ChuckALuck from "@/pages/games/ChuckALuck";
import BigSixWheel from "@/pages/games/BigSixWheel";
import JacksOrBetter from "@/pages/games/JacksOrBetter";

// May 2026 PDF batch — new rooms backed by already-shipped DSG Guard
// + Streamer Action Hub APIs.
import StreamerOverlay   from "@/pages/streamer/StreamerOverlay";
import Vibetionary       from "@/pages/party/Vibetionary";
import MemeMatchmaker    from "@/pages/party/MemeMatchmaker";
import VibeHideSeek      from "@/pages/party/VibeHideSeek";
import BlindAuctionDating from "@/pages/dating/BlindAuctionDating";
import VibeShopperHunt   from "@/pages/dsg/VibeShopperHunt";
import BeatVaultDLC      from "@/pages/dsg/BeatVaultDLC";
// Music Arena + TV Totem Pole batch (May 2026 PDFs).
import SoundCheckGauntlet from "@/pages/music/SoundCheckGauntlet";
import CollabMatchmaker   from "@/pages/music/CollabMatchmaker";
import TotemPoleBattles   from "@/pages/music/TotemPoleBattles";
import TotemPoleQueue     from "@/pages/tv/TotemPoleQueue";
import StreamerSetupGuide from "@/pages/streamer/StreamerSetupGuide";
import VibeSuite          from "@/pages/music/VibeSuite";
import LyricGlasshouse    from "@/pages/music/LyricGlasshouse";
import FanTan from "@/pages/games/FanTan";
import Faro from "@/pages/games/Faro";
import VibesDarts from "@/pages/games/VibesDarts";
import EuchreAAA from "@/pages/games/EuchreAAA";
import CardMpRoomPage from "@/pages/games/CardMpRoomPage";
import GinRummyAAA from "@/pages/games/GinRummyAAA";
import GoFishAAA from "@/pages/games/GoFishAAA";
import HeartsAAA from "@/pages/games/HeartsAAA";
import RummyAAA from "@/pages/games/RummyAAA";
import UnoAAA from "@/pages/games/UnoAAA";
import WarAAA from "@/pages/games/WarAAA";
import DominoesAAA from "@/pages/games/DominoesAAA";
import DominoesMP from "@/pages/games/DominoesMP";
import PinochleAAA from "@/pages/games/PinochleAAA";
// Spades legacy imports removed May 2026. SpadesAAA is now the single canonical room.
import BigWheelLounge from "@/pages/games/BigWheelLounge";
import Vibez654Game from "@/pages/games/Vibez654Game";
import BlackjackUniversal from "@/pages/games/BlackjackUniversal";
import PokerPractice from "@/pages/games/PokerPractice";
import BaccaratPremium from "@/pages/games/BaccaratPremium";
import CyberCasino from "@/pages/games/CyberCasino";
import CyberCasinoRoulette from "@/pages/games/CyberCasinoRoulette";
import CyberCasinoSlots from "@/pages/games/CyberCasinoSlots";
import CyberCasinoBlackjack from "@/pages/games/CyberCasinoBlackjack";
import VibeSuitesDiscovery from "@/pages/VibeSuitesDiscovery";
import CreateVibeSuite from "@/pages/CreateVibeSuite";
// UndergroundSpades legacy import removed May 2026.
import UndergroundClub from "@/pages/UndergroundClub";
import ARCardPreview from "@/pages/ARCardPreview";
import JazzClubLobby from "@/pages/JazzClubLobby";
import PracticeMode from "@/pages/PracticeMode";
import CyberCasinoRoom from "@/pages/cyber-casino/CyberCasinoRoom";
import PracticeGamePlay from "@/pages/PracticeGamePlay";
import PracticeStats from "@/pages/PracticeStats";
import HttpMultiplayerLobby from "@/pages/HttpMultiplayerLobby";
import HttpGameRouter from "@/pages/HttpGameRouter";
import TournamentsListPage from "@/pages/TournamentsListPage";
import TournamentDetailsPage from "@/pages/TournamentDetailsPage";
import TournamentHub from "@/pages/TournamentHub";
import CouplesTournaments from "@/pages/CouplesTournaments";
import FriendsTournaments from "@/pages/FriendsTournaments";
import CardRoyaleLobby from "@/pages/CardRoyaleLobby";
import GauntletRunner from "@/pages/GauntletRunner";
import VoiceMirror from "@/pages/VoiceMirror";
import VoiceMirrorPairPage from "@/pages/VoiceMirrorPairPage";
import TGEOptIn from "@/pages/TGEOptIn";
import LeaderboardPage from "@/pages/LeaderboardPage";
import MarathonLeaderboardPage from "@/pages/MarathonLeaderboardPage";
import SmartcarConnect from "@/pages/SmartcarConnect";
import SmartcarCallback from "@/pages/SmartcarCallback";
import SpotifyConnect from "@/pages/SpotifyConnect";
import SpotifyCallback from "@/pages/SpotifyCallback";
import VibeDrive from "@/pages/VibeDrive";
import VibeDriveHUD from "@/pages/VibeDriveHUD";
import AIPracticeMode from "@/pages/AIPracticeMode";
import NOVADealerTest from "@/pages/NOVADealerTest";
import ModernGamesShowcase from "@/pages/ModernGamesShowcase";
import DealerShowcase from "@/pages/DealerShowcase";
import TableDesignShowcase from "@/pages/TableDesignShowcase";
import ProfessionalDealerShowcase from "@/pages/ProfessionalDealerShowcase";
import ProfessionalTablePreview from "@/pages/ProfessionalTablePreview";
import PlayerStats from "@/pages/PlayerStats";
import VRCelestialSlots from "@/components/vr/VRCelestialSlots";
import Leaderboard from "@/pages/Leaderboard";
import MultiplayerRoom from "@/pages/MultiplayerRoom";
import MyVibezFeed from "@/pages/MyVibezFeed";
import MyVibezUpload from "@/pages/MyVibezUpload";
import { MyVibez } from "@/pages/MyVibez";
import { VideoPlayer } from "@/pages/VideoPlayer";
import { WatchAndWager } from "@/pages/WatchAndWager";
import { MyBetsHistory } from "@/pages/MyBetsHistory";
import { SpectateGame } from "@/pages/SpectateGame";
import MultiplayerPoker from "@/pages/MultiplayerPoker";
import UniversalGameRoom from "@/pages/games/UniversalGameRoom";
import StabilityGuard from "@/components/StabilityGuard";
import VibesCasinoBlackjack from "@/pages/VibesCasinoBlackjack";
import BlackjackGameAAA from "@/components/practice_games/BlackjackGameAAA";
import BlackjackGameSimple from "@/components/practice_games/BlackjackGameSimple";
import RouletteGameAAA from "@/components/practice_games/RouletteGameAAA";
import CelestialSlots from "@/components/practice_games/CelestialSlots";
import MultiplayerCelestialSlots from "@/components/practice_games/MultiplayerCelestialSlots";
import VideoCallDemo from "@/pages/VideoCallDemo";
import PracticeBaccarat from "@/components/practice_games/PracticeBaccarat";
import VibeDice654 from "@/pages/games/VibeDice654";
import VibeDice654Premium from "@/pages/games/VibeDice654Premium";
import Vibe654TournamentLobby from "@/pages/games/Vibe654TournamentLobby";
import Vibe654TournamentTable from "@/pages/games/Vibe654TournamentTable";
import VibeColiseum from "@/pages/games/VibeColiseum";
import VibeSoloHighRoller from "@/pages/games/VibeSoloHighRoller";
import VibeWallet from "@/pages/VibeWallet";
import CommunitySlots from "@/pages/CommunitySlots";
import SmartTables from "@/pages/SmartTables";
import TournamentWinnings from "@/pages/TournamentWinnings";
import LeaderboardRewards from "@/pages/LeaderboardRewards";
import AnalyticsDashboard from "@/pages/AnalyticsDashboard";

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



    
    {/* Trivia */}
    <Route path="/trivia" element={<ProtectedRoute><TriviaLobby /></ProtectedRoute>} />
    <Route path="/trivia/play/:gameId" element={<ProtectedRoute><TriviaGame /></ProtectedRoute>} />
    <Route path="/trivia/results/:gameId" element={<ProtectedRoute><TriviaResults /></ProtectedRoute>} />
    <Route path="/trivia/leaderboard" element={<ProtectedRoute><TriviaLeaderboard /></ProtectedRoute>} />
    
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
    <Route path="/blackjack-universal" element={<ProtectedRoute><BlackjackUniversal /></ProtectedRoute>} />
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
    
    {/* Practice Mode - REDIRECTED TO NEW UNIFIED GAMES PAGE */}
    <Route path="/practice" element={<ProtectedRoute><Games /></ProtectedRoute>} />
    <Route path="/practice/play/:gameId" element={<ProtectedRoute><PracticeGamePlay /></ProtectedRoute>} />
    <Route path="/practice/stats" element={<ProtectedRoute><PracticeStats /></ProtectedRoute>} />
    {/* Defensive redirect — beta-blocker fix (2026-02-09): older
        GamesMenu link + bookmarks point to '/practice/chess'. Send
        them to the canonical '/practice/play/chess' (which renders
        PracticeChess with Voice Coach + Roguelite Trial + Battle
        Mode toggle). */}
    <Route path="/practice/chess" element={<Navigate to="/practice/play/chess" replace />} />
    
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
    <Route 
      path="/wallet" 
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