/**
 * NotificationContext
 * Manages local (in-memory) notifications created in the frontend
 * and exposes unreadCount for the tab bar badge.
 *
 * Local notifications are added immediately after measurement completes
 * (works even when the backend is unavailable / USE_MOCK_MEASUREMENT=true).
 * When NotificationScreen loads from the backend successfully, local
 * notifications with matching measurement_id are cleared to avoid duplicates.
 */
import React, {createContext, useContext, useState, useCallback} from 'react';
import type {Notification, NotificationType} from '../types/measurement';

interface NotificationContextType {
  localNotifications: Notification[];
  unreadCount: number;
  addLocalNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  clearLocalNotifications: () => void;
  markLocalRead: (id: string) => void;
  markAllLocalRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);

  const addLocalNotification = useCallback(
    (n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
      const newNotif: Notification = {
        ...n,
        id: `local_${Date.now()}`,
        createdAt: new Date().toISOString(),
        isRead: false,
      };
      setLocalNotifications(prev => [newNotif, ...prev]);
    },
    [],
  );

  const clearLocalNotifications = useCallback(() => {
    setLocalNotifications([]);
  }, []);

  const markLocalRead = useCallback((id: string) => {
    setLocalNotifications(prev =>
      prev.map(n => n.id === id ? {...n, isRead: true} : n),
    );
  }, []);

  const markAllLocalRead = useCallback(() => {
    setLocalNotifications(prev => prev.map(n => ({...n, isRead: true})));
  }, []);

  const unreadCount = localNotifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      localNotifications,
      unreadCount,
      addLocalNotification,
      clearLocalNotifications,
      markLocalRead,
      markAllLocalRead,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextType => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider');
  return ctx;
};

// Re-export type for convenience
export type {NotificationType};
