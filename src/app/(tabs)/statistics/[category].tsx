import { useLocalSearchParams } from 'expo-router';
import { StatisticsDataState } from '../../../../components/statistics';
import { useStatisticsData } from '../../../../screens/statistics/StatisticsDataProvider';
import { parseStatisticsDestination } from '../../../../screens/statistics/statisticsRoutes';
import { backToStatistics, useStatisticsFocusRefresh } from '../../../../screens/statistics/useStatisticsNavigation';
import { CaloriesStatisticsScreen, GoalsStatisticsScreen, HabitsStatisticsScreen, RunningStatisticsScreen,
  ScheduleStatisticsScreen, TimeStatisticsScreen, WeightStatisticsScreen } from '../../../../screens/statistics';

const screens = { time: TimeStatisticsScreen, calories: CaloriesStatisticsScreen, running: RunningStatisticsScreen,
  schedule: ScheduleStatisticsScreen, weight: WeightStatisticsScreen, goals: GoalsStatisticsScreen, habits: HabitsStatisticsScreen };
export default function StatisticsDetailRoute() {
  const params = useLocalSearchParams();
  const { today } = useStatisticsData();
  useStatisticsFocusRefresh();
  const destination = parseStatisticsDestination(params.category, params.kind, params.date, today);
  if (!destination) return <StatisticsDataState state="empty" title="Danh mục không tồn tại"
    message="Chọn một trong bảy danh mục thống kê của FitLog." onRetry={backToStatistics} />;
  const Screen = screens[destination.category];
  return <Screen key={destination.category + ':' + destination.kind + ':' + destination.anchor} onBack={backToStatistics}
    initialKind={destination.kind} initialAnchor={destination.anchor} />;
}
