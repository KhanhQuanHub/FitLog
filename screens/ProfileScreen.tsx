import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { fontSize, fontWeight, layout, radius, spacing, type ThemeMode } from '../constants/theme';
import { calculateBmi } from '../domain/bmi';
import { answerSummary, healthLabel, muscleLabel, TRAINING_QUESTIONS } from '../domain/training';
import { useAuthStore } from '../store/authStore';
import { useTraining } from '../store/TrainingContext';
import { useTheme } from '../store/themeStore';
import Button from '../components/ui/Button';

const THEME_MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Sáng' }, { mode: 'dark', label: 'Tối' }, { mode: 'system', label: 'Tự động' },
];

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { setup } = useTraining();
  const { colors, themeMode, setThemeMode } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  if (!user || !setup) return null;
  const bmi = calculateBmi(setup.weight, setup.height, colors);
  const initial = user.fullName.trim().split(' ').pop()?.charAt(0).toUpperCase() || 'F';
  const strideCm = Math.round(setup.height * (setup.gender === 'Nữ' ? 0.413 : 0.415) * 10) / 10;

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}><Text style={[styles.initial, { color: colors.primary }]}>{initial}</Text></View>
          <View style={styles.meta}><Text style={[styles.name, { color: colors.text }]}>{user.fullName}</Text><Text style={[styles.small, { color: colors.textMuted }]}>{user.email}</Text></View>
        </View>
        <View style={[styles.stats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[[`${setup.age}`, 'Tuổi'], [`${setup.weight} kg`, 'Cân nặng'], [String(bmi.bmi), 'BMI']].map(([value, label]) => <View key={label} style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text><Text style={[styles.small, { color: colors.textMuted }]}>{label}</Text>
          </View>)}
        </View>
        <Button title="Chỉnh sửa" accessibilityLabel="Thiết lập lại chỉ số & vùng cơ" icon="options-outline" onPress={() => navigation.navigate('EditTraining')} />
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Thông tin</Text>
          {setup.goalAnswers && <Text numberOfLines={2} style={[styles.text, { color: colors.textSecondary }]}>{answerSummary(setup.goalAnswers, 'goals')}</Text>}
          <Text style={[styles.text, { color: colors.textSecondary }]}>{setup.gender} · {setup.height} cm · {setup.sessions} buổi/tuần</Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>Sức khỏe: {healthLabel(setup.conditions)}</Text>
          {setup.conditions.includes('other') && <Text style={[styles.text, { color: colors.textSecondary }]}>{setup.healthNote}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="Xem khảo sát đã lưu" accessibilityState={{ expanded: showSurvey }} aria-expanded={showSurvey} onPress={() => setShowSurvey(value => !value)} style={styles.row}>
            <Text style={[styles.text, { color: colors.text }]}>Khảo sát</Text><Ionicons name={showSurvey ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </Pressable>
          {showSurvey && <>
            {setup.goalAnswers && TRAINING_QUESTIONS.map(question => <Text key={question.id} style={[styles.small, { color: colors.textSecondary }]}>{question.title} {answerSummary(setup.goalAnswers!, question.id)}</Text>)}
            <Text style={[styles.small, { color: colors.textSecondary }]}>Vùng cơ: {setup.muscles.map(muscleLabel).join(', ')}</Text>
            <Text style={[styles.small, { color: colors.textMuted }]}>Sải chân ước tính: {strideCm} cm · {setup.minutes} phút/buổi</Text>
          </>}
        </View>
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Giao diện</Text>
          <View style={styles.themeRow}>{THEME_MODES.map(item => <Pressable key={item.mode} accessibilityRole="radio" aria-checked={item.mode === themeMode} accessibilityState={{ checked: item.mode === themeMode }} onPress={() => setThemeMode(item.mode)}
            style={[styles.themeButton, { backgroundColor: item.mode === themeMode ? colors.primaryLight : colors.surfaceAlt }]}>
            <Text style={[styles.text, { color: colors.text }]}>{item.label}</Text>
          </Pressable>)}</View>
          <View style={styles.row}><Text style={[styles.text, { color: colors.text }]}>Nhắc nhở luyện tập</Text><Switch accessibilityLabel="Nhắc nhở luyện tập" value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ true: colors.primary }} /></View>
        </View>
        <Text style={[styles.small, { color: colors.textMuted }]}>Gợi ý tham khảo, không thay thế tư vấn y tế.</Text>
        <Button title="Đăng xuất" variant="danger" icon="log-out-outline" onPress={() => setLogoutVisible(true)} />
      </View>
    </ScrollView>
    <Modal visible={logoutVisible} transparent animationType="fade" onRequestClose={() => setLogoutVisible(false)}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}><View style={[styles.modal, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Đăng xuất khỏi FitLog?</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>Chỉ số và vùng cơ của bạn vẫn được lưu trong tài khoản.</Text>
        <Button title="Đăng xuất" variant="danger" onPress={() => { setLogoutVisible(false); logout(); }} />
        <Button title="Hủy" variant="secondary" onPress={() => setLogoutVisible(false)} />
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { padding: layout.screenPadding, paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: fontSize.headline, fontWeight: fontWeight.bold }, meta: { flex: 1, gap: spacing.xs },
  name: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  stats: { flexDirection: 'row', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs }, statValue: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  panel: { padding: spacing.lg, borderWidth: 1, borderRadius: radius.lg, gap: spacing.md },
  sectionTitle: { fontSize: fontSize.subtitle, fontWeight: fontWeight.bold }, text: { fontSize: fontSize.body, lineHeight: 25 }, small: { fontSize: fontSize.caption, lineHeight: 22 },
  themeRow: { flexDirection: 'row', gap: spacing.sm }, themeButton: { flex: 1, minHeight: layout.minTouchSize, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  row: { minHeight: layout.minTouchSize, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  overlay: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  modal: { width: '100%', maxWidth: 420, padding: spacing.xl, borderRadius: radius.lg, gap: spacing.lg },
});
