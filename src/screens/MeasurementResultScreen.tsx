import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import type {MeasurementRecord} from '../types/measurement';
import {Button} from '../components/Button';
import {
  getHeartRateStatus,
  getHRVStatus,
  getStressStatus,
  getPercentileExplanation,
} from '../utils/metrics';

interface MeasurementResultScreenProps {
  record: MeasurementRecord;
  onSaveAndClose: (notes: string) => void;
}

export const MeasurementResultScreen: React.FC<
  MeasurementResultScreenProps
> = ({record, onSaveAndClose}) => {
  const {analysis} = record;

  if (!analysis) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>분석 결과를 불러올 수 없습니다</Text>
      </View>
    );
  }

  const hrStatus = getHeartRateStatus(analysis.general.heartRate);
  const hrvStatus = getHRVStatus(analysis.general.hrv);
  const stressStatus = getStressStatus(analysis.general.stressLevel);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>측정 완료</Text>
        <Text style={styles.subtitle}>분석 결과를 확인하세요</Text>
      </View>

      {/* 1. 측정 결과 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>측정 결과</Text>

        {/* 심박수 */}
        <View style={styles.metricContainer}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel}>심박수 (Heart Rate)</Text>
            <View
              style={[styles.statusBadge, {backgroundColor: hrStatus.color}]}>
              <Text style={styles.statusBadgeText}>{hrStatus.text}</Text>
            </View>
          </View>
          <Text style={styles.metricValueLarge}>
            {analysis.general.heartRate} bpm
          </Text>
          <Text style={styles.metricReference}>참고 범위: 60-100 bpm</Text>
        </View>

        {/* HRV */}
        <View style={styles.metricContainer}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel}>심박 변이도 (HRV)</Text>
            <View
              style={[styles.statusBadge, {backgroundColor: hrvStatus.color}]}>
              <Text style={styles.statusBadgeText}>{hrvStatus.text}</Text>
            </View>
          </View>
          <Text style={styles.metricValueLarge}>
            {analysis.general.hrv} ms
          </Text>
          <Text style={styles.metricReference}>
            참고 범위: 30-100 ms (높을수록 좋음)
          </Text>
        </View>

        {/* 스트레스 */}
        <View style={styles.metricContainer}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel}>스트레스 지수</Text>
            <View
              style={[
                styles.statusBadge,
                {backgroundColor: stressStatus.color},
              ]}>
              <Text style={styles.statusBadgeText}>{stressStatus.text}</Text>
            </View>
          </View>
          <Text style={styles.metricValueLarge}>
            {analysis.general.stressLevel} / 100
          </Text>
          <Text style={styles.metricReference}>0-100 (낮을수록 좋음)</Text>
        </View>
      </View>

      {/* 2. 나의 평균 대비 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>나의 평균 대비</Text>
        <Text style={styles.sectionDescription}>
          최근 측정 기록과 비교한 결과입니다
        </Text>

        <View style={styles.comparisonCard}>
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
      </View>

      {/* 3. 동일 연령대 비교 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>동일 연령대 비교</Text>
        <Text style={styles.sectionDescription}>
          같은 나이와 성별의 평균 데이터와 비교한 결과입니다
        </Text>

        <View style={styles.percentileCard}>
          <Text style={styles.percentileLabel}>상위</Text>
          <Text style={styles.percentileValue}>
            {analysis.demographic.percentile}%
          </Text>
          <Text style={styles.percentileNote}>
            {getPercentileExplanation(analysis.demographic.percentile)}
          </Text>
        </View>

        <View style={styles.demographicComparison}>
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
                styles.demographicDiff,
                {
                  color:
                    analysis.general.heartRate <
                    analysis.demographic.ageGroupAvg
                      ? '#34C759'
                      : '#FF3B30',
                },
              ]}>
              {analysis.general.heartRate - analysis.demographic.ageGroupAvg >
              0
                ? '+'
                : ''}
              {analysis.general.heartRate - analysis.demographic.ageGroupAvg}{' '}
              bpm
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="저장하고 닫기"
          onPress={() => onSaveAndClose('')}
          style={styles.saveButton}
        />
      </View>
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
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
  },
  metricContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C3C43',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  metricValueLarge: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  metricReference: {
    fontSize: 13,
    color: '#8E8E93',
  },
  comparisonCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 20,
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
    fontSize: 16,
    fontWeight: '500',
    color: '#3C3C43',
    flex: 1,
  },
  comparisonValueContainer: {
    alignItems: 'flex-end',
    flex: 2,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  comparisonNote: {
    fontSize: 13,
    color: '#8E8E93',
  },
  percentileCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  percentileLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  percentileValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  percentileNote: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
  demographicComparison: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 20,
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
  demographicDiff: {
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    padding: 24,
  },
  saveButton: {
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
});
