import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { muscleLabel, recommendTraining, type TrainingSetup } from '../../domain/training';
import { useTheme } from '../../store/themeStore';

export default function ExerciseList({ setup }: { setup: TrainingSetup }) {
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const exercises = recommendTraining(setup).exercises;
  const visible = showAll ? exercises : exercises.slice(0, 4);
  return <View style={styles.list}>
    {visible.map((exercise, index) => {
      const expanded = opened === exercise.id;
      return <View key={exercise.id} style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Hướng dẫn: ${exercise.name}`}
          accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setOpened(expanded ? null : exercise.id)} style={styles.header}>
          <View style={[styles.number, { backgroundColor: colors.primaryLight }]}><Text style={[styles.numberText, { color: colors.primary }]}>{index + 1}</Text></View>
          <View style={styles.content}>
            <Text style={[styles.name, { color: colors.text }]}>{exercise.name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{muscleLabel(exercise.muscle)} · {exercise.sets} × {exercise.reps} lần</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Pressable>
        {expanded && <Text style={[styles.description, { color: colors.textSecondary }]}>{exercise.instruction}</Text>}
      </View>;
    })}
    {exercises.length > 4 && <Pressable accessibilityRole="button" accessibilityLabel={showAll ? 'Thu gọn danh sách bài tập' : 'Xem tất cả bài tập'}
      accessibilityState={{ expanded: showAll }} aria-expanded={showAll} onPress={() => setShowAll(value => !value)} style={styles.more}>
      <Text style={[styles.moreText, { color: colors.primary }]}>{showAll ? 'Thu gọn' : `Xem thêm ${exercises.length - 4} bài`}</Text>
    </Pressable>}
    <Text style={[styles.meta, { color: colors.textMuted }]}>Khởi động nhẹ. Dừng nếu đau hoặc khó chịu.</Text>
  </View>;
}
const styles = StyleSheet.create({
  list: { gap: spacing.sm }, item: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  number: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
  content: { flex: 1, gap: spacing.xs }, name: { fontSize: fontSize.body, lineHeight: 22, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.caption, lineHeight: 20 },
  description: { fontSize: fontSize.caption, lineHeight: 22, paddingBottom: spacing.md },
  more: { minHeight: layout.minTouchSize, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
});
