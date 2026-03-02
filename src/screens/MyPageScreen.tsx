import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {Button} from '../components/Button';
import {Input} from '../components/Input';
import {useAuth} from '../context/AuthContext';
import * as authApi from '../api/auth';
import {Colors} from '../config/colors';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

type MyPageScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const MyPageScreen: React.FC<MyPageScreenProps> = ({navigation}) => {
  const {user, logout, updateUser, refreshUser} = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [username, setUsername] = useState(user?.username || '');
  const [height, setHeight] = useState(user?.height?.toString() || '');
  const [weight, setWeight] = useState(user?.weight?.toString() || '');
  const [hasDiabetes, setHasDiabetes] = useState(user?.has_diabetes);

  /**
   * Handle logout
   */
  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  /**
   * Enter edit mode
   */
  const handleEdit = () => {
    setUsername(user?.username || '');
    setHeight(user?.height?.toString() || '');
    setWeight(user?.weight?.toString() || '');
    setHasDiabetes(user?.has_diabetes);
    setIsEditing(true);
  };

  /**
   * Cancel edit
   */
  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  /**
   * Save profile
   */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: any = {};

      if (username !== user?.username) {
        updateData.username = username;
      }
      if (height && parseFloat(height) !== user?.height) {
        updateData.height = parseFloat(height);
      }
      if (weight && parseFloat(weight) !== user?.weight) {
        updateData.weight = parseFloat(weight);
      }
      if (hasDiabetes !== user?.has_diabetes) {
        updateData.has_diabetes = hasDiabetes;
      }

      const updatedUser = await authApi.updateProfile(updateData);
      updateUser(updatedUser);
      setIsEditing(false);
      Alert.alert('성공', '프로필이 수정되었습니다.');
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert(
        '프로필 수정 실패',
        error.response?.data?.detail || '프로필 수정에 실패했습니다.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Refresh user data
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
    } catch (error) {
      Alert.alert('오류', '사용자 정보를 새로고침하지 못했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>사용자 정보를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const getInitials = () => {
    if (user.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const getGenderText = () => {
    if (user.gender === 'male') return '남성';
    if (user.gender === 'female') return '여성';
    if (user.gender === 'other') return '기타';
    return '미입력';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }>
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
        <Text style={styles.username}>{user.username || '사용자'}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>
            {user.provider === 'email'
              ? '이메일'
              : user.provider === 'kakao'
              ? '카카오'
              : user.provider === 'google'
              ? '구글'
              : user.provider}
          </Text>
        </View>
      </View>

      {/* Profile Info */}
      {!isEditing ? (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>기본 정보</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>성별</Text>
            <Text style={styles.infoValue}>{getGenderText()}</Text>
          </View>

          {user.birth_year && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>출생년도</Text>
              <Text style={styles.infoValue}>{user.birth_year}년</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>키</Text>
            <Text style={styles.infoValue}>
              {user.height ? `${user.height} cm` : '미입력'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>몸무게</Text>
            <Text style={styles.infoValue}>
              {user.weight ? `${user.weight} kg` : '미입력'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>당뇨병</Text>
            <Text style={styles.infoValue}>
              {user.has_diabetes === true
                ? '있음'
                : user.has_diabetes === false
                ? '없음'
                : '미입력'}
            </Text>
          </View>

          <Button
            title="프로필 수정"
            onPress={handleEdit}
            style={styles.editButton}
          />
        </View>
      ) : (
        <View style={styles.editSection}>
          <Text style={styles.sectionTitle}>프로필 수정</Text>

          <Input
            label="사용자명"
            placeholder="사용자명을 입력하세요"
            value={username}
            onChangeText={setUsername}
            editable={!isSaving}
          />

          <Input
            label="키 (cm)"
            placeholder="예: 170"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            editable={!isSaving}
          />

          <Input
            label="몸무게 (kg)"
            placeholder="예: 65"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            editable={!isSaving}
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
                disabled={isSaving}>
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
                disabled={isSaving}>
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

          <View style={styles.editButtons}>
            <Button
              title={isSaving ? '저장 중...' : '저장'}
              onPress={handleSave}
              disabled={isSaving}
              style={styles.saveButton}
            />
            <Button
              title="취소"
              onPress={handleCancelEdit}
              variant="outline"
              disabled={isSaving}
            />
          </View>
        </View>
      )}

      {/* Logout Button */}
      <Button
        title="로그아웃"
        onPress={handleLogout}
        variant="outline"
        style={styles.logoutButton}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  providerBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  providerText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  infoSection: {
    marginBottom: 24,
  },
  editSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  editButton: {
    marginTop: 16,
  },
  diabetesContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  diabetesButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  diabetesButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  diabetesButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  diabetesButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  diabetesButtonTextActive: {
    color: Colors.white,
  },
  editButtons: {
    gap: 12,
  },
  saveButton: {
    marginTop: 8,
  },
  logoutButton: {
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.statusDanger,
    textAlign: 'center',
    marginTop: 40,
  },
});
