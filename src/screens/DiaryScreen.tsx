import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
} from 'react-native';
import {Calendar} from 'react-native-calendars';
import type {MeasurementRecord, MarkedDates} from '../types/measurement';
import {DiaryDetailScreen} from './DiaryDetailScreen';

// 더미 데이터 (나중에 실제 API로 교체)
const DUMMY_RECORDS: MeasurementRecord[] = [
  {
    id: '1',
    userId: 'user1',
    date: '2026-01-26',
    time: '09:30:00',
    timestamp: Date.now(),
    duration: 60,
    notes: '아침 측정, 컨디션 좋음',
    analysis: {
      general: {
        heartRate: 72,
        hrv: 45,
        stressLevel: 35,
        status: 'good',
      },
      personal: {
        heartRateDiff: -3,
        hrvDiff: 5,
        trend: 'improving',
      },
      demographic: {
        percentile: 65,
        ageGroupAvg: 75,
        genderGroupAvg: 74,
        comparison: 'above_average',
      },
    },
  },
  {
    id: '2',
    userId: 'user1',
    date: '2026-01-26',
    time: '14:20:00',
    timestamp: Date.now(),
    duration: 60,
    notes: '점심 후 측정',
    analysis: {
      general: {
        heartRate: 78,
        hrv: 38,
        stressLevel: 52,
        status: 'normal',
      },
      personal: {
        heartRateDiff: 3,
        hrvDiff: -2,
        trend: 'stable',
      },
      demographic: {
        percentile: 50,
        ageGroupAvg: 75,
        genderGroupAvg: 74,
        comparison: 'average',
      },
    },
  },
  {
    id: '3',
    userId: 'user1',
    date: '2026-01-25',
    time: '10:15:00',
    timestamp: Date.now() - 86400000,
    duration: 60,
    analysis: {
      general: {
        heartRate: 68,
        hrv: 50,
        stressLevel: 28,
        status: 'excellent',
      },
      personal: {
        heartRateDiff: -7,
        hrvDiff: 10,
        trend: 'improving',
      },
      demographic: {
        percentile: 78,
        ageGroupAvg: 75,
        genderGroupAvg: 74,
        comparison: 'above_average',
      },
    },
  },
];

export const DiaryScreen: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MeasurementRecord | null>(
    null,
  );
  const [showRecordListModal, setShowRecordListModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 날짜별로 기록 그룹화
  const recordsByDate = DUMMY_RECORDS.reduce(
    (acc, record) => {
      if (!acc[record.date]) {
        acc[record.date] = [];
      }
      acc[record.date].push(record);
      return acc;
    },
    {} as Record<string, MeasurementRecord[]>,
  );

  // 달력에 표시할 마크
  const markedDates: MarkedDates = Object.keys(recordsByDate).reduce(
    (acc, date) => {
      acc[date] = {
        marked: true,
        dotColor: '#007AFF',
        count: recordsByDate[date].length,
      };
      return acc;
    },
    {} as MarkedDates,
  );

  // 날짜 선택 시
  const handleDayPress = (day: {dateString: string}) => {
    const records = recordsByDate[day.dateString];
    if (records && records.length > 0) {
      setSelectedDate(day.dateString);
      setShowRecordListModal(true);
    }
  };

  // 기록 선택 시
  const handleRecordPress = (record: MeasurementRecord) => {
    setSelectedRecord(record);
    setShowRecordListModal(false);
    setShowDetailModal(true);
  };

  // 기록 리스트 아이템 렌더링
  const renderRecordItem = ({item}: {item: MeasurementRecord}) => (
    <TouchableOpacity
      style={styles.recordItem}
      onPress={() => handleRecordPress(item)}>
      <View style={styles.recordItemLeft}>
        <Text style={styles.recordTime}>{item.time}</Text>
        {item.analysis && (
          <Text style={styles.recordHeartRate}>
            {item.analysis.general.heartRate} bpm
          </Text>
        )}
      </View>
      <Text style={styles.recordArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={markedDates}
        theme={{
          todayTextColor: '#007AFF',
          selectedDayBackgroundColor: '#007AFF',
          selectedDayTextColor: '#FFFFFF',
          arrowColor: '#007AFF',
          monthTextColor: '#000000',
          textMonthFontWeight: 'bold',
          textMonthFontSize: 18,
          textDayFontSize: 16,
          textDayHeaderFontSize: 14,
        }}
      />

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, {backgroundColor: '#007AFF'}]} />
          <Text style={styles.legendText}>측정 기록 있음</Text>
        </View>
      </View>

      {/* 날짜별 기록 목록 모달 */}
      <Modal
        visible={showRecordListModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecordListModal(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowRecordListModal(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate} 측정 기록 ({recordsByDate[selectedDate || '']?.length || 0}회)
              </Text>
              <TouchableOpacity
                onPress={() => setShowRecordListModal(false)}
                style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedDate ? recordsByDate[selectedDate] : []}
              keyExtractor={item => item.id}
              renderItem={renderRecordItem}
              contentContainerStyle={styles.recordList}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* 상세 기록 모달 */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.detailModalContainer}>
          <View style={styles.detailModalHeader}>
            <TouchableOpacity
              onPress={() => setShowDetailModal(false)}
              style={styles.backButton}>
              <Text style={styles.backButtonText}>‹ 닫기</Text>
            </TouchableOpacity>
            <Text style={styles.detailModalTitle}>측정 상세</Text>
            <View style={styles.placeholder} />
          </View>

          {selectedRecord && (
            <DiaryDetailScreen
              record={selectedRecord}
              onClose={() => setShowDetailModal(false)}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#8E8E93',
  },
  recordList: {
    padding: 16,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recordItemLeft: {
    flex: 1,
  },
  recordTime: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  recordHeartRate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  recordArrow: {
    fontSize: 24,
    color: '#C7C7CC',
    marginLeft: 12,
  },
  detailModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007AFF',
  },
  detailModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 50,
  },
});
