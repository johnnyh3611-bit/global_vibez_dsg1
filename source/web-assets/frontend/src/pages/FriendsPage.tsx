import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Search, 
  Check, 
  X, 
  MessageCircle, 
  Gamepad2,
  Circle,
  Mail,
  User as UserIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState('friends'); // friends, requests, search
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId] = useState(() => localStorage.getItem('user_id') || 'demo_user');

  useEffect(() => {
    if (activeTab === 'friends') {
      fetchFriends();
    } else if (activeTab === 'requests') {
      fetchPendingRequests();
    }
  }, [activeTab]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/friends/list/${userId}`);
      const data = await response.json();
      if (data.success) {
        setFriends(data.friends);
      }
    } catch (error) {
      // console.error('Failed to fetch friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/friends/requests/pending/${userId}`);
      const data = await response.json();
      if (data.success) {
        setPendingRequests(data.requests);
      }
    } catch (error) {
      // console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/friends/search?query=${encodeURIComponent(searchQuery)}&exclude_user_id=${userId}`
      );
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.users);
      }
    } catch (error) {
      // console.error('Failed to search users:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (toUserId) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/request/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: userId,
          to_user_id: toUserId,
          message: 'Let\'s connect on Global Vibez!'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Friend request sent!');
        searchUsers(); // Refresh results
      } else {
        alert(data.detail || 'Failed to send request');
      }
    } catch (error) {
      // console.error('Failed to send friend request:', error);
      alert('Failed to send friend request');
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/request/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          action: action
        })
      });
      
      const data = await response.json();
      if (data.success) {
        fetchPendingRequests(); // Refresh requests
        if (action === 'accept') {
          fetchFriends(); // Refresh friends list
        }
      }
    } catch (error) {
      // console.error('Failed to respond to request:', error);
    }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/friends/remove/${userId}/${friendId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        fetchFriends(); // Refresh friends list
      }
    } catch (error) {
      // console.error('Failed to remove friend:', error);
    }
  };

  const StatusIndicator = ({ status }) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-gray-500',
      in_game: 'bg-yellow-500'
    };
    
    return (
      <div className={`w-3 h-3 rounded-full ${colors[status]} animate-pulse`} />
    );
  };

  const FriendCard = ({ friend }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <Card className="bg-slate-900/90 border-cyan-500/30 p-4 hover:border-cyan-500/60 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center relative">
              {friend.friend_avatar ? (
                <img src={friend.friend_avatar} alt={friend.friend_name} className="w-full h-full rounded-full" />
              ) : (
                <UserIcon className="w-6 h-6 text-white" />
              )}
              <div className="absolute -bottom-1 -right-1">
                <StatusIndicator status={friend.status} />
              </div>
            </div>
            
            {/* Info */}
            <div>
              <h3 className="font-bold text-white">{friend.friend_name}</h3>
              <p className="text-sm text-gray-400 capitalize flex items-center gap-1">
                {friend.status === 'in_game' && <Gamepad2 className="w-3 h-3" />}
                {friend.status === 'in_game' ? `Playing ${friend.current_game}` : friend.status}
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => window.location.href = `/chat/${friend.friend_id}`}
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-cyan-500/50 hover:border-cyan-500"
              onClick={() => window.location.href = `/invite/${friend.friend_id}`}
            >
              <Gamepad2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeFriend(friend.friend_id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  const RequestCard = ({ request }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <Card className="bg-slate-900/90 border-purple-500/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              {request.from_user_avatar ? (
                <img src={request.from_user_avatar} alt={request.from_user_name} className="w-full h-full rounded-full" />
              ) : (
                <UserIcon className="w-6 h-6 text-white" />
              )}
            </div>
            
            <div>
              <h3 className="font-bold text-white">{request.from_user_name}</h3>
              <p className="text-sm text-gray-400">{request.message || 'Wants to connect'}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => respondToRequest(request.id, 'accept')}
            >
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/50 hover:border-red-500"
              onClick={() => respondToRequest(request.id, 'reject')}
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  const SearchResultCard = ({ user }) => (
    <Card className="bg-slate-900/90 border-cyan-500/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
            ) : (
              <UserIcon className="w-6 h-6 text-white" />
            )}
          </div>
          
          <div>
            <h3 className="font-bold text-white">{user.name}</h3>
            <p className="text-sm text-gray-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </p>
          </div>
        </div>
        
        {user.is_friend ? (
          <Button size="sm" disabled className="bg-gray-700">
            <Check className="w-4 h-4 mr-1" />
            Friends
          </Button>
        ) : user.request_pending ? (
          <Button size="sm" disabled className="bg-yellow-700">
            Pending
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-gradient-to-r from-cyan-600 to-blue-600"
            onClick={() => sendFriendRequest(user.id)}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Add Friend
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <Users className="w-16 h-16 text-cyan-400 mr-4" />
            <h1 className="text-6xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
              Friends
            </h1>
          </div>
          <p className="text-xl text-gray-400">Connect, Chat, and Play Together</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          {[
            { id: 'friends', label: 'Friends', icon: Users, count: friends.length },
            { id: 'requests', label: 'Requests', icon: Mail, count: pendingRequests.length },
            { id: 'search', label: 'Add Friends', icon: UserPlus }
          ].map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {tab.count}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4 animate-spin">🔄</div>
                  <p className="text-xl text-gray-400">Loading friends...</p>
                </div>
              ) : friends.length > 0 ? (
                friends.map((friend) => (
                  <FriendCard key={friend.friend_id} friend={friend} />
                ))
              ) : (
                <div className="text-center py-20">
                  <Users className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-gray-400 mb-2">No Friends Yet</h2>
                  <p className="text-gray-500 mb-6">Start connecting with other players!</p>
                  <Button
                    onClick={() => setActiveTab('search')}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Add Friends
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4 animate-spin">🔄</div>
                  <p className="text-xl text-gray-400">Loading requests...</p>
                </div>
              ) : pendingRequests.length > 0 ? (
                pendingRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              ) : (
                <div className="text-center py-20">
                  <Mail className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-gray-400">No Pending Requests</h2>
                  <p className="text-gray-500">Friend requests will appear here</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Search Bar */}
              <Card className="bg-slate-900/90 border-cyan-500/30 p-6 mb-6">
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                    className="flex-1 bg-slate-800 border-slate-700 text-white"
                  />
                  <Button
                    onClick={searchUsers}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600"
                    disabled={!searchQuery.trim()}
                  >
                    <Search className="w-5 h-5 mr-2" />
                    Search
                  </Button>
                </div>
              </Card>

              {/* Search Results */}
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-20">
                    <div className="text-6xl mb-4 animate-spin">🔍</div>
                    <p className="text-xl text-gray-400">Searching...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <SearchResultCard key={user.id} user={user} />
                  ))
                ) : searchQuery ? (
                  <div className="text-center py-20">
                    <Search className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-3xl font-bold text-gray-400">No Results Found</h2>
                    <p className="text-gray-500">Try a different search term</p>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <UserPlus className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-3xl font-bold text-gray-400">Find Friends</h2>
                    <p className="text-gray-500">Search for users to connect with</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
