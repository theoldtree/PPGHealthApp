/**
 * Profile Complete Screen
 * First login screen to input health profile data
 */
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {Button} from '../components/Button';
import {Input} from '../components/Input';
import {useAuth} from '../context/AuthContext';
import * as authApi from '../api/auth';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

type ProfileCompleteScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const ProfileCompleteScreen: React.FC<ProfileCompleteScreenProps> = ({
  navigation,
}) => {
  const {updateUser} = useAuth();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [hasDiabetes, setHasDiabetes] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Submit profile
   */
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const profileData: any = {};

      if (height) {
        profileData.height = parseFloat(height);
      }
      if (weight) {
        profileData.weight = parseFloat(weight);
      }
      if (hasDiabetes !== undefined) {
        profileData.has_diabetes = hasDiabetes;
      }

      const updatedUser = await authApi.completeProfile(profileData);
      updateUser(updatedUser);

      Alert.alert(
        '프로필 완성!',
        '정확한 건강 분석을 위해 프로필을 등록해주셔서 감사합니다.',
        [
          {
            text: '확인',
            onPress: () => {
              // Navigation will be handled by App.tsx based on auth state
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Profile complete error:', error);
      Alert.alert(
        '프로필 저장 실패',
        error.response?.data?.detail || '프로필 저장에 실패했습니다. 다시 시도해주세요.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Skip profile completion
   */
  const handleSkip = async () => {
    Alert.alert(
      '나중에 입력하기',
      '프로필 정보는 마이페이지에서 언제든 입력할 수 있습니다.\n정확한 건강 분석을 위해 나중에 꼭 입력해주세요.',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '나중에 입력',
          onPress: async () => {
            setIsLoading(true);
            try {
              // Just mark as complete without data
              const updatedUser = await authApi.completeProfile({});
              updateUser(updatedUser);
            } catch (error: any) {
              console.error('Skip profile error:', error);
              Alert.alert('오류', '프로필 저장에 실패했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>프로필 완성하기</Text>
          <Text style={styles.subtitle}>
            정확한 건강 분석을 위해{'\n'}
            기본 정보를 입력해주세요
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="키 (cm)"
            placeholder="예: 170"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            editable={!isLoading}
          />

          <Input
            label="몸무게 (kg)"
            placeholder="예: 65"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            editable={!isLoading}
          />

          <View style={styles.diabetesContainer}>
            <Text style={styles.label}>당뇨병 진단 여부</Text>
            <View style={styles.diabetesButtons}>
              <TouchableOpacity
                style={[
                  styles.diabetesButton,
                  hasDiabetes === false && styles.diabetesButtonActive,
                ]}
                onPress={() => setHasDiabetes(false)}
                disabled={isLoading}>
                <Text
                  style={[
                    styles.diabetesButtonText,
                    hasDiabetes === false && styles.diabetesButtonTextActive,
                  ]}>
                  없음
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.diabetesButton,
                  hasDiabetes === true && styles.diabetesButtonActive,
                ]}
                onPress={() => setHasDiabetes(true)}
                disabled={isLoading}>
                <Text
                  style={[
                    styles.diabetesButtonText,
                    hasDiabetes === true && styles.diabetesButtonTextActive,
                  ]}>
                  있음
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 모든 항목은 선택사항입니다.{'\n'}
            입력하신 정보는 건강 분석 정확도 향상에 활용됩니다.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Button
            title={isLoading ? '저장 중...' : '완료'}
            onPress={handleSubmit}
            disabled={isLoading}
          />

          <TouchableOpacity
            onPress={handleSkip}
            disabled={isLoading}
            style={styles.skipButton}>
            <Text style={styles.skipButtonText}>나중에 입력하기</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    marginBottom: 24,
  },
  diabetesContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  diabetesButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  diabetesButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  diabetesButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  diabetesButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  diabetesButtonTextActive: {
    color: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  buttons: {
    gap: 12,
  },
  skipButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#999999',
    fontWeight: '500',
  },
});
