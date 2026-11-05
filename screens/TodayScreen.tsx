import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { fontSize, fontWeight, layout, radius, spacing } from '../constants/theme';
import { answerSummary, recommendTraining } from '../domain/training';
import { useTraining } from '../store/TrainingContext';
import { useTheme } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import BodyMap from '../components/training/BodyMap';
import ExerciseList from '../components/training/ExerciseList';
import Button from '../components/ui/Button';
import TrainingDetails from '../components/training/TrainingDetails';

export default function TodayScreen() {
  const { colors } = useTheme();
  const { setup } = useTraining();
  const user = useAuthStore(state => state.user);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (!setup) return null;
  const plan = recommendTraining(setup);
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <Text style={[styles.greeting, { color: colors.textMuted }]}>Chào {user?.fullName}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Hôm nay</Text>
        <View style={[styles.hero, { backgroundColor: colors.primaryLight, borderColor: colors.primaryMuted }]}>
          <Text numberOfLines={2} style={[styles.planTitle, { color: colors.text }]}>{setup.goalAnswers ? answerSummary(setup.goalAnswers, 'goals') : plan.title}</Text>
          <Text style={[styles.note, { color: colors.textSecondary }]}>{setup.sessions} buổi/tuần · {setup.minutes} phút/buổi · {setup.muscles.length} nhóm cơ</Text>
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
  greeting: { fontSize: fontSize.body }, title: { fontSize: fontSize.headline, fontWeight: fontWeight.heavy },
  hero: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  planTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold }, text: { fontSize: fontSize.body, lineHeight: 25 },
  note: { fontSize: fontSize.caption, lineHeight: 23 },
});
