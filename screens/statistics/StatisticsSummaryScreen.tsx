// ============================================================================
// Module: screens/statistics/StatisticsSummaryScreen.tsx
// Chức năng: Màn hình chính của tab Thống kê ("Tóm tắt"):
// - Hiển thị vòng tròn tiến độ "Cam kết thời gian tuần này".
// - Hiển thị lưới 6 thẻ tóm tắt nhanh: Calo theo lịch hôm nay, Quãng đường chạy
//   hôm nay, Buổi hoàn thành tuần này, Cân nặng gần nhất, Chuỗi hoàn thành,
//   và Phút tập theo lịch tuần này.
// - Hiển thị thẻ "Buổi chạy gần nhất" và nút "Xem tất cả danh mục".
// ============================================================================

import { useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../components/ui/Card';
import {
  StatisticsActivityRow,
  StatisticsDataState,
  StatisticsProgress,
  StatisticsSourceNotice,
} from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import { formatStatisticsValue } from '../../components/statistics/presentation';
import type { StatisticsReport } from '../../domain/statistics/statistics';
import type { StatisticsMetric } from '../../domain/statistics/types';
import type { StatisticsDataSnapshot } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import {
  StatisticsDataProvider,
  useHasStatisticsProvider,
  useStatisticsData,
} from './StatisticsDataProvider';
import { StatisticsInfo, StatisticsMetricGrid, StatisticsSection } from './shared';
import {
  buildStatisticsView,
  counted,
  isStatisticsSourceCurrent,
  sourceMetric,
  statisticsDateLabel,
  statisticsPeriodLabel,
} from './viewModel';
import type { StatisticsView } from './viewModel';
import type { StatisticsDestination } from './statisticsRoutes';

/** Các hàm điều hướng truyền vào màn hình Tóm tắt */
export interface StatisticsSummaryProps {
  onOpenDetail: (destination: StatisticsDestination) => void;
  onOpenCategories: () => void;
}

/**
 * Chuẩn bị số phút tập thực tế (`actual`) và mục tiêu (`target`) cho vòng tròn
 * "Cam kết thời gian tuần này" trên màn Tóm tắt.
 *
 * @param snapshot Bản chụp 5 nguồn dữ liệu
 * @param report Kết quả tính toán thống kê
 * @returns Cặp giá trị `{ actualMinutes, targetMinutes }`
 */
function buildWeeklyCommitmentProgress(
  snapshot: StatisticsDataSnapshot,
  report: StatisticsReport
): {
  actualMinutes: StatisticsMetric | null;
  targetMinutes: number | null;
} {
  const baseMinutes = sourceMetric(snapshot.workouts, report.targets.minutes.actual);
  const isGoalSourceReady = isStatisticsSourceCurrent(snapshot.userGoals);
  const isScheduleClean =
    report.weekSchedule.counts.unknown === 0 &&
    report.quality.invalidWorkoutDates === 0;

  // Nếu nguồn mục tiêu chưa sẵn sàng hoặc lịch tập tuần có buổi lỗi, đánh dấu chưa đầy đủ
  const actualMinutes: StatisticsMetric | null = baseMinutes
    ? {
        ...baseMinutes,
        complete: baseMinutes.complete && isGoalSourceReady && isScheduleClean,
      }
    : null;

  const targetMinutes =
    isGoalSourceReady && report.targets.state === 'selected'
      ? report.targets.minutes.target
      : null;

  return { actualMinutes, targetMinutes };
}

/**
 * Tạo danh sách cấu hình cho 6 thẻ chỉ số tóm tắt nhanh trên màn hình chính.
 *
 * @param snapshot Bản chụp 5 nguồn dữ liệu
 * @param view Mô hình hiển thị đã tính toán
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @param openDetail Hàm tạo callback mở màn hình chi tiết
 * @returns Mảng 6 đối tượng `StatisticsMetricCardProps`
 */
function buildSummaryMetricItems(
  snapshot: StatisticsDataSnapshot,
  view: StatisticsView,
  today: string,
  openDetail: (
    category: StatisticsDestination['category'],
    kind: StatisticsDestination['kind'],
    anchor?: string
  ) => () => void
): StatisticsMetricCardProps[] {
  const { report } = view;

  // Nhãn phụ cho thẻ "Cân nặng gần nhất"
  let weightPeriodLabel = 'Chưa có số đo';
  if (report.weight.recordedDate) {
    weightPeriodLabel = statisticsDateLabel(report.weight.recordedDate);
  } else if (report.weight.source === 'profile') {
    weightPeriodLabel = 'Từ hồ sơ · chưa rõ ngày đo';
  }

  // Ghi chú cho thẻ "Quãng đường chạy hôm nay"
  const todayRunningHint =
    report.today.running.queuedCount > 0
      ? `${report.today.running.queuedCount} buổi chờ đồng bộ`
      : 'Chỉ từ các buổi chạy';

  const isWeekScheduleComplete =
    report.weekSchedule.counts.unknown === 0 &&
    report.quality.invalidWorkoutDates === 0;

  const isStreakComplete =
    report.habits.streakComplete && report.quality.invalidWorkoutDates === 0;

  return [
    {
      title: 'Calo theo lịch',
      periodLabel: 'Hôm nay',
      metric: sourceMetric(snapshot.workouts, report.today.schedule.calories),
      unit: 'kcal',
      onPress: openDetail('calories', 'day'),
      hint: 'Từ buổi theo lịch đã hoàn thành',
    },
    {
      title: 'Quãng đường chạy',
      periodLabel: 'Hôm nay',
      metric: sourceMetric(snapshot.runs, report.today.running.distanceKm),
      unit: 'km',
      onPress: openDetail('running', 'day'),
      hint: todayRunningHint,
    },
    {
      title: 'Buổi hoàn thành',
      periodLabel: 'Tuần này · theo lịch',
      metric: counted(
        snapshot.workouts,
        report.weekSchedule.counts.done,
        isWeekScheduleComplete
      ),
      unit: 'count',
      onPress: openDetail('schedule', 'week'),
    },
    {
      title: 'Cân nặng gần nhất',
      periodLabel: weightPeriodLabel,
      metric: view.currentWeight,
      unit: 'kg',
      onPress: openDetail('weight', 'month', report.weight.recordedDate ?? today),
    },
    {
      title: 'Chuỗi hoàn thành',
      periodLabel: 'Các buổi theo lịch liên tiếp',
      metric: counted(
        snapshot.workouts,
        report.habits.currentStreak,
        isStreakComplete
      ),
      unit: 'count',
      onPress: openDetail('habits', 'month'),
      hint: 'Tập bù không khôi phục chuỗi đã mất',
    },
    {
      title: 'Phút tập theo lịch',
      periodLabel: 'Tuần này',
      metric: sourceMetric(snapshot.workouts, report.weekSchedule.minutes),
      unit: 'minutes',
      onPress: openDetail('time', 'week'),
    },
  ];
}

/**
 * Component màn hình Tóm tắt thống kê (tự động bọc `StatisticsDataProvider` nếu chưa có).
 *
 * @param props Hàm mở màn hình chi tiết `onOpenDetail` và mở danh sách danh mục `onOpenCategories`
 * @returns JSX màn hình Tóm tắt
 */
export default function StatisticsSummaryScreen(props: StatisticsSummaryProps) {
  const hasProvider = useHasStatisticsProvider();
  if (hasProvider) {
    return <SummaryBody {...props} />;
  }
  return (
    <StatisticsDataProvider>
      <SummaryBody {...props} />
    </StatisticsDataProvider>
  );
}

/**
 * Phần nội dung chính của màn hình Tóm tắt thống kê.
 *
 * @param props Các hàm điều hướng `onOpenDetail` và `onOpenCategories`
 * @returns JSX hiển thị tổng quan thống kê
 */
function SummaryBody({ onOpenDetail, onOpenCategories }: StatisticsSummaryProps) {
  const { colors } = useTheme();
  const { snapshot, today, refresh } = useStatisticsData();

  // Tính toán số liệu thống kê với kỳ mặc định là tuần hiện tại ('week')
  const view = useMemo(
    () => (snapshot ? buildStatisticsView(snapshot, today, 'week', today) : null),
    [snapshot, today]
  );

  const sources = snapshot
    ? [
        snapshot.workouts,
        snapshot.runs,
        snapshot.profiles,
        snapshot.weights,
        snapshot.userGoals,
      ]
    : [];
  const refreshing = sources.some((source) => source.status === 'loading');

  /**
   * Tạo hàm xử lý sự kiện khi người dùng chạm vào một thẻ để mở màn chi tiết tương ứng.
   */
  const openDetail =
    (
      category: StatisticsDestination['category'],
      kind: StatisticsDestination['kind'],
      anchor = today
    ) =>
    () =>
      onOpenDetail({ category, kind, anchor });

  /**
   * Vẽ khu vực "Buổi chạy gần nhất" bằng câu lệnh `if` rõ ràng thay vì toán tử 3 ngôi lồng nhau.
   */
  const renderLatestRunSection = (
    currentSnapshot: StatisticsDataSnapshot,
    report: StatisticsReport
  ) => {
    const latestRun = report.latestRun;

    if (currentSnapshot.runs.data === null) {
      const fallbackState =
        currentSnapshot.runs.status === 'success'
          ? 'empty'
          : currentSnapshot.runs.status;
      return (
        <StatisticsDataState
          state={fallbackState}
          message={currentSnapshot.runs.error?.message}
          onRetry={refresh}
        />
      );
    }

    if (!latestRun) {
      return (
        <StatisticsDataState
          state="empty"
          message="Chưa có buổi chạy được ghi nhận."
        />
      );
    }

    const distanceDisplay = formatStatisticsValue(
      typeof latestRun.distanceKm === 'number' ? latestRun.distanceKm : null,
      'km'
    );
    const durationDisplay = formatStatisticsValue(
      typeof latestRun.durationSec === 'number' ? latestRun.durationSec : null,
      'seconds'
    );

    return (
      <Card>
        <StatisticsActivityRow
          title="Chạy bộ"
          dateLabel={statisticsDateLabel(latestRun.date)}
          detail={`${distanceDisplay} km · ${durationDisplay}`}
          queued={latestRun._queued === true}
          onPress={openDetail('running', 'day', latestRun.date as string)}
        />
      </Card>
    );
  };

  /**
   * Vẽ mục "Trạng thái dữ liệu" nếu có bất kỳ nguồn nào đang tải, bị lỗi hoặc có buổi chạy chờ đồng bộ.
   */
  const renderDataSourcesStatusSection = (report: StatisticsReport) => {
    const sourceNames = ['Lịch tập', 'Chạy bộ', 'Hồ sơ', 'Cân nặng', 'Mục tiêu'];
    const hasAnySourceIssue =
      sources.some(
        (source) =>
          source.status !== 'success' ||
          !source.complete ||
          source.stale ||
          source.issues.length > 0
      ) || report.running.queuedCount > 0;

    if (!hasAnySourceIssue) {
      return null;
    }

    return (
      <StatisticsSection title="Trạng thái dữ liệu">
        {sources.map((source, index) => {
          const isRunsSource = index === 1;
          const queuedCount = isRunsSource ? report.running.queuedCount : 0;
          const showNotice =
            source.status !== 'success' ||
            !source.complete ||
            source.stale ||
            source.issues.length > 0 ||
            queuedCount > 0;

          if (!showNotice) {
            return null;
          }

          return (
            <View key={index}>
              <Text style={[styles.caption, { color: colors.text }]}>
                {sourceNames[index]}
              </Text>
              <StatisticsSourceNotice
                source={source}
                queuedCount={queuedCount}
                onRetry={refresh}
              />
            </View>
          );
        })}
      </StatisticsSection>
    );
  };

  /**
   * Quyết định phần nội dung chính của màn Tóm tắt (Đang tải / Cần đăng nhập / Đủ dữ liệu).
   */
  const renderSummaryMainContent = () => {
    if (!snapshot) {
      return <StatisticsDataState state="loading" />;
    }

    if (!view) {
      return (
        <StatisticsDataState
          state="idle"
          title="Cần đăng nhập"
          message="Đăng nhập để xem dữ liệu thống kê cá nhân của bạn."
        />
      );
    }

    const { report } = view;
    const { actualMinutes, targetMinutes } = buildWeeklyCommitmentProgress(
      snapshot,
      report
    );
    const summaryItems = buildSummaryMetricItems(snapshot, view, today, openDetail);

    return (
      <>
        {/* 1. Vòng tròn tiến độ cam kết tuần */}
        <StatisticsProgress
          title="Cam kết thời gian tuần này"
          periodLabel={statisticsPeriodLabel('week', today)}
          actual={actualMinutes}
          target={targetMinutes}
          onPress={openDetail('goals', 'week')}
        />

        {/* 2. Lưới 6 thẻ chỉ số tóm tắt */}
        <StatisticsMetricGrid items={summaryItems} />

        {/* 3. Buổi chạy gần nhất */}
        <StatisticsSection title="Buổi chạy gần nhất">
          {renderLatestRunSection(snapshot, report)}
        </StatisticsSection>

        {/* 4. Trạng thái dữ liệu (chỉ hiện khi có nguồn đang tải, lỗi hoặc chờ đồng bộ) */}
        {renderDataSourcesStatusSection(report)}

        <StatisticsInfo>
          Lịch tập và chạy bộ được thống kê riêng. Chỉ các buổi theo lịch đã hoàn
          thành được tính vào cam kết tuần.
        </StatisticsInfo>

        {/* 5. Nút mở danh sách cả 7 danh mục */}
        <Pressable
          accessibilityRole="button"
          onPress={onOpenCategories}
          style={({ pressed }) => [
            styles.categories,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.categoriesText, { color: colors.primary }]}>
            Xem tất cả danh mục
          </Text>
          <Text
            accessible={false}
            style={[styles.categoriesText, { color: colors.primary }]}
          >
            ›
          </Text>
        </Pressable>
      </>
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Tóm tắt
        </Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {statisticsDateLabel(today)}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới thống kê"
          disabled={refreshing}
          accessibilityState={{ disabled: refreshing }}
          onPress={refresh}
          style={styles.action}
        >
          <Text style={[styles.caption, { color: colors.primary }]}>
            {refreshing ? 'Đang cập nhật…' : 'Làm mới thống kê'}
          </Text>
        </Pressable>

        {renderSummaryMainContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.headline, fontWeight: fontWeight.bold },
  caption: { fontSize: fontSize.caption, lineHeight: 22 },
  action: {
    alignSelf: 'flex-start',
    minHeight: layout.minTouchSize,
    justifyContent: 'center',
  },
  categories: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: layout.minTouchSize,
  },
  categoriesText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    flexShrink: 1,
  },
});
