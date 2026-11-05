import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import StatBox from '../components/ui/StatBox';
import WeeklyStrip from '../components/schedule/WeeklyStrip';
import WorkoutCard from '../components/schedule/WorkoutCard';
import WorkoutEditorModal from '../components/schedule/WorkoutEditorModal';
import ExerciseLibraryModal from '../components/schedule/ExerciseLibraryModal';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import {
  createWorkout,
  deleteWorkout,
  getSafeExercises,
  getWorkouts,
  updateWorkout,
} from '../services/api';
import {
  Exercise,
  MET_REFERENCES,
  Workout,
  WorkoutInput,
} from '../domain/workout';
import { localDateString } from '../utils/dateLocal';
import { getErrorMessage } from '../utils/errorHandler';
import { fontSize, fontWeight, layout, radius, spacing } from '../constants/theme';
import { formatInt } from '../utils/format';

type CalendarMode = 'week' | 'month';

export default function ScheduleScreen() {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(() => localDateString());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [libraryExerciseId, setLibraryExerciseId] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showMetReferences, setShowMetReferences] = useState(false);
  const requestId = useRef(0);

  const monthDate = useMemo(() => parseISO(selectedDate), [selectedDate]);
  const monthKey = format(monthDate, 'yyyy-MM');
  const weightKg = Number(user?.weight) > 0 ? Number(user?.weight) : 60;

  const loadSchedule = useCallback(async (
    date = `${monthKey}-01`,
    showLoading = true
  ) => {
    const currentRequestId = ++requestId.current;
    const targetDate = parseISO(date);
    const from = format(startOfMonth(targetDate), 'yyyy-MM-dd');
    const to = format(endOfMonth(targetDate), 'yyyy-MM-dd');

    if (showLoading) {
      setIsLoading(true);
      setLoadError(null);
    }
    try {
      const [exerciseList, workoutList] = await Promise.all([
        getSafeExercises(user?.healthCondition),
        getWorkouts(user?.id ?? '', from, to),
      ]);

      if (requestId.current !== currentRequestId) return;
      setExercises(Array.isArray(exerciseList) ? exerciseList : []);
      setWorkouts(Array.isArray(workoutList) ? workoutList : []);
      setActionError(null);
    } catch (error: unknown) {
      if (requestId.current !== currentRequestId) return;
      if (showLoading) {
        setLoadError(getErrorMessage(error));
      } else {
        setActionError(`Đã lưu thay đổi nhưng chưa tải lại được lịch: ${getErrorMessage(error)}`);
      }
    } finally {
      if (requestId.current === currentRequestId && showLoading) setIsLoading(false);
    }
  }, [monthKey, user?.healthCondition, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadSchedule();
      return () => {
        requestId.current += 1;
      };
    }, [loadSchedule])
  );

  const workoutsByDate = useMemo(() => {
    const dates = new Set<string>();
    workouts.forEach((workout) => dates.add(workout.date));
    return dates;
  }, [workouts]);

  const markedDates = useMemo(() => {
    const marks: Record<string, object> = {};
    workouts.forEach((workout) => {
      marks[workout.date] = {
        marked: true,
        dotColor: workout.status === 'done' ? colors.primary : colors.accent,
      };
    });
    marks[selectedDate] = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.textOnPrimary,
    };
    return marks;
  }, [colors.accent, colors.primary, colors.textOnPrimary, selectedDate, workouts]);

  const selectedWorkouts = useMemo(
    () =>
      workouts
        .filter((workout) => workout.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [selectedDate, workouts]
  );
  const completedCount = selectedWorkouts.filter((workout) => workout.status === 'done').length;
  const completedCalories = selectedWorkouts.reduce(
    (total, workout) => total + (workout.status === 'done' ? Number(workout.caloriesBurned) || 0 : 0),
    0
  );

  const openNewWorkout = () => {
    setEditingWorkout(null);
    setEditorVisible(true);
  };

  const openEditWorkout = (workout: Workout) => {
    setEditingWorkout(workout);
    setEditorVisible(true);
  };

  const handleSaveWorkout = async (input: WorkoutInput) => {
    setSaving(true);
    setActionError(null);
    try {
      if (editingWorkout) {
        await updateWorkout(editingWorkout.id, input);
      } else {
        await createWorkout(input);
      }
      setSelectedDate(input.date);
      setEditorVisible(false);
      setEditingWorkout(null);
      await loadSchedule(input.date, false);
    } catch (error: unknown) {
      setActionError(`Chưa lưu được lịch tập: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkout = async (workout: Workout) => {
    if (deletingWorkoutId !== null) return;
    setDeletingWorkoutId(workout.id);
    setActionError(null);
    try {
      await deleteWorkout(workout.id);
      setWorkouts((current) => current.filter((item) => item.id !== workout.id));
      await loadSchedule(workout.date, false);
    } catch (error: unknown) {
      setActionError(`Chưa xóa được buổi tập: ${getErrorMessage(error)}`);
    } finally {
      setDeletingWorkoutId(null);
    }
  };

  const openExerciseLibrary = (exerciseId?: number) => {
    setLibraryExerciseId(exerciseId);
    setLibraryVisible(true);
  };

  const changeMonth = (amount: number) => {
    const currentMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1);
    setSelectedDate(format(currentMonth, 'yyyy-MM-01'));
  };

  const selectedDateLabel = format(monthDate, 'EEEE, d MMMM', { locale: vi });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Lịch tập"
          subtitle="Lên kế hoạch, theo dõi buổi tập và calo tiêu hao"
        />

        <View style={styles.primaryAction}>
          <Button
            title="Lên lịch buổi tập"
            icon="add-circle-outline"
            size="lg"
            onPress={openNewWorkout}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.libraryAction}
          onPress={() => openExerciseLibrary()}
        >
          <Ionicons name="fitness-outline" size={20} color={colors.primary} />
          <Text style={[styles.libraryActionText, { color: colors.primary }]}>
            Thư viện bài tập và video hướng dẫn
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceAlt }]}>
          {(['week', 'month'] as const).map((mode) => {
            const active = calendarMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setCalendarMode(mode)}
                style={[
                  styles.modeButton,
                  active && { backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.modeText, { color: active ? colors.primary : colors.textMuted }]}>
                  {mode === 'week' ? 'Tuần' : 'Tháng'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {calendarMode === 'week' ? (
          <WeeklyStrip
            selectedDate={selectedDate}
            workoutDates={workoutsByDate}
            onSelectDate={setSelectedDate}
          />
        ) : (
          <Card style={styles.calendarCard}>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tháng trước"
                onPress={() => changeMonth(-1)}
                style={styles.monthArrow}
              >
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {format(monthDate, 'MMMM yyyy', { locale: vi })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tháng sau"
                onPress={() => changeMonth(1)}
                style={styles.monthArrow}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </Pressable>
            </View>
            <Calendar
              key={monthKey}
              current={selectedDate}
              hideArrows
              hideExtraDays
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              theme={{
                calendarBackground: colors.surface,
                backgroundColor: colors.surface,
                monthTextColor: colors.text,
                dayTextColor: colors.text,
                textDisabledColor: colors.textMuted,
                arrowColor: colors.primary,
                todayTextColor: colors.accent,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: colors.textOnPrimary,
                textSectionTitleColor: colors.textMuted,
                dotColor: colors.accent,
                selectedDotColor: colors.textOnPrimary,
              }}
            />
          </Card>
        )}

        <View style={styles.statsRow}>
          <StatBox
            style={styles.half}
            label="Buổi hoàn thành"
            value={String(completedCount)}
            unit="buổi"
            icon="checkmark-circle-outline"
            tone="primary"
            hint="Trong ngày đang chọn"
          />
          <StatBox
            style={styles.half}
            label="Calo"
            value={formatInt(completedCalories)}
            unit="kcal"
            icon="flame-outline"
            tone="accent"
            hint="Ước tính từ thời gian tập thực tế"
          />
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Buổi tập</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              {selectedDateLabel}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm buổi tập"
            onPress={openNewWorkout}
            style={[styles.addButton, { backgroundColor: colors.primaryLight }]}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {actionError ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorMessage, { color: colors.danger }]}>{actionError}</Text>
          </Card>
        ) : null}

        {loadError ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorMessage, { color: colors.danger }]}>{loadError}</Text>
            <Button title="Thử tải lại" variant="secondary" onPress={() => void loadSchedule()} />
          </Card>
        ) : isLoading ? (
          <Card>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              Đang tải lịch tập...
            </Text>
          </Card>
        ) : selectedWorkouts.length > 0 ? (
          <View style={styles.workoutList}>
            {selectedWorkouts.map((workout) => {
              const exercise =
                workout.exercise ??
                exercises.find((item) => item.id === Number(workout.exerciseId));
              return (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  exercise={exercise}
                  weightKg={weightKg}
                  deleting={deletingWorkoutId === workout.id}
                  onEdit={() => openEditWorkout(workout)}
                  onDelete={() => void handleDeleteWorkout(workout)}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="calendar-clear-outline"
            title="Ngày này chưa có lịch tập"
            message="Thêm một buổi tập để lên kế hoạch và ghi nhận tiến độ của bạn."
          >
            <Button
              title="Thêm buổi tập"
              icon="add-circle-outline"
              onPress={openNewWorkout}
            />
          </EmptyState>
        )}

        <Card style={styles.metCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showMetReferences }}
            onPress={() => setShowMetReferences((current) => !current)}
            style={styles.metHeader}
          >
            <View style={[styles.metIcon, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="flame-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.metHeaderText}>
              <Text style={[styles.metTitle, { color: colors.text }]}>Cách tính calo (MET)</Text>
              <Text style={[styles.metSubtitle, { color: colors.textMuted }]}>
                1 MET x cân nặng (kg) x thời gian (giờ)
              </Text>
            </View>
            <Ionicons
              name={showMetReferences ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
          {showMetReferences ? (
            <View style={[styles.referenceList, { borderTopColor: colors.border }]}>
              <Text style={[styles.metExplanation, { color: colors.textSecondary }]}>
                Calo buổi đã hoàn thành dùng cân nặng hồ sơ và thời gian vận động thực tế.
                Đây là ước tính tham khảo, không phải phép đo y khoa.
              </Text>
              {MET_REFERENCES.map((reference) => (
                <View key={reference.activity} style={styles.referenceRow}>
                  <View style={styles.referenceCopy}>
                    <Text style={[styles.referenceActivity, { color: colors.text }]}>
                      {reference.activity}
                    </Text>
                    <Text style={[styles.referenceLevel, { color: colors.textMuted }]}>
                      Mức tiêu hao: {reference.level}
                    </Text>
                  </View>
                  <Text style={[styles.referenceMet, { color: colors.primary }]}>
                    {reference.met} MET
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {editorVisible ? (
        <WorkoutEditorModal
          visible
          workout={editingWorkout}
          exercises={exercises}
          weightKg={weightKg}
          defaultDate={selectedDate}
          saving={saving}
          onClose={() => {
            if (!saving) {
              setEditorVisible(false);
              setEditingWorkout(null);
            }
          }}
          onOpenLibrary={(exerciseId) => openExerciseLibrary(exerciseId)}
          onSave={handleSaveWorkout}
        />
      ) : null}
      {libraryVisible ? (
        <ExerciseLibraryModal
          visible
          exercises={exercises}
          initialExerciseId={libraryExerciseId}
          onClose={() => setLibraryVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  primaryAction: {
    marginTop: spacing.xs,
  },
  libraryAction: {
    minHeight: layout.minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  libraryActionText: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  modeSwitch: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.pill,
  },
  modeButton: {
    flex: 1,
    minHeight: layout.minTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  modeText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  calendarCard: {
    padding: spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  monthArrow: {
    minWidth: layout.minTouchSize,
    minHeight: layout.minTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCopy: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
  },
  sectionSubtitle: {
    fontSize: fontSize.caption,
    textTransform: 'capitalize',
  },
  addButton: {
    width: layout.minTouchSize,
    height: layout.minTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  workoutList: {
    gap: spacing.md,
  },
  errorCard: {
    gap: spacing.md,
  },
  errorMessage: {
    fontSize: fontSize.body,
    lineHeight: 22,
  },
  metCard: {
    gap: spacing.md,
  },
  metHeader: {
    minHeight: layout.minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  metTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  metSubtitle: {
    fontSize: fontSize.caption,
  },
  referenceList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  metExplanation: {
    fontSize: fontSize.caption,
    lineHeight: 20,
  },
  referenceRow: {
    minHeight: layout.minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  referenceCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  referenceActivity: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
  },
  referenceLevel: {
    fontSize: fontSize.micro,
  },
  referenceMet: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
  },
});
