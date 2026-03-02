/**
 * Measurement API functions
 */
import {apiClient} from './client';
import {API_ENDPOINTS} from '../config/api';
import type {MeasurementRecord} from '../types/measurement';

// ============================================================================
// Types
// ============================================================================

export interface MeasurementStartResponse {
  measurement_id: number;
  started_at: string;
  status: string;
}

export interface QCFeedbackResponse {
  window_index: number;
  timestamp: number;
  is_acceptable: boolean;
  snr?: number;
  peak_count?: number;
  feedback_message?: string;
  battery_level?: number;
}

export interface MeasurementCompleteResponse {
  measurement_id: number;
  completed_at: string;
  duration_seconds: number;
  status: string;
}

export interface AnalysisResponse {
  measurement_id: number;
  general: {
    heartRate: number;
    hrv: number;
    hrvRmssd?: number;
    pi: number;
    ac: number;
    dc: number;
    apgBOverA?: number;
    apgAI?: number;
    status: string;
  };
  personal: {
    heartRateDiff: number;
    hrvDiff: number;
    trend: string;
  };
  demographic: {
    percentile: number;
    ageGroupAvg: number;
    genderGroupAvg: number;
    comparison: string;
    apgBOverARef?: number;
    apgBOverAStd?: number;
  };
  advice?: string;
}

// ============================================================================
// API Functions
// ============================================================================

export const startMeasurement = async (
  userId: number,
  isDev = false,
): Promise<MeasurementStartResponse> => {
  const response = await apiClient.post<MeasurementStartResponse>(
    API_ENDPOINTS.measurementStart,
    {user_id: userId, is_dev: isDev},
  );
  return response.data;
};

export const submitQCData = async (
  measurementId: number,
  windowIndex: number,
  timestamp: number,
  ppgData: number[],
  batteryLevel?: number,
): Promise<QCFeedbackResponse> => {
  const response = await apiClient.post<QCFeedbackResponse>(
    API_ENDPOINTS.measurementQCData,
    {
      measurement_id: measurementId,
      window_index: windowIndex,
      timestamp,
      ppg_data: ppgData,
      battery_level: batteryLevel,
    },
  );
  return response.data;
};

export const getLatestQC = async (
  measurementId: number,
): Promise<QCFeedbackResponse> => {
  const response = await apiClient.get<QCFeedbackResponse>(
    API_ENDPOINTS.measurementQCLatest(measurementId),
  );
  return response.data;
};

export const completeMeasurement = async (
  measurementId: number,
  notes?: string,
): Promise<MeasurementCompleteResponse> => {
  const response = await apiClient.post<MeasurementCompleteResponse>(
    API_ENDPOINTS.measurementComplete,
    {measurement_id: measurementId, notes},
  );
  return response.data;
};

export const analyzeMeasurement = async (
  measurementId: number,
  ppgData?: number[],
  samplingRate?: number,
): Promise<AnalysisResponse> => {
  const response = await apiClient.post<AnalysisResponse>(
    API_ENDPOINTS.measurementAnalyze,
    {
      measurement_id: measurementId,
      ppg_data: ppgData ?? null,
      sampling_rate: samplingRate ?? 200,
    },
  );
  return response.data;
};

export const updateBattery = async (
  measurementId: number,
  batteryLevel: number,
): Promise<void> => {
  await apiClient.post(API_ENDPOINTS.measurementBattery, {
    measurement_id: measurementId,
    battery_level: batteryLevel,
  });
};

/**
 * Save diary notes, tags, and advice after viewing the result screen.
 */
export const saveDiaryEntry = async (
  measurementId: number,
  notes: string,
  tags: string[],
  advice?: string,
): Promise<void> => {
  await apiClient.patch(`/api/v1/measurements/${measurementId}/diary`, {
    notes,
    tags,
    advice,
  });
};

/**
 * Fetch all completed measurements for the current user.
 */
export const getMeasurementHistory = async (): Promise<MeasurementRecord[]> => {
  const response = await apiClient.get<MeasurementRecord[]>(
    '/api/v1/measurements/history',
  );
  return response.data;
};

/**
 * Convert API analysis response to MeasurementRecord
 */
export const convertAnalysisToRecord = (
  analysisData: AnalysisResponse,
  duration: number,
): MeasurementRecord => {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    id: `measurement_${analysisData.measurement_id}`,
    userId: 'user1',
    date: localDate,
    time: now.toTimeString().split(' ')[0],
    timestamp: now.getTime(),
    duration,
    advice: analysisData.advice,
    analysis: {
      general: {
        heartRate: analysisData.general.heartRate,
        hrv: analysisData.general.hrv,
        hrvRmssd: analysisData.general.hrvRmssd,
        pi: analysisData.general.pi ?? 0,
        ac: analysisData.general.ac ?? 0,
        dc: analysisData.general.dc ?? 0,
        apgBOverA: analysisData.general.apgBOverA,
        apgAI: analysisData.general.apgAI,
        status: analysisData.general.status as 'excellent' | 'good' | 'normal' | 'poor',
      },
      personal: {
        heartRateDiff: analysisData.personal.heartRateDiff,
        hrvDiff: analysisData.personal.hrvDiff,
        trend: analysisData.personal.trend as 'improving' | 'stable' | 'declining',
      },
      demographic: {
        percentile: analysisData.demographic.percentile,
        ageGroupAvg: analysisData.demographic.ageGroupAvg,
        genderGroupAvg: analysisData.demographic.genderGroupAvg,
        comparison: analysisData.demographic.comparison as
          | 'above_average'
          | 'average'
          | 'below_average',
        apgBOverARef: analysisData.demographic.apgBOverARef,
        apgBOverAStd: analysisData.demographic.apgBOverAStd,
      },
    },
  };
};
