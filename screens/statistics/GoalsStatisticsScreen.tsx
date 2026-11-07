// ============================================================================
// Module: screens/statistics/GoalsStatisticsScreen.tsx
// Chức năng: Màn hình thống kê chi tiết "Tiến độ mục tiêu":
// - Đối chiếu kết quả tập theo lịch trong tuần hiện tại với cam kết đã lưu:
//   1. Số phút tập theo lịch / `minMinutesPerWeek` (từ bảng `userGoals`).
//   2. Số buổi tập hoàn thành / `sessionsPerWeek` (từ bảng `profiles`).
//   3. Cân nặng gần nhất so với `targetWeightKg` (từ bảng `userGoals`).
// - Hiển thị thêm 2 biểu đồ cột kết quả phút tập và số buổi trong kỳ đang chọn.
// ============================================================================

import {
  StatisticsBarChart,
  StatisticsProgress,
  StatisticsSourceNotice,
} from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import type { StatisticsMetric, WorkoutRecord } from '../../domain/statistics/types';
import type { StatisticsSource } from '../../services/statisticsRepository';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type {
  StatisticsScreenContext,
  StatisticsScreenProps,
} from './StatisticsDetailScreen';
import {
  StatisticsInfo,
  StatisticsMetricGrid,
  StatisticsSourceSection,
  StatisticsText,
} from './shared';
import {
  isStatisticsSourceCurrent,
  measurement,
  sourceMetric,
  statisticsDateLabel,
  statisticsPeriodLabel,
} from './viewModel';

/**
 * Xây dựng chỉ số thực tế (`actual`) cho vòng tròn cam kết tuần (phút hoặc số buổi).
 * Tách hàm riêng thay vì sửa trực tiếp thuộc tính `.complete = false` trên đối tượng.
 *
 * @param workoutsSource Nguồn dữ liệu lịch tập (`snapshot.workouts`)
 * @param actualMetric Chỉ số thực tế trong tuần hiện tại
 * @param isTargetSourceCurrent Nguồn chứa cam kết (`userGoals` hoặc `profiles`) đã tải mới nhất chưa
 * @param isScheduleClean Lịch tập tuần hiện tại có sạch lỗi ngày/trạng thái không
 * @returns Đối tượng `StatisticsMetric` hoặc `null`
 */
function buildWeeklyTargetMetric(
  workoutsSource: StatisticsSource<WorkoutRecord>,
  actualMetric: StatisticsMetric,
  isTargetSourceCurrent: boolean,
  isScheduleClean: boolean
): StatisticsMetric | null {
  const base = sourceMetric(workoutsSource, actualMetric);
  if (!base) {
    return null;
  }
  return {
    ...base,
    complete: base.complete && isTargetSourceCurrent && isScheduleClean,
  };
}

/**
 * Tạo câu thông báo khi chưa xác định được mục tiêu đang áp dụng từ bảng `userGoals`.
 *
 * @param targetState Trạng thái mục tiêu ('selected' | 'missing' | 'ambiguous')
 * @param isUserGoalsComplete Nguồn `userGoals` đã tải đầy đủ chưa
 * @returns Câu thông báo tiếng Việt
 */
function getMissingGoalMessage(
  targetState: 'selected' | 'missing' | 'ambiguous',
  isUserGoalsComplete: boolean
): string {
  if (targetState === 'ambiguous') {
    return 'Có nhiều mục tiêu trong dữ liệu, chưa xác định được mục tiêu đang áp dụng.';
  }
  if (isUserGoalsComplete) {
    return 'Chưa có mục tiêu được ghi nhận.';
  }
  return 'Chưa đủ dữ liệu để xác định mục tiêu đang áp dụng.';
}

/**
 * Tạo nhãn phụ cho thẻ "Cân nặng gần nhất" khi đối chiếu với cân nặng đích.
 *
 * @param recordedDate Ngày đo cân nặng gần nhất
 * @param source Nguồn cân nặng ('history' | 'profile' | null)
 * @returns Chuỗi nhãn mô tả thời điểm hoặc nguồn cân nặng
 */
function getRecentWeightLabel(
  recordedDate: string | null,
  source: 'history' | 'profile' | null
): string {
  if (recordedDate) {
    return `Ghi nhận ${statisticsDateLabel(recordedDate)}`;
  }
  if (source === 'profile') {
    return 'Từ hồ sơ';
  }
  return 'Chưa có số đo';
}

/**
 * Nội dung bên trong màn hình Tiến độ mục tiêu.
 *
 * @param context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX hiển thị tiến độ thực hiện cam kết tuần và biểu đồ kết quả trong kỳ
 */
