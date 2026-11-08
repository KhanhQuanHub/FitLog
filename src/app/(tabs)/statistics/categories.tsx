// ============================================================================
// Module: src/app/(tabs)/statistics/categories.tsx
// Chức năng: Route hiển thị danh sách 7 danh mục thống kê (`/statistics/categories`).
// ============================================================================

import { router } from 'expo-router';
import StatisticsCategoriesScreen from '../../../../screens/statistics/StatisticsCategoriesScreen';
import { useStatisticsData } from '../../../../screens/statistics/StatisticsDataProvider';
import { statisticsDetailHref } from '../../../../screens/statistics/statisticsRoutes';
import { backToStatistics } from '../../../../screens/statistics/useStatisticsNavigation';

/**
 * Component Route cho đường dẫn `/statistics/categories`.
 *
 * @returns JSX màn hình `StatisticsCategoriesScreen`
 */
export default function StatisticsCategoriesRoute() {
  const { today } = useStatisticsData();

  return (
    <StatisticsCategoriesScreen
      today={today}
      onBack={backToStatistics}
      onOpenDetail={(destination) => router.push(statisticsDetailHref(destination))}
    />
  );
}
