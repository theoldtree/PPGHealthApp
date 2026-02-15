/**
 * Authentication Context
 * Manages global authentication state
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/auth';
import * as authApi from '../api/auth';

const TOKEN_KEY = '@ppg_auth_token';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  mockLogin: () => Promise<void>; // 임시 로그인 함수
  signup: (
    email: string,
    password: string,
    username?: string,
    gender?: 'male' | 'female' | 'other',
    birthYear?: number
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from storage on mount
  useEffect(() => {
    loadToken();
  }, []);

  // Set auth token when token changes
  useEffect(() => {
    authApi.setAuthToken(token);
  }, [token]);

  /**
   * Load token from AsyncStorage and fetch user data
   */
  const loadToken = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
        authApi.setAuthToken(storedToken);

        // Fetch user data
        const userData = await authApi.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load token:', error);
      // Clear invalid token
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh user data from server
   */
  const refreshUser = async () => {
    if (!token) return;

    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  /**
   * Login with email and password
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      await AsyncStorage.setItem(TOKEN_KEY, response.access_token);
      setToken(response.access_token);
      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  /**
   * Mock login for testing (임시 로그인)
   */
  const mockLogin = async () => {
    try {
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
    } catch (error) {
      console.error('Mock login failed:', error);
      throw error;
    }
  };

  /**
   * Signup with email and password
   */
  const signup = async (
    email: string,
    password: string,
    username?: string,
    gender?: 'male' | 'female' | 'other',
    birthYear?: number
  ) => {
    try {
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
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  };

  /**
   * Update user data in state (after profile update)
   */
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    mockLogin,
    signup,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
