import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {MeasurementScreen} from '../screens/MeasurementScreen';
import {DiaryScreen} from '../screens/DiaryScreen';
import {MyPageScreen} from '../screens/MyPageScreen';
import {NotificationScreen} from '../screens/NotificationScreen';

export type MainTabParamList = {
  Measurement: undefined;
  Diary: undefined;
  Notification: undefined;
  MyPage: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}>
      <Tab.Screen
        name="Measurement"
        component={MeasurementScreen}
        options={{
          title: '측정',
          headerTitle: 'PPG 측정',
        }}
      />
      <Tab.Screen
        name="Diary"
        component={DiaryScreen}
        options={{
          title: '다이어리',
          headerTitle: '측정 다이어리',
        }}
      />
      <Tab.Screen
        name="Notification"
        component={NotificationScreen}
        options={{
          title: '알림',
          headerTitle: '알림',
        }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{
          title: '마이페이지',
          headerTitle: '마이페이지',
        }}
      />
    </Tab.Navigator>
  );
};
