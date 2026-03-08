/**
 * Measurement Configuration Constants
 */

/**
 * DEV: Skip authentication entirely (mock login).
 * true  = bypass login/signup → go straight to main app with a mock user
 * false = normal auth flow (login / signup required)
 *
 * Set to false before production build.
 */
export const SKIP_AUTH = true;

/**
 * DEV: Use local mock data for measurement (no backend API calls).
 * true  = skip /start, /qc-data, /complete, /analyze → compute result locally
 * false = real backend API calls (requires running server + valid JWT)
 *
 * Independent from SKIP_AUTH. Set to false when backend is ready to test.
 */
export const USE_MOCK_MEASUREMENT = true;

/**
 * BLE mode flag.
 * false = mock PPG replay (BUT-PPG dataset, for dev/demo)
 * true  = real BLE sensor (set this when hardware is ready)
 *
 * When switching to BLE:
 *  1. Set USE_BLE_SENSOR = true
 *  2. Remove dataGeneratorRef interval in useMeasurement.startMeasurement
 *  3. Subscribe to BLE notifications, call injectPPGSample(rawValue) in the callback
 */
export const USE_BLE_SENSOR = false;

// Measurement duration in seconds
export const MEASUREMENT_DURATION = 60; // 1 minute

/**
 * Minimum seconds required to save a measurement result.
 * Below this threshold, cancelling simply discards data.
 * 15s is enough for ~10 heart beats → reliable HR estimate.
 */
export const MIN_MEASUREMENT_SECONDS = 15;

// Data transmission interval to server (ms)
export const DATA_SEND_INTERVAL = 1000; // 1 second

// BLE packet interval (ms) — one packet = BLE_SAMPLES_PER_PACKET samples
export const DATA_GENERATION_INTERVAL = 50; // 50ms = 20 packets/sec

/**
 * BLE packet layout (20 bytes total):
 *   [0]    Sync  (1 byte)  — 0xAA
 *   [1–2]  Index (2 bytes) — uint16 LE, increments per packet
 *   [3–17] PPG   (15 bytes)— 12 × 10-bit ADC values, MSB-first bit-packed
 *   [18]   BAT   (1 byte)  — battery level (0–100 %)
 *   [19]   CRC   (1 byte)  — XOR of bytes 0–18
 */
export const BLE_PACKET_SIZE      = 20;   // total bytes per BLE packet
export const BLE_PPG_FIELD_SIZE   = 15;   // PPG field bytes (12 × 10-bit)
// Samples per BLE packet: 12 measurements packed into 15 bytes (12 × 10bit = 120bit)
export const BLE_SAMPLES_PER_PACKET = 12;

// PPG sensor sampling rate (Hz): 12 samples/packet × 20 packets/sec = 240 Hz
export const PPG_SAMPLING_RATE = 240;

// QC window size (number of samples): 2 seconds at 200 Hz
export const QC_WINDOW_SIZE = 400;

// Minimum data points required before sending
export const MIN_DATA_POINTS = 10;

// Battery level thresholds
export const BATTERY_THRESHOLD_GOOD = 50; // > 50% is good
export const BATTERY_THRESHOLD_LOW = 20; // > 20% is warning, <= 20% is critical

// Health metric reference ranges
export const HEART_RATE_RANGE = {
  min: 60,
  max: 100,
} as const;

export const HRV_RANGE = {
  low: 30,
  normal: 60,
  high: 100,
} as const;

export const STRESS_RANGE = {
  low: 30,
  moderate: 60,
  high: 100,
} as const;
