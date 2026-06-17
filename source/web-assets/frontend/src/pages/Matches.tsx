import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Globe, Heart, MessageCircle, ArrowLeft, Sparkles, Flag } from 'lucide-react';
import AppFooter from '@/components/AppFooter';
import ReportUserModal from '@/components/ReportUserModal';
import VerifiedBadge from '@/components/VerifiedBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportingUser, setReportingUser] = useState(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API}/matches`, {
      });
      
      if (!response.ok) throw new Error('Failed to fetch matches');
      
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      // console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/20"
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">Your Matches</h1>
          </div>
          <div className="w-24" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {matches.length === 0 ? (
            <Card className="p-12 text-center bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <Heart className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">No Matches Yet</h2>
              <p className="mb-6">Start swiping to find your perfect match!</p>
              <Button
                onClick={() => navigate('/discover')}
                className="bg-white text-purple-600 hover:bg-gray-100"
                data-testid="start-swiping-btn"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Start Swiping
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => (
                <Card
                  key={match.match_id}
                  className="overflow-hidden hover:shadow-2xl transition-shadow bg-white"
                  data-testid="match-card"
                >
                  {/* Profile Image */}
                  <div className="relative h-48 bg-gradient-to-br from-purple-400 to-pink-400">
                    {match.user.photos && match.user.photos.length > 0 ? (
                      <img
                        src={match.user.photos[0]}
                        alt={match.user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                        {match.user.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Profile Details */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-800">
                        {match.user.name}, {match.user.age}
                      </h3>
                      <VerifiedBadge verified={match.user.age_verified || match.user.verification_status === 'approved'} />
                    </div>
                    {match.user.location && (
                      <p className="text-sm text-gray-600 mb-3">{match.user.location}</p>
                    )}
                    {match.user.bio && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">{match.user.bio}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                        onClick={() => navigate(`/chat/${match.user.user_id}`)}
                        data-testid="message-btn"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setReportingUser(match.user)}
                      >
                        <Flag className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <AppFooter />
      
      {/* Report User Modal */}
      {reportingUser && (
        <ReportUserModal
          userId={reportingUser.user_id}
          userName={reportingUser.name}
          onClose={() => setReportingUser(null)}
          onSuccess={() => {
            setReportingUser(null);
            // Optionally remove from matches
            setMatches(prev => prev.filter(m => m.user.user_id !== reportingUser.user_id));
          }}
        />
      )}
    </div>
  );
}