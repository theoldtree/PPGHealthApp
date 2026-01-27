/**
 * API Client - Axios instance with default configuration
 */
import axios from 'axios';
import {API_BASE_URL, REQUEST_TIMEOUT} from '../config/api';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  config => {
    // Add auth token if available
    // const token = await AsyncStorage.getItem('auth_token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  },
);

// Response interceptor
apiClient.interceptors.response.use(
  response => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('API Response Error:', error.response?.status, error.message);

    // Handle specific error codes
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login
          console.warn('Unauthorized - need to login');
          break;
        case 404:
          console.warn('Resource not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          break;
      }
    }

    return Promise.reject(error);
  },
);
