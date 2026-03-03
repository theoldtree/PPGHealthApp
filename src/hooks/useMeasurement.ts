/**
 * Custom hook for managing PPG measurement workflow.
 *
 * Mode flag: USE_BLE_SENSOR in src/config/measurement.ts
 * ──────────────────────────────────────────────────────
 * false (default) → mock PPG replay simulating real BLE packet structure
 *                   (10 samples per 50ms packet, 200 Hz, from mock_ppg_data.json)
 * true            → real BLE sensor
 *
 * BLE swap guide (when USE_BLE_SENSOR = true)
 * ───────────────────────────────────────────
 *   1. Set USE_BLE_SENSOR = true in src/config/measurement.ts
 *   2. Install BLE library (e.g. react-native-ble-plx)
 *   3. Remove the `dataGeneratorRef` setInterval in `startMeasurement`
 *   4. In your BLE notification callback, parse the 24-byte packet and call:
 *        injectPPGSample(rawValue)   ← call once per sample (10 times per packet)
 *   5. Add BLE connect/disconnect in startMeasurement / stopMeasurement
 *
 * Everything else (QC sender, timer, analysis) stays the same.
 */
import {useState, useRef, useEffect, useCallback} from 'react';
import {Alert} from 'react-native';
import {
  startMeasurement as apiStartMeasurement,
  submitQCData,
  completeMeasurement,
  analyzeMeasurement as apiAnalyzeMeasurement,
  saveMockAnalysis,
  convertAnalysisToRecord,
} from '../api/measurements';
import type {MeasurementRecord} from '../types/measurement';
import {
  MEASUREMENT_DURATION,
  DATA_SEND_INTERVAL,
  DATA_GENERATION_INTERVAL,
  QC_WINDOW_SIZE,
  MIN_DATA_POINTS,
  PPG_SAMPLING_RATE,
  BLE_SAMPLES_PER_PACKET,
  USE_BLE_SENSOR,
  MIN_MEASUREMENT_SECONDS,
  USE_MOCK_MEASUREMENT,
  SKIP_AUTH,
} from '../config/measurement';
import mockPPGData from '../assets/mock_ppg_data.json';

// ── Mock signal helpers (used when USE_BLE_SENSOR = false) ──────────────────
/** Source data rate of mock_ppg_data.json (300 Hz) */
const _mockSignalRate: number = (mockPPGData as any).samplingRate;
const _mockMeasurements: Array<{ppgSignal: number[]}> = Object.values(
  (mockPPGData as any).measurements,
);
/** Pick a random recording for this session */
const _pickMockSignal = (): number[] =>
  _mockMeasurements[Math.floor(Math.random() * _mockMeasurements.length)]
    .ppgSignal;
/**
 * Source samples to advance per BLE packet tick (300 Hz source → 200 Hz output).
 * Per 50ms: source spans 300 * 0.05 = 15 samples → resample to 10 output samples.
 */
const _sourceSamplesPerPacket = Math.round(_mockSignalRate * DATA_GENERATION_INTERVAL / 1000); // 15
const _resampleStep = _sourceSamplesPerPacket / BLE_SAMPLES_PER_PACKET; // 1.5

/** Samples shown in chart (last 3 s at 200 Hz = 600 samples) */
const CHART_DISPLAY_SAMPLES = 600;

// ── Local mock analysis (used when USE_MOCK_MEASUREMENT = true) ────────────────────────
function _mockAdvice(hr: number, hrv: number): string {
  if (hr > 90) return '심박수가 다소 높습니다. 심호흡과 충분한 휴식을 취해보세요.';
  if (hrv < 30) return 'HRV가 낮습니다. 스트레스 관리와 규칙적인 수면이 도움이 됩니다.';
  if (hr >= 60 && hr <= 80 && hrv >= 50) return '심박수와 HRV가 모두 양호합니다. 현재 건강 상태를 잘 유지하고 있습니다.';
  return '전반적으로 양호한 상태입니다. 꾸준한 유산소 운동이 심혈관 건강에 도움이 됩니다.';
}

