import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsStatusBadge } from './StatisticsStatus';

export interface StatisticsActivityRowProps {
  title: string;
  dateLabel: string;
  detail: string;
  statusLabel?: string;
  queued?: boolean;
  onPress?: () => void;
}

export function StatisticsActivityRow({ title, dateLabel, detail, statusLabel, queued, onPress }: StatisticsActivityRowProps) {
  const { colors } = useTheme();
  const label = [title, dateLabel, detail, statusLabel, queued ? 'Chờ đồng bộ' : ''].filter(Boolean).join('. ');
  const content = <>
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {onPress ? <Text accessible={false} style={[styles.chevron, { color: colors.textMuted }]}>›</Text> : null}
    </View>
    <Text style={[styles.caption, { color: colors.textSecondary }]}>{dateLabel}</Text>
    <Text style={[styles.detail, { color: colors.text }]}>{detail}</Text>
    <View style={styles.badges}>
      {statusLabel ? <StatisticsStatusBadge label={statusLabel} /> : null}
      {queued ? <StatisticsStatusBadge tone="warning" label="Chờ đồng bộ" /> : null}
    </View>
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Xem chi tiết`} onPress={onPress}
    style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>{content}</Pressable>
    : <View accessible accessibilityLabel={label} style={[styles.row, { borderColor: colors.border }]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.xs, borderBottomWidth: 1, minHeight: layout.minTouchSize },
  header: { flexDirection: 'row', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  chevron: { fontSize: fontSize.title },
  caption: { fontSize: fontSize.caption, lineHeight: 21 },
  detail: { fontSize: fontSize.body, lineHeight: 24 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
