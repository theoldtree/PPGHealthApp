/**
 * Custom hook for managing PPG measurement workflow.
 *
 * Mode flag: USE_BLE_SENSOR in src/config/measurement.ts
 * ──────────────────────────────────────────────────────
 * false (default) → mock PPG replay from BUT-PPG dataset
 * true            → real BLE sensor
 *
 * BLE swap guide (when USE_BLE_SENSOR = true)
 * ───────────────────────────────────────────
 *   1. Set USE_BLE_SENSOR = true in src/config/measurement.ts
 *   2. Install BLE library (e.g. react-native-ble-plx)
 *   3. Remove the `dataGeneratorRef` setInterval in `startMeasurement`
 *   4. In your BLE notification callback, call:
 *        injectPPGSample(rawValue)   ← exported from this hook
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
  USE_BLE_SENSOR,
} from '../config/measurement';
import mockPPGData from '../assets/mock_ppg_data.json';

// ── Mock signal helpers (used when USE_BLE_SENSOR = false) ──────────────────
const _mockSignalRate: number = (mockPPGData as any).samplingRate; // 300 Hz
const _mockMeasurements: Array<{ppgSignal: number[]}> = Object.values(
  (mockPPGData as any).measurements,
);
/** Pick a random recording from the BUT-PPG dataset */
const _pickMockSignal = (): number[] =>
  _mockMeasurements[Math.floor(Math.random() * _mockMeasurements.length)]
    .ppgSignal;
/** How many source samples to advance per generator tick (300 Hz / 10 Hz = 30) */
const _samplesPerTick = _mockSignalRate / (1000 / DATA_GENERATION_INTERVAL);

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
  const ppgDataRef       = useRef<number[]>([]);
  const measurementIdRef = useRef<number | null>(null);
  const windowIndexRef   = useRef<number>(0);
  const elapsedRef       = useRef<number>(0);
  /** Stores the randomly selected mock PPG signal for the current session */
  const mockSignalRef    = useRef<number[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
      if (dataSenderRef.current) clearInterval(dataSenderRef.current);
    };
  }, []);

  // ── BLE injection point ─────────────────────────────────────────────────────
  /**
   * Append one PPG sample. Used by both the dummy generator and BLE callbacks.
   * Keep this as the SINGLE place where data enters ppgData.
   */
  const injectPPGSample = useCallback((value: number) => {
    setPpgData(prev => {
      const next = [...prev, value];
      ppgDataRef.current = next;
      return next;
    });
  }, []);

  // ── Data generator (mock replay or sin-wave BLE placeholder) ───────────────
  const generateDummyData = useCallback(() => {
    if (!USE_BLE_SENSOR) {
      // Mock replay: subsample the BUT-PPG signal to DATA_GENERATION_INTERVAL rate
      const ticks = ppgDataRef.current.length;
      const sourceIdx =
        Math.round(ticks * _samplesPerTick) % mockSignalRef.current.length;
      injectPPGSample(mockSignalRef.current[sourceIdx] ?? 0);
    } else {
      // BLE mode: sin-wave placeholder — remove this block when BLE is live
      const newValue = 70 + Math.sin(Date.now() / 1000) * 10 + Math.random() * 5;
      injectPPGSample(Math.round(newValue));
    }

    // Simulate battery drain
    if (Math.random() < 0.01) {
      setBatteryLevel(prev => Math.max(0, prev - 1));
    }
  }, [injectPPGSample]);

  // ── QC sender (uses ref to avoid stale closure) ────────────────────────────
  const sendDataToServer = useCallback(async () => {
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
  const runAnalysis = useCallback(async (mId: number) => {
    try {
      await completeMeasurement(mId, '');

      // BLE mode: use the samples collected during recording at PPG_SAMPLING_RATE
      // Mock mode: use the full 300 Hz BUT-PPG signal for accurate HR/HRV analysis
      const [ppgForAnalysis, sampleRate] = USE_BLE_SENSOR
        ? [ppgDataRef.current.slice(), PPG_SAMPLING_RATE]
        : [mockSignalRef.current, _mockSignalRate];

      const analysisData = await apiAnalyzeMeasurement(
        mId,
        ppgForAnalysis,
        sampleRate,
      );
      const record = convertAnalysisToRecord(analysisData, MEASUREMENT_DURATION);
      onAnalysisComplete(record);
    } catch (error) {
      console.error('Failed to analyze measurement:', error);
      Alert.alert('오류', '분석에 실패했습니다.');
    }
  }, [onAnalysisComplete]);

  // ── Start measurement ───────────────────────────────────────────────────────
  const startMeasurement = async () => {
    try {
      const response = await apiStartMeasurement(userId);
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

      // Mock mode: pick a random BUT-PPG recording for this session
      if (!USE_BLE_SENSOR) {
        mockSignalRef.current = _pickMockSignal();
      }

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
      // Mock mode: replays BUT-PPG signal (see generateDummyData)
      // BLE mode (USE_BLE_SENSOR = true): remove this block and subscribe to
      //   BLE notifications instead → call injectPPGSample(rawValue)
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
    timerRef.current = null;
    dataGeneratorRef.current = null;
    dataSenderRef.current = null;
    setIsRecording(false);

    const mId = measurementIdRef.current;
    if (elapsedRef.current >= MEASUREMENT_DURATION - 1 && mId) {
      runAnalysis(mId);
    }
  };

  // ── Cancel measurement ──────────────────────────────────────────────────────
  const cancelMeasurement = () => {
    Alert.alert('측정 취소', '정말 측정을 취소하시겠습니까?', [
      {text: '아니오', style: 'cancel'},
      {
        text: '예',
        style: 'destructive',
        onPress: () => {
          if (timerRef.current) clearInterval(timerRef.current);
          if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
          if (dataSenderRef.current) clearInterval(dataSenderRef.current);
          timerRef.current = null;
          dataGeneratorRef.current = null;
          dataSenderRef.current = null;
          setIsRecording(false);
          setPpgData([]);
          ppgDataRef.current = [];
          setElapsedTime(0);
          elapsedRef.current = 0;
          setMeasurementId(null);
          measurementIdRef.current = null;
          setQcFeedback('');
        },
      },
    ]);
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
