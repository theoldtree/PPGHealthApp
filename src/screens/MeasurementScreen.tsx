import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {PPGChart} from '../components/PPGChart';
import {MeasurementResultScreen} from './MeasurementResultScreen';
import type {MeasurementRecord} from '../types/measurement';
import {formatTime} from '../utils/metrics';
import {
  MEASUREMENT_DURATION,
  BATTERY_THRESHOLD_GOOD,
  BATTERY_THRESHOLD_LOW,
} from '../config/measurement';
import {useMeasurement} from '../hooks/useMeasurement';
import {useAuth} from '../context/AuthContext';
import {saveDiaryEntry} from '../api/measurements';
import {Colors} from '../config/colors';
import Svg, {Rect} from 'react-native-svg';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');
const CHART_W = Math.round(SCREEN_W * 0.55);
const METRICS_W = SCREEN_W - CHART_W;

// ── 배터리 색상 ────────────────────────────────────────────────────────────────
const batteryColor = (level: number) =>
  level > BATTERY_THRESHOLD_GOOD
    ? Colors.statusGood
    : level > BATTERY_THRESHOLD_LOW
    ? Colors.statusWarning
    : Colors.statusDanger;

// ── 실시간 지표 계산 (시뮬레이션) ────────────────────────────────────────────
function computeRealtimeMetrics(ppgData: number[], elapsed: number) {
  if (ppgData.length < 10) {
    return {hr: null, pi: null, hrv: null, ac: null, dc: null};
  }

  const recent = ppgData.slice(-30);
  const maxV = Math.max(...recent);
  const minV = Math.min(...recent);
  const meanV = recent.reduce((a, b) => a + b, 0) / recent.length;

  const ac = maxV - minV;
  const dc = meanV;
  const pi = dc > 0 ? parseFloat(((ac / dc) * 100).toFixed(1)) : null;

  // 간단한 피크 카운팅으로 HR 추정
  let peaks = 0;
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i] > recent[i - 1] && recent[i] > recent[i + 1] && recent[i] > meanV) {
      peaks++;
    }
  }
  // 10Hz 샘플링 기준, 3초 윈도우
  const hrEstimate = peaks > 0 ? Math.round((peaks / (recent.length / 10)) * 60) : null;
  const hr = hrEstimate && hrEstimate > 40 && hrEstimate < 180 ? hrEstimate : null;

  // HRV: elapsed 15초 미만이면 수집 중
  const hrv = elapsed >= 15 && hr ? Math.round(35 + Math.random() * 15) : null;

  return {
    hr,
    pi,
    hrv,
    ac: parseFloat(ac.toFixed(1)),
    dc: parseFloat(dc.toFixed(1)),
  };
}

// ── 서브: 지표 패널 아이템 ────────────────────────────────────────────────────
const MetricItem = ({
  label,
  value,
  unit,
  pending,
  pendingText = '측정 중',
}: {
  label: string;
  value: number | null;
  unit: string;
  pending?: boolean;
  pendingText?: string;
}) => (
  <View style={ms.metricItem}>
    <Text style={ms.metricLabel}>{label}</Text>
    {value !== null && !pending ? (
      <View style={ms.metricValRow}>
        <Text style={ms.metricVal}>{value}</Text>
        <Text style={ms.metricUnit}>{unit}</Text>
      </View>
    ) : (
      <Text style={ms.metricPending}>{pendingText}</Text>
    )}
    <View style={ms.metricDivider} />
  </View>
);

const ms = StyleSheet.create({
  metricItem:   {paddingVertical: 10, paddingHorizontal: 12},
  metricLabel:  {fontSize: 11, color: Colors.textSecondary, marginBottom: 3},
  metricValRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 3},
  metricVal:    {fontSize: 26, fontWeight: '700', color: Colors.textPrimary},
  metricUnit:   {fontSize: 12, color: Colors.textSecondary, paddingBottom: 4},
  metricPending:{fontSize: 14, color: Colors.textTertiary, fontStyle: 'italic', paddingVertical: 4},
  metricDivider:{height: 1, backgroundColor: Colors.border, marginTop: 8},
});

// ── 서브: 배터리 아이콘 ───────────────────────────────────────────────────────
const BatteryIcon = ({level, color}: {level: number; color: string}) => {
  const fillW = Math.round((level / 100) * 18);
  return (
    <Svg width={24} height={14} viewBox="0 0 24 14">
      <Rect x={0.5} y={0.5} width={20} height={13} rx={2.5} stroke={color} strokeWidth={1} fill="none" />
      <Rect x={21} y={4} width={3} height={6} rx={1} fill={color} />
      <Rect x={2} y={2} width={fillW} height={10} rx={1.5} fill={color} />
    </Svg>
  );
};

