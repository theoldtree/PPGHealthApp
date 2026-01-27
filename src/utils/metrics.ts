/**
 * Utility functions for health metrics evaluation and formatting
 */
import {HEART_RATE_RANGE, HRV_RANGE, STRESS_RANGE} from '../config/measurement';

export interface MetricStatus {
  text: string;
  color: string;
}

/**
 * Evaluate heart rate and return status with color
 * Reference range: 60-100 bpm
 */
export const getHeartRateStatus = (hr: number): MetricStatus => {
  if (hr < HEART_RATE_RANGE.min) return {text: '정상 범위 하한', color: '#FF9500'};
  if (hr <= HEART_RATE_RANGE.max) return {text: '정상 범위', color: '#34C759'};
  return {text: '정상 범위 상한', color: '#FF3B30'};
};

/**
 * Evaluate HRV (Heart Rate Variability) and return status with color
 * Reference range: 30-100 ms (higher is better)
 */
export const getHRVStatus = (hrv: number): MetricStatus => {
  if (hrv < HRV_RANGE.low) return {text: '낮음', color: '#FF3B30'};
  if (hrv <= HRV_RANGE.normal) return {text: '정상', color: '#34C759'};
  return {text: '우수', color: '#007AFF'};
};

/**
 * Evaluate stress level and return status with color
 * Reference range: 0-100 (lower is better)
 */
export const getStressStatus = (stress: number): MetricStatus => {
  if (stress <= STRESS_RANGE.low) return {text: '낮음', color: '#34C759'};
  if (stress <= STRESS_RANGE.moderate) return {text: '보통', color: '#FF9500'};
  return {text: '높음', color: '#FF3B30'};
};

/**
 * Format time in mm:ss format
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get comparison text for personal average difference
 */
export const getComparisonText = (
  diff: number,
  unit: string,
  higherIsBetter: boolean = false,
): {value: string; note: string; color: string} => {
  if (diff === 0) {
    return {
      value: `${diff} ${unit}`,
      note: '평균과 동일',
      color: '#3C3C43',
    };
  }

  const absValue = Math.abs(diff);
  const isPositive = diff > 0;
  const prefix = isPositive ? '+' : '';
  const direction = isPositive ? '높음' : '낮음';

  // Determine color based on whether higher is better
  const color =
    (higherIsBetter && isPositive) || (!higherIsBetter && !isPositive)
      ? '#34C759'
      : '#FF3B30';

  return {
    value: `${prefix}${diff} ${unit}`,
    note: `평균 대비 ${absValue} ${unit} ${direction}`,
    color,
  };
};

/**
 * Get percentile explanation text
 */
export const getPercentileExplanation = (percentile: number): string => {
  const rank = 100 - percentile;
  return `100명 중 ${rank}번째로 좋은 수치`;
};