function _buildMockRecord(signal: number[], duration: number, mId?: number): MeasurementRecord {
  const samples = signal.length > 0 ? signal : Array.from({length: 100}, (_, i) => 70 + Math.sin(i / 10) * 10);
  const max = Math.max(...samples);
  const min = Math.min(...samples);
  const ac = max - min;
  const dc = samples.reduce((a, b) => a + b, 0) / samples.length;
  const pi = dc > 0 ? parseFloat(((ac / dc) * 100).toFixed(1)) : 1.2;

  // Count peaks (local max above mean) with minimum spacing of 30 samples
  let peaks = 0;
  let lastPeakIdx = -30;
  for (let i = 1; i < samples.length - 1; i++) {
    if (
      i - lastPeakIdx >= 30 &&
      samples[i] > samples[i - 1] &&
      samples[i] > samples[i + 1] &&
      samples[i] > dc
    ) {
      peaks++;
      lastPeakIdx = i;
    }
  }
  const signalDurationS = samples.length / PPG_SAMPLING_RATE;
  const rawHR = peaks > 0 ? Math.round((peaks / signalDurationS) * 60) : 72;
  const heartRate = rawHR > 40 && rawHR < 180 ? rawHR : 72;
  const hrv = Math.round(25 + Math.random() * 40);

  let status: 'excellent' | 'good' | 'normal' | 'poor';
  if (heartRate >= 60 && heartRate <= 80 && hrv >= 50) { status = 'excellent'; }
  else if (heartRate >= 55 && heartRate <= 90 && hrv >= 30) { status = 'good'; }
  else if (heartRate >= 50 && heartRate <= 100) { status = 'normal'; }
  else { status = 'poor'; }

  const percentile = Math.round(30 + Math.random() * 50);
  const ageGroupAvg = 72;
  const genderGroupAvg = 70;
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return {
    id: mId ? `measurement_${mId}` : `mock_${Date.now()}`,
    userId: 'mock_user',
    date: localDate,
    time: now.toTimeString().split(' ')[0],
    timestamp: now.getTime(),
    duration,
    advice: _mockAdvice(heartRate, hrv),
    analysis: {
      general: {
        heartRate,
        hrv,
        hrvRmssd: Math.round(hrv * 0.85 + Math.random() * 5),   // RMSSD ~ 0.85×SDNN
        pi,
        ac: parseFloat(ac.toFixed(1)),
        dc: parseFloat(dc.toFixed(1)),
        apgBOverA: parseFloat((-0.30 - Math.random() * 0.15).toFixed(3)),  // mock: -0.30 ~ -0.45
        apgAI: parseFloat((-0.05 - Math.random() * 0.10).toFixed(3)),
        status,
      },
      personal: {
        heartRateDiff: heartRate - 74,
        hrvDiff: hrv - 45,
        trend: 'stable',
      },
      demographic: {
        percentile,
        ageGroupAvg,
        genderGroupAvg,
        comparison: percentile >= 60 ? 'above_average' : percentile >= 40 ? 'average' : 'below_average',
        apgBOverARef: -0.33,   // Takazawa mock reference (30s age group)
        apgBOverAStd: 0.14,
        avgHrvSdnn: 44,        // literature avg for 30s age group (Task Force 1996)
        stdHrvSdnn: 14,
      },
    },
  };
}

export interface UseMeasurementResult {
  isRecording: boolean;
  elapsedTime: number;
  ppgData: number[];
  batteryLevel: number;
  qcFeedback: string;
  qcIsAcceptable: boolean;
  progress: number;
  /** BLE hook-in: call this from BLE notification callback with each sample value */
  injectPPGSample: (value: number) => void;
  startMeasurement: () => Promise<void>;
  stopMeasurement: () => void;
  cancelMeasurement: () => void;
}