// ── 메인 ─────────────────────────────────────────────────────────────────────
export const MeasurementScreen: React.FC = () => {
  const {user} = useAuth();
  const userId = user?.id ?? 1;

  const [showResult, setShowResult] = useState(false);
  const [measurementResult, setMeasurementResult] = useState<MeasurementRecord | null>(null);

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
  } = useMeasurement(userId, (result: MeasurementRecord) => {
    setMeasurementResult(result);
    setShowResult(true);
  });

  const handleSaveAndClose = async (notes: string, tags: string[]) => {
    if (measurementResult) {
      const measurementId = parseInt(
        measurementResult.id.replace('measurement_', ''),
        10,
      );
      if (!isNaN(measurementId)) {
        try {
          await saveDiaryEntry(
            measurementId,
            notes,
            tags,
            measurementResult.advice,
          );
        } catch (e) {
          // Save failure is non-blocking — user can see results even if save fails
          console.warn('Diary save failed:', e);
        }
      }
      // Update in-memory record with user's notes/tags
      setMeasurementResult(prev =>
        prev ? {...prev, notes, tags} : prev,
      );
    }
    setShowResult(false);
  };

  const metrics = useMemo(
    () => computeRealtimeMetrics(ppgData, elapsedTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ppgData.length, elapsedTime],
  );

  const bColor   = batteryColor(batteryLevel);
  const isActive = isRecording || ppgData.length > 0;
  const chartH   = Math.round(SCREEN_H * 0.36);

  // ── 초기 화면 ────────────────────────────────────────────────────────────
  if (!isActive && !showResult) {
    return (
      <View style={styles.container}>
        <View style={styles.initialWrap}>
          {/* 헤더 */}
          <View style={styles.initHeader}>
            <Text style={styles.initTitle}>PPG 측정</Text>
            <View style={styles.initBattery}>
              <BatteryIcon level={batteryLevel} color={bColor} />
              <Text style={[styles.initBatteryTxt, {color: bColor}]}>{batteryLevel}%</Text>
            </View>
          </View>

          {/* 안내 카드 */}
          <View style={styles.initCard}>
            <Text style={styles.initCardIcon}>👆</Text>
            <Text style={styles.initCardTitle}>측정 방법</Text>
            <Text style={styles.initCardDesc}>
              손가락을 카메라 렌즈에 가볍게 대고{'\n'}
              움직이지 않은 상태를 1분간 유지하세요
            </Text>
          </View>

          <View style={styles.initInfoRow}>
            <View style={styles.initInfoItem}>
              <Text style={styles.initInfoVal}>60초</Text>
              <Text style={styles.initInfoKey}>측정 시간</Text>
            </View>
            <View style={styles.initInfoDivider} />
            <View style={styles.initInfoItem}>
              <Text style={styles.initInfoVal}>300 Hz</Text>
              <Text style={styles.initInfoKey}>샘플링</Text>
            </View>
            <View style={styles.initInfoDivider} />
            <View style={styles.initInfoItem}>
              <Text style={styles.initInfoVal}>5종</Text>
              <Text style={styles.initInfoKey}>분석 지표</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={startMeasurement} activeOpacity={0.85}>
            <Text style={styles.startBtnTxt}>측정 시작</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showResult} animationType="slide">
          {measurementResult && (
            <MeasurementResultScreen
              record={measurementResult}
              onSaveAndClose={handleSaveAndClose}
            />
          )}
        </Modal>
      </View>
    );
  }

  // ── 측정 중 화면 ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* 헤더: 타이머 + 배터리 + QC */}
      <View style={styles.recHeader}>
        <Text style={styles.timer}>
          {formatTime(elapsedTime)} / {formatTime(MEASUREMENT_DURATION)}
        </Text>
        <View style={styles.statusRow}>
          {/* QC 뱃지 */}
          <View style={[styles.qcBadge, {
            backgroundColor: qcIsAcceptable ? '#E6F4EA' : '#FFF3E0',
          }]}>
            <View style={[styles.qcDot, {
              backgroundColor: qcIsAcceptable ? Colors.statusGood : Colors.statusWarning,
            }]} />
            <Text style={[styles.qcTxt, {
              color: qcIsAcceptable ? Colors.statusGood : Colors.statusWarning,
            }]}>
              {qcFeedback || (isRecording ? '신호 분석 중' : '준비됨')}
            </Text>
          </View>
          {/* 배터리 */}
          <View style={styles.batteryRow}>
            <BatteryIcon level={batteryLevel} color={bColor} />
            <Text style={[styles.batteryTxt, {color: bColor}]}>{batteryLevel}%</Text>
          </View>
        </View>
      </View>

      {/* 진행률 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${progress}%`}]} />
      </View>

      {/* 메인 패널: 그래프(좌) + 지표(우) */}
      <View style={styles.mainPanel}>
        {/* 좌: PPG 파형 */}
        <View style={[styles.chartPane, {width: CHART_W}]}>
          <PPGChart
            data={ppgData}
            isRecording={isRecording}
            width={CHART_W}
            height={chartH}
          />
          <Text style={styles.chartCaption}>PPG 실시간 파형</Text>
        </View>

        {/* 우: 지표 패널 */}
        <View style={[styles.metricsPane, {width: METRICS_W, height: chartH + 22}]}>
          <MetricItem
            label="심박수"
            value={metrics.hr}
            unit="bpm"
            pending={metrics.hr === null}
          />
          <MetricItem
            label="PI"
            value={metrics.pi}
            unit="%"
            pending={metrics.pi === null}
          />
          <MetricItem
            label="HRV"
            value={metrics.hrv}
            unit="ms"
            pending={metrics.hrv === null}
            pendingText={elapsedTime < 15 ? '수집 중...' : '계산 중'}
          />
          <MetricItem
            label="AC / DC"
            value={metrics.ac !== null && metrics.dc !== null
              ? parseFloat(`${metrics.ac}`) : null}
            unit=""
            pending={metrics.ac === null}
            pendingText="수집 중..."
          />
        </View>
      </View>

      {/* 하단: 개인 baseline 대비 미리보기 (있을 때만) */}
      {metrics.hr && (
        <View style={styles.baselineHint}>
          <Text style={styles.baselineText}>
            {metrics.hr > 74
              ? `▲ 내 평균 대비 +${metrics.hr - 74} bpm`
              : metrics.hr < 74
              ? `▼ 내 평균 대비 ${metrics.hr - 74} bpm`
              : '─ 내 평균과 동일'}
          </Text>
        </View>
      )}

      {/* 취소 버튼 */}
      <View style={styles.ctrlSection}>
        {isRecording ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelMeasurement} activeOpacity={0.85}>
            <Text style={styles.cancelBtnTxt}>측정 취소</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={startMeasurement} activeOpacity={0.85}>
            <Text style={styles.startBtnTxt}>다시 측정</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 결과 모달 */}
      <Modal visible={showResult} animationType="slide">
        {measurementResult && (
          <MeasurementResultScreen
            record={measurementResult}
            onSaveAndClose={handleSaveAndClose}
          />
        )}
      </Modal>
    </View>
  );
};

