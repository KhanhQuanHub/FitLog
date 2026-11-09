import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { vi } from 'date-fns/locale';

import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

type WeeklyStripProps = {
  selectedDate: string;
  workoutDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export default function WeeklyStrip({
  selectedDate,
  workoutDates,
  onSelectDate,
}: WeeklyStripProps) {
  const { colors } = useTheme();
  const selected = parseISO(selectedDate);
  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const active = isSameDay(day, selected);

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={format(day, 'EEEE d MMMM', { locale: vi })}
            accessibilityState={{ selected: active }}
            onPress={() => onSelectDate(key)}
            style={[
              styles.day,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.weekday, { color: active ? colors.textOnPrimary : colors.textMuted }]}>
              {format(day, 'EEEEE', { locale: vi })}
            </Text>
            <Text style={[styles.dayNumber, { color: active ? colors.textOnPrimary : colors.text }]}>
              {format(day, 'd')}
            </Text>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: workoutDates.has(key)
                    ? active
                      ? colors.textOnPrimary
                      : colors.accent
                    : 'transparent',
                },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  day: {
    width: 44,
    minHeight: layout.minTouchSize + 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  weekday: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.medium,
  },
  dayNumber: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
});
