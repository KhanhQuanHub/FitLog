// ============================================================================
// Module: screens/statistics/CaloriesStatisticsScreen.tsx
// Chức năng: Màn hình thống kê chi tiết "Calo luyện tập":
// - Phần 1: Calo tiêu hao từ các buổi tập theo lịch đã hoàn thành (`workouts`).
// - Phần 2: Calo tiêu hao ước tính từ các buổi chạy bộ (`runs`).
// - Hai nguồn được giữ riêng biệt, không tự cộng gộp để tránh trùng lặp.
// ============================================================================

import { StatisticsBarChart } from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type {
  StatisticsScreenContext,
  StatisticsScreenProps,
} from './StatisticsDetailScreen';
import {
  StatisticsInfo,
  StatisticsMetricGrid,
  StatisticsSourceSection,
} from './shared';
import { sourceMetric } from './viewModel';

/**
 * Nội dung bên trong màn hình Calo luyện tập.
 *
 * @param context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX hiển thị số liệu calo từ lịch tập và chạy bộ
 */
function CaloriesContent({
  snapshot,
  view,
  refresh,
  chartWidth,
}: StatisticsScreenContext) {
  const { report, label, series } = view;

  // Chuẩn bị danh sách 2 thẻ chỉ số calo từ lịch tập
  const scheduleCalorieItems: StatisticsMetricCardProps[] = [
    {
      title: 'Calo tập theo lịch',
      periodLabel: label,
      metric: sourceMetric(snapshot.workouts, report.schedule.calories),
      unit: 'kcal',
      hint: 'Năng lượng tiêu hao ước tính.',
    },
    {
      title: 'Trung bình mỗi buổi',
      periodLabel: label,
      metric: sourceMetric(snapshot.workouts, report.schedule.averageCalories),
      unit: 'kcal',
    },
  ];

  // Chuẩn bị danh sách 2 thẻ chỉ số calo từ chạy bộ
  const runningCalorieItems: StatisticsMetricCardProps[] = [
    {
      title: 'Calo từ buổi chạy',
      periodLabel: label,
      metric: sourceMetric(snapshot.runs, report.running.calories),
      unit: 'kcal',
      hint: 'Năng lượng tiêu hao ước tính.',
    },
    {
      title: 'Trung bình mỗi buổi chạy',
      periodLabel: label,
      metric: sourceMetric(snapshot.runs, report.running.averageCalories),
      unit: 'kcal',
    },
  ];

  const scheduleCaloriePoints = series('schedule', 'calories');
  const runningCaloriePoints = series('running', 'calories');

  return (
    <>
      <StatisticsSourceSection
        title="Calo từ lịch tập"
        source={snapshot.workouts}
        refresh={refresh}
      >
        <StatisticsMetricGrid items={scheduleCalorieItems} />
        <StatisticsBarChart
          width={chartWidth}
          title="Calo theo lịch đã hoàn thành"
          unit="kcal"
          points={scheduleCaloriePoints}
        />
      </StatisticsSourceSection>

      <StatisticsSourceSection
        title="Calo từ chạy bộ"
        source={snapshot.runs}
        refresh={refresh}
      >
        <StatisticsMetricGrid items={runningCalorieItems} />
        <StatisticsBarChart
          width={chartWidth}
          title="Calo chạy đã ghi nhận"
          unit="kcal"
          points={runningCaloriePoints}
        />
      </StatisticsSourceSection>

      <StatisticsInfo>
        Đây là năng lượng luyện tập ước tính. Hai nguồn được giữ riêng, không cộng
        thành tổng calo cả ngày.
      </StatisticsInfo>
    </>
  );
}

/**
 * Component màn hình Calo luyện tập.
 *
 * @param props Các thuộc tính điều hướng và kỳ mặc định `StatisticsScreenProps`
 * @returns JSX màn hình Calo luyện tập
 */
export default function CaloriesStatisticsScreen(props: StatisticsScreenProps) {
  return (
    <StatisticsDetailScreen
      {...props}
      title="Calo luyện tập"
      description="Xem năng lượng ước tính từ lịch tập và các buổi chạy."
    >
      {(context) => <CaloriesContent {...context} />}
    </StatisticsDetailScreen>
  );
}
