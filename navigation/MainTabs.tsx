// ============================================================================
// navigation/MainTabs.tsx
// Thanh điều hướng 5 tab dưới cùng (Mục tiêu, Lịch tập, Chạy bộ, Thống kê, Hồ sơ):
// - Khắc phục triệt để lỗi icon bị cắt mất một nửa bên phải:
//   1. Bỏ qua TabBarIcon mặc định của @react-navigation/bottom-tabs (vốn ép khung
//      wrapperMaterial cố định 24x24px với position: 'absolute', khiến View con có
//      paddingHorizontal: 12 đẩy lệch icon sang phải 12px và bị cắt cụt ở ranh giới 24px).
//   2. Dùng Custom TabBar với khung nền tròn nhạt (pill 56x32px) rộng rãi bao trọn
//      icon 24x24px và vẽ icon bằng SVG (react-native-svg) sắc nét, không phụ thuộc
//      font hệ thống hay bộ đệm font Android.
// - Dùng useSafeAreaInsets() để cộng thêm vùng đệm an toàn dưới đáy (home indicator).
// - Mỗi tab có vùng chạm >= 44px, icon 24px, nhãn 12.5sp canh giữa hai chiều.
// ============================================================================

import React, { memo } from 'react';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import RunScreen from '../screens/running/RunScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import TodayScreen from '../screens/TodayScreen';
import StatisticsNavigator from './StatisticsNavigator';
import {
  fontWeight,
  layout,
} from '../constants/theme';
import { useTheme } from '../store/themeStore';

export type MainTabParamList = {
  Today: undefined;
  Schedule: undefined;
  Run: undefined;
  Stats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Today: 'Mục tiêu',
  Schedule: 'Lịch tập',
  Run: 'Chạy bộ',
  Stats: 'Thống kê',
  Profile: 'Hồ sơ',
};

/**
 * Bộ icon SVG 24x24px chuẩn cho 5 tab dưới đáy:
 * Dùng react-native-svg để vẽ vector trực tiếp trong viewBox="0 0 24 24",
 * đảm bảo không bao giờ bị cắt chữ (clipping) bởi TextView của Android.
 */
const TabSvgIcon = memo(function TabSvgIcon({
  routeName,
  color,
  focused,
}: {
  routeName: keyof MainTabParamList;
  color: string;
  focused: boolean;
}) {
  const strokeWidth = focused ? 2.3 : 1.9;

  switch (routeName) {
    case 'Today':
      // Icon mục tiêu
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="12"
            r="9"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={focused ? color : 'none'}
            fillOpacity={focused ? 0.16 : 0}
          />
          <Circle
            cx="12"
            cy="12"
            r="5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M12 12L19 5M15.5 5H19V8.5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'Schedule':
      // Icon Lịch tập
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="3"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={focused ? color : 'none'}
            fillOpacity={focused ? 0.14 : 0}
          />
          <Path
            d="M16 3V7M8 3V7M3 10H21"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Circle cx="8.5" cy="14.5" r="1.2" fill={color} />
          <Circle cx="12" cy="14.5" r="1.2" fill={color} />
          <Circle cx="15.5" cy="14.5" r="1.2" fill={color} />
        </Svg>
      );

    case 'Run':
      // Icon Chạy bộ / Bước chân
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle cx="14.5" cy="4.5" r="2" stroke={color} strokeWidth={strokeWidth} />
          <Path
            d="M7 21L10.5 15.5L13 17L15.5 12.5M10.5 15.5L12.5 10L9.5 9L7 12.5M12.5 10L16 12L18.5 10.5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'Stats':
      // Icon Thống kê (Biểu đồ cột)
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 20H20"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Rect
            x="6"
            y="12"
            width="3"
            height="7"
            rx="1"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={focused ? color : 'none'}
            fillOpacity={focused ? 0.22 : 0}
          />
          <Rect
            x="11"
            y="7"
            width="3"
            height="12"
            rx="1"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={focused ? color : 'none'}
            fillOpacity={focused ? 0.35 : 0}
          />
          <Rect
            x="16"
            y="10"
            width="3"
            height="9"
            rx="1"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={focused ? color : 'none'}
            fillOpacity={focused ? 0.22 : 0}
          />
        </Svg>
      );

    case 'Profile':
      // Icon Hồ sơ người dùng
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="8"
            r="4"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={focused ? color : 'none'}
            fillOpacity={focused ? 0.2 : 0}
          />
          <Path
            d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
});

/**
 * Thanh điều hướng đáy FitLog tuỳ chỉnh (Custom TabBar):
 * - Giữ trọn vẹn icon SVG trong vùng vẽ, triệt tiêu lỗi clipping trên Android.
 * - Khoảng chạm rộng rãi (>= 44px) đúng chuẩn giao diện di động.
 */
export function FitLogBottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom : layout.screenPadding,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const routeName = route.name as keyof MainTabParamList;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : TAB_LABELS[routeName] ?? route.name;

        const isFocused = state.index === index;
        const itemColor = isFocused ? colors.primary : colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            aria-selected={isFocused}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
          >
            {/* Khung pill 56x32px bao trọn icon 24x24px, không bao giờ cắt ngang icon */}
            <View
              style={[
                styles.iconPill,
                isFocused && { backgroundColor: colors.primaryLight },
              ]}
            >
              <TabSvgIcon
                routeName={routeName}
                color={itemColor}
                focused={isFocused}
              />
            </View>

            {/* Nhãn tab 12.5sp canh giữa */}
            <Text
              numberOfLines={1}
              style={[
                styles.tabLabel,
                {
                  color: itemColor,
                  fontWeight: isFocused ? fontWeight.bold : fontWeight.medium,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Today"
      tabBar={(props) => <FitLogBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarLabel: 'Mục tiêu' }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ tabBarLabel: 'Lịch tập' }}
      />
      <Tab.Screen
        name="Run"
        component={RunScreen}
        options={{ tabBarLabel: 'Chạy bộ' }}
      />
      <Tab.Screen
        name="Stats"
        component={StatisticsNavigator}
        options={{ tabBarLabel: 'Thống kê' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Hồ sơ' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    minHeight: layout.minTouchSize, // >= 44px
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconPill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  tabLabel: {
    fontSize: 12.5,
    lineHeight: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
