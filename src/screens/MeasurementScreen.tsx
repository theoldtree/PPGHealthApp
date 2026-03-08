import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableOpacity,
  Platform,
  ScrollView,
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
import {useNotificationContext} from '../context/NotificationContext';
import {saveDiaryEntry} from '../api/measurements';
import {Colors} from '../config/colors';
import Svg, {Rect} from 'react-native-svg';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

const batteryColor = (level: number) =>
  level > BATTERY_THRESHOLD_GOOD
    ? Colors.statusGood
    : level > BATTERY_THRESHOLD_LOW
    ? Colors.statusWarning
    : Colors.statusDanger;

function computeRealtimeMetrics(ppgData: number[], _elapsed: number) {
  if (ppgData.length < 10) {
    return {hr: null, pi: null, hrv: null, ac: null, dc: null};
  }
  // Use last 100 samples (≈10 sec at 10 Hz) for more stable estimates
  const recent = ppgData.slice(-100);
  const maxV = Math.max(...recent);
  const minV = Math.min(...recent);
  const meanV = recent.reduce((a, b) => a + b, 0) / recent.length;
  const ac = maxV - minV;
  const dc = meanV;
  const pi = dc > 0 ? parseFloat(((ac / dc) * 100).toFixed(1)) : null;
  // Peak detection with minimum spacing (10 samples ≈ 1 sec at 10 Hz)
  let peaks = 0;
  let lastPeakIdx = -10;
  for (let i = 1; i < recent.length - 1; i++) {
    if (
      i - lastPeakIdx >= 10 &&
      recent[i] > recent[i - 1] &&
      recent[i] > recent[i + 1] &&
      recent[i] > meanV
    ) {
      peaks++;
      lastPeakIdx = i;
    }
  }
  const windowSecs = recent.length / 10;
  const hrEstimate = peaks > 0 ? Math.round((peaks / windowSecs) * 60) : null;
  const hr = hrEstimate && hrEstimate > 40 && hrEstimate < 180 ? hrEstimate : null;
  // HRV requires full 60s of RR intervals — always show pending during measurement
  return {hr, pi, hrv: null, ac: parseFloat(ac.toFixed(1)), dc: parseFloat(dc.toFixed(1))};
}

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

const MetricCell = ({label, value, unit, pendingText = '측정 중'}: {
  label: string; value: number | null; unit: string; pendingText?: string;
}) => (
  <View style={ms.cell}>
    <Text style={ms.cellLabel}>{label}</Text>
    {value !== null ? (
      <View style={ms.cellValRow}>
        <Text style={ms.cellVal}>{value}</Text>
        {unit ? <Text style={ms.cellUnit}>{unit}</Text> : null}
      </View>
    ) : (
      <Text style={ms.cellPending}>{pendingText}</Text>
    )}
  </View>
);

