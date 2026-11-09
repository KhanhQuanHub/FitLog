// ============================================================================
// Module: screens/statistics/index.ts
// Chức năng: Điểm xuất tập trung (barrel export) cho 7 màn hình thống kê chi tiết
// và `StatisticsDataProvider`.
// ============================================================================

export { default as RunningStatisticsScreen } from './RunningStatisticsScreen';
export { default as ScheduleStatisticsScreen } from './ScheduleStatisticsScreen';
export { default as TimeStatisticsScreen } from './TimeStatisticsScreen';
export { default as CaloriesStatisticsScreen } from './CaloriesStatisticsScreen';
export { default as WeightStatisticsScreen } from './WeightStatisticsScreen';
export { default as GoalsStatisticsScreen } from './GoalsStatisticsScreen';
export { default as HabitsStatisticsScreen } from './HabitsStatisticsScreen';
export { StatisticsDataProvider } from './StatisticsDataProvider';
export type { StatisticsScreenProps } from './StatisticsDetailScreen';
