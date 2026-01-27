/**
 * API Configuration
 */
import {Platform} from 'react-native';

// API Base URL
// Note: Android emulator uses 10.0.2.2 to access host machine's localhost
export const API_BASE_URL = __DEV__
  ? Platform.select({
      ios: 'http://localhost:8000',
      android: 'http://10.0.2.2:8000',
      default: 'http://localhost:8000',
    })
  : 'https://your-production-api.com';  // Production

// API Endpoints
export const API_ENDPOINTS = {
  // Health
  health: '/api/v1/health',

  // Measurements
  measurementStart: '/api/v1/measurements/start',
  measurementQCData: '/api/v1/measurements/qc/data',
  measurementQCLatest: (measurementId: number) =>
    `/api/v1/measurements/qc/latest/${measurementId}`,
  measurementComplete: '/api/v1/measurements/complete',
  measurementAnalyze: '/api/v1/measurements/analyze',
  measurementBattery: '/api/v1/measurements/battery',
};

// Request timeout (ms)
export const REQUEST_TIMEOUT = 30000; // 30 seconds
