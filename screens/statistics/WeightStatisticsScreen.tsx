// ============================================================================
// Module: screens/statistics/WeightStatisticsScreen.tsx
// Chức năng: Màn hình thống kê chi tiết "Cân nặng và BMI":
// - Hiển thị Cân nặng gần nhất và chỉ số BMI hiện tại (kèm phân loại Gầy /
//   Bình thường / Thừa cân / Béo phì).
// - Hiển thị mức thay đổi cân nặng trong kỳ (`changeKg`) và biểu đồ đường
//   (`StatisticsLineChart`) nối các lần cân thực tế theo đúng khoảng cách ngày.
// - Hiển thị danh sách Lịch sử cân và Cân nặng đích đã lưu trong mục tiêu.
// ============================================================================

import {
  StatisticsActivityRow,
  StatisticsLineChart,
  StatisticsSourceNotice,
} from '../../components/statistics';
import type { StatisticsChartPoint, StatisticsMetricCardProps } from '../../components/statistics';
import { formatStatisticsValue } from '../../components/statistics/presentation';
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
import { measurement, sourceMetric, statisticsDateLabel } from './viewModel';

/** Số mili-giây trong 1 ngày (24 giờ * 60 phút * 60 giây * 1000 ms) */
const MS_PER_DAY = 86_400_000;

/** Bản đồ tên tiếng Việt cho 4 nhóm phân loại BMI */
const BMI_GROUP_LABELS: Record<string, string> = {
  thin: 'Gầy',
  normal: 'Bình thường',
  overweight: 'Thừa cân',
  obese: 'Béo phì',
};

/**
 * Tính khoảng cách số ngày giữa ngày `date` và ngày cân đầu tiên `firstDate` trong kỳ.
 * Giúp biểu đồ đường đặt các điểm cân đúng tỷ lệ thời gian thực tế trên trục hoành (X).
 *
 * @param date Ngày của lần cân hiện tại ('YYYY-MM-DD')
 * @param firstDate Ngày của lần cân đầu tiên trong kỳ ('YYYY-MM-DD')
 * @returns Số ngày chênh lệch (>= 0)
 */
function calculateDayOffset(date: string, firstDate: string): number {
  const currentMs = Date.parse(`${date}T00:00:00Z`);
  const firstMs = Date.parse(`${firstDate}T00:00:00Z`);
  return (currentMs - firstMs) / MS_PER_DAY;
}

/**
 * Tạo câu mô tả xu hướng thay đổi cân nặng giữa đầu kỳ và cuối kỳ.
 *
 * @param changeKg Chênh lệch cân nặng (kg) hoặc `null` nếu chưa đủ 2 ngày đo
 * @returns Câu giải thích tiếng Việt hiển thị dưới thẻ "Thay đổi cân nặng"
 */
function getWeightChangeDescription(changeKg: number | null): string {
  if (changeKg === null) {
    return 'Cần hai ngày có số đo trong kỳ để so sánh.';
  }
  if (changeKg > 0) {
    return 'Cân nặng tăng trong kỳ.';
  }
  if (changeKg < 0) {
    return 'Cân nặng giảm trong kỳ.';
  }
  return 'Cân nặng không thay đổi giữa hai mốc.';
}

/**
 * Tạo nhãn nguồn và thời điểm cho thẻ "Cân nặng gần nhất" và "BMI hiện tại".
 *
 * @param recordedDate Ngày ghi nhận cân nặng gần nhất (nếu lấy từ bảng `weights`)
 * @param source Nguồn lấy cân nặng ('history' | 'profile' | 'none')
 * @returns Chuỗi nhãn mô tả thời điểm hoặc nguồn đo
 */
function getWeightPeriodLabel(
  recordedDate: string | null,
  source: 'history' | 'profile' | null
): string {
  if (recordedDate) {
    return `Ghi nhận ${statisticsDateLabel(recordedDate)}`;
  }
  if (source === 'profile') {
    return 'Từ hồ sơ · chưa có ngày đo';
  }
  return 'Chưa có số đo';
}

/**
 * Tạo thông báo giải thích khi chưa thể hiển thị thẻ "Cân nặng đích".
 *
 * @param targetState Trạng thái mục tiêu ('selected' | 'missing' | 'ambiguous')
 * @param isUserGoalsComplete Nguồn `userGoals` đã tải đầy đủ hay chưa
 * @returns Câu thông báo tiếng Việt
 */
function getTargetGoalStatusMessage(
  targetState: 'selected' | 'missing' | 'ambiguous',
  isUserGoalsComplete: boolean
): string {
  if (targetState === 'ambiguous') {
    return 'Chưa xác định được mục tiêu đang áp dụng.';
  }
  if (isUserGoalsComplete) {
    return 'Chưa có mục tiêu được ghi nhận.';
  }
  return 'Chưa đủ dữ liệu để xác định mục tiêu đang áp dụng.';
}

/**
 * Nội dung bên trong màn hình Cân nặng và BMI.
 *
 * @param context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX hiển thị số đo cân nặng, BMI, biểu đồ đường và lịch sử cân
 */
