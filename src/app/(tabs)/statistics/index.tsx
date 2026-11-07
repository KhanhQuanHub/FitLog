// ============================================================================
// Module: src/app/(tabs)/statistics/index.tsx
// Chức năng: Route gốc của tab Thống kê (`/statistics`), hiển thị màn hình
// Tóm tắt (`StatisticsSummaryScreen`) và nối các sự kiện bấm thẻ sang Expo Router.
// ============================================================================

import { router } from 'expo-router';
import StatisticsSummaryScreen from '../../../../screens/StatsScreen';
import { statisticsDetailHref } from '../../../../screens/statistics/statisticsRoutes';
import { useStatisticsFocusRefresh } from '../../../../screens/statistics/useStatisticsNavigation';

/**
 * Component Route cho đường dẫn `/statistics`.
 *
 * @returns JSX màn hình `StatisticsSummaryScreen`
 */
export default function StatisticsRoute() {
  // Tự động làm mới dữ liệu khi người dùng chuyển về màn hình này
  useStatisticsFocusRefresh();

  return (
    <StatisticsSummaryScreen
      onOpenDetail={(destination) => router.push(statisticsDetailHref(destination))}
      onOpenCategories={() => router.push('/statistics/categories')}
    />
  );
}
