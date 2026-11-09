// ============================================================================
// Module: domain/statistics/types.ts
// Chức năng: Định nghĩa các kiểu dữ liệu (TypeScript interfaces & types) dùng
// chung cho toàn bộ chức năng thống kê của ứng dụng FitLog.
//
// Tại sao nhiều trường dùng kiểu `unknown`?
// - Dữ liệu đọc từ JSON Server (`db.json`) hoặc bộ nhớ cục bộ (`AsyncStorage`)
//   có thể bị thiếu trường hoặc sai kiểu. Dùng `unknown` bắt buộc code tính toán
//   phải kiểm tra hợp lệ trước khi cộng trừ, giúp ứng dụng không bị lỗi NaN.
// ============================================================================

/** Mã định danh bản ghi (có thể là chuỗi hoặc số từ JSON Server) */
export type StatisticsId = string | number;

/** 4 loại kỳ thống kê hỗ trợ trên giao diện: Ngày, Tuần, Tháng, Năm */
export type PeriodKind = 'day' | 'week' | 'month' | 'year';

/**
 * Thông tin một kỳ thống kê đã tính ngày bắt đầu và kết thúc.
 * - kind: Loại kỳ ('day' | 'week' | 'month' | 'year')
 * - start: Ngày bắt đầu kỳ (định dạng 'YYYY-MM-DD')
 * - end: Ngày kết thúc kỳ (định dạng 'YYYY-MM-DD')
 * - keys: Danh sách các mốc thời gian nằm trong kỳ để vẽ cột biểu đồ
 *   (ví dụ: 7 ngày trong tuần, hoặc 12 tháng 'YYYY-MM' trong năm)
 */
export interface StatisticsPeriod {
  kind: PeriodKind;
  start: string;
  end: string;
  keys: string[];
}

/** Bản ghi có gắn mã người dùng sở hữu (userId) từ cơ sở dữ liệu */
export interface OwnedRecord {
  id?: StatisticsId;
  userId?: unknown;
}

/** Bản ghi danh mục bài tập từ bảng `exercises` trong CSDL */
export interface ExerciseRecord {
  id?: StatisticsId;
  name?: unknown;
  muscleGroup?: unknown;
}

/** Bản ghi buổi tập theo lịch từ bảng `workouts` trong CSDL */
export interface WorkoutRecord extends OwnedRecord {
  exerciseId?: StatisticsId;
  date?: unknown;
  time?: unknown;
  status?: unknown;
  durationMin?: unknown;
  caloriesBurned?: unknown;
  exercise?: ExerciseRecord | null;
}

/** Bản ghi buổi chạy bộ từ bảng `runs` hoặc hàng đợi chờ đồng bộ (queue) */
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
  /** Cờ đánh dấu buổi chạy đang nằm trong hàng đợi offline, chưa gửi lên server */
  _queued?: boolean;
}

/** Bản ghi hồ sơ sức khỏe người dùng từ bảng `profiles` trong CSDL */
export interface ProfileRecord extends OwnedRecord {
  heightCm?: unknown;
  weightKg?: unknown;
  sessionsPerWeek?: unknown;
}

/** Bản ghi lịch sử cân nặng từ bảng `weightHistory` trong CSDL */
export interface WeightRecord extends OwnedRecord {
  date?: unknown;
  weightKg?: unknown;
}

/** Bản ghi loại mục tiêu chung từ bảng `goals` trong CSDL */
export interface GoalRecord {
  id?: StatisticsId;
  name?: unknown;
  code?: unknown;
}

/** Bản ghi mục tiêu cá nhân của người dùng từ bảng `userGoals` trong CSDL */
export interface UserGoalRecord extends OwnedRecord {
  goalId?: StatisticsId;
  minMinutesPerWeek?: unknown;
  targetWeightKg?: unknown;
  goal?: GoalRecord | null;
}

/**
 * Kết quả tổng hợp của một chỉ số thống kê (ví dụ: tổng số phút, tổng số km).
 * - value: Giá trị tính được (bằng `null` nếu tất cả bản ghi đều bị thiếu dữ liệu;
 *   bằng `0` nếu tải thành công nhưng chưa có buổi tập nào).
 * - missingCount: Số bản ghi bị thiếu hoặc sai dữ liệu số ở trường này.
 * - complete: `true` nếu mọi bản ghi đều có số liệu hợp lệ (`missingCount === 0`).
 */
export interface StatisticsMetric {
  value: number | null;
  missingCount: number;
  complete: boolean;
}

/**
 * Trạng thái của một buổi tập theo lịch sau khi đối chiếu với ngày hôm nay:
 * - 'done': Đã hoàn thành
 * - 'missed': Đã bỏ lỡ (hoặc lên lịch ở ngày quá khứ nhưng chưa tập)
 * - 'pending': Đang chờ tập (hôm nay hoặc tương lai)
 * - 'unknown': Dữ liệu ngày hoặc trạng thái không hợp lệ
 */
export type WorkoutState = 'done' | 'missed' | 'pending' | 'unknown';

/**
 * Đầu vào cho hàm tính toán thống kê tổng hợp `calculateStatistics`.
 */
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
