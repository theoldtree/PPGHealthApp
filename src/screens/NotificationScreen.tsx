import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Colors} from '../config/colors';
import type {Notification, NotificationType} from '../types/measurement';
import {useNotificationContext} from '../context/NotificationContext';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  toNotification,
} from '../api/notifications';

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function relativeTime(isoStr: string): string {
  const now  = new Date();
  const past = new Date(isoStr);
  const diffMs = now.getTime() - past.getTime();
  const mins  = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);

  if (mins < 1)   return '방금';
  if (mins < 60)  return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
}

function isToday(isoStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return isoStr.startsWith(today);
}

// ── 알림 타입별 설정 ──────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<NotificationType, {
  icon: string; accentColor: string; bgColor: string;
}> = {
  measurement_complete: {
    icon: '🔔',
    accentColor: Colors.primary,
    bgColor: Colors.primaryLight,
  },
  reminder: {
    icon: '⏰',
    accentColor: Colors.statusWarning,
    bgColor: '#FFF8EC',
  },
  weekly_report: {
    icon: '📊',
    accentColor: Colors.statusGood,
    bgColor: '#EEF9F1',
  },
};

// ── 알림 카드 ─────────────────────────────────────────────────────────────────
const NotifCard = ({
  notif,
  onPress,
}: {
  notif: Notification;
  onPress?: () => void;
}) => {
  const cfg = TYPE_CONFIG[notif.type];

  return (
    <TouchableOpacity
      style={[st.card, !notif.isRead && st.cardUnread]}
      onPress={onPress}
      activeOpacity={0.75}>
      <View style={[st.cardAccent, {backgroundColor: cfg.accentColor}]} />

      <View style={[st.iconWrap, {backgroundColor: cfg.bgColor}]}>
        <Text style={st.iconText}>{cfg.icon}</Text>
      </View>

      <View style={st.cardContent}>
        <View style={st.cardTitleRow}>
          <Text style={st.cardTitle}>{notif.title}</Text>
          {!notif.isRead && <View style={st.unreadDot} />}
        </View>
        <Text style={st.cardBody} numberOfLines={2}>{notif.body}</Text>

        {notif.type === 'measurement_complete' && notif.data && (
          <View style={st.previewRow}>
            {notif.data.heartRate != null && (
              <View style={[st.previewChip, {borderColor: cfg.accentColor}]}>
                <Text style={[st.previewChipTxt, {color: cfg.accentColor}]}>
                  {notif.data.heartRate as number} bpm
                </Text>
              </View>
            )}
            {notif.data.percentile != null && (
              <View style={[st.previewChip, {borderColor: cfg.accentColor}]}>
                <Text style={[st.previewChipTxt, {color: cfg.accentColor}]}>
                  상위 {notif.data.percentile as number}%
                </Text>
              </View>
            )}
          </View>
        )}

        {notif.type === 'weekly_report' && notif.data && (
          <View style={st.previewRow}>
            <View style={[st.previewChip, {borderColor: cfg.accentColor}]}>
              <Text style={[st.previewChipTxt, {color: cfg.accentColor}]}>
                {notif.data.trend === 'improving' ? '▼ 개선됨'
                 : notif.data.trend === 'declining' ? '▲ 악화'
                 : '→ 유지'}
              </Text>
            </View>
          </View>
        )}

        <Text style={st.cardTime}>{relativeTime(notif.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── 메인 ─────────────────────────────────────────────────────────────────────
export const NotificationScreen: React.FC = () => {
  const {localNotifications, clearLocalNotifications, markLocalRead, markAllLocalRead, setBackendUnreadCount} = useNotificationContext();
  const [backendNotifications, setBackendNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications();
      const mapped = data.map(toNotification);
      setBackendNotifications(mapped);
      // Backend loaded successfully — clear local duplicates
      clearLocalNotifications();
      // Sync backend unread count to context for tab badge
      setBackendUnreadCount(mapped.filter(n => !n.isRead).length);
    } catch {
      // silently fail — local notifications still shown
    } finally {
      setIsLoading(false);
    }
  }, [clearLocalNotifications, setBackendUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load]),
  );

  // Merge: local first (newest), then backend; sort by createdAt desc
  const notifications = [...localNotifications, ...backendNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const handleMarkRead = async (id: string) => {
    if (id.startsWith('local_')) {
      markLocalRead(id);
      return;
    }
    // Only decrement if it was unread
    const wasUnread = backendNotifications.find(n => n.id === id)?.isRead === false;
    setBackendNotifications(prev =>
      prev.map(n => n.id === id ? {...n, isRead: true} : n),
    );
    if (wasUnread) {
      setBackendUnreadCount(backendNotifications.filter(n => !n.isRead && n.id !== id).length);
    }
    try {
      await markNotificationRead(id);
    } catch { /* optimistic update already applied */ }
  };

  const handleMarkAllRead = async () => {
    markAllLocalRead();
    setBackendNotifications(prev => prev.map(n => ({...n, isRead: true})));
    setBackendUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch { /* optimistic update already applied */ }
  };

  const todayNotifs   = notifications.filter(n => isToday(n.createdAt));
  const earlierNotifs = notifications.filter(n => !isToday(n.createdAt));
  const unreadCount   = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <View style={[st.screen, st.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.screen}>
      {unreadCount > 0 && (
        <View style={st.header}>
          <Text style={st.headerSub}>{unreadCount}개의 읽지 않은 알림</Text>
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={st.markAllBtn}>모두 읽음</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
        {todayNotifs.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionLabel}>오늘</Text>
            {todayNotifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onPress={() => handleMarkRead(n.id)}
              />
            ))}
          </View>
        )}

        {earlierNotifs.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionLabel}>이전</Text>
            {earlierNotifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onPress={() => handleMarkRead(n.id)}
              />
            ))}
          </View>
        )}

        {notifications.length === 0 && (
          <View style={st.empty}>
            <Text style={st.emptyIcon}>🔕</Text>
            <Text style={st.emptyText}>알림이 없습니다</Text>
          </View>
        )}

        <View style={{height: 32}} />
      </ScrollView>
    </View>
  );
};

// ── 스타일 ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: Colors.background},
  center: {justifyContent: 'center', alignItems: 'center'},

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSub:   {fontSize: 12, color: Colors.primary, fontWeight: '600'},
  markAllBtn:  {fontSize: 13, color: Colors.primary, fontWeight: '600'},

  section:      {paddingHorizontal: 16, paddingTop: 16},
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardUnread: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.1,
    elevation: 3,
  },
  cardAccent: {width: 3},
  iconWrap: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {fontSize: 22},

  cardContent:  {flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 16},
  cardTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3},
  cardTitle:    {fontSize: 14, fontWeight: '700', color: Colors.textPrimary},
  unreadDot:    {width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary},
  cardBody:     {fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 6},

  previewRow:    {flexDirection: 'row', gap: 6, marginBottom: 6},
  previewChip:   {borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2},
  previewChipTxt:{fontSize: 11, fontWeight: '600'},

  cardTime: {fontSize: 11, color: Colors.textTertiary},

  empty:     {alignItems: 'center', paddingTop: 80},
  emptyIcon: {fontSize: 40, marginBottom: 12},
  emptyText: {fontSize: 15, color: Colors.textSecondary},
});
