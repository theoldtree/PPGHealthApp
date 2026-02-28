import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { PPGChart } from '../components/PPGChart';
import { MeasurementResultScreen } from './MeasurementResultScreen';
import type { MeasurementRecord } from '../types/measurement';
import { formatTime, computeAPGIndices } from '../utils/metrics';
import {
  MEASUREMENT_DURATION,
  BATTERY_THRESHOLD_GOOD,
  BATTERY_THRESHOLD_LOW,
} from '../config/measurement';
import { useMeasurement } from '../hooks/useMeasurement';

const SCREEN_WIDTH = Dimensions.get('window').width;

const batteryColor = (level: number) =>
  level > BATTERY_THRESHOLD_GOOD
    ? '#34C759'
    : level > BATTERY_THRESHOLD_LOW
    ? '#FF9500'
    : '#FF3B30';

export const MeasurementScreen: React.FC = () => {
  const [showResult, setShowResult] = useState(false);
  const [measurementResult, setMeasurementResult] =
    useState<MeasurementRecord | null>(null);

  const {
    isRecording,
    elapsedTime,
    ppgData,
    batteryLevel,
    qcFeedback,
    qcIsAcceptable,
    progress,
    startMeasurement,
    cancelMeasurement,
  } = useMeasurement((result: MeasurementRecord) => {
    setMeasurementResult(result);
    setShowResult(true);
  });

  const handleSaveResult = (_notes: string) => {
    setShowResult(false);
  };

  // Compute APG indices from collected PPG data
  const apgIndices = useMemo(
    () => computeAPGIndices(ppgData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ppgData.length],
  );

  const isActive = isRecording || ppgData.length > 0;

  // ── Initial state ─────────────────────────────────────────────────────────
  if (!isActive && !showResult) {
    return (
      <View style={styles.container}>
        <View style={styles.initialContent}>
          <Text style={styles.initialTitle}>PPG 측정</Text>
          <Text style={styles.initialSub}>
            손가락을 카메라에 대고 측정을 시작하세요
          </Text>
          <Text style={styles.initialInfo}>측정 시간: 1분</Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={startMeasurement}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>측정 시작</Text>
          </TouchableOpacity>
        </View>

        {/* 결과 모달 */}
        <Modal visible={showResult} animationType="slide">
          {measurementResult && (
            <MeasurementResultScreen
              record={measurementResult}
              onSaveAndClose={handleSaveResult}
            />
          )}
        </Modal>
      </View>
    );
  }

  // ── Recording / post-record state ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ① 그래프 영역 (풀 너비) */}
      <View style={styles.chartSection}>
        <PPGChart
          data={ppgData}
          isRecording={isRecording}
          width={SCREEN_WIDTH}
          height={220}
        />

        {/* 그래프 위 오버레이: 타이머(좌) + 배터리(우) */}
        <View style={styles.chartOverlay}>
          <Text style={styles.overlayTimer}>
            {formatTime(elapsedTime)} / {formatTime(MEASUREMENT_DURATION)}
          </Text>
          <View style={styles.overlayBatteryRow}>
            <View
              style={[
                styles.batteryDot,
                { backgroundColor: batteryColor(batteryLevel) },
              ]}
            />
            <Text
              style={[
                styles.overlayBatteryText,
                { color: batteryColor(batteryLevel) },
              ]}
            >
              {batteryLevel}%
            </Text>
          </View>
        </View>
      </View>

      {/* ② 진행률 바 */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* ③ QC 피드백 */}
      <View style={styles.qcSection}>
        {qcFeedback ? (
          <View
            style={[
              styles.qcPill,
              {
                backgroundColor: qcIsAcceptable ? '#E8F5E9' : '#FFF3E0',
                borderColor: qcIsAcceptable ? '#34C759' : '#FF9500',
              },
            ]}
          >
            <View
              style={[
                styles.qcDot,
                { backgroundColor: qcIsAcceptable ? '#34C759' : '#FF9500' },
              ]}
            />
            <Text
              style={[
                styles.qcText,
                { color: qcIsAcceptable ? '#2E7D32' : '#E65100' },
              ]}
            >
              {qcFeedback}
            </Text>
          </View>
        ) : (
          <View style={[styles.qcPill, styles.qcPillIdle]}>
            <View style={[styles.qcDot, { backgroundColor: '#AAAAAA' }]} />
            <Text style={styles.qcTextIdle}>
              {isRecording ? '신호 분석 중...' : '측정 준비됨'}
            </Text>
          </View>
        )}
      </View>

      {/* ④ 주요 지표 그리드 (b/a · AI · d/a · c/a) */}
      <View style={styles.metricsSection}>
        <MetricCard
          label="b/a"
          value={apgIndices ? String(apgIndices.bOverA) : '—'}
          description="동맥 탄성"
        />
        <MetricCard
          label="AI"
          value={apgIndices ? String(apgIndices.ai) : '—'}
          description="증강지수"
        />
        <MetricCard
          label="d/a"
          value={apgIndices ? String(apgIndices.dOverA) : '—'}
          description="혈관 저항"
        />
        <MetricCard
          label="c/a"
          value={apgIndices ? String(apgIndices.cOverA) : '—'}
          description="혈관 순응도"
        />
      </View>

      {/* ⑤ 상태 텍스트 + 컨트롤 */}
      <View style={styles.controlSection}>
        {isRecording && (
          <Text style={styles.statusText}>
            측정 중 · 기기를 움직이지 마세요
          </Text>
        )}
        {isRecording ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelMeasurement}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelButtonText}>측정 취소</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.startButton}
            onPress={startMeasurement}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>다시 측정</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 결과 모달 */}
      <Modal visible={showResult} animationType="slide">
        {measurementResult && (
          <MeasurementResultScreen
            record={measurementResult}
            onSaveAndClose={handleSaveResult}
          />
        )}
      </Modal>
    </View>
  );
};

// ── Metric card ───────────────────────────────────────────────────────────────
const MetricCard = ({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricDesc}>{description}</Text>
  </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Initial state
  initialContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  initialTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  initialSub: {
    fontSize: 15,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  initialInfo: {
    fontSize: 13,
    color: '#AAAAAA',
    marginBottom: 40,
  },

  // Graph section
  chartSection: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  chartOverlay: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overlayTimer: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
    backgroundColor: 'rgba(248,248,250,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  overlayBatteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248,248,250,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  batteryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  overlayBatteryText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Progress bar
  progressSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#EEEEEE',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 2,
  },

  // QC feedback
  qcSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  qcPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  qcPillIdle: {
    backgroundColor: '#F5F5F5',
    borderColor: '#DDDDDD',
  },
  qcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qcText: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  qcTextIdle: {
    fontSize: 14,
    color: '#AAAAAA',
  },

  // APG Metrics
  metricsSection: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8F8FA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  metricDesc: {
    fontSize: 10,
    color: '#AAAAAA',
    textAlign: 'center',
  },

  // Control section
  controlSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 10,
  },
  statusText: {
    fontSize: 13,
    color: '#FF9500',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Buttons
  startButton: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555555',
  },
});
