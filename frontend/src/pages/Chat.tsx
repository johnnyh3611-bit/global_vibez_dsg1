
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, ArrowLeft, Send, Check, CheckCheck, Circle, Mic, Image as ImageIcon, Smile, Search, Play, Pause, Flag, UserX, MoreVertical } from 'lucide-react';
import { useMessagingSocket } from '@/hooks/useMessagingSocket';
import VoiceMessageRecorder from '@/components/VoiceMessageRecorder';
import ImageUploader from '@/components/ImageUploader';
import GifPicker from '@/components/GifPicker';
import EmojiReactionPicker from '@/components/EmojiReactionPicker';
import ReportUserModal from '@/components/ReportUserModal';
import { useVoiceMirrorTarget } from '@/contexts/VoiceMirrorContext';
import TranslatedSubtitle from '@/components/common/TranslatedSubtitle';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Chat() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({ online: false, last_seen: '' });
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Socket.IO hook
  const socket = useMessagingSocket(currentUser?.user_id);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser?.user_id) {
      fetchConversation();
      fetchOtherUser();
      fetchUserStatus();
    }
  }, [userId, currentUser]);

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket.isConnected) return;

    // New message received
    const unsubscribeNewMessage = socket.onNewMessage((message) => {
      if (message.sender_id === userId || message.receiver_id === userId) {
        setMessages(prev => [...prev, message]);
        
        // Mark as read if from other user
        if (message.sender_id === userId) {
          socket.markAsRead(message.message_id);
        }
      }
    });

    // Message sent confirmation
    const unsubscribeMessageSent = socket.onMessageSent((message) => {
      setMessages(prev => {
        const exists = prev.some(m => m.message_id === message.message_id);
        return exists ? prev : [...prev, message];
      });
    });

    // Message read receipt
    const unsubscribeMessageRead = socket.onMessageRead((data) => {
      setMessages(prev => prev.map(msg =>
        msg.message_id === data.message_id ? { ...msg, read: true } : msg
      ));
    });

    // User status changed
    const unsubscribeUserStatus = socket.onUserStatusChanged((data) => {
      if (data.user_id === userId) {
        setOnlineStatus({
          online: data.online,
          last_seen: data.last_seen
        });
      }
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageSent();
      unsubscribeMessageRead();
      unsubscribeUserStatus();
    };
  }, [socket.isConnected, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API}/auth/me`, { });
      if (!response.ok) throw new Error('Not authenticated');
      const userData = await response.json();
      setCurrentUser(userData);
    } catch (error) {
      navigate('/');
    }
  };

  const fetchConversation = async () => {
    try {
      const response = await fetch(`${API}/messaging/conversation/${userId}`, {
      });
      if (!response.ok) throw new Error('Failed to fetch conversation');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      // console.error('Error fetching conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherUser = async () => {
    try {
      const response = await fetch(`${API}/dating/profile/${userId}`, { });
      if (response.ok) {
        const userData = await response.json();
        setOtherUser(userData);
        return;
      }
      // Fallback: set minimal user info
      setOtherUser({ user_id: userId, name: 'User', photos: [] });
    } catch (error) {
      setOtherUser({ user_id: userId, name: 'User', photos: [] });
    }
  };

  const fetchUserStatus = async () => {
    try {
      const response = await fetch(`${API}/messaging/status/${userId}`, { });
      if (response.ok) {
        const data = await response.json();
        setOnlineStatus(data);
      }
    } catch (error) {
      // console.error('Error fetching user status:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !socket.isConnected) return;

    setSending(true);
    socket.stopTyping(userId);

    try {
      await socket.sendMessage(userId, newMessage.trim(), 'text');
      setNewMessage('');
    } catch (error) {
      // console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Voice Mirror: translated voice notes flow into this DM thread.
  useVoiceMirrorTarget(
    otherUser && socket.isConnected
      ? {
          id: `dm-${userId}`,
          label: `DM · ${otherUser?.name || otherUser?.email || 'user'}`,
          onTranslated: async ({ translated, original }) => {
            const text = (translated || original || '').trim();
            if (!text) return;
            try {
              await socket.sendMessage(userId, text, 'text');
            } catch {
              /* surface via chat error; non-blocking */
            }
          },
        }
      : null
  );

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    // Send typing indicator
    if (socket.isConnected) {
      socket.startTyping(userId);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socket.stopTyping(userId);
      }, 3000);
    }
  };

  const handleVoiceSend = async (audioData, duration) => {
    try {
      const response = await fetch(`${API}/messaging/send-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ receiver_id: userId, audio_data: audioData, duration })
      });
      if (response.ok) {
        setShowVoiceRecorder(false);
        fetchConversation();
      }
    } catch (error) {
      // console.error('Error sending voice message:', error);
    }
  };

  const handleImageSend = async (imageData) => {
    try {
      const response = await fetch(`${API}/messaging/send-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ receiver_id: userId, image_data: imageData })
      });
      if (response.ok) {
        setShowImageUploader(false);
        fetchConversation();
      }
    } catch (error) {
      // console.error('Error sending image:', error);
    }
  };

  const handleGifSend = async (gifUrl) => {
    try {
      const response = await fetch(`${API}/messaging/send-gif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ receiver_id: userId, gif_url: gifUrl })
      });
      if (response.ok) {
        setShowGifPicker(false);
        fetchConversation();
      }
    } catch (error) {
      // console.error('Error sending GIF:', error);
    }
  };

  const handleReaction = async (messageId, emoji, action) => {
    try {
      if (action === 'add') {
        await fetch(`${API}/messaging/add-reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          
          body: JSON.stringify({ message_id: messageId, emoji })
        });
      } else {
        await fetch(`${API}/messaging/remove-reaction/${messageId}/${emoji}`, {
          method: 'DELETE',
        });
      }
      // Refresh to get updated reactions
      fetchConversation();
    } catch (error) {
      // console.error('Error handling reaction:', error);
    }
  };

  const handleBlockUser = async () => {
    if (!window.confirm(`Are you sure you want to block ${otherUser?.name}?`)) return;
    
    try {
      const response = await fetch(`${API}/reports/block/${userId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setIsBlocked(true);
        setShowActionsMenu(false);
        alert(`${otherUser?.name} has been blocked. You will no longer receive messages from them.`);
        navigate('/messages');
      }
    } catch (error) {
      // console.error('Error blocking user:', error);
    }
  };

  const handleUnblockUser = async () => {
    try {
      const response = await fetch(`${API}/reports/unblock/${userId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setIsBlocked(false);
        alert(`${otherUser?.name} has been unblocked.`);
      }
    } catch (error) {
      // console.error('Error unblocking user:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `${API}/messaging/search?query=${encodeURIComponent(searchQuery)}&other_user_id=${userId}`,
        { }
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      // console.error('Error searching messages:', error);
    }
  };

  const playVoiceMessage = (audioData, messageId) => {
    const audio = new Audio(audioData);
    audio.play();
    setPlayingVoice(messageId);
    audio.onended = () => setPlayingVoice(null);
  };

  const getLastSeenText = () => {
    if (onlineStatus.online) return 'Online';
    if (!onlineStatus.last_seen) return '';
    const lastSeen = new Date(onlineStatus.last_seen);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
    if (diffMins < 5) return 'Active recently';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    return `Active ${lastSeen.toLocaleDateString()}`;
  };

  const renderMessage = (message) => {
    const isOwn = message.sender_id === currentUser?.user_id;

    return (
      <div key={message.message_id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs md:max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
          <div
            className={`px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none'
                : 'bg-white/10 backdrop-blur-xl border border-cyan-500/30 text-white rounded-bl-none'
            }`}
          >
            {/* Text Message */}
            {message.message_type === 'text' && (
              <>
                <p>{message.content}</p>
                {!isOwn && <TranslatedSubtitle text={message.content} tone="solid" />}
              </>
            )}

            {/* Voice Message */}
            {message.message_type === 'voice' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => playVoiceMessage(message.content, message.message_id)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  {playingVoice === message.message_id ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="h-1 bg-white/20 rounded-full w-24">
                    <div className="h-1 bg-white rounded-full" style={{ width: '0%' }} />
                  </div>
                  <p className="text-xs mt-1">{message.duration ? `${Math.floor(message.duration)}s` : 'Voice'}</p>
                </div>
              </div>
            )}

            {/* Image Message */}
            {message.message_type === 'image' && (
              <img
                src={message.content}
                alt="Shared"
                className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                onClick={() = loading="lazy"> window.open(message.content, '_blank')}
              />
            )}

            {/* GIF Message */}
            {message.message_type === 'gif' && (
              <img
                src={message.content}
                alt="GIF"
                className="max-w-full rounded-lg" loading="lazy" />
            )}

            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <p className={`text-xs ${isOwn ? 'text-cyan-200' : 'text-gray-400'}`}>
                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {isOwn && (message.read ? <CheckCheck className="w-3 h-3 text-cyan-200" /> : <Check className="w-3 h-3 text-cyan-200" />)}
            </div>
          </div>

          {/* Emoji Reactions */}
          <div className="mt-1">
            <EmojiReactionPicker
              messageId={message.message_id}
              onReact={handleReaction}
              currentReactions={message.reactions || {}}
              currentUserId={currentUser?.user_id}
            />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950">
        <div className="text-white text-xl">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 flex flex-col">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-cyan-500/30">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/messages')} className="text-white hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              {otherUser?.photos?.[0] ? (
                <img src={otherUser.photos[0]} alt={otherUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-cyan-500/50" loading="lazy" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold border-2 border-cyan-500/50">
                  {otherUser?.name?.charAt(0) || '?'}
                </div>
              )}
              {onlineStatus.online && <Circle className="w-3 h-3 absolute bottom-0 right-0 fill-green-400 text-green-400" />}
            </div>
            <div>
              <h2 className="text-white font-bold">{otherUser?.name || 'User'}</h2>
              <div className="flex items-center gap-2">
                <p className="text-cyan-400 text-xs">{getLastSeenText()}</p>
                {socket.typingUsers.has(userId) && (
                  <p className="text-cyan-400 text-xs italic">typing...</p>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setShowSearch(!showSearch)} className="text-cyan-400 hover:text-cyan-300">
            <Search className="w-5 h-5" />
          </button>
          
          {/* Actions Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowActionsMenu(!showActionsMenu)} 
              className="text-cyan-400 hover:text-cyan-300"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showActionsMenu && (
              <div className="absolute right-0 top-full mt-2 bg-black/90 border border-cyan-500/50 rounded-lg shadow-xl z-50 min-w-48">
                <button
                  onClick={() => {
                    setShowReportModal(true);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-red-600/20 flex items-center gap-2 border-b border-gray-700"
                >
                  <Flag className="w-4 h-4 text-red-400" />
                  Report User
                </button>
                {!isBlocked ? (
                  <button
                    onClick={handleBlockUser}
                    className="w-full px-4 py-3 text-left text-white hover:bg-red-600/20 flex items-center gap-2"
                  >
                    <UserX className="w-4 h-4 text-red-400" />
                    Block User
                  </button>
                ) : (
                  <button
                    onClick={handleUnblockUser}
                    className="w-full px-4 py-3 text-left text-white hover:bg-green-600/20 flex items-center gap-2"
                  >
                    <UserX className="w-4 h-4 text-green-400" />
                    Unblock User
                  </button>
                )}
              </div>
            )}
          </div>
          
          <Globe className="w-6 h-6 text-cyan-400" />
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 pb-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-white/10 backdrop-blur-xl border-cyan-500/30 text-white placeholder:text-gray-400"
              />
              <Button onClick={handleSearch} className="bg-cyan-600 hover:bg-cyan-700">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-black/60 rounded-lg p-2">
                {searchResults.map((msg) => (
                  <div key={msg.message_id} className="text-white text-sm p-2 hover:bg-white/10 rounded cursor-pointer">
                    {msg.content.substring(0, 100)}...
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center text-white/70 py-12">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Media Components */}
      {showVoiceRecorder && (
        <div className="px-4 py-2">
          <VoiceMessageRecorder
            onSend={handleVoiceSend}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}
      {showImageUploader && (
        <div className="px-4 py-2">
          <ImageUploader
            onSend={handleImageSend}
            onCancel={() => setShowImageUploader(false)}
          />
        </div>
      )}
      {showGifPicker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <GifPicker
            onSelect={handleGifSend}
            onCancel={() => setShowGifPicker(false)}
          />
        </div>
      )}

      {/* Input */}
      <div className="bg-black/40 backdrop-blur-xl border-t border-cyan-500/30 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {/* Media Toolbar */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-400"
              title="Voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowImageUploader(!showImageUploader)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-400"
              title="Send image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowGifPicker(!showGifPicker)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-400"
              title="Send GIF"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Text Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={handleTyping}
              className="flex-1 bg-white/10 backdrop-blur-xl border-cyan-500/30 text-white placeholder:text-gray-400"
              disabled={sending || !socket.isConnected}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending || !socket.isConnected}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>

          {/* Connection Status */}
          {!socket.isConnected && (
            <p className="text-red-400 text-xs mt-2 text-center">Connecting to real-time messaging...</p>
          )}
        </div>
      </div>
      
      {/* Report User Modal */}
      {showReportModal && otherUser && (
        <ReportUserModal
          userId={userId}
          userName={otherUser.name}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            setShowReportModal(false);
          }}
        />
      )}
    </div>
  );
}
