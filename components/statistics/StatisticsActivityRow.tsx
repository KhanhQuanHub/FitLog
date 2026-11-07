// ============================================================================
// Module: components/statistics/StatisticsActivityRow.tsx
// Chức năng: Hiển thị một dòng lịch sử hoạt động (ví dụ: một buổi chạy bộ,
// một buổi tập theo lịch, hoặc một lần cân nặng) kèm ngày tháng, thông số
// chi tiết và nhãn trạng thái ("Đã hoàn thành", "Chờ đồng bộ"...).
// ============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsStatusBadge } from './StatisticsStatus';

/** Các thuộc tính đầu vào của một dòng lịch sử hoạt động */
export interface StatisticsActivityRowProps {
  title: string;
  dateLabel: string;
  detail: string;
  statusLabel?: string;
  queued?: boolean;
  onPress?: () => void;
}

/**
 * Component hiển thị một dòng hoạt động trong danh sách lịch sử.
 * Nếu có truyền hàm `onPress`, dòng sẽ biến thành nút bấm (`Pressable`) có mũi tên `›`
 * để người dùng chạm vào xem chi tiết.
 *
 * @param props Thông tin tiêu đề, ngày, chi tiết, nhãn trạng thái và sự kiện bấm
 * @returns JSX dòng lịch sử hoạt động
 */
export function StatisticsActivityRow({
  title,
  dateLabel,
  detail,
  statusLabel,
  queued,
  onPress,
}: StatisticsActivityRowProps) {
  const { colors } = useTheme();

  // Ghép chuỗi mô tả cho trình đọc màn hình (Accessibility)
  const label = [
    title,
    dateLabel,
    detail,
    statusLabel,
    queued ? 'Chờ đồng bộ' : '',
  ]
    .filter(Boolean)
    .join('. ');

  const content = (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {onPress ? (
          <Text accessible={false} style={[styles.chevron, { color: colors.textMuted }]}>
            ›
          </Text>
        ) : null}
      </View>

      <Text style={[styles.caption, { color: colors.textSecondary }]}>{dateLabel}</Text>
      <Text style={[styles.detail, { color: colors.text }]}>{detail}</Text>

      <View style={styles.badges}>
        {statusLabel ? <StatisticsStatusBadge label={statusLabel} /> : null}
        {queued ? <StatisticsStatusBadge tone="warning" label="Chờ đồng bộ" /> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Xem chi tiết`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.row, { borderColor: colors.border }]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    minHeight: layout.minTouchSize,
  },
  header: { flexDirection: 'row', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  chevron: { fontSize: fontSize.title },
  caption: { fontSize: fontSize.caption, lineHeight: 21 },
  detail: { fontSize: fontSize.body, lineHeight: 24 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
