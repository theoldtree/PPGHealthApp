import React, {useState} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {Button} from '../components/Button';
import {Input} from '../components/Input';

export const SignupScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = () => {
    console.log('Signup:', {email, username, password});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>회원가입</Text>

      <Input
        label="이메일"
        placeholder="이메일을 입력하세요"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Input
        label="사용자명"
        placeholder="사용자명을 입력하세요"
        value={username}
        onChangeText={setUsername}
      />

      <Input
        label="비밀번호"
        placeholder="비밀번호를 입력하세요"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Input
        label="비밀번호 확인"
        placeholder="비밀번호를 다시 입력하세요"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <Button title="가입하기" onPress={handleSignup} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 32,
    textAlign: 'center',
  },
});
