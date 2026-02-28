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
    stressLevel: number;
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
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Start a new measurement session
 */
export const startMeasurement = async (
  userId: number,
): Promise<MeasurementStartResponse> => {
  const response = await apiClient.post<MeasurementStartResponse>(
    API_ENDPOINTS.measurementStart,
    {user_id: userId},
  );
  return response.data;
};

/**
 * Submit PPG data for QC feedback
 */
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

/**
 * Get latest QC feedback
 */
export const getLatestQC = async (
  measurementId: number,
): Promise<QCFeedbackResponse> => {
  const response = await apiClient.get<QCFeedbackResponse>(
    API_ENDPOINTS.measurementQCLatest(measurementId),
  );
  return response.data;
};

/**
 * Complete a measurement
 */
export const completeMeasurement = async (
  measurementId: number,
  notes?: string,
): Promise<MeasurementCompleteResponse> => {
  const response = await apiClient.post<MeasurementCompleteResponse>(
    API_ENDPOINTS.measurementComplete,
    {
      measurement_id: measurementId,
      notes,
    },
  );
  return response.data;
};

/**
 * Analyze a completed measurement
 */
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

/**
 * Update battery level
 */
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
 * Convert API analysis response to MeasurementRecord
 */
export const convertAnalysisToRecord = (
  analysisData: AnalysisResponse,
  duration: number,
): MeasurementRecord => {
  const now = new Date();

  return {
    id: `measurement_${analysisData.measurement_id}`,
    userId: 'user1', // TODO: Get from auth context
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    timestamp: now.getTime(),
    duration,
    analysis: {
      general: {
        heartRate: analysisData.general.heartRate,
        hrv: analysisData.general.hrv,
        stressLevel: analysisData.general.stressLevel,
        status: analysisData.general.status as
          | 'excellent'
          | 'good'
          | 'normal'
          | 'poor',
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
      },
    },
  };
};
