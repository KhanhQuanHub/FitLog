// ============================================================================
// Module: components/statistics/StatisticsMetricCard.tsx
// Chức năng: Hiển thị thẻ chỉ số thống kê (`StatisticsMetricCard`) gồm:
// - Tiêu đề chỉ số (ví dụ: "Calo theo lịch", "Quãng đường chạy")
// - Nhãn kỳ thời gian (ví dụ: "Hôm nay", "Tuần này")
// - Con số lớn kèm đơn vị đo (`StatisticsMetricValue`) và ghi chú phụ (`hint`)
// ============================================================================

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import type { CardProps } from '../ui/Card';
import type { StatisticsMetric } from '../../domain/statistics/types';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { describeStatisticsMetric } from './presentation';
import type { StatisticsUnit } from './presentation';

/** Thuộc tính đầu vào cho phần hiển thị con số và đơn vị */
export interface StatisticsMetricValueProps {
  metric: StatisticsMetric | null;
  unit: StatisticsUnit;
  unitLabel?: string;
}

/**
 * Component hiển thị con số thống kê đã định dạng kèm đơn vị đo và ghi chú
 * ("Chưa có dữ liệu" hoặc "Số liệu chưa đầy đủ" nếu có).
 *
 * @param props Đối tượng `metric`, loại đơn vị `unit` và nhãn đơn vị tùy chọn `unitLabel`
 * @returns JSX hiển thị giá trị số và đơn vị
 */
export function StatisticsMetricValue({
  metric,
  unit,
  unitLabel,
}: StatisticsMetricValueProps) {
  const { colors } = useTheme();
  const display = describeStatisticsMetric(metric, unit, unitLabel);

  return (
    <View accessible accessibilityLabel={display.accessible} style={styles.valueGroup}>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{display.value}</Text>
        {display.unit ? (
          <Text style={[styles.unit, { color: colors.textSecondary }]}>{display.unit}</Text>
        ) : null}
      </View>
      {display.note ? (
        <Text style={[styles.note, { color: colors.textSecondary }]}>{display.note}</Text>
      ) : null}
    </View>
  );
}

/** Thuộc tính đầu vào cho thẻ chỉ số `StatisticsMetricCard` */
export interface StatisticsMetricCardProps extends StatisticsMetricValueProps {
  title: string;
  periodLabel: string;
  hint?: string;
  onPress?: () => void;
  style?: CardProps['style'];
  children?: ReactNode;
}

/**
 * Component hiển thị một ô thẻ chỉ số thống kê.
 * Nếu có truyền `onPress`, người dùng có thể chạm vào thẻ để chuyển sang màn hình chi tiết.
 *
 * @param props Tiêu đề, nhãn kỳ, số liệu `metric`, đơn vị `unit` và sự kiện `onPress`
 * @returns JSX thẻ `Card` hiển thị chỉ số
 */
export function StatisticsMetricCard({
  title,
  periodLabel,
  hint,
  onPress,
  style,
  children,
  ...value
}: StatisticsMetricCardProps) {
  const { colors } = useTheme();
  const display = describeStatisticsMetric(value.metric, value.unit, value.unitLabel);

  const hintSegment = hint ? `${hint}. ` : '';
  const cardAccessibilityLabel = onPress
    ? `${title}. ${periodLabel}. ${display.accessible}. ${hintSegment}Xem chi tiết`
    : undefined;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={cardAccessibilityLabel}
      style={[styles.card, ...(Array.isArray(style) ? style : [style])]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {onPress ? (
          <Text accessible={false} style={[styles.chevron, { color: colors.textMuted }]}>
            ›
          </Text>
        ) : null}
      </View>

      <Text style={[styles.period, { color: colors.textSecondary }]}>{periodLabel}</Text>
      <StatisticsMetricValue {...value} />

      {hint ? (
        <Text style={[styles.note, { color: colors.textSecondary }]}>{hint}</Text>
      ) : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, minHeight: layout.minTouchSize, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  title: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.bold },
  chevron: { fontSize: fontSize.title },
  period: { fontSize: fontSize.caption },
  valueGroup: { gap: spacing.xs },
  valueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.xs,
  },
  value: { fontSize: fontSize.headline, fontWeight: fontWeight.bold, flexShrink: 1 },
  unit: { fontSize: fontSize.caption, flexShrink: 1 },
  note: { fontSize: fontSize.caption, lineHeight: 21 },
});
