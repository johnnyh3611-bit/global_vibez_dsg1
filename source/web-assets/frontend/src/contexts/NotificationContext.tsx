import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { requestNotificationPermission, onMessageListener } from '../lib/firebase';
import SecureStorage from '../utils/SecureStorage';

interface NotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface NotificationContextValue {
  fcmToken: string | null;
  notification: NotificationPayload | null;
  permissionStatus: NotificationPermission | 'default';
  enableNotifications: () => Promise<boolean>;
  clearNotification: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationPayload | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'default'>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const enableNotifications = async (): Promise<boolean> => {
    try {
      const token = await requestNotificationPermission();
      if (token) {
        setFcmToken(token);
        setPermissionStatus('granted');

        const API_URL = process.env.REACT_APP_BACKEND_URL;
        const authToken = await SecureStorage.getItem('token');

        if (authToken) {
          await fetch(`${API_URL}/api/notifications/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ fcm_token: token }),
          });
        }

        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (permissionStatus === 'granted') {
      onMessageListener()
        .then((payload: any) => {
          setNotification({
            title: payload?.notification?.title,
            body: payload?.notification?.body,
            data: payload?.data,
          });
          setTimeout(() => setNotification(null), 5000);
        })
        .catch(() => {
          // ignore
        });
    }
  }, [permissionStatus]);

  const value: NotificationContextValue = {
    fcmToken,
    notification,
    permissionStatus,
    enableNotifications,
    clearNotification: () => setNotification(null),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
