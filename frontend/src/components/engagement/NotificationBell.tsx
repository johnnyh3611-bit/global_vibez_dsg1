import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Trophy, Star, Zap, X, Heart, Gamepad2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const navigate = useNavigate();
  const audioRef = useRef(null);

  const userId = localStorage.getItem('user_id');

  // Notification sound
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0fPTgjMGHm7A7+OZURQNUK/m77BdGAg+ltryxnMnBSuAzPDajj0IE2S26+OcTgwOTKXh8bllHAc4jtHz0H0uBSh+y+/gkjwIE2O16+KZUBQOUKfj8LRfGgc8k9jzyn0tBSh+yu/gkjsIE2K16+KYTxQOT6bj8LNfGgc8ktjzyn0tBSh9yu/fkjsIE2K16+KYTxQOT6bj8LNfGgc8ktjzyn0tBSh9yu/fkjsIE2K16+KYTxQOT6bj8LNfGgc8ktjzyn0tBQ==');
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API}/api/engagement/notifications/${userId}?limit=20`);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      // console.error('Error fetching notifications:', error);
    }
  };

  // WebSocket connection for real-time notifications
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    // Connect to WebSocket
    const wsUrl = API.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/api/engagement/ws/${userId}`);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'notification') {
        // Add new notification to the list
        setNotifications(prev => [message.data, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Play notification sound
        if (audioRef.current) {
        }
      }
    };

    ws.onerror = (error) => {
      // console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;

    // Ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (ws) ws.close();
    };
  }, [userId]);

  // Mark notifications as read
  const markAsRead = async (notificationIds = null) => {
    try {
      await fetch(`${API}/api/engagement/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          notification_ids: notificationIds,
        }),
      });
      
      if (notificationIds) {
        setNotifications(prev =>
          prev.map(n => (notificationIds.includes(n.id) ? { ...n, is_read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      // console.error('Error marking notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead([notification.id]);
    if (notification.action_url) {
      navigate(notification.action_url);
      setShowDropdown(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'achievement':
        return <Trophy className="w-5 h-5 text-white" />;
      case 'friend_request':
        return <Users className="w-5 h-5 text-white" />;
      case 'like':
        return <Heart className="w-5 h-5 text-white" />;
      case 'game_invite':
        return <Gamepad2 className="w-5 h-5 text-white" />;
      default:
        return <Star className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <motion.button
        className="relative p-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-purple-600/20 border border-cyan-500/50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDropdown(!showDropdown)}
        animate={{
          boxShadow: unreadCount > 0
            ? [
                '0 0 20px rgba(239, 68, 68, 0.5)',
                '0 0 40px rgba(239, 68, 68, 0.8)',
                '0 0 20px rgba(239, 68, 68, 0.5)',
              ]
            : '0 0 20px rgba(6, 182, 212, 0.3)',
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Bell className="w-6 h-6 text-cyan-400" />
        
        {/* Connection Status Indicator */}
        {isConnected && (
          <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full" />
        )}
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <motion.div
            className="absolute -top-1 -right-1 min-w-[24px] h-6 px-1.5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-black"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
      </motion.button>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className="absolute top-full right-0 mt-2 w-96 bg-black/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl shadow-2xl overflow-hidden z-50"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
          >
            {/* Header */}
            <div className="p-4 border-b border-cyan-500/30 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Notifications</h3>
                <p className="text-sm text-gray-400">{unreadCount} unread</p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAsRead()}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif, idx) => (
                  <motion.div
                    key={notif.id}
                    className={`p-4 border-b border-cyan-500/20 hover:bg-cyan-500/10 cursor-pointer transition-colors ${
                      !notif.is_read ? 'bg-cyan-500/5' : ''
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {notif.title}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-cyan-400 mt-1">
                          {new Date(notif.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
