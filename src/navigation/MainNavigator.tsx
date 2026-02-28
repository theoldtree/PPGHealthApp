import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Svg, {Path, Polyline, Line, Circle} from 'react-native-svg';
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

// ── SVG icon components ────────────────────────────────────────────────────────

const WaveformIcon = ({color}: {color: string}) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Polyline
      points="2,12 5,7 8,14 11,4 14,16 17,10 20,12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const DiaryIcon = ({color}: {color: string}) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 3h13a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Line
      x1="8"
      y1="9"
      x2="14"
      y2="9"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Line
      x1="8"
      y1="13"
      x2="14"
      y2="13"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);

const BellIcon = ({color}: {color: string}) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M13.73 21a2 2 0 0 1-3.46 0"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const PersonIcon = ({color}: {color: string}) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle
      cx="12"
      cy="7"
      r="4"
      stroke={color}
      strokeWidth={1.8}
    />
  </Svg>
);

// ── Navigator ─────────────────────────────────────────────────────────────────

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A1A2E',
        tabBarInactiveTintColor: '#AAAAAA',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 6,
        },
        tabBarStyle: {
          height: 76,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EEEEEE',
        },
        tabBarItemStyle: {
          gap: 4,
        },
      }}>
      <Tab.Screen
        name="Measurement"
        component={MeasurementScreen}
        options={{
          title: '측정',
          tabBarIcon: ({color}) => <WaveformIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Diary"
        component={DiaryScreen}
        options={{
          title: '다이어리',
          tabBarIcon: ({color}) => <DiaryIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Notification"
        component={NotificationScreen}
        options={{
          title: '알림',
          tabBarIcon: ({color}) => <BellIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{
          title: '마이페이지',
          tabBarIcon: ({color}) => <PersonIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
