import React from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';

const DUMMY_NOTIFICATIONS = [
  {id: '1', title: '측정 완료', message: '오늘의 측정이 완료되었습니다', time: '10분 전'},
  {id: '2', title: '분석 결과', message: '심박수가 정상 범위입니다', time: '1시간 전'},
  {id: '3', title: '측정 알림', message: '오늘의 측정을 시작하세요', time: '3시간 전'},
];

export const NotificationScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>알림</Text>

      <FlatList
        data={DUMMY_NOTIFICATIONS}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <Text style={styles.message}>{item.message}</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>알림이 없습니다</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  time: {
    fontSize: 12,
    color: '#8E8E93',
  },
  message: {
    fontSize: 14,
    color: '#3C3C43',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
