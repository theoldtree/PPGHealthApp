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
} from 'react-native';
import {Button} from '../components/Button';
import {Input} from '../components/Input';
import {useAuth} from '../context/AuthContext';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({navigation}) => {
  const {login, mockLogin} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Email login (임시: mockLogin 사용)
   */
  const handleEmailLogin = async () => {
    // 임시 로그인: 이메일/비밀번호 검증 없이 바로 로그인
    setIsLoading(true);
    try {
      await mockLogin();
      // Navigation handled by App.tsx based on auth state
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('로그인 실패', '로그인 중 오류가 발생했습니다.');
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

  /**
   * Kakao login (OAuth)
   */
  const handleKakaoLogin = () => {
    Alert.alert('준비 중', '카카오 로그인은 현재 개발 중입니다.');
    // TODO: Implement Kakao OAuth flow
  };

  /**
   * Google login (OAuth)
   */
  const handleGoogleLogin = () => {
    Alert.alert('준비 중', '구글 로그인은 현재 개발 중입니다.');
    // TODO: Implement Google OAuth flow
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
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
    color: '#666666',
  },
  signupLink: {
    color: '#007AFF',
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
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#999999',
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
    backgroundColor: '#FEE500',
    borderColor: '#FEE500',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDDDDD',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  googleButtonText: {
    color: '#666666',
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
