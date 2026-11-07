// ============================================================================
// Module: src/app/(tabs)/statistics/[category].tsx
// Chức năng: Route động (`/statistics/[category]`) hiển thị 1 trong 7 màn hình
// thống kê chi tiết tùy theo tham số `category`, `kind` và `date` trên URL.
// ============================================================================

import { useLocalSearchParams } from 'expo-router';
import { StatisticsDataState } from '../../../../components/statistics';
import { useStatisticsData } from '../../../../screens/statistics/StatisticsDataProvider';
import { parseStatisticsDestination } from '../../../../screens/statistics/statisticsRoutes';
import {
  backToStatistics,
  useStatisticsFocusRefresh,
} from '../../../../screens/statistics/useStatisticsNavigation';
import {
  CaloriesStatisticsScreen,
  GoalsStatisticsScreen,
  HabitsStatisticsScreen,
  RunningStatisticsScreen,
  ScheduleStatisticsScreen,
  TimeStatisticsScreen,
  WeightStatisticsScreen,
} from '../../../../screens/statistics';

/** Bảng ánh xạ từ tên `category` trên URL sang Component màn hình chi tiết tương ứng */
const screens = {
  time: TimeStatisticsScreen,
  calories: CaloriesStatisticsScreen,
  running: RunningStatisticsScreen,
  schedule: ScheduleStatisticsScreen,
  weight: WeightStatisticsScreen,
  goals: GoalsStatisticsScreen,
  habits: HabitsStatisticsScreen,
};

/**
 * Component Route động cho đường dẫn `/statistics/[category]`.
 *
 * @returns JSX màn hình chi tiết tương ứng hoặc thông báo "Danh mục không tồn tại"
 */
export default function StatisticsDetailRoute() {
  const params = useLocalSearchParams();
  const { today } = useStatisticsData();
  useStatisticsFocusRefresh();

  const destination = parseStatisticsDestination(
    params.category,
    params.kind,
    params.date,
    today
  );

  if (!destination) {
    return (
      <StatisticsDataState
        state="empty"
        title="Danh mục không tồn tại"
        message="Chọn một trong bảy danh mục thống kê của FitLog."
        onRetry={backToStatistics}
      />
    );
  }

  const Screen = screens[destination.category];
  const screenKey = `${destination.category}:${destination.kind}:${destination.anchor}`;

  return (
    <Screen
      key={screenKey}
      onBack={backToStatistics}
      initialKind={destination.kind}
      initialAnchor={destination.anchor}
    />
  );
}
