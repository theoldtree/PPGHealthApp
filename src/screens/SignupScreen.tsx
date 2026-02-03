import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {Button} from '../components/Button';
import {Input} from '../components/Input';
import {useAuth} from '../context/AuthContext';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const SignupScreen: React.FC<SignupScreenProps> = ({navigation}) => {
  const {signup} = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | undefined>();
  const [birthYear, setBirthYear] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Validate form inputs
   */
  const validateInputs = (): boolean => {
    if (!email || !password || !username) {
      Alert.alert('오류', '이메일, 사용자명, 비밀번호를 모두 입력해주세요.');
      return false;
    }

    if (password.length < 8) {
      Alert.alert('오류', '비밀번호는 8자 이상이어야 합니다.');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return false;
    }

    if (birthYear && (parseInt(birthYear) < 1900 || parseInt(birthYear) > 2024)) {
      Alert.alert('오류', '올바른 출생년도를 입력해주세요 (1900-2024).');
      return false;
    }

    return true;
  };

  /**
   * Handle signup
   */
  const handleSignup = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    try {
      await signup(
        email,
        password,
        username,
        gender,
        birthYear ? parseInt(birthYear) : undefined
      );
      // Navigation handled by App.tsx based on auth state
    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert(
        '회원가입 실패',
        error.response?.data?.detail || '회원가입에 실패했습니다. 다시 시도해주세요.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>회원가입</Text>

        {/* Required Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>필수 정보</Text>

          <Input
            label="이메일*"
            placeholder="이메일을 입력하세요"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />

          <Input
            label="사용자명*"
            placeholder="사용자명을 입력하세요"
            value={username}
            onChangeText={setUsername}
            editable={!isLoading}
          />

          <Input
            label="비밀번호* (최소 8자)"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <Input
            label="비밀번호 확인*"
            placeholder="비밀번호를 다시 입력하세요"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading}
          />
        </View>

        {/* Optional Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>선택 정보 (건강 분석에 활용)</Text>

          <View style={styles.genderContainer}>
            <Text style={styles.label}>성별</Text>
            <View style={styles.genderButtons}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'male' && styles.genderButtonActive,
                ]}
                onPress={() => setGender('male')}
                disabled={isLoading}>
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === 'male' && styles.genderButtonTextActive,
                  ]}>
                  남성
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'female' && styles.genderButtonActive,
                ]}
                onPress={() => setGender('female')}
                disabled={isLoading}>
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === 'female' && styles.genderButtonTextActive,
                  ]}>
                  여성
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'other' && styles.genderButtonActive,
                ]}
                onPress={() => setGender('other')}
                disabled={isLoading}>
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === 'other' && styles.genderButtonTextActive,
                  ]}>
                  기타
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Input
            label="출생년도"
            placeholder="예: 1990"
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="numeric"
            maxLength={4}
            editable={!isLoading}
          />
        </View>

        <Button
          title={isLoading ? '가입 중...' : '가입하기'}
          onPress={handleSignup}
          disabled={isLoading}
          style={styles.signupButton}
        />

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isLoading}
          style={styles.backButton}>
          <Text style={styles.backButtonText}>이미 계정이 있으신가요? 로그인</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 32,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  genderContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  genderButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
  },
  signupButton: {
    marginTop: 8,
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
