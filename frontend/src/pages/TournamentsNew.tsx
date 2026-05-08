
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import { Button } from '@/components/ui/button';
import { 
  Trophy, Users, Heart, Zap, Crown, ArrowLeft,
  Calendar, Clock, DollarSign, Target
} from 'lucide-react';
import AppFooter from '@/components/AppFooter';

const API = process.env.REACT_APP_BACKEND_URL;

const TOURNAMENT_TYPES = [
  {
    id: 'couples',
    name: 'Couples Tournaments',
    icon: Heart,
    description: 'Compete as a couple in dating show-style games',
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    games: ['Partner Quiz', 'Compatibility Challenge', 'Love Language Test'],
    entryFee: 100,
    prizePool: 500,
    participants: '16 couples'
  },
  {
    id: 'friends',
    name: 'Friends Tournaments',
    icon: Users,
    description: 'Team up with friends for multiplayer challenges',
    gradient: 'from-blue-500 via-purple-500 to-pink-500',
    games: ['Trivia Battle', 'Would You Rather', 'Two Truths One Lie'],
    entryFee: 50,
    prizePool: 300,
    participants: '32 teams'
  },
  {
    id: 'card',
    name: 'Card Tournaments',
    icon: Trophy,
    description: 'High-stakes card game championships',
    gradient: 'from-yellow-500 via-orange-500 to-red-600',
    games: ['Spades', 'Bid Whist', 'Poker'],
    entryFee: 200,
    prizePool: 1000,
    participants: '64 players'
  }
];

export default function TournamentsNew() {
  const navigate = useNavigate();
  const [activeTournaments, setActiveTournaments] = useState([]);
  const [myTournaments, setMyTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      // Fetch active tournaments
      const activeRes = await fetch(`${API}/api/tournaments/active`, {
      });
      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveTournaments(data.tournaments || []);
      }

      // Fetch user's tournaments
      const myRes = await fetch(`${API}/api/tournaments/my-tournaments`, {
      });
      if (myRes.ok) {
        const data = await myRes.json();
        setMyTournaments(data.tournaments || []);
        setCredits(data.credits_balance || 0);
      }
    } catch (error) {
      // console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = (tournamentId) => {
    navigate(`/tournament/${tournamentId}/join`);
  };

  return (
    <RoomLayout theme="tournaments" showStars={true}>
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
            <Trophy className="w-8 h-8 text-yellow-400" />
            Tournament Hall
          </h1>
          
          <GlassCard className="px-4 py-2" hoverable={false}>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-bold">{credits}</span>
              <span className="text-slate-400 text-sm">credits</span>
            </div>
          </GlassCard>
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
            Compete for <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">Glory</span>
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Enter tournaments, win prizes, climb leaderboards
          </p>

          {/* Stats */}
          <div className="flex gap-8 justify-center text-center">
            <div>
              <p className="text-3xl font-bold text-yellow-400">₵2,500</p>
              <p className="text-sm text-slate-400">Total Prize Pool</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-400">24</p>
              <p className="text-sm text-slate-400">Active Tournaments</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-400">500+</p>
              <p className="text-sm text-slate-400">Participants</p>
            </div>
          </div>
        </motion.div>

        {/* Tournament Types */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {TOURNAMENT_TYPES.map((type, index) => {
            const Icon = type.icon;
            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard
                  hoverable={true}
                  className="group overflow-hidden h-full"
                  glow={true}
                  glowColor="rgba(251,146,60,0.3)"
                >
                  {/* Header */}
                  <div className={`relative h-32 bg-gradient-to-br ${type.gradient} flex items-center justify-center`}>
                    <Icon className="w-16 h-16 text-white drop-shadow-2xl" />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {type.name}
                    </h3>
                    <p className="text-slate-300 text-sm mb-4">
                      {type.description}
                    </p>

                    {/* Games */}
                    <div className="mb-4">
                      <p className="text-xs text-slate-400 mb-2">Games:</p>
                      <div className="flex flex-wrap gap-1">
                        {type.games.map((game: string, idx: number) => (
                          <span
                            key={`games-${idx}-${game}`}
                            className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                          >
                            {game}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Entry Fee:</span>
                        <span className="text-white font-semibold">{type.entryFee} credits</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Prize Pool:</span>
                        <span className="text-yellow-400 font-bold">{type.prizePool} credits</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Participants:</span>
                        <span className="text-white">{type.participants}</span>
                      </div>
                    </div>

                    <NeonButton
                      onClick={() => navigate(`/${type.id}-tournaments`)}
                      variant="gradient"
                      className="w-full"
                    >
                      View Tournaments
                    </NeonButton>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* My Tournaments */}
        {myTournaments.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-12"
          >
            <h3 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-400" />
              My Tournaments
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myTournaments.map((tournament) => (
                <GlassCard key={tournament.id} className="p-6" hoverable={true}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-white mb-1">
                        {tournament.name}
                      </h4>
                      <p className="text-sm text-slate-400">{tournament.game_type}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      tournament.status === 'active' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {tournament.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(tournament.start_time).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Users className="w-4 h-4" />
                      <span>{tournament.participants}/{tournament.max_participants} players</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate(`/tournament/${tournament.id}`)}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-600"
                  >
                    View Details
                  </Button>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        )}

        {/* How It Works */}
        <GlassCard className="p-8" hoverable={false}>
          <h3 className="text-3xl font-bold text-white mb-6 text-center">
            How Tournaments Work
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: Target, title: 'Choose Tournament', desc: 'Browse available tournaments by type and game' },
              { icon: DollarSign, title: 'Pay Entry Fee', desc: 'Use credits to enter (earn credits or buy them)' },
              { icon: Trophy, title: 'Compete & Win', desc: 'Play games and climb the bracket' },
              { icon: Crown, title: 'Claim Prizes', desc: 'Winners take home the prize pool' }
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={`item-${idx}`} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                  <p className="text-sm text-slate-400">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <AppFooter />
    </RoomLayout>
  );
}
