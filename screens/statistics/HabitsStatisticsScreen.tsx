// ============================================================================
// Module: screens/statistics/HabitsStatisticsScreen.tsx
// Chức năng: Màn hình thống kê chi tiết "Thói quen luyện tập":
// - Hiển thị Chuỗi hiện tại (`currentStreak`) và Chuỗi dài nhất (`longestStreak`)
//   của các buổi tập theo lịch liên tiếp.
// - Hiển thị tổng số Ngày có hoạt động (`activeDays`) trong kỳ (gộp từ cả lịch
//   tập hoàn thành và chạy bộ, mỗi ngày tối đa tính 1 lần).
// - Hiển thị Lịch hoạt động trực quan (`ActivityCalendar`) và biểu đồ phân bố
//   theo các thứ trong tuần (Thứ 2 -> Chủ nhật).
// ============================================================================

import { StyleSheet, Text, View } from 'react-native';
import Card from '../../components/ui/Card';
import { StatisticsSourceNotice } from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import type { PeriodKind } from '../../domain/statistics/types';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type {
  StatisticsScreenContext,
  StatisticsScreenProps,
} from './StatisticsDetailScreen';
import {
  StatisticsInfo,
  StatisticsMetricGrid,
  StatisticsSection,
  StatisticsSourceSection,
} from './shared';
import { counted, measurement, statisticsDateLabel } from './viewModel';
import type { StatisticsView } from './viewModel';

/** Danh sách nhãn 7 thứ trong tuần cho tiêu đề cột của Lịch hoạt động */
const WEEKDAY_HEADER_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * Xác định nhãn trạng thái (cho trình đọc màn hình) và ký hiệu chấm tròn hiển thị
 * bên trong một ô ngày trên Lịch hoạt động.
 *
 * @param isFuture Ngày đó có nằm ở tương lai (`date > today`) hay không
 * @param hasActivity Ngày đó có hoạt động đã ghi nhận hay không
 * @param activityComplete Dữ liệu hoạt động kết hợp đã tải đầy đủ hay chưa
 * @returns Cặp `{ statusLabel, dotSymbol }`
 */
function getCalendarCellStatus(
  isFuture: boolean,
  hasActivity: boolean,
  activityComplete: boolean
): { statusLabel: string; dotSymbol: string } {
  if (isFuture) {
    return { statusLabel: 'Chưa tới ngày', dotSymbol: '·' };
  }
  if (hasActivity) {
    return { statusLabel: 'Có hoạt động đã ghi nhận', dotSymbol: '●' };
  }
  if (activityComplete) {
    return { statusLabel: 'Chưa ghi nhận hoạt động', dotSymbol: '–' };
  }
  return { statusLabel: 'Chưa đủ dữ liệu để xác định', dotSymbol: '?' };
}

/**
 * Component vẽ lưới Lịch hoạt động 7 cột (T2 -> CN) cho kỳ Ngày / Tuần / Tháng.
 *
 * @param props.context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX thẻ Card chứa lưới lịch đánh dấu những ngày có tập luyện
 */
