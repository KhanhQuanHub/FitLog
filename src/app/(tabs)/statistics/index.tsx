import { router } from 'expo-router';
import StatisticsSummaryScreen from '../../../../screens/StatsScreen';
import { statisticsDetailHref } from '../../../../screens/statistics/statisticsRoutes';
import { useStatisticsFocusRefresh } from '../../../../screens/statistics/useStatisticsNavigation';
export default function StatisticsRoute() {
  useStatisticsFocusRefresh();
  return <StatisticsSummaryScreen onOpenDetail={destination => router.push(statisticsDetailHref(destination))}
    onOpenCategories={() => router.push('/statistics/categories')} />;
}
