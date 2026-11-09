// ============================================================================
// Module: screens/statistics/ScheduleStatisticsScreen.tsx
// Chức năng: Màn hình thống kê chi tiết "Lịch tập và mức độ hoàn thành":
// - Hiển thị số buổi Đã hoàn thành, Bỏ lỡ, Còn chờ và Tỷ lệ hoàn thành (%).
// - Hiển thị danh sách các bài tập thường thực hiện (`byExercise`).
// - Hiển thị biểu đồ phân bố buổi tập theo nhóm cơ (`byMuscleGroup`).
// - Hiển thị danh sách chi tiết từng buổi tập trong kỳ.
// ============================================================================

import { StatisticsActivityRow } from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import {
  formatStatisticsNumber,
  formatStatisticsValue,
} from '../../components/statistics/presentation';
import { getWorkoutState } from '../../domain/statistics/statistics';
import type { StatisticsMetric, WorkoutRecord, WorkoutState } from '../../domain/statistics/types';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type {
  StatisticsScreenContext,
  StatisticsScreenProps,
} from './StatisticsDetailScreen';
import {
  StatisticsHistory,
  StatisticsInfo,
  StatisticsMetricGrid,
  StatisticsSection,
  StatisticsSourceSection,
} from './shared';
import {
  counted,
  measurement,
  sourceMetric,
  statisticsDateLabel,
} from './viewModel';

/** Bản đồ tên trạng thái tiếng Việt cho từng trạng thái buổi tập trong lịch */
const WORKOUT_STATE_LABELS: Record<WorkoutState, string> = {
  done: 'Đã hoàn thành',
  missed: 'Bỏ lỡ',
  pending: 'Còn chờ',
  unknown: 'Chưa xác định',
};

/**
 * Nội dung bên trong màn hình Lịch tập và mức độ hoàn thành.
 *
 * @param context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX hiển thị kết quả lịch tập, bài tập, nhóm cơ và lịch sử buổi tập
 */
