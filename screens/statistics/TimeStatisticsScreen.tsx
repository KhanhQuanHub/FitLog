// ============================================================================
// Module: screens/statistics/TimeStatisticsScreen.tsx
// Chức năng: Màn hình thống kê chi tiết "Thời gian luyện tập":
// - Phần 1: Thời gian tập theo lịch (`workouts`) gồm tổng số phút, trung bình
//   mỗi buổi và biểu đồ cột số phút tập theo từng ngày/tháng.
// - Phần 2: Thời gian chạy bộ (`runs`) gồm thời gian chạy, trung bình mỗi buổi,
//   thời gian tạm dừng và biểu đồ cột số phút chạy.
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
import { sourceMetric, toMinutes } from './viewModel';

/**
 * Nội dung bên trong màn hình Thời gian luyện tập.
 *
 * @param context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX hiển thị số liệu thời gian từ lịch tập và chạy bộ
 */
function TimeContent({
  snapshot,
  view,
  refresh,
  chartWidth,
}: StatisticsScreenContext) {
  const { report, label, series } = view;

  // Chuẩn bị danh sách 2 thẻ chỉ số thời gian tập theo lịch
  const scheduleTimeItems: StatisticsMetricCardProps[] = [
    {
      title: 'Thời gian đã tập',
      periodLabel: label,
      metric: sourceMetric(snapshot.workouts, report.schedule.minutes),
      unit: 'minutes',
    },
    {
      title: 'Trung bình mỗi buổi',
      periodLabel: label,
      metric: sourceMetric(snapshot.workouts, report.schedule.averageMinutes),
      unit: 'minutes',
    },
  ];

  // Chuẩn bị danh sách 3 thẻ chỉ số thời gian chạy bộ (đổi từ giây sang phút)
  const runningTimeItems: StatisticsMetricCardProps[] = [
    {
      title: 'Thời gian chạy',
      periodLabel: label,
      metric: sourceMetric(snapshot.runs, toMinutes(report.running.durationSec)),
      unit: 'minutes',
    },
    {
      title: 'Trung bình mỗi buổi chạy',
      periodLabel: label,
      metric: sourceMetric(
        snapshot.runs,
        toMinutes(report.running.averageDurationSec)
      ),
      unit: 'minutes',
    },
    {
      title: 'Thời gian tạm dừng',
      periodLabel: label,
      metric: sourceMetric(snapshot.runs, toMinutes(report.running.pausedSec)),
      unit: 'minutes',
    },
  ];

  const scheduleMinutePoints = series('schedule', 'minutes');
  const runningMinutePoints = series('running', 'minutes');

  return (
    <>
      <StatisticsSourceSection
        title="Tập theo lịch"
        source={snapshot.workouts}
        refresh={refresh}
      >
        <StatisticsMetricGrid items={scheduleTimeItems} />
        <StatisticsBarChart
          width={chartWidth}
          title="Phút tập theo lịch"
          unit="minutes"
          points={scheduleMinutePoints}
        />
      </StatisticsSourceSection>

      <StatisticsSourceSection
        title="Chạy bộ"
        source={snapshot.runs}
        refresh={refresh}
      >
        <StatisticsMetricGrid items={runningTimeItems} />
        <StatisticsBarChart
          width={chartWidth}
          title="Phút chạy đã ghi nhận"
          unit="minutes"
          points={runningMinutePoints}
          hint="Thời gian vận động, không gồm tạm dừng."
        />
      </StatisticsSourceSection>

      <StatisticsInfo>
        Lịch tập và buổi chạy được trình bày riêng để tránh tính hai lần cùng một
        hoạt động.
      </StatisticsInfo>
    </>
  );
}

/**
 * Component màn hình Thời gian luyện tập.
 *
 * @param props Các thuộc tính điều hướng và kỳ mặc định `StatisticsScreenProps`
 * @returns JSX màn hình Thời gian luyện tập
 */
export default function TimeStatisticsScreen(props: StatisticsScreenProps) {
  return (
    <StatisticsDetailScreen
      {...props}
      title="Thời gian luyện tập"
      description="Theo dõi thời gian từ các buổi đã ghi nhận."
    >
      {(context) => <TimeContent {...context} />}
    </StatisticsDetailScreen>
  );
}
