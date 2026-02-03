/**
 * Authentication API client
 */
import axios from 'axios';
import {
  SignupData,
  LoginData,
  ProfileCompleteData,
  ProfileUpdateData,
  TokenResponse,
  User,
} from '../types/auth';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

/**
 * Email signup
 */
export const signup = async (data: SignupData): Promise<TokenResponse> => {
  const response = await api.post<TokenResponse>('/auth/signup', data);
  return response.data;
};

/**
 * Email login
 */
export const login = async (data: LoginData): Promise<TokenResponse> => {
  const response = await api.post<TokenResponse>('/auth/login', data);
  return response.data;
};

/**
 * Get current user info
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/auth/me');
  return response.data;
};

/**
 * Complete user profile (first login)
 */
export const completeProfile = async (
  data: ProfileCompleteData
): Promise<User> => {
  const response = await api.put<User>('/auth/profile/complete', data);
  return response.data;
};

/**
 * Update user profile
 */
export const updateProfile = async (data: ProfileUpdateData): Promise<User> => {
  const response = await api.put<User>('/auth/profile', data);
  return response.data;
};

/**
 * Logout
 */
export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

/**
 * Get Kakao OAuth URL
 */
export const getKakaoAuthUrl = async (): Promise<string> => {
  const response = await api.get<{ url: string }>('/auth/kakao/url');
  return response.data.url;
};

/**
 * Get Google OAuth URL
 */
export const getGoogleAuthUrl = async (): Promise<string> => {
  const response = await api.get<{ url: string }>('/auth/google/url');
  return response.data.url;
};

/**
 * Kakao OAuth callback
 */
export const kakaoCallback = async (code: string): Promise<TokenResponse> => {
  const response = await api.get<TokenResponse>('/auth/kakao/callback', {
    params: { code },
  });
  return response.data;
};

/**
 * Google OAuth callback
 */
export const googleCallback = async (code: string): Promise<TokenResponse> => {
  const response = await api.get<TokenResponse>('/auth/google/callback', {
    params: { code },
  });
  return response.data;
};
