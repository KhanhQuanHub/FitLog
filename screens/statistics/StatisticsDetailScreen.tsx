import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatisticsDataState, StatisticsPeriodPicker } from '../../components/statistics';
import { getStatisticsPeriod, shiftStatisticsPeriod } from '../../domain/statistics/statistics';
import type { PeriodKind } from '../../domain/statistics/types';
import type { StatisticsDataSnapshot } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsDataProvider, useHasStatisticsProvider, useStatisticsData } from './StatisticsDataProvider';
import { buildStatisticsView, statisticsPeriodLabel } from './viewModel';
import type { StatisticsView } from './viewModel';

export interface StatisticsScreenProps {
  onBack?: () => void;
  initialKind?: PeriodKind;
  initialAnchor?: string;
  // Chỉ truyền khi host đã biết chiều rộng vùng biểu đồ; mặc định tự đo onLayout.
  chartWidth?: number;
}
export interface StatisticsScreenContext {
  snapshot: StatisticsDataSnapshot;
  view: StatisticsView;
  today: string;
  kind: PeriodKind;
  chartWidth?: number;
  refresh: () => void;
}

interface DetailProps extends StatisticsScreenProps {
  title: string;
  description: string;
  children: (context: StatisticsScreenContext) => ReactNode;
}

export function StatisticsDetailScreen(props: DetailProps) {
  const shared = useHasStatisticsProvider();
  return shared ? <StatisticsDetailBody {...props} />
    : <StatisticsDataProvider><StatisticsDetailBody {...props} /></StatisticsDataProvider>;
}

function StatisticsDetailBody({ title, description, onBack, initialKind = 'week', initialAnchor, chartWidth, children }: DetailProps) {
  const { colors } = useTheme();
  const { snapshot, today, refresh } = useStatisticsData();
  const [kind, setKind] = useState<PeriodKind>(initialKind);
  const [selection, setSelection] = useState<string | null>(initialAnchor ?? null);
  const anchor = selection ?? today;
  const period = useMemo(() => getStatisticsPeriod(kind, anchor), [kind, anchor]);
  const view = useMemo(() => snapshot ? buildStatisticsView(snapshot, today, kind, anchor) : null, [snapshot, today, kind, anchor]);
  const refreshing = !!snapshot && [snapshot.workouts, snapshot.runs, snapshot.profiles, snapshot.weights, snapshot.userGoals]
    .some(source => source.status === 'loading');
  let canPrevious = false;
  let canNext = false;
  try { canPrevious = shiftStatisticsPeriod(kind, anchor, -1).start >= '0001-01-01'; } catch { /* Biên lịch. */ }
  try { canNext = shiftStatisticsPeriod(kind, anchor, 1).start <= today; } catch { /* Biên lịch. */ }
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}
      tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />}>
      <View style={styles.heading}>
        {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.action}>
          <Text style={[styles.back, { color: colors.text }]}>‹</Text>
        </Pressable> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      <StatisticsPeriodPicker value={kind} periodLabel={statisticsPeriodLabel(kind, anchor)} onChange={setKind}
        onShift={direction => setSelection(shiftStatisticsPeriod(kind, anchor, direction).start)} onCurrent={() => setSelection(null)}
        canPrevious={canPrevious} canNext={canNext} />
      <Pressable accessibilityRole="button" accessibilityLabel="Làm mới thống kê" disabled={refreshing}
        accessibilityState={{ disabled: refreshing }} aria-disabled={refreshing} onPress={refresh} style={styles.refresh}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{refreshing ? 'Đang cập nhật…' : 'Làm mới thống kê'}</Text>
      </Pressable>
      {!snapshot ? <StatisticsDataState state="loading" /> : !view ? <StatisticsDataState state="idle" title="Cần đăng nhập"
        message="Đăng nhập để xem dữ liệu thống kê cá nhân của bạn." /> :
        <View key={`${snapshot.session.userId}:${snapshot.session.revision}:${period.kind}:${period.start}`} style={styles.body}>
          {children({ snapshot, view, today, kind, chartWidth, refresh })}
        </View>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: layout.screenPadding, paddingBottom: spacing.xxxl, gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { minWidth: layout.minTouchSize, minHeight: layout.minTouchSize, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: fontSize.headline },
  title: { flex: 1, fontSize: fontSize.headline, fontWeight: fontWeight.bold },
  description: { fontSize: fontSize.caption, lineHeight: 22 },
  refresh: { alignSelf: 'flex-start', minHeight: layout.minTouchSize, justifyContent: 'center' },
  body: { gap: spacing.xl },
});
