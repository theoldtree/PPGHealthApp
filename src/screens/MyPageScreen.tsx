import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Button} from '../components/Button';

export const MyPageScreen: React.FC = () => {
  const handleLogout = () => {
    console.log('Logout');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>마이페이지</Text>

      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>U</Text>
        </View>
        <Text style={styles.username}>사용자</Text>
        <Text style={styles.email}>user@example.com</Text>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>프로필 수정</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>설정</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>계정 보안</Text>
        </TouchableOpacity>
      </View>

      <Button
        title="로그아웃"
        onPress={handleLogout}
        variant="outline"
        style={styles.logoutButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 24,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
  },
  menuSection: {
    marginBottom: 32,
  },
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  menuText: {
    fontSize: 16,
    color: '#000000',
  },
  logoutButton: {
    marginTop: 'auto',
  },
});
