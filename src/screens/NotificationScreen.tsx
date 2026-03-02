import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {Colors} from '../config/colors';
import type {Notification, NotificationType} from '../types/measurement';

// ── Mock 알림 데이터 ───────────────────────────────────────────────────────────
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'measurement_complete',
    title: '측정 완료',
    body: '오전 9:30 측정이 완료됐어요. 심박수 76 bpm · 상위 65%',
    createdAt: '2026-02-28T09:31:00',
    isRead: false,
    recordId: '1',
    data: {heartRate: 76, percentile: 65},
  },
  {
    id: '2',
    type: 'reminder',
    title: '오후 측정 알림',
    body: '오후 측정 시간이 됐어요. 오늘 오전 측정 이후 아직 측정하지 않았습니다.',
    createdAt: '2026-02-28T14:00:00',
    isRead: false,
  },
  {
    id: '3',
    type: 'measurement_complete',
    title: '측정 완료',
    body: '오후 2:20 측정이 완료됐어요. 심박수 78 bpm · 상위 42%',
    createdAt: '2026-02-28T14:21:00',
    isRead: true,
    recordId: '2',
    data: {heartRate: 78, percentile: 42},
  },
  {
    id: '4',
    type: 'weekly_report',
    title: '주간 리포트',
    body: '이번 주 심박수 평균 75 bpm. 지난 주(78 bpm) 대비 3 bpm 낮아졌어요.',
    createdAt: '2026-02-27T09:00:00',
    isRead: true,
    data: {avgHR: 75, prevAvgHR: 78, trend: 'improving'},
  },
  {
    id: '5',
    type: 'reminder',
    title: '오늘 측정해주세요',
    body: '아직 오늘의 PPG 측정을 시작하지 않았어요. 건강 추적을 위해 하루 2회 측정을 권장합니다.',
    createdAt: '2026-02-27T08:00:00',
    isRead: true,
  },
];

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function relativeTime(isoStr: string): string {
  const now  = new Date('2026-02-28T15:00:00');
  const past = new Date(isoStr);
  const diffMs = now.getTime() - past.getTime();
  const mins  = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);

  if (mins < 1)  return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
}

function isToday(isoStr: string): boolean {
  return isoStr.startsWith('2026-02-28');
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
      {/* 왼쪽 색상 액센트 */}
      <View style={[st.cardAccent, {backgroundColor: cfg.accentColor}]} />

      {/* 아이콘 */}
      <View style={[st.iconWrap, {backgroundColor: cfg.bgColor}]}>
        <Text style={st.iconText}>{cfg.icon}</Text>
      </View>

      {/* 텍스트 */}
      <View style={st.cardContent}>
        <View style={st.cardTitleRow}>
          <Text style={st.cardTitle}>{notif.title}</Text>
          {!notif.isRead && <View style={st.unreadDot} />}
        </View>
        <Text style={st.cardBody} numberOfLines={2}>{notif.body}</Text>

        {/* 측정 완료 시 미리보기 칩 */}
        {notif.type === 'measurement_complete' && notif.data && (
          <View style={st.previewRow}>
            <View style={[st.previewChip, {borderColor: cfg.accentColor}]}>
              <Text style={[st.previewChipTxt, {color: cfg.accentColor}]}>
                {notif.data.heartRate as number} bpm
              </Text>
            </View>
            <View style={[st.previewChip, {borderColor: cfg.accentColor}]}>
              <Text style={[st.previewChipTxt, {color: cfg.accentColor}]}>
                상위 {notif.data.percentile as number}%
              </Text>
            </View>
          </View>
        )}

        {/* 주간 리포트 추세 */}
        {notif.type === 'weekly_report' && notif.data && (
          <View style={st.previewRow}>
            <View style={[st.previewChip, {borderColor: cfg.accentColor}]}>
              <Text style={[st.previewChipTxt, {color: cfg.accentColor}]}>
                {notif.data.trend === 'improving' ? '▼ 개선됨' : '▲ 악화'}
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
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({...n, isRead: true})));

  const todayNotifs  = notifications.filter(n => isToday(n.createdAt));
  const earlierNotifs = notifications.filter(n => !isToday(n.createdAt));
  const unreadCount  = notifications.filter(n => !n.isRead).length;

  return (
    <View style={st.screen}>
      {/* 헤더: 읽지 않은 알림 수 + 모두 읽음 버튼 */}
      {unreadCount > 0 && (
        <View style={st.header}>
          <Text style={st.headerSub}>{unreadCount}개의 읽지 않은 알림</Text>
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
            <Text style={st.markAllBtn}>모두 읽음</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
        {/* 오늘 */}
        {todayNotifs.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionLabel}>오늘</Text>
            {todayNotifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onPress={() =>
                  setNotifications(prev =>
                    prev.map(x => x.id === n.id ? {...x, isRead: true} : x),
                  )
                }
              />
            ))}
          </View>
        )}

        {/* 이전 */}
        {earlierNotifs.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionLabel}>이전</Text>
            {earlierNotifs.map(n => (
              <NotifCard key={n.id} notif={n} />
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

  cardContent: {flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 16},
  cardTitleRow:{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3},
  cardTitle:   {fontSize: 14, fontWeight: '700', color: Colors.textPrimary},
  unreadDot:   {width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary},
  cardBody:    {fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 6},

  previewRow:    {flexDirection: 'row', gap: 6, marginBottom: 6},
  previewChip:   {borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2},
  previewChipTxt:{fontSize: 11, fontWeight: '600'},

  cardTime: {fontSize: 11, color: Colors.textTertiary},

  empty:     {alignItems: 'center', paddingTop: 80},
  emptyIcon: {fontSize: 40, marginBottom: 12},
  emptyText: {fontSize: 15, color: Colors.textSecondary},
});
