/**
 * API Configuration
 */
import {Platform} from 'react-native';

// ── Dev server address ─────────────────────────────────────────────────────
// iOS Simulator   → localhost (Mac loopback tunneled automatically)
// Android Emulator → 10.0.2.2 (QEMU special alias for host loopback)
// Android Physical → Mac's actual LAN IP (must be on same WiFi)
//
// Change DEV_HOST to your Mac's IP when testing on a physical Android device:
//   $ ipconfig getifaddr en0   → e.g. 192.168.0.116
const DEV_HOST = Platform.select({
  ios: 'localhost',
  android: '10.0.2.2',   // ← swap to '192.168.0.116' for real device
  default: 'localhost',
});

export const API_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:8000`
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
