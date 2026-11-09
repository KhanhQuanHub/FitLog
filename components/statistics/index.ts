// ============================================================================
// Module: components/statistics/index.ts
// Chức năng: Điểm xuất (barrel export) tập trung các component giao diện dùng
// chung cho chức năng thống kê để các màn hình import ngắn gọn hơn.
// ============================================================================

export { StatisticsPeriodPicker } from './StatisticsPeriodPicker';
export { StatisticsMetricCard, StatisticsMetricValue } from './StatisticsMetricCard';
export { StatisticsProgress, StatisticsProgressBar } from './StatisticsProgress';
export { StatisticsBarChart, StatisticsLineChart } from './StatisticsChart';
export { StatisticsActivityRow } from './StatisticsActivityRow';
export {
  StatisticsDataState,
  StatisticsSourceNotice,
  StatisticsSourceContent,
  StatisticsStatusBadge,
} from './StatisticsStatus';
export type { StatisticsChartPoint, StatisticsUnit } from './presentation';
export type { StatisticsPeriodPickerProps } from './StatisticsPeriodPicker';
export type {
  StatisticsMetricCardProps,
  StatisticsMetricValueProps,
} from './StatisticsMetricCard';
export type { StatisticsProgressProps } from './StatisticsProgress';
export type { StatisticsChartProps } from './StatisticsChart';
export type { StatisticsActivityRowProps } from './StatisticsActivityRow';
