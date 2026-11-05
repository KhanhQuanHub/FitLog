import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Exercise, Workout, WORKOUT_STATUS_LABELS } from '../../domain/workout';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { calculateCalories } from '../../utils/runMath';
import Card from '../ui/Card';

type WorkoutCardProps = {
  workout: Workout;
  exercise?: Exercise;
  weightKg: number;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const STATUS_TONE = {
  planned: 'info',
  done: 'primary',
  missed: 'danger',
} as const;

export default function WorkoutCard({
  workout,
  exercise,
  weightKg,
  deleting,
  onEdit,
  onDelete,
}: WorkoutCardProps) {
  const { colors } = useTheme();
  const [shake] = useState(() => new Animated.Value(0));
  const shakeLoop = useRef<Animated.CompositeAnimation | null>(null);
  const tone = STATUS_TONE[workout.status];
  const toneColor = tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : colors.info;
  const rotation = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1.2deg', '1.2deg'],
  });

  const startShake = () => {
    if (deleting) return;
    shakeLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 45,
          useNativeDriver: true,
        }),
      ])
    );
    shakeLoop.current.start();
  };

  const stopShake = () => {
    shakeLoop.current?.stop();
    shakeLoop.current = null;
    shake.setValue(0);
  };

  return (
    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
      <Card style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nhấn giữ 2 giây để xóa buổi tập"
          accessibilityHint="Thẻ sẽ rung khi đang nhấn giữ. Thả tay trước 2 giây để hủy."
          accessibilityState={{ disabled: deleting }}
          delayLongPress={2000}
          disabled={deleting}
          onLongPress={onDelete}
          onPressIn={startShake}
          onPressOut={stopShake}
          style={styles.holdArea}
        >
          <View style={styles.topRow}>
            <View style={[styles.timeBadge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={[styles.timeText, { color: colors.primary }]}>{workout.time}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: toneColor + '18' }]}>
              <Text style={[styles.statusText, { color: toneColor }]}>
                {WORKOUT_STATUS_LABELS[workout.status]}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {exercise?.name ?? `Bài tập #${workout.exerciseId}`}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {exercise?.activityType ?? 'Bài tập'} · {exercise?.primaryMuscleGroup ?? exercise?.muscleGroup ?? 'Toàn thân'}
          </Text>

          <View style={styles.detailRow}>
            {workout.status === 'done' ? (
              <>
                <View style={styles.detailItem}>
                  <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {workout.durationMin} phút
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="flame-outline" size={16} color={colors.accent} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {workout.caloriesBurned} kcal
                  </Text>
                </View>
              </>
            ) : (
              <Text style={[styles.detailText, { color: colors.textMuted }]}>
                {exercise
                  ? exercise.reps > 0
                    ? `${exercise.sets} hiệp × ${exercise.reps} lần`
                    : `${exercise.sets} hiệp × ${Math.round(exercise.durationSec / 60)} phút`
                  : 'Chưa ghi nhận thời lượng'}
              </Text>
            )}
          </View>
          {workout.status === 'planned' && exercise ? (
            <Text style={[styles.detailText, { color: colors.textMuted }]}>
              Ước tính {calculateCalories(exercise.met, weightKg, (workout.plannedDurationMin || 30) * 60)} kcal
              {' '}cho {workout.plannedDurationMin || 30} phút
            </Text>
          ) : null}

          {workout.note ? (
            <Text style={[styles.note, { color: colors.textMuted }]} numberOfLines={2}>
              {workout.note}
            </Text>
          ) : null}

          <View style={styles.holdHint}>
            <Ionicons
              name={deleting ? 'hourglass-outline' : 'hand-left-outline'}
              size={16}
              color={deleting ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.holdHintText, { color: deleting ? colors.accent : colors.textMuted }]}>
              {deleting ? 'Đang xóa buổi tập...' : 'Nhấn giữ thẻ 2 giây để xóa'}
            </Text>
          </View>
        </Pressable>

        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa buổi tập"
            onPress={onEdit}
            disabled={deleting}
            style={styles.actionButton}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Chỉnh sửa / ghi nhận</Text>
          </Pressable>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  holdArea: {
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timeBadge: {
    minHeight: layout.minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  timeText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.semibold,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
  },
  meta: {
    fontSize: fontSize.caption,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: fontSize.caption,
  },
  note: {
    fontSize: fontSize.caption,
    lineHeight: 20,
  },
  holdHint: {
    minHeight: layout.minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  holdHintText: {
    fontSize: fontSize.micro,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    minHeight: layout.minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
});