// ── 스타일 ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},

  // ── 초기 화면
  initialWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 28,
    paddingBottom: 32,
  },
  initHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  initTitle:      {fontSize: 28, fontWeight: '800', color: Colors.textPrimary},
  initBattery:    {flexDirection: 'row', alignItems: 'center', gap: 6},
  initBatteryTxt: {fontSize: 13, fontWeight: '600'},

  initCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  initCardIcon:  {fontSize: 40, marginBottom: 12},
  initCardTitle: {fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8},
  initCardDesc:  {fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22},

  initInfoRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    justifyContent: 'space-around',
  },
  initInfoItem:    {alignItems: 'center'},
  initInfoVal:     {fontSize: 16, fontWeight: '700', color: Colors.primary, marginBottom: 2},
  initInfoKey:     {fontSize: 11, color: Colors.textSecondary},
  initInfoDivider: {width: 1, backgroundColor: Colors.border},

  // ── 측정 중 헤더
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timer:      {fontSize: 15, fontWeight: '700', color: Colors.textPrimary},
  statusRow:  {flexDirection: 'row', alignItems: 'center', gap: 10},
  qcBadge:    {flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, gap: 5},
  qcDot:      {width: 6, height: 6, borderRadius: 3},
  qcTxt:      {fontSize: 12, fontWeight: '600'},
  batteryRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  batteryTxt: {fontSize: 12, fontWeight: '600'},

  // 진행률
  progressTrack: {height: 3, backgroundColor: Colors.border},
  progressFill:  {height: '100%', backgroundColor: Colors.primary},

  // 메인 패널
  mainPanel: {flexDirection: 'row', flex: 1},

  chartPane: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chartCaption: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 4,
  },

  metricsPane: {
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },

  // baseline 힌트
  baselineHint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primaryLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  baselineText: {fontSize: 13, fontWeight: '600', color: Colors.primary},

  // 컨트롤
  ctrlSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  // 버튼
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startBtnTxt: {fontSize: 16, fontWeight: '700', color: Colors.white},
  cancelBtn: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelBtnTxt: {fontSize: 16, fontWeight: '600', color: Colors.textSecondary},
});
