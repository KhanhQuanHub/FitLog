import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { fontSize, fontWeight, layout, radius, spacing } from '../constants/theme';
import { answerSummary, recommendTraining } from '../domain/training';
import { useTraining } from '../store/TrainingContext';
import { useTheme } from '../store/themeStore';
import BodyMap from '../components/training/BodyMap';
import ExerciseList from '../components/training/ExerciseList';
import Button from '../components/ui/Button';
import TrainingDetails from '../components/training/TrainingDetails';

export default function TodayScreen() {
  const { colors } = useTheme();
  const { setup } = useTraining();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (!setup) return null;
  const plan = recommendTraining(setup);
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
        <Text style={[styles.planTitle, { color: colors.text }]}>{plan.exercises.length} bài gợi ý</Text>
        <ExerciseList setup={setup} />
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
