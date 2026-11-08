// ============================================================================
// navigation/StatisticsNavigator.tsx
// Bộ điều hướng ngăn xếp riêng cho phân hệ Thống kê (Tab Thống kê):
// - Quản lý 3 màn hình: Tóm tắt (StatisticsSummary), Danh mục (StatisticsCategories),
//   và Chi tiết (StatisticsDetail) hiển thị 1 trong 7 nhóm số liệu.
// - Bọc chung một `StatisticsDataProvider` duy nhất ở tầng ngoài để cả 3 màn hình
//   chia sẻ chung bộ nhớ đệm (cache), snapshot 5 nguồn dữ liệu và cơ chế tự làm mới.
// ============================================================================

import React from 'react';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { StatisticsDataState } from '../components/statistics';
import {
  StatisticsDataProvider,
  useStatisticsData,
} from '../screens/statistics/StatisticsDataProvider';
import StatisticsSummaryScreen from '../screens/statistics/StatisticsSummaryScreen';
import StatisticsCategoriesScreen from '../screens/statistics/StatisticsCategoriesScreen';
import {
  parseStatisticsDestination,
  StatisticsCategory,
} from '../screens/statistics/statisticsRoutes';
import type { PeriodKind } from '../domain/statistics/types';
import { useStatisticsFocusRefresh } from '../screens/statistics/useStatisticsNavigation';
import {
  CaloriesStatisticsScreen,
  GoalsStatisticsScreen,
  HabitsStatisticsScreen,
  RunningStatisticsScreen,
  ScheduleStatisticsScreen,
  TimeStatisticsScreen,
  WeightStatisticsScreen,
} from '../screens/statistics';

export type StatisticsStackParamList = {
  StatisticsSummary: undefined;
  StatisticsCategories: undefined;
  StatisticsDetail: {
    category: StatisticsCategory;
    kind?: PeriodKind;
    date?: string;
  };
};

/** Ánh xạ 7 mã danh mục sang màn hình chi tiết tương ứng */
const screens = {
  time: TimeStatisticsScreen,
  calories: CaloriesStatisticsScreen,
  running: RunningStatisticsScreen,
  schedule: ScheduleStatisticsScreen,
  weight: WeightStatisticsScreen,
  goals: GoalsStatisticsScreen,
  habits: HabitsStatisticsScreen,
};

export function StatisticsSummaryRoute({
  navigation,
}: NativeStackScreenProps<StatisticsStackParamList, 'StatisticsSummary'>) {
  useStatisticsFocusRefresh();

  return (
    <StatisticsSummaryScreen
      onOpenDetail={(destination) =>
        navigation.navigate('StatisticsDetail', {
          category: destination.category,
          kind: destination.kind,
          date: destination.anchor,
        })
      }
      onOpenCategories={() => navigation.navigate('StatisticsCategories')}
    />
  );
}

export function StatisticsCategoriesRoute({
  navigation,
}: NativeStackScreenProps<StatisticsStackParamList, 'StatisticsCategories'>) {
  const { today } = useStatisticsData();

  return (
    <StatisticsCategoriesScreen
      today={today}
      onBack={() => navigation.goBack()}
      onOpenDetail={(destination) =>
        navigation.navigate('StatisticsDetail', {
          category: destination.category,
          kind: destination.kind,
          date: destination.anchor,
        })
      }
    />
  );
}

export function StatisticsDetailRoute({
  route,
  navigation,
}: NativeStackScreenProps<StatisticsStackParamList, 'StatisticsDetail'>) {
  const { today } = useStatisticsData();
  useStatisticsFocusRefresh();

  const destination = parseStatisticsDestination(
    route.params?.category,
    route.params?.kind,
    route.params?.date,
    today
  );

  if (!destination) {
    return (
      <StatisticsDataState
        state="empty"
        title="Danh mục không tồn tại"
        message="Chọn một trong bảy danh mục thống kê của FitLog."
        onRetry={() => navigation.goBack()}
      />
    );
  }

  const Screen = screens[destination.category];
  const screenKey = `${destination.category}:${destination.kind}:${destination.anchor}`;

  return (
    <Screen
      key={screenKey}
      onBack={() => navigation.goBack()}
      initialKind={destination.kind}
      initialAnchor={destination.anchor}
    />
  );
}

const Stack = createNativeStackNavigator<StatisticsStackParamList>();

export default function StatisticsNavigator() {
  return (
    <StatisticsDataProvider>
      <Stack.Navigator
        initialRouteName="StatisticsSummary"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="StatisticsSummary" component={StatisticsSummaryRoute} />
        <Stack.Screen name="StatisticsCategories" component={StatisticsCategoriesRoute} />
        <Stack.Screen name="StatisticsDetail" component={StatisticsDetailRoute} />
      </Stack.Navigator>
    </StatisticsDataProvider>
  );
}
