import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ExerciseList from '../components/training/ExerciseList';
import { fontSize, fontWeight, layout, radius, spacing } from '../constants/theme';
import { WEEKDAYS, buildWeeklySchedule, recommendTraining } from '../domain/training';
import { useTraining } from '../store/TrainingContext';
import { useTheme } from '../store/themeStore';

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const { setup } = useTraining();
  if (!setup) return null;

  const schedule = buildWeeklySchedule(setup.sessions, recommendTraining(setup).exercises);
  const today = (new Date().getDay() + 6) % WEEKDAYS.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Lịch tập</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {schedule.length} buổi mỗi tuần · Mục tiêu {setup.minutes} phút mỗi buổi
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Chọn một bài để xem hai tư thế minh họa, cách thực hiện và lưu ý kỹ thuật.
          </Text>
          {schedule.map((session, index) => (
            <View key={session.day} style={[styles.card, {
              backgroundColor: colors.surface,
              borderColor: session.day === today ? colors.primary : colors.border,
            }]}>
              <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
                {WEEKDAYS[session.day]} · Buổi {index + 1}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {session.exercises.length} bài{session.day === today ? ' · Hôm nay' : ''}
              </Text>
              <ExerciseList exercises={session.exercises} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md },
  title: { fontSize: fontSize.headline, fontWeight: fontWeight.heavy },
  heading: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.caption, lineHeight: 22 },
  card: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg },
});
