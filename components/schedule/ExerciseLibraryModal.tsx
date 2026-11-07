import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  EQUIPMENT_LABELS,
  Exercise,
  getYouTubeVideoId,
} from '../../domain/workout';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import YouTubePlayer from './YouTubePlayer';

type ExerciseLibraryModalProps = {
  visible: boolean;
  exercises: Exercise[];
  initialExerciseId?: number;
  onClose: () => void;
};

export default function ExerciseLibraryModal({
  visible,
  exercises,
  initialExerciseId,
  onClose,
}: ExerciseLibraryModalProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<number | null>(
    initialExerciseId ?? exercises[0]?.id ?? null
  );
  const selectedExercise = exercises.find((exercise) => exercise.id === selectedId);
  const videoId = getYouTubeVideoId(selectedExercise?.youtubeId);
  const playerWidth = Math.max(200, width - spacing.xxl * 2);
  const playerHeight = Math.max(200, Math.round((playerWidth * 9) / 16));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>Thư viện bài tập</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Chọn động tác để xem nhóm cơ, dụng cụ và hướng dẫn
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng thư viện bài tập"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {selectedExercise ? (
              <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.exerciseTitle, { color: colors.text }]}>
                  {selectedExercise.name}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {selectedExercise.activityType} · MET {selectedExercise.met}
                </Text>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Nhóm cơ chính</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {selectedExercise.primaryMuscleGroup || selectedExercise.muscleGroup}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Nhóm cơ phụ</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {selectedExercise.secondaryMuscleGroups?.join(', ') || 'Toàn thân'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Dụng cụ</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {EQUIPMENT_LABELS[selectedExercise.equipment] ?? selectedExercise.equipment}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Khối lượng</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {selectedExercise.reps > 0
                      ? `${selectedExercise.sets} hiệp × ${selectedExercise.reps} lần`
                      : `${selectedExercise.sets} hiệp × ${selectedExercise.durationSec} giây`}
                  </Text>
                </View>

                {videoId ? (
                  <View style={styles.playerWrap}>
                    <YouTubePlayer
                      videoId={videoId}
                      height={playerHeight}
                      width={playerWidth}
                    />
                  </View>
                ) : (
                  <View style={[styles.videoPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="logo-youtube" size={24} color={colors.textMuted} />
                    <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                      Chưa có video hướng dẫn. Thêm ID YouTube vào trường youtubeId của bài tập.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Danh sách động tác</Text>
            {exercises.map((exercise) => {
              const active = selectedId === exercise.id;
              return (
                <Pressable
                  key={exercise.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSelectedId(exercise.id);
                  }}
                  style={[
                    styles.exerciseRow,
                    {
                      backgroundColor: active ? colors.primaryLight : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.exerciseCopy}>
                    <Text style={[styles.exerciseRowTitle, { color: colors.text }]}>
                      {exercise.name}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {exercise.activityType} · MET {exercise.met}
                    </Text>
                  </View>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'chevron-forward'}
                    size={20}
                    color={active ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '92%',
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
  headerText: {
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
  detailCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
  },
  meta: {
    fontSize: fontSize.caption,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: fontSize.caption,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
  },
  playerWrap: {
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  videoPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  placeholderText: {
    flex: 1,
    fontSize: fontSize.caption,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },
  exerciseRow: {
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
  exerciseCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  exerciseRowTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
