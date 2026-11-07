import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { calculateCalories } from '../../utils/runMath';
import {
  Exercise,
  Workout,
  WorkoutInput,
  WorkoutStatus,
  WORKOUT_STATUS_LABELS,
} from '../../domain/workout';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import Button from '../ui/Button';
import Input from '../ui/Input';

type WorkoutEditorModalProps = {
  visible: boolean;
  workout: Workout | null;
  exercises: Exercise[];
  weightKg: number;
  defaultDate: string;
  saving: boolean;
  onClose: () => void;
  onOpenLibrary: (exerciseId: number) => void;
  onSave: (workout: WorkoutInput) => Promise<void>;
};

const STATUS_OPTIONS: WorkoutStatus[] = ['planned', 'done', 'missed'];

export default function WorkoutEditorModal({
  visible,
  workout,
  exercises,
  weightKg,
  defaultDate,
  saving,
  onClose,
  onOpenLibrary,
  onSave,
}: WorkoutEditorModalProps) {
  const { colors } = useTheme();
  const [exerciseId, setExerciseId] = useState<number>(
    workout?.exerciseId ?? exercises[0]?.id ?? 0
  );
  const [date, setDate] = useState(workout?.date ?? defaultDate);
  const [time, setTime] = useState(workout?.time ?? '18:00');
  const [status, setStatus] = useState<WorkoutStatus>(workout?.status ?? 'planned');
  const [durationMin, setDurationMin] = useState(
    String(workout?.durationMin || workout?.plannedDurationMin || 30)
  );
  const [plannedDurationMin, setPlannedDurationMin] = useState(
    String(workout?.plannedDurationMin || 30)
  );
  const [note, setNote] = useState(workout?.note ?? '');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedExercise = exercises.find((item) => item.id === exerciseId);
  const previewDuration =
    status === 'done'
      ? Number(durationMin)
      : status === 'planned'
        ? Number(plannedDurationMin)
        : 0;
  const estimatedCalories = useMemo(
    () => calculateCalories(selectedExercise?.met ?? 0, weightKg, previewDuration * 60),
    [previewDuration, selectedExercise?.met, weightKg]
  );

  const selectStatus = (nextStatus: WorkoutStatus) => {
    if (nextStatus === 'done' && status !== 'done' && durationMin === '0') {
      setDurationMin(plannedDurationMin);
    }
    setStatus(nextStatus);
    setFormError('');
  };

  const handleTimeChange = (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'dismissed' || !value) return;
    setTime(format(value, 'HH:mm'));
  };

  const submit = async () => {
    const safeTime = time.trim();
    const actualMinutes = Number(durationMin);
    const plannedMinutes = Number(plannedDurationMin);

    if (!selectedExercise) {
      setFormError('Vui lòng chọn một bài tập.');
      return;
    }
    const [hour, minute] = safeTime.split(':').map(Number);
    if (
      !/^\d{2}:\d{2}$/.test(safeTime) ||
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour > 23 ||
      minute > 59
    ) {
      setFormError('Giờ tập cần có định dạng HH:mm.');
      return;
    }
    if (status === 'done' && (!Number.isFinite(actualMinutes) || actualMinutes <= 0)) {
      setFormError('Nhập thời lượng thực tế lớn hơn 0 phút.');
      return;
    }
    if (status === 'planned' && (!Number.isFinite(plannedMinutes) || plannedMinutes <= 0)) {
      setFormError('Nhập thời lượng dự kiến lớn hơn 0 phút.');
      return;
    }

    setFormError('');
    await onSave({
      exerciseId,
      date,
      time: safeTime,
      status,
      durationMin: status === 'done' ? Math.round(actualMinutes) : 0,
      plannedDurationMin: status === 'planned' ? Math.round(plannedMinutes) : plannedMinutes,
      caloriesBurned:
        status === 'done'
          ? calculateCalories(selectedExercise.met, weightKg, actualMinutes * 60)
          : 0,
      weightKg: status === 'done' ? weightKg : undefined,
      note: note.trim(),
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
      >
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>
                {workout ? 'Chỉnh sửa buổi tập' : 'Lên lịch buổi tập'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Chọn bài tập, thời gian và ghi nhận kết quả
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng biểu mẫu"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.label, { color: colors.text }]}>Bài tập</Text>
            {exercises.map((exercise) => {
              const active = exerciseId === exercise.id;
              return (
                <Pressable
                  key={exercise.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setExerciseId(exercise.id)}
                  style={[
                    styles.exerciseOption,
                    {
                      backgroundColor: active ? colors.primaryLight : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.exerciseOptionCopy}>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>{exercise.name}</Text>
                    <Text style={[styles.helper, { color: colors.textMuted }]}>
                      {exercise.activityType} · {exercise.primaryMuscleGroup || exercise.muscleGroup} · MET {exercise.met}
                    </Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              );
            })}

            {selectedExercise ? (
              <Pressable
                accessibilityRole="button"
                style={styles.libraryLink}
                onPress={() => onOpenLibrary(selectedExercise.id)}
              >
                <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.libraryLinkText, { color: colors.primary }]}>
                  Xem chi tiết và video hướng dẫn
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>Ngày và giờ tập</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCalendar((current) => !current)}
              style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={[styles.pickerText, { color: colors.text }]}>{date}</Text>
              <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {showCalendar ? (
              <Calendar
                current={date}
                onDayPress={(day) => {
                  setDate(day.dateString);
                  setShowCalendar(false);
                }}
                markedDates={{
                  [date]: {
                    selected: true,
                    selectedColor: colors.primary,
                  },
                }}
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
                }}
              />
            ) : null}

            {Platform.OS === 'web' ? (
              <Input
                label="Giờ tập (HH:mm)"
                value={time}
                onChangeText={setTime}
                placeholder="18:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                leftIcon="time-outline"
              />
            ) : (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Giờ tập</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowTimePicker((current) => !current)}
                  style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <Text style={[styles.pickerText, { color: colors.text }]}>{time}</Text>
                  <Ionicons name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </Pressable>
                {showTimePicker ? (
                  <DateTimePicker
                    value={parseISO(`${date}T${time}:00`)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChange}
                  />
                ) : null}
              </>
            )}

            <Text style={[styles.label, { color: colors.text }]}>Trạng thái</Text>
            <View style={styles.statusOptions}>
              {STATUS_OPTIONS.map((option) => {
                const active = status === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => selectStatus(option)}
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor: active ? colors.primaryLight : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusOptionText, { color: active ? colors.primary : colors.textSecondary }]}>
                      {WORKOUT_STATUS_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {status === 'done' ? (
              <Input
                label="Thời gian tập thực tế (phút)"
                value={durationMin}
                onChangeText={setDurationMin}
                keyboardType="numeric"
                placeholder="Ví dụ: 30"
                leftIcon="hourglass-outline"
                hint="Dùng thời gian vận động thực tế để tính calo."
              />
            ) : status === 'planned' ? (
              <Input
                label="Thời gian dự kiến (phút)"
                value={plannedDurationMin}
                onChangeText={setPlannedDurationMin}
                keyboardType="numeric"
                placeholder="Ví dụ: 30"
                leftIcon="hourglass-outline"
              />
            ) : null}

            {selectedExercise && status !== 'missed' ? (
              <View style={[styles.caloriePreview, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="flame-outline" size={20} color={colors.accent} />
                <View style={styles.calorieCopy}>
                  <Text style={[styles.calorieValue, { color: colors.text }]}>
                    {estimatedCalories} kcal {status === 'done' ? 'tiêu hao' : 'ước tính'}
                  </Text>
                  <Text style={[styles.helper, { color: colors.textSecondary }]}>
                    {selectedExercise.met} MET × {weightKg} kg × {previewDuration} phút
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.noteGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Ghi chú cá nhân</Text>
              <TextInput
                accessibilityLabel="Ghi chú cá nhân"
                value={note}
                onChangeText={setNote}
                placeholder="Ví dụ: tập ở nhà, cần chuẩn bị thảm..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={300}
                textAlignVertical="top"
                style={[
                  styles.noteInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            {formError ? (
              <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.danger }]}>
                {formError}
              </Text>
            ) : null}

            <Button
              title={workout ? 'Lưu thay đổi' : 'Lưu lịch tập'}
              icon="checkmark-circle-outline"
              size="lg"
              loading={saving}
              onPress={submit}
              disabled={saving}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '94%',
    minHeight: '76%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  header: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    fontSize: fontSize.caption,
  },
  closeButton: {
    minWidth: layout.minTouchSize,
    minHeight: layout.minTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  exerciseOption: {
    minHeight: layout.minTouchSize + 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  exerciseOptionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  exerciseName: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  helper: {
    fontSize: fontSize.caption,
  },
  libraryLink: {
    minHeight: layout.minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  libraryLinkText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
  pickerButton: {
    minHeight: layout.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pickerText: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
  statusOptions: {
    gap: spacing.xs,
  },
  statusOption: {
    minHeight: layout.minTouchSize,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  statusOptionText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
  caloriePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  calorieCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  calorieValue: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  noteGroup: {
    gap: spacing.xs,
  },
  noteInput: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
  },
  errorText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
  },
});