function WeightContent({
  snapshot,
  view,
  refresh,
  chartWidth,
}: StatisticsScreenContext) {
  const { report, label } = view;
  const { weight } = report;

  const weightPeriod = getWeightPeriodLabel(weight.recordedDate, weight.source);
  const changeHint = getWeightChangeDescription(weight.changeKg);

  // Ghi chú phân loại BMI (chỉ hiện khi chỉ số BMI đã đầy đủ và hợp lệ)
  const bmiHint =
    view.bmi?.complete && weight.bmiGroup
      ? BMI_GROUP_LABELS[weight.bmiGroup]
      : 'Chưa đủ dữ liệu để phân loại BMI.';

  const latestWeightAndBmiItems: StatisticsMetricCardProps[] = [
    {
      title: 'Cân nặng gần nhất',
      periodLabel: weightPeriod,
      metric: view.currentWeight,
      unit: 'kg',
      hint:
        weight.source === 'profile'
          ? 'Số đo đang lưu trong hồ sơ.'
          : 'Số đo hợp lệ gần nhất trong lịch sử.',
    },
    {
      title: 'BMI hiện tại',
      periodLabel: weightPeriod,
      metric: view.bmi,
      unit: 'bmi',
      hint: bmiHint,
    },
  ];

  // Chuẩn bị danh sách điểm cho biểu đồ đường cân nặng
  const firstDate = weight.points[0]?.date ?? '';
  const isWeightSourceReady = snapshot.weights.complete && !snapshot.weights.stale;
  const weightLinePoints: StatisticsChartPoint[] = weight.points.map((point) => ({
    key: point.date,
    label: statisticsDateLabel(point.date),
    axisLabel: `${point.date.slice(8)}/${point.date.slice(5, 7)}`,
    value: point.weightKg,
    position: calculateDayOffset(point.date, firstDate),
    complete: isWeightSourceReady,
  }));

  const absoluteWeightChange =
    weight.changeKg === null ? null : Math.abs(weight.changeKg);

  /**
   * Vẽ nội dung bên trong mục "Cân nặng đích đã lưu".
   */
  const renderTargetWeightContent = () => {
    if (report.targets.state !== 'selected') {
      const message = getTargetGoalStatusMessage(
        report.targets.state,
        snapshot.userGoals.complete
      );
      return <StatisticsInfo>{message}</StatisticsInfo>;
    }

    return (
      <StatisticsMetricGrid
        items={[
          {
            title: 'Cân nặng đích',
            periodLabel: 'Mục tiêu đang lưu',
            metric: sourceMetric(
              snapshot.userGoals,
              measurement(report.targets.targetWeightKg)
            ),
            unit: 'kg',
          },
        ]}
      />
    );
  };

  return (
    <>
      {/* 1. Cân nặng gần nhất và BMI hiện tại */}
      <StatisticsSection title="Số đo gần nhất">
        <StatisticsSourceNotice source={snapshot.weights} onRetry={refresh} />
        <StatisticsSourceNotice source={snapshot.profiles} onRetry={refresh} />

        <StatisticsMetricGrid items={latestWeightAndBmiItems} />

        {snapshot.profiles.data === null && snapshot.weights.data === null ? (
          <StatisticsInfo>
            Chưa có số đo dùng được. Tải lại hồ sơ hoặc lịch sử cân để xem chỉ số.
          </StatisticsInfo>
        ) : null}

        {report.quality.profileAmbiguous ? (
          <StatisticsInfo>
            Có nhiều hồ sơ trong dữ liệu, chưa xác định được chiều cao và số đo hồ sơ
            đang áp dụng.
          </StatisticsInfo>
        ) : null}
      </StatisticsSection>

      {/* 2. Biểu đồ đường diễn biến cân nặng và lịch sử các lần cân trong kỳ */}
      <StatisticsSourceSection
        title="Diễn biến trong kỳ"
        source={snapshot.weights}
        refresh={refresh}
      >
        <StatisticsMetricGrid
          items={[
            {
              title: 'Thay đổi cân nặng',
              periodLabel: label,
              metric: sourceMetric(
                snapshot.weights,
                measurement(absoluteWeightChange)
              ),
              unit: 'kg',
              hint: changeHint,
            },
          ]}
        />

        <StatisticsLineChart
          width={chartWidth}
          title="Cân nặng đã ghi nhận"
          unit="kg"
          points={weightLinePoints}
        />

        <StatisticsSection title="Lịch sử cân">
          <StatisticsHistory
            records={weight.points.slice().reverse()}
            emptyMessage="Chưa có lần cân hợp lệ trong kỳ này."
            renderRow={(row) => (
              <StatisticsActivityRow
                key={row.date}
                title="Cân nặng"
                dateLabel={statisticsDateLabel(row.date)}
                detail={`${formatStatisticsValue(row.weightKg, 'kg')} kg`}
              />
            )}
          />
        </StatisticsSection>

        {weight.invalidRecordCount > 0 ? (
          <StatisticsInfo>
            Có số đo không hợp lệ nên chưa được đưa vào biểu đồ.
          </StatisticsInfo>
        ) : null}
      </StatisticsSourceSection>

      {/* 3. Cân nặng đích đã lưu trong mục tiêu */}
      <StatisticsSourceSection
        title="Cân nặng đích đã lưu"
        source={snapshot.userGoals}
        refresh={refresh}
      >
        {renderTargetWeightContent()}
      </StatisticsSourceSection>

      <StatisticsInfo>
        BMI chỉ thể hiện số đo hiện tại. Biểu đồ cân chỉ dùng các lần ghi nhận thực
        tế, không điền số đo cho ngày trống.
      </StatisticsInfo>
    </>
  );
}

/**
 * Component màn hình Cân nặng và BMI.
 *
 * @param props Các thuộc tính điều hướng và kỳ mặc định `StatisticsScreenProps`
 * @returns JSX màn hình Cân nặng và BMI
 */
export default function WeightStatisticsScreen(props: StatisticsScreenProps) {
  return (
    <StatisticsDetailScreen
      {...props}
      title="Cân nặng và BMI"
      description="Xem số đo gần nhất và biến động qua những lần cân."
    >
      {(context) => <WeightContent {...context} />}
    </StatisticsDetailScreen>
  );
}
