import React, {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Button} from '../components/Button';
import {Input} from '../components/Input';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    console.log('Login:', {email, password});
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인</Text>

      <Input
        label="이메일"
        placeholder="이메일을 입력하세요"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Input
        label="비밀번호"
        placeholder="비밀번호를 입력하세요"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title="로그인" onPress={handleLogin} />

      <Button
        title="회원가입"
        onPress={() => console.log('Navigate to Signup')}
        variant="outline"
        style={styles.signupButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 32,
    textAlign: 'center',
  },
  signupButton: {
    marginTop: 12,
  },
});
