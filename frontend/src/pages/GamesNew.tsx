import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Gamepad2, Trophy, Users, Zap, Crown, Search,
  ArrowLeft, Sparkles, Play, Bot, Info, Star, BarChart3
} from 'lucide-react';
import AppFooter from '@/components/AppFooter';
import GameRulesModal from '@/components/GameRulesModal';
import SoundControls from '@/components/SoundControls';
import soundManager from '@/utils/soundManager';
import WinnerTicker from '@/components/common/WinnerTicker';
import { isComingSoon } from '@/data/comingSoonGames';

// Game gradient themes - custom color schemes for each game
const GAME_GRADIENTS = {
  // Card Games - Rich casino colors
  bid_whist_premium: 'from-amber-900 via-orange-800 to-red-900',
  bid_whist_platinum: 'from-purple-900 via-cyan-700 to-blue-900',
  poker: 'from-emerald-900 via-green-800 to-teal-900',
  blackjack: 'from-red-900 via-rose-800 to-pink-900',
  uno: 'from-red-600 via-yellow-500 to-blue-600',
  go_fish: 'from-cyan-600 via-blue-500 to-indigo-600',
  crazy_eights: 'from-orange-600 via-red-500 to-pink-600',
  thirty_one: 'from-fuchsia-600 via-purple-600 to-cyan-500',
  hearts: 'from-rose-600 via-red-500 to-pink-600',
  spades: 'from-gray-800 via-slate-700 to-gray-900',
  bid_whist: 'from-amber-900 via-yellow-800 to-orange-900',
  rummy: 'from-amber-700 via-orange-600 to-red-700',
  gin_rummy: 'from-amber-600 via-yellow-500 to-orange-600',
  war: 'from-red-700 via-orange-600 to-yellow-600',
  solitaire: 'from-purple-800 via-indigo-700 to-blue-800',
  
  // Casino Table Games - Luxurious gold/neon
  roulette: 'from-yellow-600 via-amber-500 to-orange-600',
  baccarat: 'from-purple-900 via-indigo-800 to-blue-900',
  baccarat_premium: 'from-purple-600 via-pink-500 to-cyan-500',
  caribbean_stud: 'from-teal-700 via-cyan-600 to-blue-700',
  three_card_poker: 'from-red-800 via-rose-700 to-pink-800',
  pai_gow: 'from-amber-800 via-orange-700 to-red-800',
  chemin_de_fer: 'from-gray-900 via-slate-800 to-zinc-900',
  casino_war: 'from-red-700 via-orange-600 to-amber-700',
  european_roulette: 'from-emerald-700 via-green-600 to-teal-700',
  
  // Casino Dice Games
  craps: 'from-red-800 via-orange-700 to-yellow-700',
  vibez_654: 'from-purple-700 via-pink-600 to-fuchsia-700',
  vibe_654_dice: 'from-purple-700 via-pink-600 to-fuchsia-700',
  sic_bo: 'from-red-700 via-rose-600 to-pink-700',
  hazard: 'from-amber-700 via-yellow-600 to-orange-700',
  chuck_a_luck: 'from-cyan-700 via-blue-600 to-indigo-700',
  
  // Casino Wheel Games
  big_six_wheel: 'from-purple-700 via-fuchsia-600 to-pink-700',
  vibes_wheel: 'from-cyan-500 via-blue-500 to-indigo-600',
  
  // Video/Electronic Casino
  jacks_or_better: 'from-indigo-800 via-purple-700 to-pink-800',
  vibes_slots: 'from-purple-600 via-pink-500 to-fuchsia-600',
  keno: 'from-orange-700 via-amber-600 to-yellow-700',
  bingo: 'from-blue-700 via-cyan-600 to-teal-700',
  
  // Classic Casino Games
  fan_tan: 'from-red-800 via-orange-700 to-amber-800',
  faro: 'from-gray-800 via-slate-700 to-zinc-800',
  vibes_darts: 'from-red-600 via-orange-500 to-yellow-600',
  
  // Board Games - Classic wood tones
  chess: 'from-gray-700 via-slate-600 to-zinc-700',
  checkers: 'from-red-800 via-slate-700 to-gray-800',
  connect4: 'from-blue-700 via-indigo-600 to-purple-700',
  tictactoe: 'from-cyan-600 via-teal-500 to-emerald-600',
  reversi: 'from-gray-900 via-slate-800 to-zinc-900',
  mancala: 'from-amber-700 via-orange-600 to-yellow-700',
  dominoes: 'from-gray-800 via-slate-700 to-zinc-800',
  battleship: 'from-blue-900 via-cyan-800 to-teal-900',
  mahjong: 'from-emerald-800 via-green-700 to-teal-800',
  yahtzee: 'from-purple-700 via-fuchsia-600 to-pink-700',
  klondike: 'from-indigo-800 via-purple-700 to-pink-800',
  
  // Arcade Games - Neon bright
  snake: 'from-green-600 via-lime-500 to-emerald-600',
  memory_match: 'from-pink-600 via-purple-500 to-indigo-600',
  ping_pong: 'from-blue-600 via-cyan-500 to-teal-600',
  pool_8ball: 'from-emerald-800 via-green-700 to-teal-800',
  
  // Party Games - Fun vibrant
  trivia: 'from-purple-600 via-fuchsia-500 to-pink-600',
  truth_or_dare: 'from-rose-600 via-pink-500 to-fuchsia-600',
  two_truths_lie: 'from-orange-600 via-amber-500 to-yellow-600',
  
  // Premium Poker — Luxurious (3D Poker variants removed 2026-02-16 per founder)
  blackjack_new: 'from-red-900 via-rose-800 to-pink-900',
  
  // Universal Engine Games - Futuristic Neon
  blackjack_universal: 'from-cyan-900 via-blue-800 to-purple-900',
  poker_universal: 'from-emerald-900 via-teal-800 to-cyan-900',
  spades_universal: 'from-gray-900 via-slate-800 to-zinc-900',
  rummy_universal: 'from-amber-900 via-orange-800 to-red-900'
};

