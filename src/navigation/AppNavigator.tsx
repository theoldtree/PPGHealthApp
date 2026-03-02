import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {AuthNavigator} from './AuthNavigator';
import {MainNavigator} from './MainNavigator';
import {ProfileCompleteScreen} from '../screens/ProfileCompleteScreen';
import {useAuth} from '../context/AuthContext';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {SKIP_AUTH} from '../config/measurement';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const {isAuthenticated, user, isLoading, mockLogin} = useAuth();

  // DEV: auto-login when SKIP_AUTH is enabled
  useEffect(() => {
    if (SKIP_AUTH && !isAuthenticated && !isLoading) {
      mockLogin();
    }
  }, [isLoading, isAuthenticated, mockLogin]);

  // Show loading screen while checking auth state (or while mock-logging in)
  if (isLoading || (SKIP_AUTH && !isAuthenticated)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        // Not authenticated: show login/signup screens
        <AuthNavigator />
      ) : !user?.is_profile_complete ? (
        // Authenticated but profile not complete: show profile complete screen
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen
            name="ProfileComplete"
            component={ProfileCompleteScreen}
          />
        </Stack.Navigator>
      ) : (
        // Authenticated and profile complete: show main app
        <MainNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
