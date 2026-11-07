import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PeriodKind } from '../../domain/statistics/types';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

const OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'Ngày' }, { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' }, { value: 'year', label: 'Năm' },
];
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

export function StatisticsPeriodPicker({ value, periodLabel, onChange, onShift, onCurrent,
  canPrevious = true, canNext = true, disabled = false }: StatisticsPeriodPickerProps) {
  const { colors } = useTheme();
  function arrow(direction: -1 | 1) {
    const blocked = disabled || (direction === -1 ? !canPrevious : !canNext);
    return <Pressable accessibilityRole="button" accessibilityLabel={direction === -1 ? 'Kỳ trước' : 'Kỳ sau'}
      accessibilityState={{ disabled: blocked }} aria-disabled={blocked} disabled={blocked} onPress={() => onShift(direction)}
      style={({ pressed }) => [styles.arrow, { backgroundColor: colors.surface, borderColor: colors.border,
        opacity: blocked ? 0.4 : pressed ? 0.7 : 1 }]}>
      <Text style={[styles.arrowText, { color: colors.text }]}>{direction === -1 ? '‹' : '›'}</Text>
    </Pressable>;
  }
  return (
    <View style={styles.wrap}>
      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        {OPTIONS.map(option => (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={`Xem theo ${option.label.toLowerCase()}`}
            accessibilityState={{ selected: value === option.value, disabled }} aria-selected={value === option.value} aria-disabled={disabled} disabled={disabled}
            onPress={() => onChange(option.value)} style={({ pressed }) => [styles.tab,
              { backgroundColor: value === option.value ? colors.surface : colors.surfaceAlt,
                borderColor: value === option.value ? colors.border : colors.surfaceAlt, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
            <Text style={[styles.tabText, { color: value === option.value ? colors.text : colors.textSecondary }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.navigation}>
        {arrow(-1)}
        <Text accessibilityLiveRegion="polite" style={[styles.period, { color: colors.text }]}>{periodLabel}</Text>
        {arrow(1)}
      </View>
      {onCurrent ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onCurrent}
        style={({ pressed }) => [styles.current, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
        <Text style={[styles.currentText, { color: colors.textSecondary }]}>Về kỳ hiện tại</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  tabs: { flexDirection: 'row', padding: spacing.xs, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs },
  tab: { flex: 1, minWidth: layout.minTouchSize, minHeight: layout.minTouchSize, paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm, borderWidth: 1, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, textAlign: 'center' },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrow: { minWidth: layout.minTouchSize, minHeight: layout.minTouchSize, borderWidth: 1,
    borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  arrowText: { fontSize: fontSize.headline, lineHeight: 32 },
  period: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold, textAlign: 'center' },
  current: { alignSelf: 'center', minHeight: layout.minTouchSize, justifyContent: 'center', paddingHorizontal: spacing.md },
  currentText: { fontSize: fontSize.caption, textDecorationLine: 'underline' },
});
