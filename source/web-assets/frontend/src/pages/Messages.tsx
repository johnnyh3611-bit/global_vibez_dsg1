
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Globe, ArrowLeft, MessageCircle, Heart, Circle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Messages() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    fetchConversations();
    fetchUnreadCount();

    // Poll for new messages every 5 seconds
    const interval = setInterval(() => {
      fetchConversations();
      fetchUnreadCount();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API}/messaging/conversations`, {
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      // console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API}/messaging/unread-count`, {
      });

      if (!response.ok) return;

      const data = await response.json();
      setTotalUnread(data.unread_count || 0);
    } catch (error) {
      // console.error('Error fetching unread count:', error);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    if (!timestamp) return '';
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now.getTime() - messageTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return messageTime.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950">
        <div className="text-white text-xl">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-cyan-500/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/10"
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <MessageCircle className="w-8 h-8 text-cyan-400" />
              {totalUnread > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">Messages</h1>
          </div>
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {conversations.length === 0 ? (
            <Card className="p-12 text-center bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 text-white">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
              <h2 className="text-2xl font-bold mb-4">No Messages Yet</h2>
              <p className="mb-6 text-gray-400">Start matching and chatting with people!</p>
              <Button
                onClick={() => navigate('/discover')}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
                data-testid="start-matching-btn"
              >
                <Heart className="w-4 h-4 mr-2" />
                Start Matching
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {conversations.map((conversation) => (
                <Card
                  key={conversation.match_id}
                  className="p-4 bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all cursor-pointer"
                  onClick={() => navigate(`/chat/${conversation.other_user.user_id}`)}
                  data-testid="conversation-card"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      {conversation.other_user.photos && conversation.other_user.photos.length > 0 ? (
                        <img
                          src={conversation.other_user.photos[0]}
                          alt={conversation.other_user.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500/50"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-cyan-500/50">
                          {conversation.other_user.name.charAt(0)}
                        </div>
                      )}
                      {/* Online indicator placeholder - will be real-time later */}
                    </div>

                    {/* Message Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-white text-lg">
                          {conversation.other_user.name}
                        </h3>
                        <span className="text-sm text-gray-400">
                          {getTimeAgo(conversation.last_message_time)}
                        </span>
                      </div>
                      <p className="text-gray-300 truncate">
                        {conversation.last_message || 'Start a conversation...'}
                      </p>
                    </div>

                    {/* Unread Badge */}
                    {conversation.unread_count > 0 && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-cyan-500/50">
                        {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
