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
import {saveLocalRecord} from '../utils/localCache';
import {
  MEASUREMENT_DURATION,
  DATA_SEND_INTERVAL,
  DATA_GENERATION_INTERVAL,
  QC_WINDOW_SIZE,
  MIN_DATA_POINTS,
  PPG_SAMPLING_RATE,
  BLE_SAMPLES_PER_PACKET,
  BLE_PACKET_SIZE,
  BLE_PPG_FIELD_SIZE,
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

/**
 * Max data points sent to PPGChart state (downsampled from the full buffer).
 * 60s × 240Hz = 14,400 raw samples → downsample to 480 visual points.
 */
const CHART_RENDER_POINTS = 480;

// ── BLE packet codec (mock and real sensor share the same parser) ─────────────
/**
 * 20-byte BLE PPG packet layout (루트스 BLE hardware spec):
 *   [0]     Sync  — 0xAA (1 byte)
 *   [1–2]   Index — uint16 LE, increments per packet (2 bytes)
 *   [3–17]  PPG   — 12 × 10-bit ADC values, MSB-first bit-packed (15 bytes)
 *   [18]    BAT   — battery level 0–100 % (1 byte)
 *   [19]    CRC   — XOR of bytes 0–18 (1 byte)
 *
 * Real BLE mode:
 *   BLE characteristic notification callback receives the raw 20-byte packet
 *   → call injectBLEPacket(packet).  The hook parses it and feeds each of the
 *   12 ADC samples into ppgDataRef.
 *
 * Mock mode:
 *   generateDummyData takes 12 floats from mock_ppg_data.json, encodes them
 *   into this exact 20-byte format via _buildBLEPacket, then calls
 *   injectBLEPacket — same code path as real BLE.
 */
const BLE_SYNC_BYTE = 0xAA;

/**
 * BUT-PPG dataset is 0–1 normalized (AC only, mean ≈ 0.168).
 * To simulate realistic 10-bit ADC output:
 *   ADC = DC_OFFSET + (float − float_mean) × AC_SCALE
 *   DC_OFFSET = 512  (mid-scale, typical reflectance PPG baseline)
 *   AC_SCALE  = 25   → peak-to-peak AC ≈ 25 ADC counts → PI ≈ 4.9%
 *   (real fingertip PPG PI ≈ 1–10 %; 4.9 % is physiologically plausible)
 */
const _MOCK_ADC_DC     = 512;    // 10-bit mid-scale DC baseline
const _MOCK_ADC_AC     = 25;     // ADC counts per unit deviation from signal mean
const _MOCK_FLOAT_MEAN = 0.168;  // empirical mean of BUT-PPG normalized signal

/**
 * Parse a 20-byte BLE PPG packet.
 * Returns { samples: 12 ADC values (0–1023), battery: 0–100 } or null on error.
 */
function parseBLEPacket(
  packet: Uint8Array,
): {samples: number[]; battery: number} | null {
  if (packet.length !== BLE_PACKET_SIZE) {return null;}
  if (packet[0] !== BLE_SYNC_BYTE)       {return null;}

  // CRC check: XOR of bytes 0–18 must equal byte 19
  let crc = 0;
  for (let i = 0; i < BLE_PACKET_SIZE - 1; i++) {crc ^= packet[i];}
  if (crc !== packet[BLE_PACKET_SIZE - 1]) {return null;}

  // Unpack 12 × 10-bit samples from 15-byte PPG field (MSB first)
  const ppgStart = 3; // after sync(1) + index(2)
  const samples: number[] = [];
  let bitBuf = 0;
  let bitsAvail = 0;
  for (let b = 0; b < BLE_PPG_FIELD_SIZE; b++) {
    bitBuf = (bitBuf << 8) | packet[ppgStart + b];
    bitsAvail += 8;
    while (bitsAvail >= 10) {
      bitsAvail -= 10;
      samples.push((bitBuf >> bitsAvail) & 0x3FF);
    }
  }

  const battery = packet[18];
  return {samples, battery};
}

/**
 * Build a mock 20-byte BLE packet.
 * adcSamples: 12 values in 0–1023 (10-bit).
 * index: packet counter (uint16, wraps).
 * battery: 0–100 %.
 */
function _buildBLEPacket(
  adcSamples: number[],
  index: number,
  battery: number,
): Uint8Array {
  const pkt = new Uint8Array(BLE_PACKET_SIZE);
  pkt[0] = BLE_SYNC_BYTE;
  pkt[1] = index & 0xFF;
  pkt[2] = (index >> 8) & 0xFF;

  // Pack 12 × 10-bit MSB-first into 15-byte PPG field
  let bitBuf = 0;
  let bitsBuffered = 0;
  let byteIdx = 3;
  for (let i = 0; i < BLE_SAMPLES_PER_PACKET; i++) {
    const v = Math.max(0, Math.min(0x3FF, adcSamples[i] ?? 0));
    bitBuf = (bitBuf << 10) | v;
    bitsBuffered += 10;
    while (bitsBuffered >= 8) {
      bitsBuffered -= 8;
      pkt[byteIdx++] = (bitBuf >> bitsBuffered) & 0xFF;
    }
  }
  // Flush remaining bits (15 bytes × 8 = 120 bits, 12 × 10 = 120 bits → no remainder)

  pkt[18] = Math.max(0, Math.min(100, battery));

  // CRC: XOR of bytes 0–18
  let crc = 0;
  for (let i = 0; i < BLE_PACKET_SIZE - 1; i++) {crc ^= pkt[i];}
  pkt[19] = crc;

  return pkt;
}

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
  ppgDisplayData: number[];   // raw float values (0–1) for chart display
  batteryLevel: number;
  qcFeedback: string;
  qcIsAcceptable: boolean;
  progress: number;
  /**
   * BLE packet injection point.
   * Call this from the BLE characteristic notification callback with the raw
   * 20-byte packet bytes. In mock mode this is called internally with the
   * same packet format built from mock_ppg_data.json.
   */
  injectBLEPacket: (packet: Uint8Array) => void;
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
  const [ppgDisplayData, setPpgDisplayData] = useState<number[]>([]);
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
  const ppgDisplayRef    = useRef<number[]>([]);   // raw float values for chart
  const measurementIdRef = useRef<number | null>(null);
  const windowIndexRef   = useRef<number>(0);
  const elapsedRef       = useRef<number>(0);
  /** Stores the randomly selected mock PPG signal for the current session */
  const mockSignalRef       = useRef<number[]>([]);
  /** Position in mock source signal — advances by _sourceSamplesPerPacket per tick */
  const sourcePositionRef   = useRef<number>(0);
  /** BLE packet Index field (uint16, wraps 0–65535) */
  const packetIndexRef      = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
      if (dataSenderRef.current) clearInterval(dataSenderRef.current);
      if (displayTimerRef.current) clearInterval(displayTimerRef.current);
    };
  }, []);

  // ── BLE injection points ─────────────────────────────────────────────────────
  /**
   * Internal: append one ADC sample to the raw buffer.
   * Called only from injectBLEPacket after parsing.
   * O(1) — no re-render; chart is updated by displayTimerRef.
   */
  const injectPPGSample = useCallback((value: number) => {
    ppgDataRef.current.push(value);
  }, []);

  /**
   * Public BLE hook-in — call this with the raw 20-byte packet from the BLE
   * characteristic notification callback.
   *
   * Parses sync, index, 12×10-bit PPG samples, battery, and CRC.
   * On CRC error the packet is silently discarded.
   * In real BLE mode (USE_BLE_SENSOR=true) battery level is read from the packet.
   * In mock mode the packet is built by generateDummyData in the same format.
   */
  const injectBLEPacket = useCallback((packet: Uint8Array) => {
    const result = parseBLEPacket(packet);
    if (!result) {return;}
    result.samples.forEach(s => injectPPGSample(s));
    if (USE_BLE_SENSOR) {
      setBatteryLevel(result.battery);
    }
  }, [injectPPGSample]);

  // ── Data generator (mock BLE packet replay or placeholder) ───────────────────
  /**
   * Simulates one BLE packet arrival every DATA_GENERATION_INTERVAL ms (50ms).
   * 12 samples per packet × 20 packets/sec = 240 Hz output.
   *
   * Mock mode (USE_BLE_SENSOR = false):
   *   Reads 12 samples from mock_ppg_data.json (300 Hz source → 240 Hz output,
   *   _sourceSamplesPerPacket = 15 source frames per tick, step = 1.25).
   *   Encodes each float to 10-bit ADC, packs into a 20-byte BLE packet,
   *   then calls injectBLEPacket — identical parse path to real hardware.
   *
   * BLE mode (USE_BLE_SENSOR = true):
   *   Remove this interval entirely. Subscribe to the BLE characteristic and
   *   call injectBLEPacket(rawBytes) in the notification callback.
   */
  const generateDummyData = useCallback(() => {
    if (!USE_BLE_SENSOR) {
      // Encode 12 mock float samples → 10-bit ADC → 20-byte BLE packet
      const signal  = mockSignalRef.current;
      const srcBase = sourcePositionRef.current;
      const adcSamples: number[] = [];
      for (let i = 0; i < BLE_SAMPLES_PER_PACKET; i++) {
        const srcIdx = Math.round(srcBase + i * _resampleStep) % signal.length;
        const f = signal[srcIdx] ?? _MOCK_FLOAT_MEAN;
        ppgDisplayRef.current.push(f);   // raw float for analysis (_buildMockRecord)
        // Map float [0,1] → 10-bit ADC [0,1023] directly — preserves full signal range
        adcSamples.push(Math.round(Math.max(0, Math.min(0x3FF, f * 0x3FF))));
      }
      const idx = packetIndexRef.current;
      const pkt = _buildBLEPacket(adcSamples, idx, 100 /* battery in mock */);
      packetIndexRef.current = (idx + 1) & 0xFFFF;
      injectBLEPacket(pkt);
      sourcePositionRef.current = (srcBase + _sourceSamplesPerPacket) % signal.length;
    }
    // USE_BLE_SENSOR = true: no data generation; real packets arrive via injectBLEPacket

    // Simulate battery drain in mock mode
    if (!USE_BLE_SENSOR && Math.random() < 0.01) {
      setBatteryLevel(prev => Math.max(0, prev - 1));
    }
  }, [injectBLEPacket]);

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
      // Step 2a (mock): build result from raw float values for accurate analysis
      const floatSignal = ppgDisplayRef.current.length > 0
        ? ppgDisplayRef.current.slice()
        : ppgDataRef.current.slice();
      const record = _buildMockRecord(floatSignal, duration, mId);

      // Step 2b: cache to AsyncStorage immediately (works without backend)
      saveLocalRecord(record).catch(() => {/* silent */});

      // Step 2c: save pre-computed mock values to backend.
      // Await this so DiaryScreen sees the analysis data when the user navigates there.
      // (without await, a race condition can cause the diary to load before heart_rate is saved)
      if (record.analysis) {
        const g = record.analysis.general;
        const d = record.analysis.demographic;
        try {
          await saveMockAnalysis(mId, {
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
          });
        } catch (err) {
          console.warn('Mock analysis save failed (result still shown from local):', err);
        }
      }

      // Step 2d: show result (after backend save so diary is in sync)
      onAnalysisComplete(record);
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
      setPpgDisplayData([]);
      ppgDataRef.current = [];
      ppgDisplayRef.current = [];

      // Mock mode: pick a random recording and reset source position
      if (!USE_BLE_SENSOR) {
        mockSignalRef.current = _pickMockSignal();
        sourcePositionRef.current = 0;
        packetIndexRef.current = 0;
      }

      // Display timer: updates chart at 10 Hz with downsampled full buffer.
      // Downsampling keeps the state payload small while showing the entire recording.
      displayTimerRef.current = setInterval(() => {
        // ADC values → metrics (HR, PI, etc.)
        const buf = ppgDataRef.current;
        if (buf.length > 0) {
          if (buf.length > CHART_RENDER_POINTS) {
            const step = Math.floor(buf.length / CHART_RENDER_POINTS);
            setPpgData(Array.from({length: CHART_RENDER_POINTS}, (_, i) => buf[i * step]));
          } else {
            setPpgData(buf.slice());
          }
        }

        // Float values → chart display (raw signal, not ADC-encoded)
        const disp = USE_BLE_SENSOR ? ppgDataRef.current : ppgDisplayRef.current;
        if (disp.length === 0) { return; }
        if (disp.length > CHART_RENDER_POINTS) {
          const step = Math.floor(disp.length / CHART_RENDER_POINTS);
          setPpgDisplayData(Array.from({length: CHART_RENDER_POINTS}, (_, i) => disp[i * step]));
        } else {
          setPpgDisplayData(disp.slice());
        }
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
      setPpgDisplayData([]);
      ppgDataRef.current = [];
      ppgDisplayRef.current = [];
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
    ppgDisplayData,
    batteryLevel,
    qcFeedback,
    qcIsAcceptable,
    progress,
    injectBLEPacket,
    startMeasurement,
    stopMeasurement,
    cancelMeasurement,
  };
};