// Game categories with multiplayer availability mapping
const MULTIPLAYER_AVAILABLE = {
  // Card Games with multiplayer
  'poker': true,
  'poker_universal': true,
  'blackjack': true,
  'blackjack_universal': true,
  'uno': true,
  'go_fish': true,
  'hearts': true,
  'spades': true,
  'spades_universal': true,
  'bid_whist': true,
  'rummy': true,
  'rummy_universal': true,
  'crazy_eights': true,
  'thirty_one': true,
  'yahtzee': true,
  'war': true,
  'gin_rummy': true,
  
  // Casino - most are single-player only
  'roulette': false,
  'baccarat': false,
  'baccarat_premium': false,
  'caribbean_stud': false,
  'three_card_poker': false,
  'pai_gow': false,
  'chemin_de_fer': false,
  'casino_war': false,
  'european_roulette': false,
  'craps': false,
  'sic_bo': false,
  'hazard': false,
  'chuck_a_luck': false,
  'big_six_wheel': false,
  'vibes_wheel': false,
  'jacks_or_better': false,
  'vibes_slots': true,
  'bingo': true,
  'keno': false,
  'fan_tan': false,
  'faro': false,
  'vibes_darts': false,
  
  // Board Games with multiplayer
  'chess': true,
  'checkers': true,
  'connect4': true,
  'tictactoe': true,
  'reversi': false,
  'mancala': true,
  'dominoes': true,
  'battleship': false,
  'mahjong': true,
  'klondike': false,
  
  // Arcade - mostly single-player
  'snake': false,
  'memory_match': false,
  'ping_pong': false,
  'pool_8ball': false,
  
  // Party Games
  'trivia': true,
  'truth_or_dare': true,
  'two_truths_lie': false,
  
  // Premium
  'blackjack_new': false
  // poker_3d / poker_css3d removed 2026-02-16 (founder directive — 3D Poker rooms deleted).
};

