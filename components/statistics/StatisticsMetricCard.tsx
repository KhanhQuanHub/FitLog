import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import type { CardProps } from '../ui/Card';
import type { StatisticsMetric } from '../../domain/statistics/types';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { describeStatisticsMetric } from './presentation';
import type { StatisticsUnit } from './presentation';

export interface StatisticsMetricValueProps {
  metric: StatisticsMetric | null;
  unit: StatisticsUnit;
  unitLabel?: string;
}

export function StatisticsMetricValue({ metric, unit, unitLabel }: StatisticsMetricValueProps) {
  const { colors } = useTheme();
  const display = describeStatisticsMetric(metric, unit, unitLabel);
  return <View accessible accessibilityLabel={display.accessible} style={styles.valueGroup}>
    <View style={styles.valueRow}>
      <Text style={[styles.value, { color: colors.text }]}>{display.value}</Text>
      {display.unit ? <Text style={[styles.unit, { color: colors.textSecondary }]}>{display.unit}</Text> : null}
    </View>
    {display.note ? <Text style={[styles.note, { color: colors.textSecondary }]}>{display.note}</Text> : null}
  </View>;
}

export interface StatisticsMetricCardProps extends StatisticsMetricValueProps {
  title: string;
  periodLabel: string;
  hint?: string;
  onPress?: () => void;
  style?: CardProps['style'];
  children?: ReactNode;
}

export function StatisticsMetricCard({ title, periodLabel, hint, onPress, style, children, ...value }: StatisticsMetricCardProps) {
  const { colors } = useTheme();
  const display = describeStatisticsMetric(value.metric, value.unit, value.unitLabel);
  return <Card onPress={onPress} accessibilityLabel={onPress ? `${title}. ${periodLabel}. ${display.accessible}. ${hint ? `${hint}. ` : ''}Xem chi tiết` : undefined}
    style={[styles.card, ...(Array.isArray(style) ? style : [style])]}>
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {onPress ? <Text accessible={false} style={[styles.chevron, { color: colors.textMuted }]}>›</Text> : null}
    </View>
    <Text style={[styles.period, { color: colors.textSecondary }]}>{periodLabel}</Text>
    <StatisticsMetricValue {...value} />
    {hint ? <Text style={[styles.note, { color: colors.textSecondary }]}>{hint}</Text> : null}
    {children}
  </Card>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, minHeight: layout.minTouchSize, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  title: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.bold },
  chevron: { fontSize: fontSize.title },
  period: { fontSize: fontSize.caption },
  valueGroup: { gap: spacing.xs },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.xs },
  value: { fontSize: fontSize.headline, fontWeight: fontWeight.bold, flexShrink: 1 },
  unit: { fontSize: fontSize.caption, flexShrink: 1 },
  note: { fontSize: fontSize.caption, lineHeight: 21 },
});
