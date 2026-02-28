/**
 * Measurement Configuration Constants
 */

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

// Data transmission interval to server (ms)
export const DATA_SEND_INTERVAL = 1000; // 1 second

// Data generation interval for dummy data (ms)
export const DATA_GENERATION_INTERVAL = 100; // 100ms = 10Hz

// PPG sensor sampling rate (Hz)
export const PPG_SAMPLING_RATE = 200; // 200Hz (10 samples/packet × 20 packets/sec)

// QC window size (number of samples)
export const QC_WINDOW_SIZE = 400; // 2 seconds at 200Hz

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