const GAME_CATEGORIES = {
  featured: {
    name: 'Featured',
    icon: Sparkles,
    games: [
      { id: 'bid_whist_premium', name: 'Vibez Whist Premium', emoji: '🎴', image: '/bidwhist-card.png', players: '4', type: 'card', featured: true, badge: '✨ AAA ROOM' },
      { id: 'blackjack_universal', name: 'Blackjack Universal', emoji: '⚡', image: '/blackjack-card.png', players: '1-7', type: 'card', featured: true, badge: '🚀 ENGINE' },
      { id: 'poker_universal', name: 'Texas Hold\'em', emoji: '♠️', image: '/poker-card.png', players: '2-10', type: 'card', featured: true, badge: '🚀 NEW' },
      { id: 'spades_universal', name: 'Spades AAA', emoji: '♠️', image: '/spades-card.png', players: '4', type: 'card', featured: true, badge: '✨ NEW AAA ROOM' },
      { id: 'vibez_654', name: 'Vibez 654', emoji: '🎲', image: '/dice654-card.png', players: '1', type: 'casino', featured: true, badge: '💰 POPULAR' },
      { id: 'uno', name: 'UNO', emoji: '🎯', image: '/uno-card.png', players: '2-4', type: 'card', featured: true, badge: '✨ AAA ROOM' }
    ]
  },
  card: {
    name: 'Card Games',
    icon: Gamepad2,
    games: [
      { id: 'bid_whist_premium', name: 'Vibez Whist Premium', emoji: '🎴', image: '/bidwhist-card.png', players: '4', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'bid_whist_platinum', name: 'Vibez Whist Platinum', emoji: '💎', image: '/bidwhist-card.png', players: '4', type: 'card', badge: '🎨 AAA' },
      { id: 'poker_universal', name: 'Texas Hold\'em', emoji: '♠️', image: '/poker-card.png', players: '2-10', type: 'card', badge: '🚀 UNIVERSAL ENGINE' },
      { id: 'poker', name: 'Poker (Legacy)', emoji: '♣️', image: '/poker-card.png', players: '2-6', type: 'card' },
      { id: 'blackjack', name: 'Blackjack', emoji: '🃏', image: '/blackjack-card.png', players: '1-4', type: 'card' },
      { id: 'blackjack_new', name: 'Blackjack Premium', emoji: '🎴', image: '/blackjackpremium-card.png', players: '1', type: 'card', badge: '🎵 UPGRADED' },
      { id: 'blackjack_universal', name: 'Blackjack Universal', emoji: '⚡', image: '/blackjack-card.png', players: '1-7', type: 'card', badge: '🚀 ENGINE DEMO' },
      { id: 'uno', name: 'UNO', emoji: '🎯', image: '/uno-card.png', players: '2-4', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'go_fish', name: 'Go Fish', emoji: '🐟', image: '/gofish-card.png', players: '2-4', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'crazy_eights', name: 'Crazy Eights', emoji: '8️⃣', image: '/crazyeights-card.png', players: '2-4', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'thirty_one', name: 'Thirty-One', emoji: '🃏', image: '/poker-card.png', players: '2-7', type: 'card', badge: '🆕 SCARCITY RULES' },
      { id: 'hearts', name: 'Hearts', emoji: '♥️', image: '/hearts-card.png', players: '4', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'spades_universal', name: 'Spades AAA', emoji: '♠️', image: '/spades-card.png', players: '4', type: 'card', badge: '✨ NEW AAA ROOM' },
      { id: 'bid_whist', name: 'Bid Whist', emoji: '🃏', image: '/bidwhist-card.png', players: '4', type: 'card', badge: '👑 PREMIUM' },
      { id: 'rummy_universal', name: 'Rummy Universal', emoji: '🎴', image: '/rummy-card.png', players: '2-6', type: 'card', badge: '🚀 UNIVERSAL ENGINE' },
      { id: 'rummy', name: 'Rummy', emoji: '🃏', image: '/rummy-card.png', players: '2-4', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'gin_rummy', name: 'Gin Rummy', emoji: '🥃', image: '/ginrummy-card.png', players: '2', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'war', name: 'War', emoji: '⚔️', image: '/war-card.png', players: '2', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'euchre', name: 'Euchre', emoji: '👑', image: '/euchre-card.png', players: '4', type: 'card', badge: '✨ AAA ROOM' },
      { id: 'pinochle', name: 'Pinochle', emoji: '💎', image: '/euchre-card.png', players: '4', type: 'card', badge: '✨ AAA NEW' },
      { id: 'solitaire', name: 'Solitaire', emoji: '🂡', image: '/solitaire-card.png', players: '1', type: 'card', badge: '🎵 UPGRADED' }
    ]
  },
  casino: {
    name: 'Casino',
    icon: Star,
    games: [
      // ⭐ NEW GAME - VIBEZ 654
      { id: 'vibe_654_dice', name: 'Vibez 654', emoji: '🎲', image: '/dice654-card.png', players: '1', type: 'casino', badge: '💰 NEW', featured: true },
      { id: 'vibe_654_tournament', name: 'Vibez 654 Tournament', emoji: '🏆', image: '/dice654-card.png', players: '2-20', type: 'casino', badge: '🏆 TOURNAMENT', featured: true },
      
      // Table Games
      { id: 'roulette', name: 'Roulette', emoji: '🎰', image: '/roulette-card.png', players: '1', type: 'casino', badge: '🎰 ENHANCED', featured: true },
      { id: 'baccarat', name: 'Baccarat', emoji: '🎴', image: '/baccarat-card.png', players: '1', type: 'casino', badge: 'CLASSIC' },
      { id: 'baccarat_premium', name: 'Baccarat 3D Premium', emoji: '💎', image: '/baccarat-card.png', players: '1', type: 'casino', badge: '3D PREMIUM', featured: true },
      { id: 'caribbean_stud', name: 'Caribbean Stud', emoji: '🏝️', image: '/caribbeanstud-card.png', players: '1', type: 'casino', badge: 'POKER' },
      { id: 'three_card_poker', name: 'Three Card Poker', emoji: '🃏', image: '/threecardpoker-card.png', players: '1', type: 'casino', badge: 'POKER' },
      { id: 'pai_gow', name: 'Pai Gow', emoji: '🀄', image: '/paigow-card.png', players: '1', type: 'casino', badge: 'ASIAN' },
      { id: 'chemin_de_fer', name: 'Chemin de Fer', emoji: '🎩', image: '/chemindefer-card.png', players: '1', type: 'casino', badge: 'VIP' },
      { id: 'casino_war', name: 'Casino War', emoji: '⚔️', image: '/casinowar-card.png', players: '1', type: 'casino', badge: 'FAST' },
      { id: 'european_roulette', name: 'European Roulette', emoji: '🇪🇺', image: '/europeanroulette-card.png', players: '1', type: 'casino', badge: 'PREMIUM' },
      
      // Dice Games
      { id: 'craps', name: 'Craps', emoji: '🎲', image: '/craps-card.png', players: '1-8', type: 'casino', badge: 'DICE' },
      { id: 'sic_bo', name: 'Sic Bo', emoji: '🎲', image: '/sicbo-card.png', players: '1', type: 'casino', badge: 'ASIAN' },
      { id: 'hazard', name: 'Hazard', emoji: '🎲', image: '/hazard-card.png', players: '1', type: 'casino', badge: 'CLASSIC' },
      { id: 'chuck_a_luck', name: 'Chuck-A-Luck', emoji: '🎲', image: '/chuckaluck-card.png', players: '1', type: 'casino', badge: 'DICE' },
      
      // Wheel Games
      { id: 'big_six_wheel', name: 'Big Six Wheel', emoji: '🎡', image: '/bigsixwheel-card.png', players: '1', type: 'casino', badge: 'WHEEL' },
      { id: 'vibes_wheel', name: 'Vibes Wheel', emoji: '🎡', image: '/vibeswheel-card.png', players: '1', type: 'casino', badge: 'NEW' },
      
      // Video/Electronic
      { id: 'jacks_or_better', name: 'Jacks or Better', emoji: '🎰', image: '/jacksobetter-card.png', players: '1', type: 'casino', badge: 'VIDEO POKER' },
      { id: 'vibes_slots', name: 'Vibes Slots', emoji: '🎰', image: '/vibesslots-card.png', players: '1', type: 'casino', badge: '🆕 LIVE JACKPOT' },
      { id: 'keno', name: 'Keno', emoji: '🎱', image: '/keno-card.png', players: '1', type: 'casino', badge: 'LOTTERY' },
      { id: 'bingo', name: 'Bingo', emoji: '🅱️', image: '/bingo-card.png', players: '1+', type: 'casino', badge: 'SOCIAL' },
      
      // Classic Games
      { id: 'fan_tan', name: 'Fan-Tan', emoji: '🪙', image: '/fantan-card.png', players: '1', type: 'casino', badge: 'ASIAN' },
      { id: 'faro', name: 'Faro', emoji: '🎴', image: '/faro-card.png', players: '1', type: 'casino', badge: 'VINTAGE' },
      { id: 'vibes_darts', name: 'Vibes Darts', emoji: '🎯', image: '/vibesdarts-card.png', players: '1', type: 'casino', badge: 'SKILL' }
    ]
  },
  board: {
    name: 'Board Games',
    icon: Trophy,
    games: [
      { id: 'chess', name: 'Chess', emoji: '♟️', image: '/chess-card.png', players: '2', type: 'board', badge: '⚔️ BATTLE MODE' },
      { id: 'checkers', name: 'Checkers', emoji: '🔴', image: '/checkers-card.png', players: '2', type: 'board' },
      { id: 'connect4', name: 'Connect 4 XL', emoji: '🔵', image: '/connect4-card.png', players: '2', type: 'board', badge: '🆕 XL BOARD' },
      { id: 'tictactoe', name: 'Tic Tac Toe XL', emoji: '❌', image: '/tictactoe-card.png', players: '2', type: 'board', badge: '🆕 12×12' },
      { id: 'reversi', name: 'Reversi', emoji: '⚫', image: '/reversi-card.png', players: '2', type: 'board' },
      { id: 'ludo', name: 'Ludo', emoji: '🎲', image: '/ludo-card.png', players: '2-4', type: 'board', badge: '🎮 MP' },
      { id: 'backgammon', name: 'Backgammon', emoji: '🎯', image: '/backgammon-card.png', players: '2', type: 'board', badge: '🎮 MP', multiplayerOnly: true },
      { id: 'carrom', name: 'Carrom', emoji: '🟡', image: '/carrom-card.png', players: '2-4', type: 'board', badge: '🎮 MP', multiplayerOnly: true },
      { id: 'parcheesi', name: 'Parcheesi', emoji: '🏁', image: '/parcheesi-card.png', players: '2-4', type: 'board', badge: '🎮 MP', multiplayerOnly: true },
      { id: 'shogi', name: 'Shogi', emoji: '🈁', image: '/shogi-card.png', players: '2', type: 'board', badge: '🎮 MP · ASIAN', multiplayerOnly: true },
      { id: 'xiangqi', name: 'Xiangqi', emoji: '🀄', image: '/xiangqi-card.png', players: '2', type: 'board', badge: '🎮 MP · ASIAN', multiplayerOnly: true },
      { id: 'chinesecheckers', name: 'Chinese Checkers', emoji: '⭐', image: '/chinesecheckers-card.png', players: '2-6', type: 'board', badge: '🎮 MP', multiplayerOnly: true },
      { id: 'mancala', name: 'Mancala', emoji: '🪨', image: '/mancala-card.png', players: '2', type: 'board', badge: '🎵 UPGRADED' },
      { id: 'dominoes', name: 'Dominoes', emoji: '🀫', image: '/dominoes-card.png', players: '2', type: 'board', badge: '✨ AAA' },
      { id: 'battleship', name: 'Battleship', emoji: '🚢', image: '/battleship-card.png', players: '2', type: 'board', badge: '🎵 UPGRADED' },
      { id: 'mahjong', name: 'Mahjong', emoji: '🀄', image: '/mahjong-card.png', players: '1-4', type: 'board', badge: 'ASIAN' },
      { id: 'yahtzee', name: 'Yahtzee', emoji: '🎲', image: '/yahtzee-card.png', players: '1-4', type: 'board', badge: '🆕 PLAYABLE' },
      { id: 'klondike', name: 'Klondike', emoji: '🂡', image: '/klondike-card.png', players: '1', type: 'board', badge: 'SOLITAIRE' }
    ]
  },
  arcade: {
    name: 'Arcade',
    icon: Zap,
    games: [
      { id: 'snake', name: 'Snake', emoji: '🐍', image: '/snake-card.png', players: '1', type: 'arcade', badge: '🎵 UPGRADED' },
      { id: 'memory_match', name: 'Memory Match', emoji: '🧠', image: '/memorymatch-card.png', players: '1', type: 'arcade', badge: '🎵 UPGRADED' },
      { id: 'ping_pong', name: 'Ping Pong', emoji: '🏓', image: '/pingpong-card.png', players: '1-2', type: 'arcade', badge: '🎵 UPGRADED' },
      { id: 'pool_8ball', name: '8-Ball Pool', emoji: '🎱', image: '/pool8ball-card.png', players: '2', type: 'arcade', badge: '🎵 UPGRADED' }
    ]
  },
  party: {
    name: 'Party Games',
    icon: Users,
    games: [
      { id: 'trivia', name: 'Trivia Battle', emoji: '🧠', image: '/trivia-card.png', players: '2+', type: 'party' },
      { id: 'truth_or_dare', name: 'Truth or Dare', emoji: '💘', image: '/truthordare-card.png', players: '2+', type: 'party', badge: '🎵 UPGRADED' },
      { id: 'two_truths_lie', name: 'Two Truths & A Lie', emoji: '🤥', image: '/twotruths-card.png', players: '2+', type: 'party', badge: '🎵 UPGRADED' }
    ]
  }
  // 3D Poker category removed 2026-02-16 (founder directive — rooms
  // weren't production-quality, deleting the whole room rather than
  // shipping broken UX. Practice flow + 3D mesh components removed.).
};