function GoalsContent({
  snapshot,
  view,
  today,
  refresh,
  chartWidth,
}: StatisticsScreenContext) {
  const { report, label, series } = view;
  const { targets } = report;

  const isGoalCurrent = isStatisticsSourceCurrent(snapshot.userGoals);
  const isProfileCurrent = isStatisticsSourceCurrent(snapshot.profiles);
  const isScheduleClean =
    report.weekSchedule.counts.unknown === 0 &&
    report.quality.invalidWorkoutDates === 0;

  // Chuẩn bị số phút thực tế và số buổi thực tế trong tuần hiện tại
  const minutesMetric = buildWeeklyTargetMetric(
    snapshot.workouts,
    targets.minutes.actual,
    isGoalCurrent,
    isScheduleClean
  );

  const sessionsMetric = buildWeeklyTargetMetric(
    snapshot.workouts,
    targets.sessions.actual,
    isProfileCurrent,
    isScheduleClean
  );

  const weekLabel = statisticsPeriodLabel('week', today);
  const recentWeightLabel = getRecentWeightLabel(
    report.weight.recordedDate,
    report.weight.source
  );

  /**
   * Vẽ phần nội dung bên trong khu vực "Mục tiêu đang áp dụng".
   */
  const renderActiveGoalSectionContent = () => {
    if (targets.state !== 'selected') {
      const message = getMissingGoalMessage(
        targets.state,
        snapshot.userGoals.complete
      );
      return <StatisticsInfo>{message}</StatisticsInfo>;
    }

    const weightComparisonItems: StatisticsMetricCardProps[] = [
      {
        title: 'Cân nặng đích',
        periodLabel: 'Mục tiêu đang lưu',
        metric: sourceMetric(
          snapshot.userGoals,
          measurement(targets.targetWeightKg)
        ),
        unit: 'kg',
      },
      {
        title: 'Cân nặng gần nhất',
        periodLabel: recentWeightLabel,
        metric: view.currentWeight,
        unit: 'kg',
      },
    ];

    return (
      <>
        <StatisticsInfo>{targets.name ?? 'Mục tiêu đã lưu'}</StatisticsInfo>

        <StatisticsSourceSection
          title="Cam kết thời gian tuần này"
          source={snapshot.workouts}
          refresh={refresh}
        >
          <StatisticsProgress
            title="Phút tập theo lịch"
            periodLabel={weekLabel}
            actual={minutesMetric}
            target={isGoalCurrent ? targets.minutes.target : null}
          />
        </StatisticsSourceSection>

        <StatisticsSourceNotice source={snapshot.weights} onRetry={refresh} />
        <StatisticsSourceNotice source={snapshot.profiles} onRetry={refresh} />

        <StatisticsMetricGrid items={weightComparisonItems} />
        <StatisticsText>
          Chỉ đối chiếu số đo hiện tại với cân nặng đích; chưa tính phần trăm
          hành trình cân nặng.
        </StatisticsText>
      </>
    );
  };

  return (
    <>
      {/* 1. Mục tiêu cá nhân từ bảng userGoals (thời gian/tuần & cân nặng đích) */}
      <StatisticsSourceSection
        title="Mục tiêu đang áp dụng"
        source={snapshot.userGoals}
        refresh={refresh}
      >
        {renderActiveGoalSectionContent()}
      </StatisticsSourceSection>

      {/* 2. Cam kết số buổi tập mỗi tuần từ bảng profiles */}
      <StatisticsSourceSection
        title="Cam kết số buổi tuần này"
        source={snapshot.profiles}
        refresh={refresh}
      >
        <StatisticsSourceSection
          title="Buổi theo lịch đã hoàn thành"
          source={snapshot.workouts}
          refresh={refresh}
        >
          {report.quality.profileAmbiguous ? (
            <StatisticsInfo>
              Có nhiều hồ sơ trong dữ liệu, chưa xác định được cam kết số buổi đang
              áp dụng.
            </StatisticsInfo>
          ) : (
            <StatisticsProgress
              title="Số buổi theo lịch"
              periodLabel={weekLabel}
              actual={sessionsMetric}
              target={isProfileCurrent ? targets.sessions.target : null}
              unitLabel="buổi"
            />
          )}
        </StatisticsSourceSection>
      </StatisticsSourceSection>

      {/* 3. Biểu đồ lịch sử kết quả trong kỳ đang chọn */}
      <StatisticsSourceSection
        title={`Kết quả trong kỳ · ${label}`}
        source={snapshot.workouts}
        refresh={refresh}
      >
        <StatisticsBarChart
          width={chartWidth}
          title="Phút tập theo lịch trong kỳ"
          unit="minutes"
          points={series('schedule', 'minutes')}
        />
        <StatisticsBarChart
          width={chartWidth}
          title="Buổi hoàn thành trong kỳ"
          unit="count"
          points={series('schedule', 'sessions')}
        />
      </StatisticsSourceSection>

      <StatisticsInfo>
        Cam kết chỉ áp dụng cho tuần hiện tại, không nhân lên thành mục tiêu tháng
        hoặc năm. Buổi chạy được theo dõi riêng và chưa cộng vào tiến độ theo lịch.
      </StatisticsInfo>
    </>
  );
}

/**
 * Component màn hình Tiến độ mục tiêu.
 *
 * @param props Các thuộc tính điều hướng và kỳ mặc định `StatisticsScreenProps`
 * @returns JSX màn hình Tiến độ mục tiêu
 */
export default function GoalsStatisticsScreen(props: StatisticsScreenProps) {
  return (
    <StatisticsDetailScreen
      {...props}
      title="Tiến độ mục tiêu"
      description="Đối chiếu luyện tập theo lịch với cam kết đang lưu."
    >
      {(context) => <GoalsContent {...context} />}
    </StatisticsDetailScreen>
  );
}
