import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import type {MeasurementRecord} from '../types/measurement';
import {
  getHeartRateStatus,
  getHRVStatus,
  getStressStatus,
  getPercentileExplanation,
  getOverallFeedback,
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
  const feedback = getOverallFeedback(
    analysis.general.heartRate,
    analysis.general.hrv,
    analysis.general.stressLevel,
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ① 종합 피드백 배너 */}
      <View style={[styles.feedbackBanner, {borderLeftColor: feedback.color}]}>
        <Text style={[styles.feedbackSummary, {color: feedback.color}]}>
          {feedback.summary}
        </Text>
        <Text style={styles.feedbackAdvice}>{feedback.advice}</Text>
      </View>

      {/* ② 핵심 지표 3종 */}
      <View style={styles.metricsRow}>
        <MetricChip
          label="심박수"
          value={`${analysis.general.heartRate}`}
          unit="bpm"
          statusText={hrStatus.text}
          statusColor={hrStatus.color}
        />
        <MetricChip
          label="HRV"
          value={`${analysis.general.hrv}`}
          unit="ms"
          statusText={hrvStatus.text}
          statusColor={hrvStatus.color}
        />
        <MetricChip
          label="스트레스"
          value={`${analysis.general.stressLevel}`}
          unit="/ 100"
          statusText={stressStatus.text}
          statusColor={stressStatus.color}
        />
      </View>

      {/* ③ 나의 평균 대비 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>나의 평균 대비</Text>

        <View style={styles.comparisonCard}>
          <CompareRow
            label="심박수"
            diff={analysis.personal.heartRateDiff}
            unit="bpm"
            higherIsBetter={false}
          />
          <CompareRow
            label="HRV"
            diff={analysis.personal.hrvDiff}
            unit="ms"
            higherIsBetter
          />
        </View>
      </View>

      {/* ④ 동일 연령대 비교 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>동일 연령대 비교</Text>

        <View style={styles.percentileRow}>
          <View style={styles.percentileBlock}>
            <Text style={styles.percentileLabel}>상위</Text>
            <Text style={[styles.percentileValue, {color: feedback.color}]}>
              {analysis.demographic.percentile}%
            </Text>
          </View>
          <Text style={styles.percentileNote}>
            {getPercentileExplanation(analysis.demographic.percentile)}
          </Text>
        </View>

        <View style={styles.comparisonCard}>
          <View style={styles.demoRow}>
            <Text style={styles.demoLabel}>내 심박수</Text>
            <Text style={styles.demoValue}>
              {analysis.general.heartRate} bpm
            </Text>
          </View>
          <View style={styles.demoRow}>
            <Text style={styles.demoLabel}>연령대 평균</Text>
            <Text style={styles.demoValue}>
              {analysis.demographic.ageGroupAvg} bpm
            </Text>
          </View>
          <View style={[styles.demoRow, {borderBottomWidth: 0}]}>
            <Text style={styles.demoLabel}>차이</Text>
            <Text
              style={[
                styles.demoValue,
                {
                  color:
                    analysis.general.heartRate < analysis.demographic.ageGroupAvg
                      ? '#34C759'
                      : '#FF3B30',
                  fontWeight: '700',
                },
              ]}>
              {analysis.general.heartRate - analysis.demographic.ageGroupAvg > 0
                ? '+'
                : ''}
              {analysis.general.heartRate - analysis.demographic.ageGroupAvg} bpm
            </Text>
          </View>
        </View>
      </View>

      {/* 참고 안내 */}
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          ※ 이 결과는 참고용이며 의학적 진단을 대체하지 않습니다.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => onSaveAndClose('')}
          activeOpacity={0.85}>
          <Text style={styles.saveButtonText}>저장하고 닫기</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const MetricChip = ({
  label,
  value,
  unit,
  statusText,
  statusColor,
}: {
  label: string;
  value: string;
  unit: string;
  statusText: string;
  statusColor: string;
}) => (
  <View style={styles.metricChip}>
    <Text style={styles.metricChipLabel}>{label}</Text>
    <Text style={styles.metricChipValue}>
      {value}
      <Text style={styles.metricChipUnit}> {unit}</Text>
    </Text>
    <View style={[styles.statusBadge, {backgroundColor: statusColor}]}>
      <Text style={styles.statusBadgeText}>{statusText}</Text>
    </View>
  </View>
);

const CompareRow = ({
  label,
  diff,
  unit,
  higherIsBetter,
}: {
  label: string;
  diff: number;
  unit: string;
  higherIsBetter: boolean;
}) => {
  const positive = diff > 0;
  const isGood =
    diff === 0
      ? false
      : (higherIsBetter && positive) || (!higherIsBetter && !positive);
  const color =
    diff === 0 ? '#888888' : isGood ? '#34C759' : '#FF3B30';

  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <View style={styles.compareRight}>
        <Text style={[styles.compareValue, {color}]}>
          {diff > 0 ? '+' : ''}
          {diff} {unit}
        </Text>
        <Text style={styles.compareNote}>
          {diff === 0
            ? '평균과 동일'
            : `평균 대비 ${Math.abs(diff)} ${unit} ${positive ? '높음' : '낮음'}`}
        </Text>
      </View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    margin: 32,
  },

  // Feedback banner
  feedbackBanner: {
    margin: 16,
    padding: 18,
    backgroundColor: '#F8F8FA',
    borderRadius: 14,
    borderLeftWidth: 4,
  },
  feedbackSummary: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  feedbackAdvice: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  metricChip: {
    flex: 1,
    backgroundColor: '#F8F8FA',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  metricChipLabel: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 4,
  },
  metricChipValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  metricChipUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#888888',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Section
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
    marginTop: 8,
  },

  // Comparison card
  comparisonCard: {
    backgroundColor: '#F8F8FA',
    borderRadius: 14,
    overflow: 'hidden',
  },
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  compareLabel: {
    fontSize: 15,
    color: '#444444',
    fontWeight: '500',
  },
  compareRight: {
    alignItems: 'flex-end',
  },
  compareValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  compareNote: {
    fontSize: 12,
    color: '#AAAAAA',
  },

  // Percentile
  percentileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  percentileBlock: {
    alignItems: 'center',
  },
  percentileLabel: {
    fontSize: 12,
    color: '#888888',
  },
  percentileValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  percentileNote: {
    flex: 1,
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },

  // Demo rows
  demoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  demoLabel: {
    fontSize: 14,
    color: '#555555',
  },
  demoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },

  // Notice
  notice: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#BBBBBB',
    lineHeight: 18,
  },

  // Footer
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
