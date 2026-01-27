import React, {useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {AuthNavigator} from './AuthNavigator';
import {MainNavigator} from './MainNavigator';

export const AppNavigator: React.FC = () => {
  // TODO: Replace with actual auth state from AuthContext
  const [isAuthenticated] = useState(false);

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
