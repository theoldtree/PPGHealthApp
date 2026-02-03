/**
 * Authentication types
 */

export interface User {
  id: number;
  email: string;
  username: string | null;
  provider: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birth_year: number | null;
  height: number | null; // cm
  weight: number | null; // kg
  has_diabetes: boolean | null;
  is_profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SignupData {
  email: string;
  password: string;
  username?: string;
  gender?: 'male' | 'female' | 'other';
  birth_year?: number;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ProfileCompleteData {
  height?: number;
  weight?: number;
  has_diabetes?: boolean;
}

export interface ProfileUpdateData {
  username?: string;
  gender?: 'male' | 'female' | 'other';
  birth_year?: number;
  height?: number;
  weight?: number;
  has_diabetes?: boolean;
}
