import React, { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationBanner() {
  const { 
    notification, 
    permissionStatus, 
    enableNotifications, 
    clearNotification 
  } = useNotifications();
  
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    
    // Show permission prompt after 3 seconds if not granted and not dismissed
    const timer = setTimeout(() => {
      
      if (permissionStatus === 'default' && !isDismissed) {
        setShowPermissionPrompt(true);
      } else {
      }
    }, 3000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [permissionStatus, isDismissed]);

  const handleEnableNotifications = async () => {
    const success = await enableNotifications();
    
    if (success) {
      setShowPermissionPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPermissionPrompt(false);
    setIsDismissed(true);
  };

  return (
    <>
      {/* Permission Request Banner */}
      {showPermissionPrompt && permissionStatus === 'default' && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white rounded-lg shadow-2xl p-4 animate-slide-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Bell className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">
                🔔 Stay in the Loop!
              </h3>
              <p className="text-sm text-white/90 mb-3">
                Get instant notifications for matches, game invites, ride requests, and more!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleEnableNotifications}
                  className="px-4 py-2 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-100 transition-all"
                >
                  Enable Notifications
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                >
                  Maybe Later
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Foreground Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-gray-900 text-white rounded-lg shadow-2xl p-4 animate-slide-in border border-purple-500">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-base mb-1">
                {notification.title}
              </h4>
              <p className="text-sm text-gray-300">
                {notification.body}
              </p>
            </div>
            <button
              onClick={clearNotification}
              className="p-1 hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Notification Status Indicator (Bottom Right) */}
      <div className="fixed bottom-4 right-4 z-40">
        {permissionStatus === 'granted' ? (
          <div className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
            <Bell className="w-4 h-4" />
            <span>Notifications On</span>
          </div>
        ) : permissionStatus === 'denied' ? (
          <div className="flex flex-col gap-2 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
            <div className="flex items-center gap-2">
              <BellOff className="w-4 h-4" />
              <span className="font-semibold">Notifications Blocked</span>
            </div>
            <p className="text-xs text-white/90">
              To enable: Click 🔒 in address bar → Site settings → Allow notifications
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
