/**
 * Authentication Context
 * Manages global authentication state
 */
import React, {createContext, useContext, useState, useEffect} from 'react';
import {Linking, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {User} from '../types/auth';
import * as authApi from '../api/auth';

const TOKEN_KEY = '@ppg_auth_token';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (accessToken: string) => Promise<void>;
  mockLogin: () => Promise<void>;
  signup: (
    email: string,
    password: string,
    username?: string,
    gender?: 'male' | 'female' | 'other',
    birthYear?: number,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored token on mount
  useEffect(() => {
    loadToken();
  }, []);

  // Keep auth.ts axios instance in sync
  useEffect(() => {
    authApi.setAuthToken(token);
  }, [token]);

  // Listen for OAuth deep link: ppghealth://auth/callback?access_token=...
  useEffect(() => {
    const handleUrl = ({url}: {url: string}) => {
      if (url.startsWith('ppghealth://auth/callback')) {
        const params = new URLSearchParams(url.split('?')[1] ?? '');
        const accessToken = params.get('access_token');
        if (accessToken) {
          loginWithToken(accessToken).catch(err =>
            Alert.alert('로그인 오류', err?.message ?? '소셜 로그인에 실패했습니다.'),
          );
        }
      }
    };

    // Handle cold-start deep link
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({url});
    });

    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadToken = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
        authApi.setAuthToken(storedToken);
        const userData = await authApi.getCurrentUser();
        setUser(userData);
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        // Token is invalid or expired — clear it and show login screen
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
      // Network error (server down, no connection): keep the token,
      // user will re-authenticate when the server is reachable again
      console.warn('Failed to restore session:', error?.message ?? error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    const userData = await authApi.getCurrentUser();
    setUser(userData);
  };

  /** Email + password login */
  const login = async (email: string, password: string) => {
    const response = await authApi.login({email, password});
    await AsyncStorage.setItem(TOKEN_KEY, response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  };

  /**
   * OAuth deep-link login.
   * Called after the backend redirects to ppghealth://auth/callback?access_token=...
   */
  const loginWithToken = async (accessToken: string) => {
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    authApi.setAuthToken(accessToken);
    const userData = await authApi.getCurrentUser();
    setUser(userData);
  };

  /** Temporary mock login (bypasses backend) */
  const mockLogin = async () => {
    const mockToken = 'mock_token_12345';
    const mockUser: User = {
      id: 1,
      email: 'test@example.com',
      username: '테스트사용자',
      provider: null,
      gender: 'male',
      birth_year: 1990,
      height: 175,
      weight: 70,
      has_diabetes: false,
      is_profile_complete: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await AsyncStorage.setItem(TOKEN_KEY, mockToken);
    setToken(mockToken);
    setUser(mockUser);
  };

  const signup = async (
    email: string,
    password: string,
    username?: string,
    gender?: 'male' | 'female' | 'other',
    birthYear?: number,
  ) => {
    const response = await authApi.signup({
      email,
      password,
      username,
      gender,
      birth_year: birthYear,
    });
    await AsyncStorage.setItem(TOKEN_KEY, response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    } finally {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        loginWithToken,
        mockLogin,
        signup,
        logout,
        updateUser,
        refreshUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