const ms = StyleSheet.create({
  cell:        {flex: 1, paddingVertical: 12, paddingHorizontal: 14},
  cellLabel:   {fontSize: 11, color: Colors.textSecondary, marginBottom: 4},
  cellValRow:  {flexDirection: 'row', alignItems: 'flex-end', gap: 3},
  cellVal:     {fontSize: 28, fontWeight: '700', color: Colors.textPrimary},
  cellUnit:    {fontSize: 12, color: Colors.textSecondary, paddingBottom: 5},
  cellPending: {fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic', paddingVertical: 6},
});

export const MeasurementScreen: React.FC = () => {
  const {user} = useAuth();
  const userId = user?.id ?? 1;
  const {addLocalNotification} = useNotificationContext();
  const [showResult, setShowResult] = useState(false);
  const [measurementResult, setMeasurementResult] = useState<MeasurementRecord | null>(null);

  const {isRecording, elapsedTime, ppgData, batteryLevel, qcFeedback, qcIsAcceptable, progress,
    startMeasurement, cancelMeasurement} =
    useMeasurement(userId, (result: MeasurementRecord) => {
      setMeasurementResult(result);
      setShowResult(true);
      if (result.analysis) {
        const g = result.analysis.general;
        const d = result.analysis.demographic;
        addLocalNotification({
          type: 'measurement_complete',
          title: '측정 완료',
          body: `심박수 ${g.heartRate} bpm · 상위 ${d.percentile}%`,
          data: {heartRate: g.heartRate, percentile: d.percentile, status: g.status},
        });
      }
    });

  const handleSaveAndClose = async (notes: string, tags: string[]) => {
    if (measurementResult) {
      const measurementId = parseInt(measurementResult.id.replace('measurement_', ''), 10);
      if (!isNaN(measurementId)) {
        try {
          await saveDiaryEntry(measurementId, notes, tags, measurementResult.advice);
        } catch (e) {
          console.warn('Diary save failed:', e);
        }
      }
      setMeasurementResult(prev => prev ? {...prev, notes, tags} : prev);
    }
    setShowResult(false);
  };

  // Update metrics once per second (elapsedTime changes at 1 Hz) — not at every sample (10 Hz)
  const metrics = useMemo(
    () => computeRealtimeMetrics(ppgData, elapsedTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elapsedTime],
  );

  const bColor   = batteryColor(batteryLevel);
  const isActive = isRecording || ppgData.length > 0;
  const chartH   = Math.round(SCREEN_H * 0.28);
  const rawValues = ppgData.slice(-12);

  // ── 초기 화면 ───────────────────────────────────────────────────────────────
  if (!isActive && !showResult) {
    return (
      <View style={styles.container}>
        <View style={styles.initialWrap}>
          <View style={styles.initTopRow}>
            <View style={styles.initBattery}>
              <BatteryIcon level={batteryLevel} color={bColor} />
              <Text style={[styles.initBatteryTxt, {color: bColor}]}>{batteryLevel}%</Text>
            </View>
          </View>
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
            <MeasurementResultScreen record={measurementResult} onSaveAndClose={handleSaveAndClose} />
          )}
        </Modal>
      </View>
    );
  }

  // ── 측정 중 화면 (full-width layout) ────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* 헤더: 타이머 | QC | 배터리 */}
      <View style={styles.recHeader}>
        <Text style={styles.timer}>
          {formatTime(elapsedTime)} / {formatTime(MEASUREMENT_DURATION)}
        </Text>
        <View style={[styles.qcBadge, {backgroundColor: qcIsAcceptable ? '#E6F4EA' : '#FFF3E0'}]}>
          <View style={[styles.qcDot, {backgroundColor: qcIsAcceptable ? Colors.statusGood : Colors.statusWarning}]} />
          <Text style={[styles.qcTxt, {color: qcIsAcceptable ? Colors.statusGood : Colors.statusWarning}]}>
            {qcFeedback || (isRecording ? '신호 분석 중' : '준비됨')}
          </Text>
        </View>
        <View style={styles.batteryRow}>
          <BatteryIcon level={batteryLevel} color={bColor} />
          <Text style={[styles.batteryTxt, {color: bColor}]}>{batteryLevel}%</Text>
        </View>
      </View>

      {/* 진행률 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${progress}%`}]} />
      </View>

      {/* PPG 차트: 전체 너비 */}
      <View style={styles.chartWrap}>
        <PPGChart data={ppgData} isRecording={isRecording} width={SCREEN_W} height={chartH} />
      </View>

      <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
        {/* 2×2 지표 그리드 */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <MetricCell label="심박수" value={metrics.hr} unit="bpm" />
            <View style={styles.metricsDivV} />
            <MetricCell
              label="HRV"
              value={metrics.hrv}
              unit="ms"
              pendingText={elapsedTime < 15 ? '수집 중...' : '계산 중'}
            />
          </View>
          <View style={styles.metricsDivH} />
          <View style={styles.metricsRow}>
            <MetricCell label="PI" value={metrics.pi} unit="%" />
            <View style={styles.metricsDivV} />
            <MetricCell
              label="AC / DC"
              value={metrics.ac !== null ? metrics.ac : null}
              unit={metrics.dc !== null ? `/ ${metrics.dc}` : ''}
              pendingText="수집 중..."
            />
          </View>
        </View>

        {/* 최근 Raw PPG 값 */}
        {rawValues.length > 0 && (
          <View style={styles.rawSection}>
            <Text style={styles.rawLabel}>최근 RAW 값</Text>
            <View style={styles.rawRow}>
              {rawValues.map((v, i) => (
                <View key={i} style={styles.rawChip}>
                  <Text style={styles.rawChipTxt}>{Math.round(v)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* baseline 힌트 */}
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
      </ScrollView>

      {/* 취소 / 다시 시작 버튼 */}
      <View style={styles.ctrlSection}>
        {isRecording ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelMeasurement} activeOpacity={0.85}>
            <Text style={styles.cancelBtnTxt}>측정 중단</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={startMeasurement} activeOpacity={0.85}>
            <Text style={styles.startBtnTxt}>다시 측정</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showResult} animationType="slide">
        {measurementResult && (
          <MeasurementResultScreen record={measurementResult} onSaveAndClose={handleSaveAndClose} />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},

  initialWrap: {
    flex: 1, paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 32,
  },
  initTopRow:     {flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24},
  initBattery:    {flexDirection: 'row', alignItems: 'center', gap: 6},
  initBatteryTxt: {fontSize: 13, fontWeight: '600'},

  initCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 24, alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary, shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  initCardIcon:  {fontSize: 40, marginBottom: 12},
  initCardTitle: {fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8},
  initCardDesc:  {fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22},

  initInfoRow: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 12,
    padding: 16, marginBottom: 28, justifyContent: 'space-around',
  },
  initInfoItem:    {alignItems: 'center'},
  initInfoVal:     {fontSize: 16, fontWeight: '700', color: Colors.primary, marginBottom: 2},
  initInfoKey:     {fontSize: 11, color: Colors.textSecondary},
  initInfoDivider: {width: 1, backgroundColor: Colors.border},

  recHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 12,
    paddingBottom: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  timer:      {fontSize: 15, fontWeight: '700', color: Colors.textPrimary},
  qcBadge:    {flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, gap: 5},
  qcDot:      {width: 6, height: 6, borderRadius: 3},
  qcTxt:      {fontSize: 12, fontWeight: '600'},
  batteryRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  batteryTxt: {fontSize: 12, fontWeight: '600'},

  progressTrack: {height: 3, backgroundColor: Colors.border},
  progressFill:  {height: '100%', backgroundColor: Colors.primary},

  chartWrap:    {borderBottomWidth: 1, borderBottomColor: Colors.border},

  metricsGrid:  {backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border},
  metricsRow:   {flexDirection: 'row'},
  metricsDivV:  {width: 1, backgroundColor: Colors.border},
  metricsDivH:  {height: 1, backgroundColor: Colors.border},

  rawSection:  {paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border},
  rawLabel:    {fontSize: 11, color: Colors.textTertiary, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5},
  rawRow:      {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  rawChip:     {backgroundColor: Colors.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border},
  rawChipTxt:  {fontSize: 11, color: Colors.textSecondary},

  baselineHint: {paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.primaryLight},
  baselineText: {fontSize: 13, fontWeight: '600', color: Colors.primary},

  ctrlSection: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },

  startBtn:     {backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center'},
  startBtnTxt:  {fontSize: 16, fontWeight: '700', color: Colors.white},
  cancelBtn:    {backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border},
  cancelBtnTxt: {fontSize: 16, fontWeight: '600', color: Colors.textSecondary},
});