function ActivityCalendar({ context }: { context: StatisticsScreenContext }) {
  const { colors } = useTheme();
  const { report, activityComplete } = context.view;
  const activeDatesSet = new Set(report.habits.activeDates);
  const periodDateKeys = report.period.keys;

  // Tìm thứ của ngày đầu kỳ để chèn các ô trống (offset) trước ngày đầu tiên:
  // Trong JS: Chủ nhật = 0, Thứ 2 = 1... Công thức `(dayOfWeek + 6) % 7` đổi Thứ 2 -> 0, CN -> 6.
  const dayOfWeek = new Date(`${report.period.start}T00:00:00Z`).getUTCDay();
  const emptyLeadingCellsCount = (dayOfWeek + 6) % 7;

  return (
    <Card style={styles.calendar}>
      <View style={styles.grid}>
        {WEEKDAY_HEADER_LABELS.map((day) => (
          <Text key={day} style={[styles.weekday, { color: colors.textSecondary }]}>
            {day}
          </Text>
        ))}

        {/* Các ô trống đầu lịch để căn đúng cột Thứ trong tuần */}
        {Array.from({ length: emptyLeadingCellsCount }, (_, index) => (
          <View key={`blank-${index}`} style={styles.cell} />
        ))}

        {/* Các ô ngày trong kỳ */}
        {periodDateKeys.map((date) => {
          const isFuture = date > context.today;
          const hasActivity = activeDatesSet.has(date);
          const { statusLabel, dotSymbol } = getCalendarCellStatus(
            isFuture,
            hasActivity,
            activityComplete
          );

          return (
            <View
              key={date}
              accessible
              accessibilityLabel={`${statisticsDateLabel(date)}. ${statusLabel}`}
              style={[
                styles.cell,
                {
                  backgroundColor: hasActivity ? colors.primaryLight : colors.surfaceAlt,
                  borderColor: date === context.today ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[styles.day, { color: isFuture ? colors.textMuted : colors.text }]}
              >
                {Number(date.slice(8))}
              </Text>
              <Text
                accessible={false}
                style={[styles.dot, { color: colors.textSecondary }]}
              >
                {dotSymbol}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/**
 * Nội dung bên trong màn hình Thói quen luyện tập.
 *
 * @param context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX hiển thị chuỗi buổi tập, lịch ngày hoạt động và biểu đồ theo thứ
 */
function HabitsContent(context: StatisticsScreenContext) {
  const { snapshot, view, today, kind, refresh, chartWidth } = context;
  const { report, label } = view;
  const habits = report.habits;
  const workoutsSource = snapshot.workouts;

  const streakItems: StatisticsMetricCardProps[] = [
    {
      title: 'Chuỗi hiện tại',
      periodLabel: 'Toàn bộ lịch đến hôm nay',
      metric: counted(workoutsSource, habits.currentStreak, habits.streakComplete),
      unit: 'count',
      unitLabel: 'buổi liên tiếp',
    },
    {
      title: 'Chuỗi dài nhất',
      periodLabel: 'Toàn bộ lịch đến hôm nay',
      metric: counted(workoutsSource, habits.longestStreak, habits.streakComplete),
      unit: 'count',
      unitLabel: 'buổi liên tiếp',
    },
  ];

  const activeDaysMetric = view.activityAvailable
    ? { ...measurement(habits.activeDays), complete: view.activityComplete }
    : null;

  return (
    <>
      {/* 1. Chuỗi buổi hoàn thành liên tiếp từ lịch tập */}
      <StatisticsSourceSection
        title="Chuỗi hoàn thành theo lịch"
        source={workoutsSource}
        refresh={refresh}
      >
        <StatisticsMetricGrid items={streakItems} />
        <StatisticsInfo>
          Ngày nghỉ không ngắt chuỗi; buổi bỏ lỡ ngắt chuỗi. Kết quả phản ánh trạng
          thái lịch đang lưu, chưa phân biệt được mọi trường hợp tập bù trong quá khứ.
        </StatisticsInfo>
      </StatisticsSourceSection>

      {/* 2. Ngày có hoạt động (kết hợp từ lịch tập hoàn thành + chạy bộ) */}
      <StatisticsSection title="Ngày có hoạt động đã ghi nhận">
        <StatisticsSourceNotice source={snapshot.workouts} onRetry={refresh} />
        <StatisticsSourceNotice source={snapshot.runs} onRetry={refresh} />

        <StatisticsMetricGrid
          items={[
            {
              title: 'Ngày có hoạt động',
              periodLabel: label,
              metric: activeDaysMetric,
              unit: 'count',
              unitLabel: 'ngày',
            },
          ]}
        />

        {kind !== 'year' ? <ActivityCalendar context={context} /> : null}

        <StatisticsInfo>
          Mỗi ngày chỉ tính một lần dù có nhiều buổi hoặc xuất hiện ở cả lịch tập và
          chạy bộ. Đây là số ngày đã ghi nhận, không phải phép cộng tổng buổi giữa
          hai nguồn.
        </StatisticsInfo>
      </StatisticsSection>
    </>
  );
}

/**
 * Component màn hình Thói quen luyện tập.
 *
 * @param props Các thuộc tính điều hướng và kỳ mặc định `StatisticsScreenProps`
 * @returns JSX màn hình Thói quen luyện tập
 */
export default function HabitsStatisticsScreen(props: StatisticsScreenProps) {
  return (
    <StatisticsDetailScreen
      {...props}
      title="Thói quen luyện tập"
      description="Theo dõi sự đều đặn qua lịch tập và các ngày có hoạt động."
    >
      {(context) => <HabitsContent {...context} />}
    </StatisticsDetailScreen>
  );
}

const styles = StyleSheet.create({
  calendar: { padding: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '0%' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: fontSize.caption,
    paddingVertical: spacing.sm,
  },
  cell: {
    width: `${100 / 7}%`,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  day: { fontSize: fontSize.caption },
  dot: { fontSize: fontSize.caption },
});
