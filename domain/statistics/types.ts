// Kiểu đọc dữ liệu hiện có; unknown buộc kiểm tra giá trị từ JSON trước khi tính.
export type StatisticsId = string | number;
export type PeriodKind = 'day' | 'week' | 'month' | 'year';
export interface StatisticsPeriod {
  kind: PeriodKind;
  start: string;
  end: string;
  keys: string[];
}
export interface OwnedRecord {
  id?: StatisticsId;
  userId?: unknown;
}
export interface ExerciseRecord {
  id?: StatisticsId;
  name?: unknown;
  muscleGroup?: unknown;
}
export interface WorkoutRecord extends OwnedRecord {
  exerciseId?: StatisticsId;
  date?: unknown;
  time?: unknown;
  status?: unknown;
  durationMin?: unknown;
  caloriesBurned?: unknown;
  exercise?: ExerciseRecord | null;
}
export interface RunRecord extends OwnedRecord {
  clientId?: unknown;
  date?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  durationSec?: unknown;
  pausedSec?: unknown;
  distanceKm?: unknown;
  steps?: unknown;
  calories?: unknown;
  _queued?: boolean;
}
export interface ProfileRecord extends OwnedRecord {
  heightCm?: unknown;
  weightKg?: unknown;
  sessionsPerWeek?: unknown;
}
export interface WeightRecord extends OwnedRecord {
  date?: unknown;
  weightKg?: unknown;
}
export interface GoalRecord {
  id?: StatisticsId;
  name?: unknown;
  code?: unknown;
}
export interface UserGoalRecord extends OwnedRecord {
  goalId?: StatisticsId;
  minMinutesPerWeek?: unknown;
  targetWeightKg?: unknown;
  goal?: GoalRecord | null;
}
// value là phần tổng hợp hợp lệ; missingCount > 0 nghĩa là chưa đầy đủ.
// Tất cả dòng đều thiếu → null. Tập rỗng tải thành công → 0.
export interface StatisticsMetric {
  value: number | null;
  missingCount: number;
  complete: boolean;
}
export type WorkoutState = 'done' | 'missed' | 'pending' | 'unknown';
export interface StatisticsInput {
  userId: StatisticsId;
  today: string;
  kind: PeriodKind;
  anchor: string;
  workouts: readonly WorkoutRecord[];
  runs: readonly RunRecord[];
  profiles: readonly ProfileRecord[];
  weights: readonly WeightRecord[];
  userGoals: readonly UserGoalRecord[];
  exercises?: readonly ExerciseRecord[];
  goals?: readonly GoalRecord[];
}
