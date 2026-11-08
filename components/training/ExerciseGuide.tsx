import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { EXERCISE_GUIDES } from '../../domain/exerciseGuides';
import type { SuggestedExercise } from '../../domain/training';
import { useTheme } from '../../store/themeStore';

export default function ExerciseGuide({ exercise }: { exercise: SuggestedExercise }) {
  const { colors } = useTheme();
  const guide = EXERCISE_GUIDES[exercise.id];

  return (
    <View style={styles.guide}>
      {guide && <View style={styles.frames}>
        {guide.poses.map((pose, index) => (
          <View key={index} style={[styles.frame, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Svg accessible={false} width="100%" height={104} viewBox="0 0 100 98">
              <Path d="M6 89H94" stroke={colors.border} strokeWidth={2} />
              {pose.support && <Path d={pose.support} fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />}
              <Circle cx={pose.head[0]} cy={pose.head[1]} r={7} fill={colors.surface} stroke={colors.text} strokeWidth={2.5} />
              <Path d={pose.body} fill="none" stroke={colors.text} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              <Path d={pose.active} fill="none" stroke={colors.primary} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.label, { color: colors.text }]}>{index === 0 ? 'Tư thế bắt đầu' : 'Khi thực hiện'}</Text>
          </View>
        ))}
      </View>}
      <Text style={[styles.label, { color: colors.primary }]}>
        {exercise.sets} hiệp · {exercise.reps} lần mỗi hiệp{guide?.alternating ? ' (tính cả hai bên)' : ''}
      </Text>
      {guide && <View style={styles.step}>
        <Text style={[styles.label, { color: colors.text }]}>1. Chuẩn bị</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{guide.setup}</Text>
      </View>}
      <View style={styles.step}>
        <Text style={[styles.label, { color: colors.text }]}>{guide ? '2. Thực hiện' : 'Thực hiện'}</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{exercise.instruction}</Text>
      </View>
      {guide && <View style={styles.step}>
        <Text style={[styles.label, { color: colors.text }]}>3. Lưu ý kỹ thuật</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{guide.cue}</Text>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { gap: spacing.md, paddingBottom: spacing.md },
  frames: { flexDirection: 'row', gap: spacing.sm },
  frame: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
  step: { gap: spacing.xs },
  copy: { fontSize: fontSize.caption, lineHeight: 22 },
});
