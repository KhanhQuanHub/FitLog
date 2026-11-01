import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { healthLabel, recommendTraining, type TrainingSetup } from '../../domain/training';
import { useTheme } from '../../store/themeStore';

export default function TrainingDetails({ setup }: { setup: TrainingSetup }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const plan = recommendTraining(setup);
  return <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Chi tiết gợi ý"
      accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(value => !value)} style={styles.header}>
      <Text style={[styles.label, { color: colors.text }]}>Chi tiết</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
    </Pressable>
    {expanded && <View style={styles.details}>
      <Text style={[styles.text, { color: colors.textSecondary }]}>{plan.reason}</Text>
      {!!plan.selectionReason && <Text style={[styles.text, { color: colors.textSecondary }]}>{plan.selectionReason}</Text>}
      {plan.trainingNotes.map(note => <Text key={note} style={[styles.text, { color: colors.textSecondary }]}>• {note}</Text>)}
      <Text style={[styles.text, { color: colors.textSecondary }]}>{setup.age} tuổi · {setup.height} cm · {setup.weight} kg</Text>
      <Text style={[styles.text, { color: colors.textSecondary }]}>Sức khỏe: {healthLabel(setup.conditions)}{setup.conditions.includes('other') ? ` · ${setup.healthNote}` : ''}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  header: { minHeight: layout.buttonHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  details: { gap: spacing.md, paddingBottom: spacing.lg }, text: { fontSize: fontSize.caption, lineHeight: 22 },
});
