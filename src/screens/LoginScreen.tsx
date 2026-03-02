import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Button} from '../components/Button';
import {Input} from '../components/Input';
import {useAuth} from '../context/AuthContext';
import {getKakaoAuthUrl, getGoogleAuthUrl} from '../api/auth';
import {Colors} from '../config/colors';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({navigation}) => {
  const {login} = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Email login
   */
  const handleEmailLogin = async () => {
    if (!email.trim()) {
      Alert.alert('입력 오류', '이메일을 입력해주세요.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('입력 오류', '비밀번호를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      // Navigation handled by App.tsx based on auth state
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ?? '로그인 중 오류가 발생했습니다.';
      Alert.alert('로그인 실패', msg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Navigate to signup screen
   */
  const handleSignup = () => {
    navigation.navigate('Signup');
  };

  /** 네트워크/설정 오류 메세지 공통 처리 */
  const getOAuthErrorMsg = (error: any, provider: string) => {
    if (!error?.response) {
      return `서버에 연결할 수 없습니다.\n백엔드가 실행 중인지 확인해주세요.`;
    }
    if (error.response?.data?.detail?.includes('not configured')) {
      return `${provider} API 키가 서버에 설정되지 않았습니다.`;
    }
    return `${provider} 로그인을 시작할 수 없습니다.`;
  };

  /**
   * Kakao login (OAuth) — fetches auth URL from backend, opens in browser.
   * Backend redirects to ppghealth://auth/callback?access_token=...
   * which AuthContext catches via Linking.addEventListener.
   */
  const handleKakaoLogin = async () => {
    setIsLoading(true);
    try {
      const url = await getKakaoAuthUrl();
      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert('카카오 로그인 불가', getOAuthErrorMsg(error, 'Kakao'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Google login (OAuth) — same pattern as Kakao.
   * NOTE: redirect_uri (localhost:8000) must be reachable from the device browser.
   * For physical device testing, use ngrok or set redirect_uri to Mac's LAN IP.
   */
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const url = await getGoogleAuthUrl();
      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert('구글 로그인 불가', getOAuthErrorMsg(error, 'Google'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingBottom: insets.bottom + 24}]}
        keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.title}>PPG Health</Text>
          <Text style={styles.subtitle}>건강 모니터링 앱</Text>
        </View>

        {/* Email Login Form */}
        <View style={styles.form}>
          <Input
            label="이메일"
            placeholder="이메일을 입력하세요"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />

          <Input
            label="비밀번호"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <Button
            title={isLoading ? '로그인 중...' : '로그인'}
            onPress={handleEmailLogin}
            disabled={isLoading}
            style={styles.loginButton}
          />

          <TouchableOpacity onPress={handleSignup} disabled={isLoading}>
            <Text style={styles.signupText}>
              계정이 없으신가요? <Text style={styles.signupLink}>회원가입</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Login Buttons */}
        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={[styles.socialButton, styles.kakaoButton]}
            onPress={handleKakaoLogin}
            disabled={isLoading}>
            <Text style={styles.socialButtonText}>카카오로 계속하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={handleGoogleLogin}
            disabled={isLoading}>
            <Text style={[styles.socialButtonText, styles.googleButtonText]}>
              Google로 계속하기
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  loginButton: {
    marginTop: 8,
  },
  signupText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  signupLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: Colors.textTertiary,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  kakaoButton: {
    backgroundColor: '#FEE500',  // Kakao brand color
    borderColor: '#FEE500',
  },
  googleButton: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  googleButtonText: {
    color: Colors.textSecondary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});