function ScheduleContent({
  snapshot,
  view,
  today,
  refresh,
  chartWidth,
}: StatisticsScreenContext) {
  const { report, label, series } = view;
  const { schedule } = report;

  // Chuẩn bị danh sách 4 thẻ chỉ số tổng quan lịch tập
  const scheduleSummaryItems: StatisticsMetricCardProps[] = [
    {
      title: 'Buổi hoàn thành',
      periodLabel: label,
      metric: counted(snapshot.workouts, schedule.counts.done),
      unit: 'count',
    },
    {
      title: 'Buổi bỏ lỡ',
      periodLabel: label,
      metric: counted(snapshot.workouts, schedule.counts.missed),
      unit: 'count',
    },
    {
      title: 'Buổi còn chờ',
      periodLabel: label,
      metric: counted(snapshot.workouts, schedule.counts.pending),
      unit: 'count',
    },
    {
      title: 'Tỷ lệ hoàn thành',
      periodLabel: label,
      metric: sourceMetric(
        snapshot.workouts,
        measurement(schedule.completionPercent)
      ),
      unit: 'bmi',
      unitLabel: '%',
    },
  ];

  const hasUnknownWorkoutRecords =
    schedule.counts.unknown > 0 || report.quality.invalidWorkoutDates > 0;

  /**
   * Vẽ một dòng thống kê bài tập trong mục "Bài tập thường thực hiện".
   */
  const renderExerciseSummaryRow = (row: {
    key: string;
    label: string;
    sessions: number;
    minutes: StatisticsMetric;
  }) => {
    const sessionsDisplay = formatStatisticsNumber(row.sessions);
    const minutesDisplay = formatStatisticsValue(row.minutes.value, 'minutes');
    const incompleteNote = row.minutes.complete ? '' : ' (chưa đầy đủ)';

    return (
      <StatisticsActivityRow
        key={row.key}
        title={row.label}
        dateLabel={label}
        detail={`${sessionsDisplay} buổi · ${minutesDisplay} phút${incompleteNote}`}
      />
    );
  };

  /**
   * Vẽ một dòng buổi tập cụ thể trong mục "Các buổi trong kỳ".
   */
  const renderScheduleWorkoutRow = (row: WorkoutRecord, index: number) => {
    const state = getWorkoutState(row, today);
    const timeSuffix = typeof row.time === 'string' ? ` · ${row.time}` : '';
    const exerciseTitle =
      typeof row.exercise?.name === 'string'
        ? row.exercise.name
        : 'Chưa rõ bài tập';

    let detailText = 'Chưa có kết quả luyện tập hoàn thành.';
    if (state === 'done') {
      const durationValue =
        typeof row.durationMin === 'number' ? row.durationMin : null;
      const caloriesValue =
        typeof row.caloriesBurned === 'number' ? row.caloriesBurned : null;
      const durationDisplay = formatStatisticsValue(durationValue, 'minutes');
      const caloriesDisplay = formatStatisticsValue(caloriesValue, 'kcal');
      detailText = `${durationDisplay} phút · ${caloriesDisplay} kcal ước tính`;
    }

    return (
      <StatisticsActivityRow
        key={String(row.id ?? index)}
        title={exerciseTitle}
        dateLabel={`${statisticsDateLabel(row.date)}${timeSuffix}`}
        statusLabel={WORKOUT_STATE_LABELS[state]}
        detail={detailText}
      />
    );
  };

  return (
    <StatisticsSourceSection
      title="Kết quả theo lịch"
      source={snapshot.workouts}
      refresh={refresh}
    >
      {/* 1. Lưới 4 chỉ số tổng quan lịch tập */}
      <StatisticsMetricGrid items={scheduleSummaryItems} />

      {hasUnknownWorkoutRecords ? (
        <StatisticsInfo>
          Có buổi chưa rõ trạng thái hoặc ngày nên chưa thể đánh giá đầy đủ.
        </StatisticsInfo>
      ) : null}

      {/* 2. Thống kê theo từng bài tập */}
      <StatisticsSection title="Bài tập thường thực hiện">
        <StatisticsHistory
          records={schedule.byExercise}
          emptyMessage="Chưa có buổi hoàn thành để thống kê bài tập."
          renderRow={renderExerciseSummaryRow}
        />
      </StatisticsSection>

      {/* 3. Phân bố buổi tập theo nhóm cơ */}
      <StatisticsSection title="Phân bố nhóm cơ">
        {schedule.byMuscleGroup.length === 0 ? (
          <StatisticsInfo>Chưa có buổi hoàn thành để phân bố nhóm cơ.</StatisticsInfo>
        ) : (
          schedule.byMuscleGroup.map((group, index) => (
            <StatisticsInfo key={group.key}>
              {index + 1}. {group.label}: {group.sessions} buổi
            </StatisticsInfo>
          ))
        )}
      </StatisticsSection>

      {/* 4. Danh sách tất cả các buổi tập trong kỳ */}
      <StatisticsSection title="Các buổi trong kỳ">
        <StatisticsHistory
          records={schedule.records.slice().reverse()}
          emptyMessage="Chưa có buổi nào được lên lịch trong kỳ này."
          renderRow={renderScheduleWorkoutRow}
        />
      </StatisticsSection>

      <StatisticsInfo>
        Tỷ lệ chỉ xét buổi hoàn thành và bỏ lỡ. Buổi còn chờ không làm giảm tỷ lệ;
        lịch chưa hoàn thành chỉ bị coi là bỏ lỡ sau khi hết ngày dự kiến.
      </StatisticsInfo>
    </StatisticsSourceSection>
  );
}

/**
 * Component màn hình Lịch tập và mức độ hoàn thành.
 *
 * @param props Các thuộc tính điều hướng và kỳ mặc định `StatisticsScreenProps`
 * @returns JSX màn hình Lịch tập
 */
export default function ScheduleStatisticsScreen(props: StatisticsScreenProps) {
  return (
    <StatisticsDetailScreen
      {...props}
      title="Lịch tập và mức độ hoàn thành"
      description="Một buổi trong lịch được tính là một buổi hoàn chỉnh."
    >
      {(context) => <ScheduleContent {...context} />}
    </StatisticsDetailScreen>
  );
}
