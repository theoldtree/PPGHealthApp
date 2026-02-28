import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import type {MeasurementRecord} from '../types/measurement';
import {
  getHeartRateStatus,
  getHRVStatus,
  getPIStatus,
} from '../utils/metrics';

interface DiaryDetailScreenProps {
  record: MeasurementRecord;
  onClose: () => void;
}

export const DiaryDetailScreen: React.FC<DiaryDetailScreenProps> = ({
  record,
}) => {
  const {analysis} = record;

  return (
    <ScrollView style={styles.container}>
      {/* 날짜 및 시간 */}
      <View style={styles.header}>
        <Text style={styles.date}>{record.date}</Text>
        <Text style={styles.time}>{record.time}</Text>
      </View>

      {/* 측정 결과 */}
      {analysis && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>측정 결과</Text>

            {/* 심박수 */}
            <View style={styles.metricContainer}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>심박수</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: getHeartRateStatus(
                        analysis.general.heartRate,
                      ).color,
                    },
                  ]}>
                  <Text style={styles.statusBadgeText}>
                    {getHeartRateStatus(analysis.general.heartRate).text}
                  </Text>
                </View>
              </View>
              <Text style={styles.metricValue}>
                {analysis.general.heartRate} bpm
              </Text>
              <Text style={styles.metricReference}>참고: 60-100 bpm</Text>
            </View>

            {/* HRV */}
            <View style={styles.metricContainer}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>HRV</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: getHRVStatus(analysis.general.hrv).color,
                    },
                  ]}>
                  <Text style={styles.statusBadgeText}>
                    {getHRVStatus(analysis.general.hrv).text}
                  </Text>
                </View>
              </View>
              <Text style={styles.metricValue}>{analysis.general.hrv} ms</Text>
              <Text style={styles.metricReference}>참고: 30-100 ms</Text>
            </View>

            {/* PI */}
            <View style={styles.metricContainer}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>PI</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {backgroundColor: getPIStatus(analysis.general.pi).color},
                  ]}>
                  <Text style={styles.statusBadgeText}>
                    {getPIStatus(analysis.general.pi).text}
                  </Text>
                </View>
              </View>
              <Text style={styles.metricValue}>{analysis.general.pi} %</Text>
              <Text style={styles.metricReference}>참고: 1-5 %</Text>
            </View>
          </View>

          {/* 나의 평균 대비 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>나의 평균 대비</Text>

            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>심박수</Text>
              <View style={styles.comparisonValueContainer}>
                <Text
                  style={[
                    styles.comparisonValue,
                    {
                      color:
                        analysis.personal.heartRateDiff > 0
                          ? '#FF3B30'
                          : analysis.personal.heartRateDiff < 0
                            ? '#34C759'
                            : '#3C3C43',
                    },
                  ]}>
                  {analysis.personal.heartRateDiff > 0 ? '+' : ''}
                  {analysis.personal.heartRateDiff} bpm
                </Text>
                <Text style={styles.comparisonNote}>
                  {analysis.personal.heartRateDiff === 0
                    ? '평균과 동일'
                    : `평균 대비 ${Math.abs(analysis.personal.heartRateDiff)} bpm ${analysis.personal.heartRateDiff > 0 ? '높음' : '낮음'}`}
                </Text>
              </View>
            </View>

            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>HRV</Text>
              <View style={styles.comparisonValueContainer}>
                <Text
                  style={[
                    styles.comparisonValue,
                    {
                      color:
                        analysis.personal.hrvDiff > 0
                          ? '#34C759'
                          : analysis.personal.hrvDiff < 0
                            ? '#FF3B30'
                            : '#3C3C43',
                    },
                  ]}>
                  {analysis.personal.hrvDiff > 0 ? '+' : ''}
                  {analysis.personal.hrvDiff} ms
                </Text>
                <Text style={styles.comparisonNote}>
                  {analysis.personal.hrvDiff === 0
                    ? '평균과 동일'
                    : `평균 대비 ${Math.abs(analysis.personal.hrvDiff)} ms ${analysis.personal.hrvDiff > 0 ? '높음' : '낮음'}`}
                </Text>
              </View>
            </View>
          </View>

          {/* 동일 연령대 비교 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>동일 연령대 비교</Text>

            <View style={styles.percentileRow}>
              <Text style={styles.percentileLabel}>상위</Text>
              <Text style={styles.percentileValue}>
                {analysis.demographic.percentile}%
              </Text>
            </View>

            <View style={styles.demographicRow}>
              <Text style={styles.demographicLabel}>내 심박수</Text>
              <Text style={styles.demographicValue}>
                {analysis.general.heartRate} bpm
              </Text>
            </View>
            <View style={styles.demographicRow}>
              <Text style={styles.demographicLabel}>연령대 평균</Text>
              <Text style={styles.demographicValue}>
                {analysis.demographic.ageGroupAvg} bpm
              </Text>
            </View>
            <View style={styles.demographicRow}>
              <Text style={styles.demographicLabel}>차이</Text>
              <Text
                style={[
                  styles.demographicValue,
                  {
                    color:
                      analysis.general.heartRate <
                      analysis.demographic.ageGroupAvg
                        ? '#34C759'
                        : '#FF3B30',
                  },
                ]}>
                {analysis.general.heartRate -
                  analysis.demographic.ageGroupAvg >
                0
                  ? '+'
                  : ''}
                {analysis.general.heartRate -
                  analysis.demographic.ageGroupAvg}{' '}
                bpm
              </Text>
            </View>
          </View>
        </>
      )}

      {/* 메모 */}
      {record.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>메모</Text>
          <Text style={styles.notes}>{record.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#F9F9F9',
  },
  date: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  time: {
    fontSize: 16,
    color: '#8E8E93',
  },
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  metricContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C3C43',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  metricReference: {
    fontSize: 12,
    color: '#8E8E93',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  comparisonLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3C3C43',
    flex: 1,
  },
  comparisonValueContainer: {
    alignItems: 'flex-end',
    flex: 2,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  comparisonNote: {
    fontSize: 12,
    color: '#8E8E93',
  },
  percentileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  percentileLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C3C43',
  },
  percentileValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  demographicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  demographicLabel: {
    fontSize: 15,
    color: '#3C3C43',
  },
  demographicValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  notes: {
    fontSize: 16,
    color: '#3C3C43',
    lineHeight: 24,
  },
});
