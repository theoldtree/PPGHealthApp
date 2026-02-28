/**
 * Utility functions for health metrics evaluation and formatting
 */
import {HEART_RATE_RANGE, HRV_RANGE} from '../config/measurement';

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
 * Evaluate PI (Perfusion Index) and return status
 * Reference: < 1% low, 1-5% normal, > 5% high
 */
export const getPIStatus = (pi: number): MetricStatus => {
  if (pi < 1.0) return {text: '낮음', color: '#FF9500'};
  if (pi <= 5.0) return {text: '정상', color: '#34C759'};
  return {text: '양호', color: '#0066CC'};
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

export interface APGIndices {
  bOverA: number;
  cOverA: number;
  dOverA: number;
  ai: number;
}

/**
 * Compute APG (Acceleration PhotoPlethysmoGraphy) indices from PPG data.
 * APG = second derivative of PPG. Characteristic peaks: a (max), b (min),
 * c (2nd max), d (2nd min). Ratios normalized to peak a amplitude.
 *
 * NOTE: Clinically meaningful values require proper sampling rate (~200 Hz).
 * With simulated 1 Hz data the absolute values are not medically accurate,
 * but the computation is structurally correct for real sensor data.
 */
export const computeAPGIndices = (ppgData: number[]): APGIndices | null => {
  if (ppgData.length < 12) {
    return null;
  }

  // Use the last 20 data points
  const window = ppgData.slice(-20);

  // Simple 3-point smoothing
  const smoothed = window.map((val, i) => {
    if (i === 0 || i === window.length - 1) {
      return val;
    }
    return (window[i - 1] + val + window[i + 1]) / 3;
  });

  // Second derivative (APG)
  const apg: number[] = [];
  for (let i = 1; i < smoothed.length - 1; i++) {
    apg.push(smoothed[i + 1] - 2 * smoothed[i] + smoothed[i - 1]);
  }

  if (apg.length < 8) {
    return null;
  }

  const q = Math.floor(apg.length / 4);

  // Find characteristic points in each quarter
  const peakA = Math.max(...apg.slice(0, q * 2));
  const peakB = Math.min(...apg.slice(0, q * 2));
  const peakC = Math.max(...apg.slice(q, q * 3));
  const peakD = Math.min(...apg.slice(q * 2));

  if (Math.abs(peakA) < 0.001) {
    return null;
  }

  return {
    bOverA: parseFloat((peakB / peakA).toFixed(2)),
    cOverA: parseFloat((peakC / peakA).toFixed(2)),
    dOverA: parseFloat((peakD / peakA).toFixed(2)),
    ai: parseFloat(((peakD - peakC) / peakA).toFixed(2)),
  };
};

/**
 * Generate an overall interpretation text from analysis results
 */
export const getOverallFeedback = (
  heartRate: number,
  hrv: number,
): {summary: string; advice: string; color: string} => {
  const hrOk  = heartRate >= 60 && heartRate <= 100;
  const hrvOk = hrv >= 30;

  if (hrOk && hrvOk) {
    return {
      summary: '심박수와 자율신경계가 안정적입니다',
      advice:  '현재 컨디션이 좋습니다. 규칙적인 측정으로 건강을 관리해보세요.',
      color:   '#16A34A',
    };
  }
  if (hrOk || hrvOk) {
    const issue = !hrOk
      ? `심박수(${heartRate} bpm)가 정상 범위를 벗어났습니다. `
      : `HRV(${hrv} ms)가 낮아 자율신경 균형이 다소 저하되어 있습니다. `;
    return {
      summary: '대체로 양호하지만 일부 지표를 주의하세요',
      advice:  issue + '충분한 수면과 휴식을 권장합니다.',
      color:   '#D97706',
    };
  }
  return {
    summary: '심혈관 지표 개선이 필요합니다',
    advice:  '심박수와 HRV가 모두 주의 범위에 있습니다. 규칙적인 운동과 충분한 휴식을 취하고, 지속될 경우 전문가 상담을 권장합니다.',
    color:   '#DC2626',
  };
};
