/**
 * NotificationContext
 * Manages local (in-memory) notifications created in the frontend
 * and exposes unreadCount for the tab bar badge.
 *
 * Local notifications are added immediately after measurement completes
 * (works even when the backend is unavailable / USE_MOCK_MEASUREMENT=true).
 * When NotificationScreen loads from the backend successfully, local
 * notifications with matching measurement_id are cleared to avoid duplicates.
 *
 * Reminder notifications are injected automatically via AppState listener:
 *   - Morning  (09:00 KST): fired if user hasn't measured today
 *   - Afternoon (15:00 KST): fired if user hasn't measured today
 * AsyncStorage dedup keys ensure each reminder fires at most once per day.
 */
import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Notification, NotificationType} from '../types/measurement';

interface NotificationContextType {
  localNotifications: Notification[];
  unreadCount: number;           // local unread + backend unread
  addLocalNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  clearLocalNotifications: () => void;
  markLocalRead: (id: string) => void;
  markAllLocalRead: () => void;
  setBackendUnreadCount: (count: number) => void;
}

// ── KST helpers (UTC+9) ───────────────────────────────────────────────────────
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 3_600_000);
  return kst.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}
function hourKST(): number {
  const kst = new Date(Date.now() + 9 * 3_600_000);
  return kst.getUTCHours(); // 0–23
}

// ── AsyncStorage key builders ─────────────────────────────────────────────────
const measuredKey  = (d: string) => `@ppg_measured_${d}`;
const morningKey   = (d: string) => `@ppg_reminder_morning_${d}`;
const afternoonKey = (d: string) => `@ppg_reminder_afternoon_${d}`;

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  const [backendUnread, setBackendUnread] = useState(0);

  const addLocalNotification = useCallback(
    (n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
      const newNotif: Notification = {
        ...n,
        id: `local_${Date.now()}`,
        createdAt: new Date().toISOString(),
        isRead: false,
      };
      setLocalNotifications(prev => [newNotif, ...prev]);
      // When measurement completes, mark today so reminders are suppressed
      if (n.type === 'measurement_complete') {
        AsyncStorage.setItem(measuredKey(todayKST()), '1').catch(() => {});
      }
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

  const unreadCount = localNotifications.filter(n => !n.isRead).length + backendUnread;

  const setBackendUnreadCount = useCallback((count: number) => {
    setBackendUnread(Math.max(0, count));
  }, []);

  // ── Reminder scheduler ────────────────────────────────────────────────────
  const checkAndAddReminders = useCallback(async () => {
    const today = todayKST();
    const hour  = hourKST();

    // If user already measured today, no reminder needed
    const measured = await AsyncStorage.getItem(measuredKey(today)).catch(() => null);
    if (measured) return;

    const addReminder = (id: string, title: string, body: string) => {
      setLocalNotifications(prev => {
        if (prev.some(n => n.id === id)) return prev; // idempotent
        return [{
          id,
          type: 'reminder' as NotificationType,
          title,
          body,
          createdAt: new Date().toISOString(),
          isRead: false,
        }, ...prev];
      });
    };

    // Morning reminder at 09:00 KST
    if (hour >= 9) {
      const key = morningKey(today);
      const shown = await AsyncStorage.getItem(key).catch(() => null);
      if (!shown) {
        addReminder(
          `local_reminder_morning_${today}`,
          '아침 측정 알림',
          '오늘 아직 PPG 측정을 하지 않았어요. 지금 1분으로 건강을 확인해보세요!',
        );
        await AsyncStorage.setItem(key, '1').catch(() => {});
      }
    }

    // Afternoon reminder at 15:00 KST
    if (hour >= 15) {
      const key = afternoonKey(today);
      const shown = await AsyncStorage.getItem(key).catch(() => null);
      if (!shown) {
        addReminder(
          `local_reminder_afternoon_${today}`,
          '오후 측정 알림',
          '오후 PPG 측정 시간이에요. 꾸준한 측정이 건강 관리의 첫걸음이에요!',
        );
        await AsyncStorage.setItem(key, '1').catch(() => {});
      }
    }
  }, []);

  // Run on mount and whenever app returns to foreground
  useEffect(() => {
    checkAndAddReminders();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkAndAddReminders();
    });
    return () => sub.remove();
  }, [checkAndAddReminders]);

  return (
    <NotificationContext.Provider value={{
      localNotifications,
      unreadCount,
      addLocalNotification,
      clearLocalNotifications,
      markLocalRead,
      markAllLocalRead,
      setBackendUnreadCount,
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
