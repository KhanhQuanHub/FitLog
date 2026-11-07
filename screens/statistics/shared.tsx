import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/ui/Card';
import { StatisticsDataState, StatisticsMetricCard, StatisticsSourceContent } from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import type { StatisticsSource } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

export function StatisticsText({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.text, { color: colors.textSecondary }]}>{children}</Text>;
}

export function StatisticsSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
    {children}
  </View>;
}

export function StatisticsSourceSection({ title, source, refresh, children }: {
  title: string; source: StatisticsSource<unknown>; refresh: () => void; children: ReactNode;
}) {
  return <StatisticsSection title={title}><StatisticsSourceContent source={source} onRetry={refresh}>{children}</StatisticsSourceContent></StatisticsSection>;
}

export function StatisticsInfo({ children }: { children: ReactNode }) {
  return <Card><StatisticsText>{children}</StatisticsText></Card>;
}

export function StatisticsMetricGrid({ items }: { items: StatisticsMetricCardProps[] }) {
  return <View style={styles.grid}>{items.map(item => <StatisticsMetricCard key={item.title} {...item} style={styles.tile} />)}</View>;
}

export function StatisticsHistory<T>({ records, renderRow, emptyMessage }: {
  records: readonly T[]; renderRow: (row: T, index: number) => ReactNode; emptyMessage: string;
}) {
  const [limit, setLimit] = useState(20);
  const { colors } = useTheme();
  if (records.length === 0) return <StatisticsDataState state="empty" message={emptyMessage} />;
  return <Card>
    {records.slice(0, limit).map(renderRow)}
    {limit < records.length ? <Pressable accessibilityRole="button" onPress={() => setLimit(value => value + 20)}
      style={({ pressed }) => [styles.more, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.text, { color: colors.text }]}>Xem thêm ({records.length - limit} mục còn lại)</Text>
    </Pressable> : null}
  </Card>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  title: { fontSize: fontSize.subtitle, fontWeight: fontWeight.bold },
  text: { fontSize: fontSize.caption, lineHeight: 22 },
  more: { minHeight: layout.minTouchSize, justifyContent: 'center', paddingVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: 134, flexGrow: 1, minWidth: 0 },
});
