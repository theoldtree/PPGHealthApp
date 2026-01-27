/**
 * Measurement Configuration Constants
 */

// Measurement duration in seconds
export const MEASUREMENT_DURATION = 60; // 1 minute

// Data transmission interval to server (ms)
export const DATA_SEND_INTERVAL = 1000; // 1 second

// Data generation interval for dummy data (ms)
export const DATA_GENERATION_INTERVAL = 100; // 100ms = 10Hz

// PPG sensor sampling rate (Hz)
export const PPG_SAMPLING_RATE = 300; // 300Hz

// QC window size (number of samples)
export const QC_WINDOW_SIZE = 600; // 2 seconds at 300Hz

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
