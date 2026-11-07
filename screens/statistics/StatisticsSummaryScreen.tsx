import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../components/ui/Card';
import { StatisticsActivityRow, StatisticsDataState, StatisticsProgress, StatisticsSourceNotice } from '../../components/statistics';
import { formatStatisticsValue } from '../../components/statistics/presentation';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsDataProvider, useHasStatisticsProvider, useStatisticsData } from './StatisticsDataProvider';
import { StatisticsInfo, StatisticsMetricGrid, StatisticsSection } from './shared';
import { buildStatisticsView, counted, sourceMetric, statisticsDateLabel, statisticsPeriodLabel } from './viewModel';
import type { StatisticsDestination } from './statisticsRoutes';

export interface StatisticsSummaryProps {
  onOpenDetail: (destination: StatisticsDestination) => void;
  onOpenCategories: () => void;
}

export default function StatisticsSummaryScreen(props: StatisticsSummaryProps) {
  return useHasStatisticsProvider() ? <SummaryBody {...props} />
    : <StatisticsDataProvider><SummaryBody {...props} /></StatisticsDataProvider>;
}

function SummaryBody({ onOpenDetail, onOpenCategories }: StatisticsSummaryProps) {
  const { colors } = useTheme();
  const { snapshot, today, refresh } = useStatisticsData();
  const view = useMemo(() => snapshot ? buildStatisticsView(snapshot, today, 'week', today) : null, [snapshot, today]);
  const sources = snapshot ? [snapshot.workouts, snapshot.runs, snapshot.profiles, snapshot.weights, snapshot.userGoals] : [];
  const refreshing = sources.some(source => source.status === 'loading');
  const open = (category: StatisticsDestination['category'], kind: StatisticsDestination['kind'], anchor = today) =>
    () => onOpenDetail({ category, kind, anchor });
  const report = view?.report;
  const minutes = snapshot && report ? sourceMetric(snapshot.workouts, report.targets.minutes.actual) : null;
  if (minutes && snapshot && report && (!snapshot.userGoals.complete || snapshot.userGoals.stale || snapshot.userGoals.status !== 'success'
    || report.weekSchedule.counts.unknown > 0 || report.quality.invalidWorkoutDates > 0)) minutes.complete = false;
  const target = snapshot && report && snapshot.userGoals.complete && !snapshot.userGoals.stale
    && snapshot.userGoals.status === 'success' && report.targets.state === 'selected' ? report.targets.minutes.target : null;
  const latest = report?.latestRun;
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}
      tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Tóm tắt</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{statisticsDateLabel(today)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Làm mới thống kê" disabled={refreshing}
        accessibilityState={{ disabled: refreshing }} onPress={refresh} style={styles.action}>
        <Text style={[styles.caption, { color: colors.primary }]}>{refreshing ? 'Đang cập nhật…' : 'Làm mới thống kê'}</Text>
      </Pressable>
      {!snapshot ? <StatisticsDataState state="loading" /> : !view || !report ? <StatisticsDataState state="idle" title="Cần đăng nhập"
        message="Đăng nhập để xem dữ liệu thống kê cá nhân của bạn." /> : <>
        <StatisticsProgress title="Cam kết thời gian tuần này" periodLabel={statisticsPeriodLabel('week', today)}
          actual={minutes} target={target} onPress={open('goals', 'week')} />
        <StatisticsMetricGrid items={[
          { title: 'Calo theo lịch', periodLabel: 'Hôm nay', metric: sourceMetric(snapshot.workouts, report.today.schedule.calories), unit: 'kcal',
            onPress: open('calories', 'day'), hint: 'Từ buổi theo lịch đã hoàn thành' },
          { title: 'Quãng đường chạy', periodLabel: 'Hôm nay', metric: sourceMetric(snapshot.runs, report.today.running.distanceKm), unit: 'km',
            onPress: open('running', 'day'), hint: report.today.running.queuedCount > 0 ? `${report.today.running.queuedCount} buổi chờ đồng bộ` : 'Chỉ từ các buổi chạy' },
          { title: 'Buổi hoàn thành', periodLabel: 'Tuần này · theo lịch', metric: counted(snapshot.workouts, report.weekSchedule.counts.done,
            report.weekSchedule.counts.unknown === 0 && report.quality.invalidWorkoutDates === 0), unit: 'count', onPress: open('schedule', 'week') },
          { title: 'Cân nặng gần nhất', periodLabel: report.weight.recordedDate ? statisticsDateLabel(report.weight.recordedDate)
            : report.weight.source === 'profile' ? 'Từ hồ sơ · chưa rõ ngày đo' : 'Chưa có số đo', metric: view.currentWeight, unit: 'kg',
            onPress: open('weight', 'month', report.weight.recordedDate ?? today) },
          { title: 'Chuỗi hoàn thành', periodLabel: 'Các buổi theo lịch liên tiếp', metric: counted(snapshot.workouts, report.habits.currentStreak,
            report.habits.streakComplete && report.quality.invalidWorkoutDates === 0), unit: 'count', onPress: open('habits', 'month'),
            hint: 'Tập bù không khôi phục chuỗi đã mất' },
          { title: 'Phút tập theo lịch', periodLabel: 'Tuần này', metric: sourceMetric(snapshot.workouts, report.weekSchedule.minutes), unit: 'minutes',
            onPress: open('time', 'week') },
        ]} />
        <StatisticsSection title="Buổi chạy gần nhất">
          {snapshot.runs.data === null ? <StatisticsDataState state={snapshot.runs.status === 'success' ? 'empty' : snapshot.runs.status}
            message={snapshot.runs.error?.message} onRetry={refresh} /> : latest ? <Card><StatisticsActivityRow title="Chạy bộ"
              dateLabel={statisticsDateLabel(latest.date)} detail={`${formatStatisticsValue(typeof latest.distanceKm === 'number' ? latest.distanceKm : null, 'km')} km · ${formatStatisticsValue(typeof latest.durationSec === 'number' ? latest.durationSec : null, 'seconds')}`}
              queued={latest._queued === true} onPress={open('running', 'day', latest.date as string)} /></Card>
            : <StatisticsDataState state="empty" message="Chưa có buổi chạy được ghi nhận." />}
        </StatisticsSection>
        {sources.some(source => source.status !== 'success' || !source.complete || source.stale || source.issues.length > 0) || report.running.queuedCount > 0
          ? <StatisticsSection title="Trạng thái dữ liệu">{sources.map((source, index) => source.status !== 'success' || !source.complete || source.stale
            || source.issues.length > 0 || (index === 1 && report.running.queuedCount > 0) ? <View key={index}>
              <Text style={[styles.caption, { color: colors.text }]}>{['Lịch tập', 'Chạy bộ', 'Hồ sơ', 'Cân nặng', 'Mục tiêu'][index]}</Text>
              <StatisticsSourceNotice source={source} queuedCount={index === 1 ? report.running.queuedCount : 0} onRetry={refresh} />
            </View> : null)}</StatisticsSection> : null}
        <StatisticsInfo>Lịch tập và chạy bộ được thống kê riêng. Chỉ các buổi theo lịch đã hoàn thành được tính vào cam kết tuần.</StatisticsInfo>
        <Pressable accessibilityRole="button" onPress={onOpenCategories} style={({ pressed }) => [styles.categories,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.categoriesText, { color: colors.primary }]}>Xem tất cả danh mục</Text>
          <Text accessible={false} style={[styles.categoriesText, { color: colors.primary }]}>›</Text>
        </Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: layout.screenPadding, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { fontSize: fontSize.headline, fontWeight: fontWeight.bold }, caption: { fontSize: fontSize.caption, lineHeight: 22 },
  action: { alignSelf: 'flex-start', minHeight: layout.minTouchSize, justifyContent: 'center' },
  categories: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, minHeight: layout.minTouchSize },
  categoriesText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, flexShrink: 1 },
});