export default function GamesNew() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('featured');
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [selectedGameForRules, setSelectedGameForRules] = useState(null);
  const [startingGame, setStartingGame] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const API = process.env.REACT_APP_BACKEND_URL;

  // Client-side games that don't need backend.
  // 3D Poker variants ('poker_3d', 'poker_css3d') deleted 2026-02-16 (founder directive).
  const clientSideGames = [
    'war', 'gin_rummy', 'solitaire', 'roulette', 'baccarat', 'baccarat_premium', 'vibes_slots', 'vibes_wheel', 'vibes_darts',
    'mancala', 'dominoes', 'battleship', 'snake', 'memory_match', 'ping_pong', 'pool_8ball',
    'truth_or_dare', 'two_truths_lie', 'blackjack_new'
  ];

  const startPracticeGame = async (game) => {
    if (startingGame) return;

    // COMING SOON gate — short-circuit before any routing logic so
    // tiles for unfinished games can't be entered. Source of truth:
    // src/data/comingSoonGames.ts
    if (isComingSoon(game.id)) {
      soundManager.buttonClick();
      navigate(`/practice/play/${game.id}`); // page-level overlay handles it
      return;
    }

    // Bid Whist — every tile now routes to the universal BidWhistAAA
    // room (Spades AAA prototype, cobalt variant). No more lobby in the
    // middle, matches the Spades AAA navigation pattern.
    if (game.id === 'bid_whist_premium' || game.id === 'bid_whist_platinum' || game.id === 'bid_whist') {
      soundManager.buttonClick();
      navigate('/bid-whist');
      return;
    }

    // Special routes for specific games
    if (game.id === 'vibe_654_dice' || game.id === 'vibez_654') {
      soundManager.buttonClick();
      navigate('/dice');
      return;
    }
    
    if (game.id === 'vibe_654_tournament') {
      soundManager.buttonClick();
      navigate('/games/vibe654/tournament');
      return;
    }
    
    // Universal Card Game Engine - Generate room code and navigate
    if (game.id === 'blackjack_universal') {
      soundManager.buttonClick();
      navigate('/blackjack-universal');
      return;
    }
    
    if (game.id === 'poker_universal') {
      soundManager.buttonClick();
      navigate('/poker-practice');
      return;
    }
    
    if (game.id === 'spades_universal') {
      soundManager.buttonClick();
      navigate('/spades');
      return;
    }
    
    if (game.id === 'rummy_universal') {
      soundManager.buttonClick();
      navigate('/rummy-practice');
      return;
    }
    if (game.id === 'underground_spades') {
      // Legacy tile — forward to the new canonical Spades room until the
      // arena list is pruned in the follow-up cleanup pass.
      soundManager.buttonClick();
      navigate('/spades');
      return;
    }

    // Hearts → universal AAA crimson room (4P prototype)
    if (game.id === 'hearts') {
      soundManager.buttonClick();
      navigate('/hearts');
      return;
    }

    // Crazy Eights → universal AAA onyx room
    if (game.id === 'crazy_eights') {
      soundManager.buttonClick();
      navigate('/crazy-eights');
      return;
    }

    // Go Fish → universal AAA ocean room
    if (game.id === 'go_fish') {
      soundManager.buttonClick();
      navigate('/go-fish');
      return;
    }

    // Gin Rummy → universal AAA gold room (2P)
    if (game.id === 'gin_rummy') {
      soundManager.buttonClick();
      navigate('/gin-rummy');
      return;
    }

    // Rummy (13-card) → universal AAA jade room (2-4P)
    if (game.id === 'rummy') {
      soundManager.buttonClick();
      navigate('/rummy');
      return;
    }

    // War → universal AAA ruby room (2P)
    if (game.id === 'war') {
      soundManager.buttonClick();
      navigate('/war');
      return;
    }

    // Euchre → universal AAA gold room (4P partnership)
    if (game.id === 'euchre') {
      soundManager.buttonClick();
      navigate('/euchre');
      return;
    }

    // UNO → universal AAA neon room (4P prototype)
    if (game.id === 'uno') {
      soundManager.buttonClick();
      navigate('/uno');
      return;
    }

    // Dominoes → universal AAA onyx "Arena" room (2P, replaces legacy
    // PracticeDominoes + HttpMultiplayerDominoes per Vibe Dominoes
    // Superior Build PDF, Feb 2026).
    if (game.id === 'dominoes') {
      soundManager.buttonClick();
      navigate('/dominoes');
      return;
    }

    // Pinochle → universal AAA pearl room (4P partnership, 48-card
    // single-deck, Feb 2026).
    if (game.id === 'pinochle') {
      soundManager.buttonClick();
      navigate('/pinochle');
      return;
    }

    // Multiplayer-only games — route straight to the HTTP MP lobby/room.
    if ((game as any).multiplayerOnly) {
      soundManager.buttonClick();
      navigate('/multiplayer');
      return;
    }

    // Client-side games - navigate directly
    if (clientSideGames.includes(game.id)) {
      soundManager.buttonClick();
      navigate(`/practice/play/${game.id}`);
      return;
    }

    // Backend games - start game first
    setStartingGame(true);
    try {
      const response = await fetch(`${API}/api/practice/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_type: game.id,
          difficulty: 'medium'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start practice game');
      }

      const data = await response.json();
      soundManager.buttonClick();
      navigate(`/practice/play/${data.game_id}`);
    } catch (err) {
      // console.error('Error starting practice game:', err);
      alert('Failed to start game. Please try again.');
    } finally {
      setStartingGame(false);
    }
  };

  const startMultiplayerGame = (game) => {
    soundManager.buttonClick();

    // COMING SOON gate — apply same gate to multiplayer button.
    if (isComingSoon(game.id)) {
      navigate(`/practice/play/${game.id}`); // page-level overlay handles it
      return;
    }

    // Special routes for specific games  
    if (game.id === 'bid_whist' || game.id === 'bid_whist_premium' || game.id === 'bid_whist_platinum') {
      navigate('/bid-whist');
      return;
    }

    // Hearts → universal AAA crimson room
    if (game.id === 'hearts') {
      navigate('/hearts');
      return;
    }

    // Crazy Eights → universal AAA onyx room
    if (game.id === 'crazy_eights') {
      navigate('/crazy-eights');
      return;
    }

    // Go Fish → universal AAA ocean room
    if (game.id === 'go_fish') {
      navigate('/go-fish');
      return;
    }

    // Gin Rummy → universal AAA gold room (2P)
    if (game.id === 'gin_rummy') {
      navigate('/gin-rummy');
      return;
    }

    // Rummy → universal AAA jade room (2-4P)
    if (game.id === 'rummy') {
      navigate('/rummy');
      return;
    }

    // War → universal AAA ruby room (2P)
    if (game.id === 'war') {
      navigate('/war');
      return;
    }

    // Euchre → universal AAA gold room (4P partnership)
    if (game.id === 'euchre') {
      navigate('/euchre');
      return;
    }
    
    // Direct routes for games with dedicated multiplayer components
    const directRoutes = {
      'poker': '/multiplayer-poker',
      'blackjack': '/multiplayer-blackjack',
      'spades': '/spades'
    };
    
    if (directRoutes[game.id]) {
      navigate(directRoutes[game.id]);
      return;
    }
    
    // All other games go to unified HTTP multiplayer lobby
    navigate('/multiplayer');
  };

  const filteredGames = searchQuery
    ? Object.values(GAME_CATEGORIES)
        .flatMap(cat => cat.games)
        .filter(game => game.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : GAME_CATEGORIES[selectedCategory].games;

  const openRulesModal = (game) => {
    setSelectedGameForRules(game.id);
    setRulesModalOpen(true);
  };

  return (
    <RoomLayout theme="games" showStars={true}>
      {/* Live Wins Ticker */}
      <WinnerTicker className="sticky top-0 z-40" />
      {/* Header */}
      <header className="relative z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Hub
          </Button>
          
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-cyan-400" />
            Game Arena
          </h1>
          
          <div className="flex gap-2 items-center">
            <SoundControls />
            
            <Button
              variant="ghost"
              onClick={() => {
                soundManager.buttonClick();
                navigate('/vibez');
              }}
              onMouseEnter={() => soundManager.buttonHover()}
              className="text-white hover:bg-white/10 bg-gradient-to-r from-pink-600/20 to-purple-600/20"
            >
              <Sparkles className="mr-2 h-5 w-5 text-pink-400" />
              My Vibez
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => {
                soundManager.buttonClick();
                navigate('/player-stats');
              }}
              onMouseEnter={() => soundManager.buttonHover()}
              className="text-white hover:bg-white/10"
            >
              <BarChart3 className="mr-2 h-5 w-5" />
              Stats
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => {
                soundManager.buttonClick();
                navigate('/leaderboard');
              }}
              onMouseEnter={() => soundManager.buttonHover()}
              className="text-white hover:bg-white/10"
            >
              <Trophy className="mr-2 h-5 w-5" />
              Leaderboard
            </Button>
            
            <Button
              onClick={() => {
                soundManager.buttonClick();
                navigate('/http-multiplayer');
              }}
              onMouseEnter={() => soundManager.buttonHover()}
              className="bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white font-bold relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-pink-400/20 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
              <Users className="mr-2 h-5 w-5 relative z-10" />
              <span className="relative z-10">⚡ Quick Play</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Choose Your <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Battle</span>
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            34 games • Multiplayer • Real-time • Tournaments
          </p>

          {/* Search Bar */}
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900/50 border-white/10 focus:border-cyan-500 text-white"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-8 justify-center text-center">
            <div>
              <p className="text-3xl font-bold text-cyan-400">24+</p>
              <p className="text-sm text-slate-400">Games</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-400">1000+</p>
              <p className="text-sm text-slate-400">Players</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-400">₵500</p>
              <p className="text-sm text-slate-400">Prize Pool</p>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Category Tabs with Animations */}
        {!searchQuery && (
          <div className="flex gap-3 mb-10 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-cyan-500 scrollbar-track-transparent">
            {Object.entries(GAME_CATEGORIES).map(([key, category]) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === key;
              return (
                <motion.button
                  key={key}
                  onClick={() => {
                    setSelectedCategory(key);
                    soundManager.buttonClick();
                  }}
                  onMouseEnter={() => soundManager.buttonHover()}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-2xl shadow-cyan-500/60'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 border border-white/10'
                  }`}
                >
                  {/* Animated background glow for selected */}
                  {isSelected && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 rounded-2xl blur-xl opacity-50"
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 0.7, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                  
                  {/* Icon with glow */}
                  <div className="relative z-10">
                    <Icon className={`w-5 h-5 ${isSelected ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''}`} />
                  </div>
                  
                  {/* Category name */}
                  <span className="relative z-10 text-base tracking-wide">
                    {category.name}
                  </span>
                  
                  {/* Active indicator dot */}
                  {isSelected && (
                    <motion.div
                      className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white shadow-lg"
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Category Header with Game Count */}
        {!searchQuery && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/50">
                  {(() => {
                    const Icon = GAME_CATEGORIES[selectedCategory]?.icon || Gamepad2;
                    return <Icon className="w-7 h-7 text-white" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tight">
                    {GAME_CATEGORIES[selectedCategory]?.name || 'Featured Games'}
                  </h3>
                  <p className="text-slate-400 text-sm font-medium mt-1">
                    {filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'} available
                  </p>
                </div>
              </div>
              
              {/* Animated gradient line */}
              <motion.div
                className="hidden md:block flex-1 ml-8 h-1 rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ transformOrigin: 'left' }}
              />
            </div>
          </motion.div>
        )}

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredGames.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              data-testid={`game-tile-${game.id}`}
              onClick={(e) => {
                // Make the whole AAA-canonical-room tile clickable. We
                // route directly to the canonical room so the Practice
                // and Multiplayer buttons inside still work without
                // double-firing (they call e.stopPropagation()).
                const aaaRoutes: Record<string, string> = {
                  spades: "/spades",
                  bid_whist: "/bid-whist",
                  bid_whist_premium: "/bid-whist",
                  bid_whist_platinum: "/bid-whist",
                  hearts: "/hearts",
                  crazy_eights: "/crazy-eights",
                  thirty_one: "/thirty-one",
                  yahtzee: "/yahtzee",
                  vibes_slots: "/vibes-slots",
                  bingo: "/bingo",
                  caribbean_stud: "/caribbean-stud",
                  sic_bo: "/sic-bo",
                  craps: "/craps",
                  vibes_wheel: "/vibes-wheel",
                  keno: "/keno",
                  three_card_poker: "/three-card-poker",
                  pai_gow: "/pai-gow",
                  casino_war: "/casino-war",
                  chemin_de_fer: "/chemin-de-fer",
                  european_roulette: "/european-roulette",
                  hazard: "/hazard",
                  chuck_a_luck: "/chuck-a-luck",
                  big_six_wheel: "/big-six-wheel",
                  jacks_or_better: "/jacks-or-better",
                  fan_tan: "/fan-tan",
                  faro: "/faro",
                  vibes_darts: "/vibes-darts",
                  reversi: "/reversi-aaa",
                  klondike: "/klondike",
                  go_fish: "/go-fish",
                  gin_rummy: "/gin-rummy",
                  rummy: "/rummy",
                  war: "/war",
                  uno: "/uno",
                  euchre: "/euchre",
                };
                const target = aaaRoutes[game.id];
                if (target) {
                  e.stopPropagation();
                  soundManager.buttonClick();
                  navigate(target);
                }
              }}
              role={
                ["spades","bid_whist","bid_whist_premium","bid_whist_platinum","hearts","crazy_eights","thirty_one","yahtzee","vibes_slots","bingo","caribbean_stud","go_fish","gin_rummy","rummy","war","uno","euchre"].includes(game.id)
                  ? "button"
                  : undefined
              }
              tabIndex={
                ["spades","bid_whist","bid_whist_premium","bid_whist_platinum","hearts","crazy_eights","thirty_one","yahtzee","vibes_slots","bingo","caribbean_stud","go_fish","gin_rummy","rummy","war","uno","euchre"].includes(game.id)
                  ? 0
                  : undefined
              }
              className={
                ["spades","bid_whist","bid_whist_premium","bid_whist_platinum","hearts","crazy_eights","go_fish","gin_rummy","rummy","war","uno","euchre"].includes(game.id)
                  ? "cursor-pointer"
                  : undefined
              }
            >
              <GlassCard
                hoverable={true}
                className={`group relative overflow-hidden h-full ${
                  isComingSoon(game.id) ? "opacity-60 grayscale" : ""
                }`}
              >
                {/* COMING SOON tag — wins over other badges visually
                    when the game is gated. Renders ABOVE the regular
                    badge so the user can't miss it. */}
                {isComingSoon(game.id) ? (
                  <div
                    className="absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 z-20 bg-amber-400 text-slate-950 shadow-lg uppercase tracking-[0.2em]"
                    style={{ fontFamily: "'Cinzel', serif" }}
                    data-testid={`game-tile-${game.id}-coming-soon-badge`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Coming Soon
                  </div>
                ) : null}

                {/* Badge (Featured, New, Hot, etc.) — hide if Coming Soon */}
                {!isComingSoon(game.id) && (game.featured || game.badge) && (
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10 ${
                    game.featured ? 'bg-yellow-400 text-black' : 
                    game.badge === 'NEW' ? 'bg-green-500 text-white' :
                    game.badge === 'HOT' ? 'bg-red-500 text-white' :
                    game.badge === 'AI DEALER' ? 'bg-purple-500 text-white' :
                    'bg-blue-500 text-white'
                  }`}>
                    {game.featured && <Crown className="w-3 h-3" />}
                    {game.featured ? 'FEATURED' : game.badge}
                  </div>
                )}

                {/* Game Icon with Enhanced Gradient Background */}
                <div className={`relative h-52 flex items-center justify-center ${game.image && !failedImages.has(game.id) ? 'bg-black' : `bg-gradient-to-br ${GAME_GRADIENTS[game.id] || 'from-slate-800 to-slate-900'}`} rounded-t-2xl overflow-hidden group-hover:h-56 transition-all duration-500`}>
                  {game.image && !failedImages.has(game.id) ? (
                    <>
                      {/* Neon Image */}
                      <motion.img
                        src={game.image}
                        alt={game.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                        whileHover={{ scale: 1.15, opacity: 1 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        onError={() => setFailedImages(prev => {
                          const next = new Set(prev);
                          next.add(game.id);
                          return next;
                        })}
                      />
                      
                      {/* Multi-layered Neon Glow */}
                      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/40 via-purple-500/20 to-transparent mix-blend-overlay" />
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-transparent to-blue-500/20 mix-blend-screen" />
                      
                      {/* Enhanced Glow on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/60 via-purple-400/40 to-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      {/* Animated Scan Line Effect */}
                      <motion.div
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,255,255,0.4) 50%, transparent 100%)'
                        }}
                        animate={{
                          y: ['-100%', '200%']
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                    </>
                  ) : (
                    <>
                      {/* Multi-layered animated backgrounds */}
                      <motion.div
                        className="absolute inset-0 opacity-20"
                        style={{
                          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 70%)'
                        }}
                        animate={{
                          scale: [1, 1.4, 1],
                          opacity: [0.2, 0.6, 0.2]
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                      
                      {/* Rotating gradient overlay */}
                      <motion.div
                        className="absolute inset-0 opacity-10"
                        style={{
                          background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.3), transparent)'
                        }}
                        animate={{
                          rotate: [0, 360]
                        }}
                        transition={{
                          duration: 8,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                      
                      {/* Enhanced Emoji with Multiple Effects */}
                      <motion.div
                        className="text-9xl relative z-10"
                        style={{
                          filter: 'drop-shadow(0 0 25px rgba(255,255,255,0.5)) drop-shadow(0 0 50px rgba(0,255,255,0.3))'
                        }}
                        whileHover={{ 
                          scale: 1.4, 
                          rotate: 15,
                          filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.9)) drop-shadow(0 0 80px rgba(0,255,255,0.6))'
                        }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      >
                        {game.emoji}
                      </motion.div>
                      
                      {/* Radial glow behind emoji */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-radial from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          background: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 60%)'
                        }}
                      />
                      
                      {/* Bottom gradient fade */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </>
                  )}
                </div>

                {/* Game Info - ENHANCED DESIGN */}
                <div className="p-6 space-y-4">
                  {/* Game Name with Gradient Underline */}
                  <div className="space-y-2">
                    <motion.h3 
                      className="text-2xl font-black text-white mb-1 tracking-tight leading-tight"
                      style={{
                        textShadow: '0 2px 10px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.1)'
                      }}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      {game.name}
                    </motion.h3>
                    
                    {/* Animated gradient underline */}
                    <motion.div 
                      className="h-1 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
                      initial={{ width: '0%', opacity: 0 }}
                      whileInView={{ width: '100%', opacity: 1 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Meta Info - Players & Type */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300 font-semibold">
                      <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <span className="text-white/90">{game.players}</span>
                    </div>
                    
                    <span className="px-3 py-1 bg-gradient-to-r from-white/10 to-white/5 rounded-full text-xs font-bold text-white/80 capitalize backdrop-blur-sm border border-white/20">
                      {game.type}
                    </span>
                  </div>

                  {/* Badge Display - More Prominent */}
                  {game.badge && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="inline-block"
                    >
                      <div className="px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg backdrop-blur-md shadow-lg">
                        <span className="text-xs font-black text-yellow-300 tracking-wider uppercase flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          {game.badge}
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {/* Action Buttons - Unified Practice + Multiplayer */}
                  <div className="space-y-2 relative z-10 pt-2">
                    {/* Practice vs AI Button - Always Available */}
                    <NeonButton
                      onClick={(e) => { e.stopPropagation(); startPracticeGame(game); }}
                      onMouseEnter={() => soundManager.buttonHover()}
                      disabled={startingGame}
                      variant="gradient"
                      className="w-full shadow-xl hover:shadow-cyan-500/50 font-bold text-base"
                      data-testid={`game-tile-${game.id}-practice-btn`}
                    >
                      <Bot className="w-4 h-4 mr-2" />
                      {startingGame ? 'Starting...' : 'Practice vs AI'}
                    </NeonButton>
                    
                    {/* Multiplayer Button - Only if Available */}
                    {MULTIPLAYER_AVAILABLE[game.id] && (
                      <NeonButton
                        onClick={(e) => { e.stopPropagation(); startMultiplayerGame(game); }}
                        onMouseEnter={() => soundManager.buttonHover()}
                        variant="ghost"
                        className="w-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-2 border-purple-500/50 hover:border-purple-400 hover:shadow-purple-500/50 text-white font-bold text-base backdrop-blur-sm"
                        data-testid={`game-tile-${game.id}-multiplayer-btn`}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Play Multiplayer
                      </NeonButton>
                    )}
                    
                    {/* How to Play Button */}
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 text-white hover:text-cyan-300 hover:bg-cyan-500/20 backdrop-blur-sm border-2 border-white/30 hover:border-cyan-400/50 shadow-lg transition-all duration-300"
                        onClick={() => {
                          soundManager.buttonClick();
                          openRulesModal(game);
                        }}
                        onMouseEnter={() => soundManager.buttonHover()}
                        title="How to Play"
                      >
                        <Info className="w-4 h-4 mr-1" />
                        Rules
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Tournaments CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <GlassCard className="p-8" glow={true} glowColor="rgba(251,146,60,0.3)">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-8 h-8 text-yellow-400" />
                  <h3 className="text-3xl font-bold text-white">
                    Join Tournaments
                  </h3>
                </div>
                <p className="text-slate-300 mb-2">
                  Compete in couples & friends tournaments for prizes
                </p>
                <p className="text-sm text-slate-400">
                  Win credits, climb leaderboards, earn badges
                </p>
              </div>
              
              <div className="flex gap-3">
                <NeonButton
                  onClick={() => navigate('/couples-tournaments')}
                  variant="primary"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  Couples
                </NeonButton>
                <NeonButton
                  onClick={() => navigate('/friends-tournaments')}
                  variant="ghost"
                >
                  <Users className="w-5 h-5 mr-2" />
                  Friends
                </NeonButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Game Rules Modal */}
      {rulesModalOpen && selectedGameForRules && (
        <GameRulesModal
          isOpen={rulesModalOpen}
          onClose={() => setRulesModalOpen(false)}
          gameType={selectedGameForRules}
        />
      )}

      <AppFooter />
    </RoomLayout>
  );
}
