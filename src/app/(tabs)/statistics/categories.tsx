import { router } from 'expo-router';
import StatisticsCategoriesScreen from '../../../../screens/statistics/StatisticsCategoriesScreen';
import { useStatisticsData } from '../../../../screens/statistics/StatisticsDataProvider';
import { statisticsDetailHref } from '../../../../screens/statistics/statisticsRoutes';
import { backToStatistics } from '../../../../screens/statistics/useStatisticsNavigation';
export default function StatisticsCategoriesRoute() {
  const { today } = useStatisticsData();
  return <StatisticsCategoriesScreen today={today} onBack={backToStatistics}
    onOpenDetail={destination => router.push(statisticsDetailHref(destination))} />;
}
