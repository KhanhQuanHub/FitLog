import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TRAINING_QUESTIONS, toggleGoalOption, type GoalAnswers } from '../../domain/training';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

export default function GoalQuestionnaire({ answers, activeQuestion, onChange }: {
  answers: GoalAnswers; activeQuestion: number;
  onChange: (answers: GoalAnswers) => void;
}) {
  const { colors } = useTheme();
  const question = TRAINING_QUESTIONS[activeQuestion];
  const selected = answers.selections[question.id];
  return <View style={styles.container} testID="training-questionnaire">
    <View style={styles.headingRow}>
      <Text style={[styles.caption, { color: colors.textMuted }]}>Câu {activeQuestion + 1}/{TRAINING_QUESTIONS.length}</Text>
      <Text style={[styles.caption, { color: colors.textMuted }]}>Chọn ít nhất 1 ý</Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Tiến độ khảo sát"
      aria-valuemin={1} aria-valuemax={TRAINING_QUESTIONS.length} aria-valuenow={activeQuestion + 1}
      accessibilityValue={{ min: 1, max: TRAINING_QUESTIONS.length, now: activeQuestion + 1, text: `Câu ${activeQuestion + 1}/${TRAINING_QUESTIONS.length}` }} style={styles.progress}>
      {TRAINING_QUESTIONS.map((item, index) => <View key={item.id} style={[styles.progressPart, { backgroundColor: index <= activeQuestion ? colors.primary : colors.border }]} />)}
    </View>
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{question.title}</Text>
    <View style={styles.options} testID={`question-${question.id}`}>
      {question.options.map(option => {
        const checked = selected.includes(option.id);
        return <Pressable key={option.id} accessibilityRole="checkbox" accessibilityLabel={option.label}
          accessibilityState={{ checked }} aria-checked={checked}
          onPress={() => onChange(toggleGoalOption(answers, question.id, option.id))}
          style={[styles.option, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primaryLight : colors.surface }]}>
          <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.textMuted} />
          <Text style={[styles.label, { color: colors.text }]}>{option.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.xs }, progressPart: { flex: 1, height: spacing.xs, borderRadius: radius.pill },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  caption: { fontSize: fontSize.caption, lineHeight: 20 },
  heading: { fontSize: fontSize.title, fontWeight: fontWeight.bold, lineHeight: 28 },
  options: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: layout.buttonHeight },
  label: { flex: 1, fontSize: fontSize.body, lineHeight: 23, fontWeight: fontWeight.medium },
});