export const useMeasurement = (
  userId: number,
  onAnalysisComplete: (result: MeasurementRecord) => void,
): UseMeasurementResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [ppgData, setPpgData] = useState<number[]>([]);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [qcFeedback, setQcFeedback] = useState<string>('');
  const [qcIsAcceptable, setQcIsAcceptable] = useState<boolean>(true);
  const [measurementId, setMeasurementId] = useState<number | null>(null);
  const [windowIndex, setWindowIndex] = useState(0);

  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataGeneratorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataSenderRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const ppgDataRef       = useRef<number[]>([]);
  const measurementIdRef = useRef<number | null>(null);
  const windowIndexRef   = useRef<number>(0);
  const elapsedRef       = useRef<number>(0);
  /** Stores the randomly selected mock PPG signal for the current session */
  const mockSignalRef       = useRef<number[]>([]);
  /** Position in mock source signal — advances by _sourceSamplesPerPacket per tick */
  const sourcePositionRef   = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
      if (dataSenderRef.current) clearInterval(dataSenderRef.current);
      if (displayTimerRef.current) clearInterval(displayTimerRef.current);
    };
  }, []);

  // ── BLE injection point ─────────────────────────────────────────────────────
  /**
   * Append one PPG sample to the raw buffer.
   * Used by both the mock packet generator and real BLE callbacks.
   * O(1) — does NOT trigger a React re-render; chart is updated by displayTimerRef.
   */
  const injectPPGSample = useCallback((value: number) => {
    ppgDataRef.current.push(value);
  }, []);

  // ── Data generator (mock BLE packet replay or sin-wave placeholder) ─────────
  /**
   * Simulates one BLE packet arrival (50ms interval, 10 samples per packet).
   *
   * Mock mode (USE_BLE_SENSOR = false):
   *   Reads BLE_SAMPLES_PER_PACKET (10) samples from mock_ppg_data.json,
   *   resampling 300 Hz source → 200 Hz output via linear index stepping.
   *
   * BLE mode (USE_BLE_SENSOR = true):
   *   Remove this interval entirely and call injectPPGSample(rawValue)
   *   once per sample inside your BLE characteristic notification callback.
   */
  const generateDummyData = useCallback(() => {
    if (!USE_BLE_SENSOR) {
      // Mock replay: emit 10 samples resampled from 300 Hz source to 200 Hz
      const signal = mockSignalRef.current;
      const srcBase = sourcePositionRef.current;
      for (let i = 0; i < BLE_SAMPLES_PER_PACKET; i++) {
        const srcIdx = Math.round(srcBase + i * _resampleStep) % signal.length;
        injectPPGSample(signal[srcIdx] ?? 0);
      }
      sourcePositionRef.current = (srcBase + _sourceSamplesPerPacket) % signal.length;
    } else {
      // BLE placeholder: sin-wave — replace with real BLE when hardware is ready
      for (let i = 0; i < BLE_SAMPLES_PER_PACKET; i++) {
        const newValue = 70 + Math.sin(Date.now() / 1000) * 10 + Math.random() * 5;
        injectPPGSample(Math.round(newValue));
      }
    }

    // Simulate battery drain
    if (Math.random() < 0.01) {
      setBatteryLevel(prev => Math.max(0, prev - 1));
    }
  }, [injectPPGSample]);

  // ── QC sender (uses ref to avoid stale closure) ────────────────────────────
  const sendDataToServer = useCallback(async () => {
    // USE_MOCK_MEASUREMENT: simulate QC locally without hitting the server
    if (USE_MOCK_MEASUREMENT) {
      const recentData = ppgDataRef.current.slice(-20);
      if (recentData.length >= MIN_DATA_POINTS) {
        const max = Math.max(...recentData);
        const min = Math.min(...recentData);
        const snr = max - min;
        const isGood = snr > 5;
        setQcFeedback(isGood ? '신호 양호' : '신호 약함 — 손가락 위치 조정');
        setQcIsAcceptable(isGood);
        const idx = windowIndexRef.current + 1;
        windowIndexRef.current = idx;
        setWindowIndex(idx);
      }
      return;
    }

    const mId = measurementIdRef.current;
    if (!mId) return;

    try {
      const recentData = ppgDataRef.current.slice(-20);   // ← ref, not state
      if (recentData.length >= MIN_DATA_POINTS) {
        const paddedData = new Array(QC_WINDOW_SIZE).fill(0).map((_, i) => {
          const src = Math.floor((i * recentData.length) / QC_WINDOW_SIZE);
          return recentData[src] || recentData[0];
        });

        const idx = windowIndexRef.current;
        const qcResponse = await submitQCData(
          mId,
          idx,
          elapsedRef.current,
          paddedData,
          batteryLevel,
        );

        setQcFeedback(qcResponse.feedback_message || '측정 중...');
        setQcIsAcceptable(qcResponse.is_acceptable);
        windowIndexRef.current = idx + 1;
        setWindowIndex(idx + 1);
      }
    } catch (error) {
      console.error('Failed to send QC data:', error);
    }
  }, [batteryLevel]);

  // ── Analysis after measurement completes ───────────────────────────────────
  const runAnalysis = useCallback(async (mId: number, duration: number = MEASUREMENT_DURATION) => {
    // Step 1: mark measurement completed in DB (always)
    try { await completeMeasurement(mId, ''); } catch { /* ignore */ }

    // Both BLE and mock modes accumulate data into ppgDataRef at PPG_SAMPLING_RATE (200 Hz)
    const ppgForAnalysis = ppgDataRef.current.slice();
    const sampleRate = PPG_SAMPLING_RATE;

    if (USE_MOCK_MEASUREMENT) {
      // Step 2a (mock): build result locally for immediate display
      const record = _buildMockRecord(ppgDataRef.current.slice(), duration, mId);
      onAnalysisComplete(record);

      // Step 2b: save pre-computed mock values to backend asynchronously.
      // We do NOT re-send the raw PPG signal (which is binary WFDB gain-encoded
      // and would produce garbage HR/HRV/PI values when re-processed by the backend).
      if (record.analysis) {
        const g = record.analysis.general;
        const d = record.analysis.demographic;
        saveMockAnalysis(mId, {
          heart_rate:       g.heartRate,
          hrv_sdnn:         g.hrv,
          hrv_rmssd:        g.hrvRmssd,
          pi:               g.pi,
          ac:               g.ac,
          dc:               g.dc,
          apg_b_over_a:     g.apgBOverA,
          apg_ai:           g.apgAI,
          status:           g.status,
          percentile:       d.percentile,
          age_group_avg:    d.ageGroupAvg,
          gender_group_avg: d.genderGroupAvg,
        }).catch(err => {
          console.warn('Background mock analysis save failed:', err);
        });
      }
      return;
    }

    // Step 2 (real mode): wait for backend analysis and use its result
    try {
      const analysisData = await apiAnalyzeMeasurement(
        mId,
        ppgForAnalysis,
        sampleRate,
      );
      const record = convertAnalysisToRecord(analysisData, duration);
      onAnalysisComplete(record);
    } catch (error) {
      console.error('Failed to analyze measurement:', error);
      Alert.alert('오류', '분석에 실패했습니다.');
    }
  }, [onAnalysisComplete]);

  // ── Start measurement ───────────────────────────────────────────────────────
  const startMeasurement = async () => {
    try {
      // Always call start to get a real DB measurement_id (needed for diary save)
      // In mock mode we skip QC/analyze but keep start/complete to track in DB
      const response = await apiStartMeasurement(userId, SKIP_AUTH);
      const mId = response.measurement_id;
      setMeasurementId(mId);
      measurementIdRef.current = mId;
      windowIndexRef.current = 0;
      setWindowIndex(0);
      setQcFeedback('측정 시작됨');
      setIsRecording(true);
      setElapsedTime(0);
      elapsedRef.current = 0;
      setPpgData([]);
      ppgDataRef.current = [];

      // Mock mode: pick a random recording and reset source position
      if (!USE_BLE_SENSOR) {
        mockSignalRef.current = _pickMockSignal();
        sourcePositionRef.current = 0;
      }

      // Display timer: updates chart at 10 Hz showing the last CHART_DISPLAY_SAMPLES
      displayTimerRef.current = setInterval(() => {
        const buf = ppgDataRef.current;
        setPpgData(buf.length > CHART_DISPLAY_SAMPLES
          ? buf.slice(-CHART_DISPLAY_SAMPLES)
          : buf.slice());
      }, 100);

      // Timer
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedTime(prev => {
          if (prev >= MEASUREMENT_DURATION - 1) {
            stopMeasurement();
            return MEASUREMENT_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

      // ── Data generator ────────────────────────────────────────────────────
      // Mock mode: simulates BLE packets (10 samples per 50ms, 200 Hz)
      // BLE mode (USE_BLE_SENSOR = true): remove this block, subscribe to
      //   BLE notifications, parse 24-byte packet → call injectPPGSample(v)
      dataGeneratorRef.current = setInterval(() => {
        generateDummyData();
      }, DATA_GENERATION_INTERVAL);
      // ── End data generator ────────────────────────────────────────────────

      // QC sender
      dataSenderRef.current = setInterval(() => {
        sendDataToServer();
      }, DATA_SEND_INTERVAL);
    } catch (error) {
      console.error('Failed to start measurement:', error);
      Alert.alert('오류', '측정을 시작할 수 없습니다.');
    }
  };

  // ── Stop measurement ────────────────────────────────────────────────────────
  const stopMeasurement = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
    if (dataSenderRef.current) clearInterval(dataSenderRef.current);
    if (displayTimerRef.current) clearInterval(displayTimerRef.current);
    timerRef.current = null;
    dataGeneratorRef.current = null;
    dataSenderRef.current = null;
    displayTimerRef.current = null;
    setIsRecording(false);

    const mId = measurementIdRef.current;
    if (elapsedRef.current >= MEASUREMENT_DURATION - 1 && mId) {
      runAnalysis(mId);
    }
  };

  // ── Cancel measurement ──────────────────────────────────────────────────────
  const cancelMeasurement = () => {
    const elapsed = elapsedRef.current;
    const mId = measurementIdRef.current;

    /** Stop all intervals and mark as not recording */
    const stopIntervals = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
      if (dataSenderRef.current) clearInterval(dataSenderRef.current);
      if (displayTimerRef.current) clearInterval(displayTimerRef.current);
      timerRef.current = null;
      dataGeneratorRef.current = null;
      dataSenderRef.current = null;
      displayTimerRef.current = null;
      setIsRecording(false);
    };

    /** Fully discard the measurement and reset all state */
    const discardMeasurement = () => {
      stopIntervals();
      setPpgData([]);
      ppgDataRef.current = [];
      setElapsedTime(0);
      elapsedRef.current = 0;
      setMeasurementId(null);
      measurementIdRef.current = null;
      setQcFeedback('');
    };

    if (elapsed < MIN_MEASUREMENT_SECONDS) {
      // Too short — offer to continue or discard
      Alert.alert(
        '측정 시간 부족',
        `정확한 분석을 위해 최소 ${MIN_MEASUREMENT_SECONDS}초 이상 측정해야 합니다.\n(현재 ${elapsed}초)`,
        [
          {text: '계속 측정', style: 'cancel'},
          {
            text: '측정 취소',
            style: 'destructive',
            onPress: discardMeasurement,
          },
        ],
      );
    } else {
      // Enough data — offer to complete with current data, or discard
      Alert.alert(
        '측정 중단',
        `지금까지 ${elapsed}초 측정된 데이터로\n분석을 완료하시겠습니까?`,
        [
          {text: '계속 측정', style: 'cancel'},
          {
            text: '데이터 버리기',
            style: 'destructive',
            onPress: discardMeasurement,
          },
          {
            text: '현재까지 분석',
            onPress: () => {
              stopIntervals();
              if (mId) {
                runAnalysis(mId, elapsed);
              }
            },
          },
        ],
      );
    }
  };

  const progress = (elapsedTime / MEASUREMENT_DURATION) * 100;

  return {
    isRecording,
    elapsedTime,
    ppgData,
    batteryLevel,
    qcFeedback,
    qcIsAcceptable,
    progress,
    injectPPGSample,
    startMeasurement,
    stopMeasurement,
    cancelMeasurement,
  };
};
