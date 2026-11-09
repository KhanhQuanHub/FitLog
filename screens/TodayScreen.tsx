import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, layout, radius, spacing } from '../constants/theme';
import { WEEKDAYS, answerSummary, buildWeeklySchedule, recommendTraining } from '../domain/training';
import { useTraining } from '../store/TrainingContext';
import { useTheme } from '../store/themeStore';
import BodyMap from '../components/training/BodyMap';
import ExerciseList from '../components/training/ExerciseList';
import Button from '../components/ui/Button';
import TrainingDetails from '../components/training/TrainingDetails';
import TrainingSetupScreen from './TrainingSetupScreen';

export default function TodayScreen() {
  const { colors } = useTheme();
  const { setup } = useTraining();
  const [editingSetup, setEditingSetup] = useState(false);
  if (!setup || editingSetup) {
    const mode = setup ? 'EditTraining' : 'Onboarding';
    return (
      <TrainingSetupScreen
        navigation={{ goBack: () => setEditingSetup(false) } as never}
        route={{ key: mode, name: mode } as never}
      />
    );
  }
  const plan = recommendTraining(setup);
  const day = (new Date().getDay() + 6) % WEEKDAYS.length;
  const schedule = buildWeeklySchedule(setup.sessions, plan.exercises);
  const sessionIndex = schedule.findIndex(session => session.day === day);
  const session = schedule[sessionIndex];
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Mục tiêu</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>Theo dõi mục tiêu tập luyện và kế hoạch phù hợp với bạn.</Text>
        <View style={[styles.hero, { backgroundColor: colors.primaryLight, borderColor: colors.primaryMuted }]}>
          <View style={styles.goalTitleRow}>
            <Ionicons name="flag-outline" size={26} color={colors.primary} />
            <Text numberOfLines={2} style={[styles.planTitle, styles.goalTitle, { color: colors.text }]}>{setup.goalAnswers ? answerSummary(setup.goalAnswers, 'goals') : plan.title}</Text>
          </View>
          <View style={styles.goalDetails}>
            <Text style={[styles.note, { color: colors.textSecondary }]}><Text style={styles.goalDetailLabel}>Tuần suất:</Text> {setup.sessions} buổi/tuần</Text>
            <Text style={[styles.note, { color: colors.textSecondary }]}><Text style={styles.goalDetailLabel}>Thời lượng:</Text> {setup.minutes} phút/buổi</Text>
            <Text style={[styles.note, { color: colors.textSecondary }]}><Text style={styles.goalDetailLabel}>Nhóm cơ:</Text> {setup.muscles.length}</Text>
          </View>
        </View>
        <BodyMap selected={setup.muscles} emphasized={plan.priorityMuscles} compact />
        <Button title="Điều chỉnh" accessibilityLabel="Thay đổi chỉ số & vùng tập" variant="secondary" onPress={() => navigation.navigate('EditTraining')} icon="options-outline" />
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.note, { color: colors.textSecondary }]}>{WEEKDAYS[day]}</Text>
          <Text style={[styles.planTitle, { color: colors.text }]}>
            {session ? `Buổi ${sessionIndex + 1} · ${session.exercises.length} bài` : 'Ngày nghỉ'}
          </Text>
          {session ? <ExerciseList key={day} exercises={session.exercises} /> : (
            <Text style={[styles.note, { color: colors.textSecondary }]}>Xem tab Lịch tập để biết các buổi trong tuần.</Text>
          )}
        </View>
        <TrainingDetails setup={setup} />
        <Text style={[styles.note, { color: colors.textMuted }]}>Gợi ý tham khảo, không thay thế tư vấn chuyên gia.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { padding: layout.screenPadding, paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg },
  title: { fontSize: fontSize.headline, fontWeight: fontWeight.heavy },
  description: { fontSize: fontSize.body, lineHeight: 23, marginTop: -spacing.md },
  hero: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  goalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalTitle: { flex: 1 },
  goalDetails: { gap: spacing.xs },
  goalDetailLabel: { fontWeight: fontWeight.bold },
  planTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold }, text: { fontSize: fontSize.body, lineHeight: 25 },
  note: { fontSize: fontSize.caption, lineHeight: 23 },
});
