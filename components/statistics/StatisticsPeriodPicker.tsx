// ============================================================================
// Module: components/statistics/StatisticsPeriodPicker.tsx
// Chức năng: Bộ điều khiển chọn kỳ thống kê gồm:
// - 4 nút tab chuyển đổi loại kỳ: Ngày (`day`), Tuần (`week`), Tháng (`month`), Năm (`year`).
// - Nút mũi tên lùi (`‹` Kỳ trước) và tiến (`›` Kỳ sau) kèm nhãn khoảng ngày ở giữa.
// - Nút "Về kỳ hiện tại" để quay nhanh về hôm nay.
// ============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PeriodKind } from '../../domain/statistics/types';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

/** Danh sách 4 loại kỳ hiển thị trên thanh tab */
const OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
];

/** Các thuộc tính đầu vào của `StatisticsPeriodPicker` */
export interface StatisticsPeriodPickerProps {
  value: PeriodKind;
  periodLabel: string;
  onChange: (value: PeriodKind) => void;
  onShift: (direction: -1 | 1) => void;
  onCurrent?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  disabled?: boolean;
}

/**
 * Component thanh chọn kỳ thống kê (Ngày / Tuần / Tháng / Năm) và điều hướng Kỳ trước / Kỳ sau.
 *
 * @param props Giá trị kỳ đang chọn, nhãn kỳ và các hàm xử lý sự kiện khi bấm đổi kỳ
 * @returns JSX bộ chọn kỳ thống kê
 */
export function StatisticsPeriodPicker({
  value,
  periodLabel,
  onChange,
  onShift,
  onCurrent,
  canPrevious = true,
  canNext = true,
  disabled = false,
}: StatisticsPeriodPickerProps) {
  const { colors } = useTheme();

  /**
   * Tạo nút mũi tên lùi (`direction = -1`) hoặc tiến (`direction = 1`).
   */
  function renderArrowButton(direction: -1 | 1) {
    const canMove = direction === -1 ? canPrevious : canNext;
    const isBlocked = disabled || !canMove;
    const label = direction === -1 ? 'Kỳ trước' : 'Kỳ sau';

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isBlocked }}
        aria-disabled={isBlocked}
        disabled={isBlocked}
        onPress={() => onShift(direction)}
        style={({ pressed }) => [
          styles.arrow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: isBlocked ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.arrowText, { color: colors.text }]}>
          {direction === -1 ? '‹' : '›'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Thanh 4 tab: Ngày / Tuần / Tháng / Năm */}
      <View
        accessibilityRole="tablist"
        style={[
          styles.tabs,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        {OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityLabel={`Xem theo ${option.label.toLowerCase()}`}
              accessibilityState={{ selected: isSelected, disabled }}
              aria-selected={isSelected}
              aria-disabled={disabled}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: isSelected ? colors.surface : colors.surfaceAlt,
                  borderColor: isSelected ? colors.border : colors.surfaceAlt,
                  opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isSelected ? colors.text : colors.textSecondary },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Hàng điều hướng: [‹ Kỳ trước]  Nhãn kỳ hiện tại  [Kỳ sau ›] */}
      <View style={styles.navigation}>
        {renderArrowButton(-1)}
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.period, { color: colors.text }]}
        >
          {periodLabel}
        </Text>
        {renderArrowButton(1)}
      </View>

      {/* Nút quay nhanh về kỳ hiện tại */}
      {onCurrent ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          accessibilityState={{ disabled }}
          onPress={onCurrent}
          style={({ pressed }) => [
            styles.current,
            { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.currentText, { color: colors.textSecondary }]}>
            Về kỳ hiện tại
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  tabs: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minWidth: layout.minTouchSize,
    minHeight: layout.minTouchSize,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrow: {
    minWidth: layout.minTouchSize,
    minHeight: layout.minTouchSize,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { fontSize: fontSize.headline, lineHeight: 32 },
  period: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  current: {
    alignSelf: 'center',
    minHeight: layout.minTouchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  currentText: { fontSize: fontSize.caption, textDecorationLine: 'underline' },
});
