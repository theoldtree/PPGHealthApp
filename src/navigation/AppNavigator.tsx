import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {AuthNavigator} from './AuthNavigator';
import {MainNavigator} from './MainNavigator';
import {ProfileCompleteScreen} from '../screens/ProfileCompleteScreen';
import {useAuth} from '../context/AuthContext';
import {View, ActivityIndicator, StyleSheet} from 'react-native';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const {isAuthenticated, user, isLoading} = useAuth();

  // Show loading screen while checking auth state
  if (isLoading) {
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
