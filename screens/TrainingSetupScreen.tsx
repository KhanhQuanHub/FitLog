import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { fontSize, fontWeight, layout, radius, spacing } from '../constants/theme';
import { CONDITIONS, MUSCLE_GROUPS, MUSCLES, TRAINING_QUESTIONS, answerSummary, createGoalAnswers, firstIncompleteQuestion, recommendTraining, sameGoalAnswers, sameMuscleSelection, suggestMuscles, validateGoalAnswers, validateSetup, type GoalAnswers, type Muscle, type TrainingSetup } from '../domain/training';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { useTraining } from '../store/TrainingContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import BodyMap from '../components/training/BodyMap';
import ExerciseList from '../components/training/ExerciseList';
import GoalQuestionnaire from '../components/training/GoalQuestionnaire';
import TrainingDetails from '../components/training/TrainingDetails';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding' | 'EditTraining'>;
const TITLES = ['Thông tin cơ thể', '', 'Vùng tập của bạn', 'Xác nhận'];
const toNumber = (value: string) => Number(value.trim().replace(',', '.'));

export default function TrainingSetupScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { setup, saveSetup } = useTraining();
  const user = useAuthStore(state => state.user);
  const editing = route.name === 'EditTraining';
  const [draft, setDraft] = useState<TrainingSetup>(() => setup ?? {
    version: 2, height: user?.height ?? 170, weight: user?.weight ?? 60,
    age: 0, gender: user?.gender ?? 'Khác', conditions: [], healthNote: '',
    experience: 'beginner', sessions: 3, minutes: 25, muscles: [],
  });
  const [age, setAge] = useState(setup ? String(setup.age) : '');
  const [height, setHeight] = useState(String(draft.height));
  const [weight, setWeight] = useState(String(draft.weight));
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<GoalAnswers>(() => setup?.goalAnswers ?? createGoalAnswers());
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const busy = useRef(false);
  const current = { ...draft, age: toNumber(age), height: toNumber(height), weight: toNumber(weight) };
  const plan = recommendTraining(current);
  const suggested = draft.goalAnswers ? suggestMuscles(draft.goalAnswers) : null;
  const customized = suggested ? !sameMuscleSelection(draft.muscles, suggested.muscles) : false;
  const incomplete = firstIncompleteQuestion(answers);
  const lastQuestion = activeQuestion === TRAINING_QUESTIONS.length - 1;
  const unansweredCurrent = !answers.selections[TRAINING_QUESTIONS[activeQuestion].id].length;
  const primaryLabel = step === 0 ? 'Xác nhận thông tin' : step === 1 ? lastQuestion ? 'Xem vùng tập đề xuất' : 'Câu tiếp theo' : step === 2 ? 'Xem bài tập gợi ý' : editing ? 'Lưu thay đổi' : 'Xác nhận & bắt đầu';

  function advance() {
    if (step === 1) {
      if (unansweredCurrent) return;
      // Luôn đi lần lượt, kể cả khi hồ sơ đã có đủ câu trả lời từ trước.
      if (!lastQuestion) { setActiveQuestion(activeQuestion + 1); return; }
      if (incomplete >= 0) { setActiveQuestion(incomplete); return; }
    }
    if (step === 3) { void confirm(); return; }
    nextStep();
  }

  useEffect(() => {
    // Đợi nội dung bước mới được dựng rồi mới cuộn, kể cả trên web.
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [step, activeQuestion]);

  function changeStep(next: number) {
    setError(null); setStep(next);
  }
  function toggleMuscle(muscle: Muscle) {
    setDraft(previous => ({ ...previous, muscles: previous.muscles.includes(muscle)
      ? previous.muscles.filter(m => m !== muscle) : [...previous.muscles, muscle] }));
    setError(null);
  }
  function nextStep() {
    if (step === 1) {
      const message = validateGoalAnswers(answers);
      if (message) {
        const incomplete = firstIncompleteQuestion(answers);
        if (incomplete >= 0) setActiveQuestion(incomplete);
        setError(message); return;
      }
      const completed = answers as GoalAnswers;
      const changed = !sameGoalAnswers(draft.goalAnswers, completed);
      const muscles = changed || !draft.muscles.length ? suggestMuscles(completed).muscles : draft.muscles;
      setDraft({ ...current, goalAnswers: { ...completed }, muscles });
      setAdvanced(false);
      changeStep(2);
      return;
    }
    // Bước chỉ số chưa yêu cầu người dùng chọn vùng cơ.
    const message = validateSetup(step === 0 ? { ...current, muscles: ['chest'] } : current);
    if (message) { setError(message); return; }
    if (step === 0) setActiveQuestion(0);
    setDraft(current); changeStep(step + 1);
  }
  async function confirm() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    try {
      await saveSetup(current);
      if (editing) navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa lưu được hồ sơ. Vui lòng thử lại.');
    } finally { busy.current = false; setSaving(false); }
  }

  function option(label: string, active: boolean, onPress: () => void, checkbox = false) {
    return <Pressable key={label} accessibilityLabel={label} accessibilityRole={checkbox ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: active }} aria-checked={active} onPress={onPress}
      style={[styles.option, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.surface }]}>
      {checkbox && <Ionicons name={active ? 'checkbox' : 'square-outline'} size={22} color={active ? colors.primary : colors.textMuted} />}
      <Text style={[styles.optionText, { color: active ? colors.text : colors.textSecondary }]}>{label}</Text>
    </Pressable>;
  }

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.brand, { color: colors.primary }]}>FITLOG</Text>
            {editing && <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} disabled={saving} style={styles.cancel}>
              <Text style={[styles.small, { color: colors.textMuted }]}>Hủy</Text>
            </Pressable>}
          </View>
          <View style={styles.progressRow}>{['Thông tin', 'Khảo sát', 'Vùng cơ', 'Xác nhận'].map((label, i) => <View key={label} style={styles.progressItem}>
            <View style={[styles.progressBar, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
            <Text style={[styles.small, { color: i === step ? colors.primary : colors.textMuted }]}>{label}</Text>
          </View>)}</View>
          {step !== 1 && <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{TITLES[step]}</Text>}

          {step === 0 && <>
            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Chỉ số</Text>
              <View style={styles.fields}>
                <Input label="Tuổi" placeholder="Ví dụ: 22" keyboardType="number-pad" value={age} onChangeText={setAge} containerStyle={styles.field} />
                <Input label="Cao (cm)" accessibilityLabel="Chiều cao (cm)" keyboardType="decimal-pad" value={height} onChangeText={setHeight} containerStyle={styles.field} />
                <Input label="Nặng (kg)" accessibilityLabel="Cân nặng (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} containerStyle={styles.field} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Giới tính</Text>
              <View style={styles.options}>{(['Nam', 'Nữ', 'Khác'] as const).map(g => option(g, draft.gender === g, () => setDraft({ ...draft, gender: g })))}</View>
            </View>
            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Lưu ý sức khỏe</Text>
              <View style={styles.options}>
                {option('Không có', draft.conditions.length === 0, () => setDraft({ ...draft, conditions: [], healthNote: '' }), true)}
                {CONDITIONS.map(condition => option(condition.label, draft.conditions.includes(condition.id), () => setDraft(previous => ({ ...previous,
                  conditions: previous.conditions.includes(condition.id) ? previous.conditions.filter(c => c !== condition.id) : [...previous.conditions, condition.id],
                })), true))}
              </View>
              {draft.conditions.includes('other') && <Input label="Ghi chú sức khỏe" placeholder="Tình trạng bạn muốn lưu ý" value={draft.healthNote} maxLength={300} multiline onChangeText={healthNote => setDraft({ ...draft, healthNote })} />}
            </View>
            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Lịch tập</Text>
              <View style={styles.options}>
                {option('Mới bắt đầu', draft.experience === 'beginner', () => setDraft({ ...draft, experience: 'beginner' }))}
                {option('Đã quen tập', draft.experience === 'regular', () => setDraft({ ...draft, experience: 'regular' }))}
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Buổi / tuần</Text>
              <View style={styles.options}>{[2, 3, 4, 5, 6].map(sessions => option(`${sessions} buổi`, draft.sessions === sessions, () => setDraft({ ...draft, sessions })))}</View>
              <Text style={[styles.label, { color: colors.text }]}>Phút / buổi</Text>
              <View style={styles.options}>{([15, 25, 40] as const).map(minutes => option(`${minutes} phút`, draft.minutes === minutes, () => setDraft({ ...draft, minutes })))}</View>
            </View>
          </>}

          {step === 1 && <GoalQuestionnaire answers={answers} activeQuestion={activeQuestion} onChange={value => { setAnswers(value); setError(null); }} />}

          {step === 2 && <>
            {draft.goalAnswers && <View style={[styles.panel, { backgroundColor: colors.primaryLight, borderColor: colors.primaryMuted }]}>
              <Text numberOfLines={2} style={[styles.sectionTitle, { color: colors.text }]}>{answerSummary(draft.goalAnswers, 'goals')}</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>{draft.muscles.length} nhóm cơ{customized ? ' · Tự chọn' : ' · Đề xuất'}</Text>
            </View>}
            <BodyMap selected={draft.muscles} emphasized={plan.priorityMuscles} onToggle={advanced ? toggleMuscle : undefined} />
            <View style={styles.legend}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} /><Text style={[styles.small, { color: colors.textSecondary }]}>{plan.priorityMuscles.length ? 'Ưu tiên' : 'Đã chọn'}</Text>
              {!!plan.priorityMuscles.length && <><View style={[styles.dot, { backgroundColor: colors.primaryMuted }]} /><Text style={[styles.small, { color: colors.textSecondary }]}>Hỗ trợ</Text></>}
            </View>
            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Nâng cao: tùy chỉnh vùng cơ"
                accessibilityState={{ expanded: advanced }} aria-expanded={advanced}
                onPress={() => setAdvanced(value => !value)} style={styles.advancedHeader}>
                <View style={styles.advancedTitle}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Nâng cao</Text>
                </View>
                <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
              </Pressable>
              {advanced && <>
                <View style={styles.topRow}>
                  <Text style={[styles.label, { color: colors.text }]}>Chọn vùng cơ</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Bỏ chọn hết" style={styles.cancel} onPress={() => setDraft({ ...draft, muscles: [] })}><Text style={[styles.small, { color: colors.textMuted }]}>Bỏ hết</Text></Pressable>
                </View>
                {MUSCLE_GROUPS.map(group => <View key={group.label} style={{ gap: spacing.sm }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{group.label}</Text>
                  <View style={styles.options}>{group.muscles.map(id => {
                    const muscle = MUSCLES.find(m => m.id === id)!;
                    return option(muscle.label, draft.muscles.includes(id), () => toggleMuscle(id), true);
                  })}</View>
                </View>)}
                <Button title="Khôi phục đề xuất" accessibilityLabel="Khôi phục vùng đề xuất" variant="secondary" disabled={!customized} onPress={() => {
                  if (suggested) { setDraft({ ...draft, muscles: [...suggested.muscles] }); setError(null); }
                }} icon="refresh-outline" />
              </>}
            </View>
          </>}

          {step === 3 && <>
            <View style={[styles.panel, { backgroundColor: colors.primaryLight, borderColor: colors.primaryMuted }]}>
              <Text numberOfLines={2} style={[styles.sectionTitle, { color: colors.text }]}>{current.goalAnswers ? answerSummary(current.goalAnswers, 'goals') : plan.title}</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>{draft.sessions} buổi/tuần · {draft.minutes} phút/buổi · {draft.muscles.length} nhóm cơ</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{plan.exercises.length} bài gợi ý</Text>
            <ExerciseList setup={current} />
            <TrainingDetails setup={current} />
            <Text style={[styles.small, { color: colors.textMuted }]}>Gợi ý tham khảo. Có bệnh nền, hãy hỏi ý kiến chuyên gia.</Text>
          </>}

          {error && <Text accessibilityRole="alert" style={[styles.notice, { color: colors.danger, backgroundColor: colors.dangerLight }]}>{error}</Text>}
          <View style={styles.actions}>
            {step > 0 && <Button title={step === 1 && activeQuestion > 0 ? 'Câu trước' : 'Quay lại'} accessibilityLabel={step === 1 && activeQuestion > 0 ? 'Câu trước' : 'Quay lại'} variant="secondary" disabled={saving} onPress={() => {
              if (step === 1 && activeQuestion > 0) { setActiveQuestion(activeQuestion - 1); return; }
              changeStep(step - 1);
            }} />}
            <Button title={step === 1 ? lastQuestion ? 'Xem vùng tập' : 'Câu tiếp theo' : step === 0 ? 'Tiếp tục' : step === 2 ? 'Xem bài tập' : editing ? 'Lưu' : 'Bắt đầu'} accessibilityLabel={primaryLabel}
              onPress={advance} disabled={step === 1 && (unansweredCurrent || (lastQuestion && incomplete >= 0))} loading={saving} style={styles.primary} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { flexGrow: 1, padding: layout.screenPadding },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg, paddingBottom: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  brand: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, letterSpacing: 1 },
  cancel: { minHeight: layout.minTouchSize, justifyContent: 'center', paddingHorizontal: spacing.sm },
  progressRow: { flexDirection: 'row', gap: spacing.sm }, progressItem: { flex: 1, gap: spacing.sm },
  progressBar: { height: spacing.xs, borderRadius: radius.pill },
  title: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  small: { fontSize: fontSize.caption, lineHeight: 22 }, sectionTitle: { fontSize: fontSize.subtitle, fontWeight: fontWeight.bold },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  panel: { padding: spacing.lg, borderWidth: 1, borderRadius: radius.lg, gap: spacing.md },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, field: { flex: 1, minWidth: 90 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { minHeight: layout.minTouchSize, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionText: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, flexShrink: 1 },
  advancedHeader: { minHeight: layout.minTouchSize, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, advancedTitle: { flex: 1, gap: spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }, dot: { width: 12, height: 12, borderRadius: radius.pill },
  notice: { fontSize: fontSize.caption, lineHeight: 23, padding: spacing.lg, borderRadius: radius.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, primary: { flexGrow: 1 },
});
