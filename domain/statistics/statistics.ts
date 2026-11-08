// ============================================================================
// Module: domain/statistics/statistics.ts
// Chức năng: Chứa toàn bộ các hàm tính toán thuần túy (pure functions) cho
// chức năng thống kê của ứng dụng FitLog:
// - Kiểm tra và tính khoảng ngày của kỳ thống kê (Ngày / Tuần / Tháng / Năm)
// - Thống kê lịch tập (workouts), chạy bộ (runs), thói quen (habits),
//   cân nặng & BMI (weight), và tiến độ mục tiêu tuần (targets).
// - Không gọi API hay sửa đổi dữ liệu gốc, giúp dễ đọc và dễ kiểm thử.
// ============================================================================

import type {
  ExerciseRecord,
  GoalRecord,
  OwnedRecord,
  PeriodKind,
  ProfileRecord,
  RunRecord,
  StatisticsId,
  StatisticsInput,
  StatisticsMetric,
  StatisticsPeriod,
  UserGoalRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutState,
} from './types';

// ============================================================================
// PHẦN 1: CÁC HÀM XỬ LÝ NGÀY THÁNG (ĐỊNH DẠNG 'YYYY-MM-DD')
// ============================================================================

/**
 * Tạo đối tượng Date chuẩn hóa ở mốc 00:00:00 UTC từ năm, tháng, ngày.
 * Tại sao dùng UTC? Để khi cộng/trừ ngày không bị lệch giờ do múi giờ địa phương
 * hoặc giờ mùa hè (DST).
 *
 * @param year Năm (ví dụ: 2026)
 * @param month Tháng từ 1 đến 12
 * @param day Ngày trong tháng từ 1 đến 31
 * @returns Đối tượng Date tương ứng
 */
function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  // Trong JavaScript, tháng của Date bắt đầu từ 0 (tháng 1 là 0, tháng 12 là 11)
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Chuyển đối tượng Date về chuỗi ngày chuẩn 'YYYY-MM-DD'.
 *
 * @param date Đối tượng Date cần chuyển đổi
 * @returns Chuỗi ngày dạng 'YYYY-MM-DD'
 */
function dateKey(date: Date): string {
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999) {
    throw new RangeError('Ngày ngoài khoảng hỗ trợ');
  }
  const yearStr = String(year).padStart(4, '0');
  const monthStr = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(date.getUTCDate()).padStart(2, '0');
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Kiểm tra một giá trị bất kỳ có phải là chuỗi ngày 'YYYY-MM-DD' hợp lệ hay không
 * (có kiểm tra cả năm nhuận, ví dụ '2026-02-29' hay '2026-02-30' sẽ trả về false).
 *
 * @param value Giá trị cần kiểm tra
 * @returns `true` nếu là ngày hợp lệ, ngược lại `false`
 */
export function isStatisticsDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  // Tạo Date rồi kiểm tra ngược lại: nếu truyền ngày 30/02, JS sẽ tự đẩy sang tháng 3
  // nên các giá trị year/month/day sẽ không còn khớp với ban đầu.
  const parsed = calendarDate(year, month, day);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

/**
 * Chuyển chuỗi 'YYYY-MM-DD' thành đối tượng Date; báo lỗi nếu chuỗi ngày sai.
 *
 * @param value Chuỗi ngày 'YYYY-MM-DD'
 * @returns Đối tượng Date đã chuẩn hóa
 */
function parseDay(value: string): Date {
  if (!isStatisticsDate(value)) {
    throw new RangeError('Ngày phải hợp lệ và có dạng YYYY-MM-DD');
  }
  const [year, month, day] = value.split('-').map(Number);
  return calendarDate(year, month, day);
}

/**
 * Đổi thứ trong tuần của JavaScript (Chủ nhật = 0, Thứ hai = 1, ..., Thứ bảy = 6)
 * sang thứ bắt đầu từ Thứ hai (Thứ hai = 0, Thứ ba = 1, ..., Chủ nhật = 6).
 *
 * @param date Đối tượng Date cần lấy thứ
 * @returns Số nguyên từ 0 (Thứ hai) đến 6 (Chủ nhật)
 */
function getMondayBasedIndex(date: Date): number {
  const jsDay = date.getUTCDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Tính ngày bắt đầu (`start`), ngày kết thúc (`end`) và danh sách các mốc (`keys`)
 * của một kỳ thống kê dựa vào loại kỳ (`kind`) và ngày neo (`anchor`).
 *
 * @param kind Loại kỳ ('day' | 'week' | 'month' | 'year')
 * @param anchor Ngày dùng làm mốc tính kỳ (định dạng 'YYYY-MM-DD')
 * @returns Thông tin kỳ thống kê `StatisticsPeriod`
 */
export function getStatisticsPeriod(kind: PeriodKind, anchor: string): StatisticsPeriod {
  const startDate = parseDay(anchor);
  const endDate = parseDay(anchor);

  if (kind === 'week') {
    // Lùi startDate về ngày Thứ Hai đầu tuần, rồi cộng 6 ngày để được Chủ Nhật cuối tuần
    const daysSinceMonday = getMondayBasedIndex(startDate);
    startDate.setUTCDate(startDate.getUTCDate() - daysSinceMonday);
    endDate.setTime(startDate.getTime());
    endDate.setUTCDate(endDate.getUTCDate() + 6);
  } else if (kind === 'month') {
    // Ngày đầu tháng là ngày 1; ngày cuối tháng lấy bằng ngày 0 của tháng kế tiếp
    startDate.setUTCDate(1);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1, 0);
  } else if (kind === 'year') {
    // Đầu năm là 01/01 (tháng 0, ngày 1), cuối năm là 31/12 (tháng 11, ngày 31)
    startDate.setUTCMonth(0, 1);
    endDate.setUTCMonth(11, 31);
  } else if (kind !== 'day') {
    throw new RangeError('Kỳ thống kê không hợp lệ');
  }

  const start = dateKey(startDate);
  const end = dateKey(endDate);
  const keys: string[] = [];

  if (kind === 'year') {
    // Kỳ năm gồm 12 mốc tháng dạng 'YYYY-01' đến 'YYYY-12'
    const yearPrefix = start.slice(0, 4);
    for (let month = 1; month <= 12; month += 1) {
      keys.push(`${yearPrefix}-${String(month).padStart(2, '0')}`);
    }
  } else {
    // Kỳ ngày, tuần, tháng gồm danh sách từng ngày liên tiếp từ start đến end
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      keys.push(dateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return { kind, start, end, keys };
}

/**
 * Dịch chuyển kỳ thống kê sang kỳ trước (`offset < 0`) hoặc kỳ sau (`offset > 0`).
 *
 * @param kind Loại kỳ ('day' | 'week' | 'month' | 'year')
 * @param anchor Ngày neo hiện tại ('YYYY-MM-DD')
 * @param offset Số kỳ cần dịch chuyển (ví dụ: -1 là lùi 1 kỳ, +1 là tiến 1 kỳ)
 * @returns Kỳ thống kê mới sau khi dịch chuyển
 */
export function shiftStatisticsPeriod(
  kind: PeriodKind,
  anchor: string,
  offset: number
): StatisticsPeriod {
  if (!Number.isSafeInteger(offset)) {
    throw new RangeError('Số kỳ dịch chuyển phải là số nguyên an toàn');
  }
  const currentPeriod = getStatisticsPeriod(kind, anchor);
  const date = parseDay(currentPeriod.start);

  if (kind === 'day') {
    date.setUTCDate(date.getUTCDate() + offset);
  } else if (kind === 'week') {
    date.setUTCDate(date.getUTCDate() + offset * 7);
  } else if (kind === 'month') {
    date.setUTCMonth(date.getUTCMonth() + offset);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + offset);
  }

  return getStatisticsPeriod(kind, dateKey(date));
}

// ============================================================================
// PHẦN 2: CÁC HÀM KIỂM TRA DỮ LIỆU & TÍNH TỔNG / TRUNG BÌNH CƠ BẢN
// ============================================================================

/**
 * Kiểm tra một giá trị có phải là mã ID hợp lệ (số hữu hạn hoặc chuỗi khác rỗng).
 *
 * @param value Giá trị cần kiểm tra
 * @returns `true` nếu là ID hợp lệ
 */
function hasId(value: unknown): value is StatisticsId {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  return false;
}

/**
 * So sánh 2 mã ID có trùng nhau không (chấp nhận cả số `1` và chuỗi `'1'`).
 *
 * @param a Mã thứ nhất
 * @param b Mã thứ hai
 * @returns `true` nếu 2 mã biểu diễn cùng một ID
 */
function sameId(a: unknown, b: unknown): boolean {
  return hasId(a) && hasId(b) && String(a) === String(b);
}

/**
 * Lọc danh sách bản ghi chỉ giữ lại những bản ghi thuộc về `userId` đang xét.
 *
 * @param rows Danh sách bản ghi đầu vào
 * @param userId Mã người dùng đang đăng nhập
 * @returns Mảng các bản ghi thuộc về `userId`
 */
function owned<T extends OwnedRecord>(rows: readonly T[], userId: StatisticsId): T[] {
  if (!hasId(userId)) {
    throw new RangeError('Thiếu mã người dùng');
  }
  return rows.filter((row) => sameId(row.userId, userId));
}

/**
 * Đọc một số không âm (`>= 0`). Nếu sai kiểu, âm hoặc NaN thì trả về `null`.
 *
 * @param value Giá trị cần đọc
 * @returns Số không âm hoặc `null`
 */
function nonNegative(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return null;
}

/**
 * Đọc một số dương (`> 0`). Dùng cho quãng đường, chiều cao, cân nặng, mục tiêu.
 *
 * @param value Giá trị cần đọc
 * @returns Số dương hoặc `null`
 */
function positive(value: unknown): number | null {
  const number = nonNegative(value);
  if (number !== null && number > 0) {
    return number;
  }
  return null;
}

/**
 * Đọc một chuỗi văn bản đã cắt khoảng trắng thừa; trả về `null` nếu rỗng.
 *
 * @param value Giá trị cần đọc
 * @returns Chuỗi khác rỗng hoặc `null`
 */
function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

/**
 * Tính tổng một trường số trên danh sách bản ghi và đếm số bản ghi bị thiếu dữ liệu.
 * Tại sao không ép giá trị lỗi thành 0? Vì nếu mọi bản ghi đều bị hỏng dữ liệu,
 * kết quả phải là `null` ("Chưa có dữ liệu") chứ không phải số `0` giả.
 *
 * @param rows Danh sách bản ghi cần cộng
 * @param read Hàm lấy trường số từ mỗi bản ghi
 * @returns Đối tượng `StatisticsMetric` chứa tổng, số dòng thiếu và cờ `complete`
 */
function sum<T>(rows: readonly T[], read: (row: T) => unknown): StatisticsMetric {
  let total = 0;
  let missingCount = 0;

  for (const row of rows) {
    const number = nonNegative(read(row));
    if (number === null) {
      missingCount += 1;
    } else {
      total += number;
    }
  }

  const allMissing = rows.length > 0 && missingCount === rows.length;
  return {
    value: allMissing ? null : total,
    missingCount,
    complete: missingCount === 0,
  };
}

/**
 * Tính trung bình cộng từ một tổng `StatisticsMetric` và tổng số bản ghi.
 * Chỉ chia cho số bản ghi thực sự có dữ liệu hợp lệ (`count - metric.missingCount`).
 *
 * @param metric Kết quả tổng từ hàm `sum`
 * @param count Tổng số bản ghi
 * @returns Đối tượng `StatisticsMetric` chứa giá trị trung bình
 */
function average(metric: StatisticsMetric, count: number): StatisticsMetric {
  const validCount = count - metric.missingCount;
  const avgValue =
    metric.value === null || count === 0 || validCount <= 0
      ? null
      : metric.value / validCount;

  return {
    value: avgValue,
    missingCount: metric.missingCount,
    complete: metric.complete,
  };
}

/**
 * Kiểm tra một chuỗi ngày có nằm trong khoảng `[period.start, period.end]` hay không.
 * Vì ngày có định dạng chuẩn 'YYYY-MM-DD', có thể so sánh chuỗi trực tiếp.
 *
 * @param date Giá trị ngày cần kiểm tra
 * @param period Kỳ thống kê đang xét
 * @returns `true` nếu ngày hợp lệ và nằm trong kỳ
 */
function within(date: unknown, period: StatisticsPeriod): boolean {
  return isStatisticsDate(date) && date >= period.start && date <= period.end;
}

/**
 * So sánh 2 mã ID theo thứ tự tăng dần (xử lý cả trường hợp ID số được lưu dạng chuỗi '2' và '10').
 *
 * @param a Mã thứ nhất
 * @param b Mã thứ hai
 * @returns Số âm nếu a < b, số dương nếu a > b, 0 nếu bằng nhau
 */
function compareId(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  const left = String(a ?? '');
  const right = String(b ?? '');

  // Nếu cả hai chuỗi đều chỉ gồm chữ số (ví dụ '2' và '10'), chuỗi ngắn hơn là số nhỏ hơn
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    if (left.length !== right.length) {
      return left.length - right.length;
    }
  }
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// ============================================================================
// PHẦN 3: THỐNG KÊ LỊCH TẬP (WORKOUTS / SCHEDULE)
// ============================================================================

/**
 * So sánh 2 buổi tập theo ngày, giờ tập, rồi đến ID để sắp xếp theo thứ tự thời gian.
 *
 * @param a Buổi tập thứ nhất
 * @param b Buổi tập thứ hai
 * @returns Thứ tự sắp xếp (-1, 0, 1)
 */
function compareWorkouts(a: WorkoutRecord, b: WorkoutRecord): number {
  const left = `${a.date ?? ''} ${text(a.time) ?? ''}`;
  const right = `${b.date ?? ''} ${text(b.time) ?? ''}`;
  if (left < right) return -1;
  if (left > right) return 1;
  return compareId(a.id, b.id);
}

/**
 * Xác định trạng thái thực tế của một buổi tập theo lịch so với ngày `today`:
 * - Nếu trạng thái là `'planned'` nhưng ngày tập đã qua (`date < today`) -> tính là `'missed'` (Bỏ lỡ).
 * - Nếu trạng thái là `'planned'` và ngày tập là hôm nay hoặc tương lai -> `'pending'` (Còn chờ).
 * - Nếu trạng thái là `'done'` hoặc `'missed'` ở ngày `<= today` -> giữ nguyên.
 * - Các trường hợp khác (ngày sai hoặc buổi ở tương lai nhưng đã đánh dấu done) -> `'unknown'`.
 *
 * @param row Bản ghi buổi tập
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @returns Trạng thái `WorkoutState`
 */
export function getWorkoutState(row: WorkoutRecord, today: string): WorkoutState {
  parseDay(today);
  if (!isStatisticsDate(row.date)) {
    return 'unknown';
  }
  if (row.status === 'planned') {
    return row.date < today ? 'missed' : 'pending';
  }
  if ((row.status === 'done' || row.status === 'missed') && row.date <= today) {
    return row.status;
  }
  return 'unknown';
}

/**
 * Gom nhóm các buổi tập đã hoàn thành theo từng bài tập (`muscle = false`)
 * hoặc theo nhóm cơ (`muscle = true`).
 *
 * @param rows Danh sách buổi tập đã hoàn thành
 * @param exercises Danh sách bài tập dùng để tra cứu tên và nhóm cơ
 * @param muscle `true` nếu gom theo nhóm cơ, `false` nếu gom theo bài tập
 * @returns Mảng các nhóm đã sắp xếp giảm dần theo số buổi tập
 */
function groupWorkouts(
  rows: readonly WorkoutRecord[],
  exercises: readonly ExerciseRecord[],
  muscle: boolean
) {
  const groups = new Map<string, { key: string; label: string; rows: WorkoutRecord[] }>();

  for (const row of rows) {
    // Tìm thông tin bài tập từ bảng exercises hoặc từ trường exercise đính kèm (_expand=exercise)
    let exercise = exercises.find((item) => sameId(item.id, row.exerciseId)) ?? null;
    if (!exercise && sameId(row.exercise?.id, row.exerciseId)) {
      exercise = row.exercise ?? null;
    }

    const label = muscle
      ? text(exercise?.muscleGroup) ?? 'Chưa rõ nhóm cơ'
      : text(exercise?.name) ?? 'Chưa rõ bài tập';

    const key = muscle
      ? label
      : hasId(row.exerciseId)
        ? String(row.exerciseId)
        : 'unknown';

    const group = groups.get(key) ?? { key, label, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      label: group.label,
      sessions: group.rows.length,
      minutes: sum(group.rows, (row) => row.durationMin),
      calories: sum(group.rows, (row) => row.caloriesBurned),
    }))
    .sort((a, b) => b.sessions - a.sessions || compareId(a.key, b.key));
}

/**
 * Tính toán toàn bộ chỉ số thống kê của Lịch tập (`workouts`) trong một kỳ:
 * số buổi hoàn thành/bỏ lỡ/còn chờ, tỷ lệ hoàn thành, tổng phút, tổng calo,
 * phân bố theo bài tập và nhóm cơ.
 *
 * @param rows Danh sách buổi tập của người dùng
 * @param period Kỳ thống kê cần tính
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @param exercises Danh mục bài tập (tùy chọn)
 * @returns Kết quả thống kê lịch tập
 */
export function calculateSchedule(
  rows: readonly WorkoutRecord[],
  period: StatisticsPeriod,
  today: string,
  exercises: readonly ExerciseRecord[] = []
) {
  parseDay(today);

  // Lọc các buổi nằm trong kỳ và sắp xếp theo ngày/giờ
  const records = rows
    .filter((row) => within(row.date, period))
    .slice()
    .sort(compareWorkouts);

  const done = records.filter((row) => getWorkoutState(row, today) === 'done');
  const counts = { done: 0, missed: 0, pending: 0, unknown: 0 };

  for (const row of records) {
    const state = getWorkoutState(row, today);
    counts[state] += 1;
  }

  // Tỷ lệ hoàn thành chỉ tính trên các buổi đã có kết quả (hoàn thành + bỏ lỡ),
  // không tính các buổi còn chờ trong hôm nay hoặc tương lai.
  const evaluated = counts.done + counts.missed;
  const completionPercent = evaluated === 0 ? null : (counts.done / evaluated) * 100;

  const minutes = sum(done, (row) => row.durationMin);
  const calories = sum(done, (row) => row.caloriesBurned);

  return {
    records,
    counts,
    minutes,
    calories,
    averageMinutes: average(minutes, done.length),
    averageCalories: average(calories, done.length),
    completionPercent,
    latest: done.at(-1) ?? null,
    byExercise: groupWorkouts(done, exercises, false),
    byMuscleGroup: groupWorkouts(done, exercises, true),
  };
}

// ============================================================================
// PHẦN 4: THỐNG KÊ CHẠY BỘ (RUNS)
// ============================================================================

/**
 * Lọc trùng danh sách buổi chạy của người dùng theo `clientId` (hoặc `id` nếu không có `clientId`).
 * Nếu cùng một buổi chạy vừa có bản chờ đồng bộ (`_queued === true`) vừa có bản đã lưu
 * trên server (`_queued !== true`), ưu tiên giữ bản từ server.
 *
 * @param rows Danh sách buổi chạy đầu vào
 * @param userId Mã người dùng đang đăng nhập
 * @returns Danh sách buổi chạy của người dùng đã khử trùng lặp
 */
export function deduplicateStatisticsRuns(
  rows: readonly RunRecord[],
  userId: StatisticsId
): RunRecord[] {
  const byKey = new Map<string, RunRecord>();
  const noKey: RunRecord[] = [];

  for (const row of owned(rows, userId)) {
    const client = text(row.clientId);
    let key: string | null = null;
    if (client) {
      key = `client:${client}`;
    } else if (hasId(row.id)) {
      key = `id:${row.id}`;
    }

    if (key === null) {
      noKey.push(row);
      continue;
    }

    const previous = byKey.get(key);
    const shouldReplace = !previous || (previous._queued === true && row._queued !== true);
    if (shouldReplace) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values(), ...noKey];
}

/**
 * Đọc mốc thời gian ISO 8601 (có múi giờ `Z` hoặc `+HH:MM`) của buổi chạy thành mili-giây.
 * Trả về `null` nếu chuỗi thời gian thiếu múi giờ hoặc giờ/phút/giây không hợp lệ.
 *
 * @param value Giá trị thời gian `startedAt` hoặc `endedAt`
 * @returns Số mili-giây (timestamp) hoặc `null`
 */
function runTimestamp(value: unknown): number | null {
  const string = text(value);
  if (!string) return null;

  const isoWithTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoWithTimezone.test(string) || !isStatisticsDate(string.slice(0, 10))) {
    return null;
  }

  // Kiểm tra giờ (0-23), phút (0-59), giây (0-59) để tránh Date.parse tự đổi 24:00 sang ngày hôm sau
  const hour = Number(string.slice(11, 13));
  const minute = Number(string.slice(14, 16));
  const second = Number(string.slice(17, 19));
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  const time = Date.parse(string);
  return Number.isFinite(time) ? time : null;
}

/**
 * Kiểm tra một buổi chạy đã hoàn thành hợp lệ hay chưa (có đủ `startedAt`, `endedAt` và `endedAt >= startedAt`).
 *
 * @param row Bản ghi buổi chạy
 * @returns `true` nếu buổi chạy đã kết thúc hợp lệ
 */
function completedRun(row: RunRecord): boolean {
  const start = runTimestamp(row.startedAt);
  const end = runTimestamp(row.endedAt);
  return start !== null && end !== null && end >= start;
}

/**
 * So sánh 2 buổi chạy theo thời điểm bắt đầu (`startedAt`), nếu trùng thì so sánh theo `id`.
 *
 * @param a Buổi chạy thứ nhất
 * @param b Buổi chạy thứ hai
 * @returns Thứ tự sắp xếp
 */
function compareRuns(a: RunRecord, b: RunRecord): number {
  const timeDiff = (runTimestamp(a.startedAt) ?? 0) - (runTimestamp(b.startedAt) ?? 0);
  if (timeDiff !== 0) return timeDiff;
  return compareId(a.id, b.id);
}

/**
 * Tính toán các chỉ số thống kê Chạy bộ trong một kỳ:
 * số buổi chạy, quãng đường, bước chân, thời gian, calo, pace trung bình (giây/km),
 * tốc độ trung bình (km/h), nhịp bước (bước/phút) và buổi chạy xa nhất.
 *
 * @param rows Danh sách buổi chạy đã lọc trùng của người dùng
 * @param period Kỳ thống kê cần tính
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @returns Kết quả thống kê chạy bộ
 */
export function calculateRuns(
  rows: readonly RunRecord[],
  period: StatisticsPeriod,
  today: string
) {
  parseDay(today);

  // Chỉ xét các buổi chạy có ngày nằm trong kỳ và không vượt quá ngày hôm nay
  const inPeriod = rows.filter((row) => within(row.date, period) && (row.date as string) <= today);
  const records = inPeriod.filter(completedRun).slice().sort(compareRuns);

  let pairSeconds = 0;
  let pairKm = 0;
  let cadenceSeconds = 0;
  let cadenceSteps = 0;
  let paceExcluded = 0;
  let cadenceExcluded = 0;
  let longest: RunRecord | null = null;

  for (const row of records) {
    const seconds = positive(row.durationSec);
    const km = positive(row.distanceKm);
    const steps = nonNegative(row.steps);

    // Tính Pace và Tốc độ theo tổng thời gian / tổng quãng đường của các buổi có đủ cả 2 số liệu
    if (seconds !== null && km !== null) {
      pairSeconds += seconds;
      pairKm += km;
    } else {
      paceExcluded += 1;
    }

    // Tính Nhịp bước (Cadence) theo tổng bước / tổng phút của các buổi có đủ bước và thời gian
    if (seconds !== null && steps !== null) {
      cadenceSeconds += seconds;
      cadenceSteps += steps;
    } else {
      cadenceExcluded += 1;
    }

    // Tìm buổi chạy có quãng đường xa nhất (nếu bằng nhau thì chọn buổi mới hơn ở sau)
    const distance = nonNegative(row.distanceKm);
    if (distance !== null) {
      const longestDistance = longest ? nonNegative(longest.distanceKm) ?? 0 : 0;
      if (!longest || distance >= longestDistance) {
        longest = row;
      }
    }
  }

  const durationSec = sum(records, (row) => row.durationSec);
  const calories = sum(records, (row) => row.calories);

  return {
    records,
    sessions: records.length,
    queuedCount: records.filter((row) => row._queued === true).length,
    incompleteRecords: inPeriod.length - records.length,
    durationSec,
    pausedSec: sum(records, (row) => row.pausedSec),
    distanceKm: sum(records, (row) => row.distanceKm),
    steps: sum(records, (row) => row.steps),
    calories,
    averageDurationSec: average(durationSec, records.length),
    averageCalories: average(calories, records.length),
    paceSecPerKm: pairKm > 0 ? pairSeconds / pairKm : null,
    avgSpeedKmh: pairSeconds > 0 ? pairKm / (pairSeconds / 3600) : null,
    cadenceSpm: cadenceSeconds > 0 ? cadenceSteps / (cadenceSeconds / 60) : null,
    paceExcluded,
    cadenceExcluded,
    longest,
    latest: records.at(-1) ?? null,
  };
}

// ============================================================================
// PHẦN 5: THỐNG KÊ THÓI QUEN (HABITS), CÂN NẶNG & BMI (WEIGHT), MỤC TIÊU (TARGETS)
// ============================================================================

/**
 * Tính toán Thói quen luyện tập:
 * - Chuỗi buổi hoàn thành liên tiếp hiện tại (`currentStreak`) và dài nhất (`longestStreak`).
 *   Lưu ý: Ngày không có lịch tập (ngày nghỉ) không làm đứt chuỗi; chỉ khi có buổi bị `'missed'`
 *   hoặc `'unknown'` thì chuỗi mới về 0.
 * - Số ngày có hoạt động trong kỳ (`activeDays`) tính từ cả lịch tập hoàn thành lẫn chạy bộ.
 * - Phân bố số ngày hoạt động theo 7 thứ trong tuần (Thứ 2 -> Chủ nhật).
 *
 * @param workouts Danh sách buổi tập của người dùng
 * @param runs Danh sách buổi chạy của người dùng
 * @param period Kỳ thống kê đang chọn
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @returns Kết quả thống kê thói quen luyện tập
 */
export function calculateHabits(
  workouts: readonly WorkoutRecord[],
  runs: readonly RunRecord[],
  period: StatisticsPeriod,
  today: string
) {
  parseDay(today);

  let currentStreak = 0;
  let longestStreak = 0;
  let unknownScheduleCount = 0;

  // Duyệt lịch tập theo thứ tự thời gian từ cũ đến mới để đếm chuỗi liên tiếp
  const sortedWorkouts = workouts.slice().sort(compareWorkouts);
  for (const row of sortedWorkouts) {
    if (isStatisticsDate(row.date) && row.date > today) {
      continue;
    }
    const state = getWorkoutState(row, today);
    if (state === 'done') {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (state === 'missed') {
      currentStreak = 0;
    } else if (state === 'unknown') {
      // Nếu có buổi tập bị lỗi trạng thái/ngày, không nối chuỗi qua buổi đó
      currentStreak = 0;
      unknownScheduleCount += 1;
    }
  }

  // Tập hợp các ngày có hoạt động (dùng Set để mỗi ngày chỉ tính 1 lần dù tập nhiều buổi)
  const dates = new Set<string>();
  for (const row of workouts) {
    if (getWorkoutState(row, today) === 'done' && within(row.date, period)) {
      dates.add(row.date as string);
    }
  }
  for (const row of runs) {
    if (completedRun(row) && within(row.date, period) && (row.date as string) <= today) {
      dates.add(row.date as string);
    }
  }

  const activeDates = [...dates].sort();
  // Khởi tạo mảng 7 phần tử tương ứng Thứ 2 (weekday = 1) đến Chủ nhật (weekday = 7)
  const weekdays = Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    activeDays: 0,
  }));

  for (const date of activeDates) {
    const dayIndex = getMondayBasedIndex(parseDay(date));
    weekdays[dayIndex].activeDays += 1;
  }

  return {
    currentStreak,
    longestStreak,
    unknownScheduleCount,
    streakComplete: unknownScheduleCount === 0,
    activeDates,
    activeDays: dates.size,
    weekdays,
  };
}

/**
 * Phân loại nhóm BMI theo chuẩn WHO từ chỉ số BMI đã làm tròn.
 *
 * @param bmi Chỉ số BMI hoặc `null`
 * @returns Nhóm BMI ('thin' | 'normal' | 'overweight' | 'obese' | null)
 */
function classifyBmiGroup(bmi: number | null): 'thin' | 'normal' | 'overweight' | 'obese' | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return 'thin';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Tính toán thống kê Cân nặng và BMI:
 * - Ưu tiên lấy cân nặng gần nhất từ lịch sử cân (`weightHistory`); nếu chưa có thì lấy từ `profile`.
 * - Trong mỗi ngày của kỳ, nếu cân nhiều lần thì chọn bản ghi có `id` lớn nhất.
 * - Tính độ lệch cân nặng giữa lần cân đầu tiên và cuối cùng trong kỳ (`changeKg`).
 * - Tính chỉ số BMI = cân nặng (kg) / (chiều cao (m))^2.
 *
 * @param weights Lịch sử cân nặng của người dùng
 * @param profile Hồ sơ sức khỏe của người dùng (hoặc `null`)
 * @param period Kỳ thống kê đang chọn
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @returns Kết quả thống kê cân nặng và BMI
 */
export function calculateWeight(
  weights: readonly WeightRecord[],
  profile: ProfileRecord | null,
  period: StatisticsPeriod,
  today: string
) {
  parseDay(today);

  // Lọc các lần cân hợp lệ (ngày <= today và cân nặng > 0), sắp xếp tăng dần theo ngày rồi theo ID
  const history = weights
    .filter((row) => isStatisticsDate(row.date) && row.date <= today && positive(row.weightKg) !== null)
    .slice()
    .sort((a, b) => (a.date as string).localeCompare(b.date as string) || compareId(a.id, b.id));

  const latest = history.at(-1) ?? null;
  const currentKg = latest ? positive(latest.weightKg) : positive(profile?.weightKg);

  let source: 'history' | 'profile' | null = null;
  if (latest) {
    source = 'history';
  } else if (currentKg !== null) {
    source = 'profile';
  }

  // Gom các điểm cân trong kỳ: mỗi ngày chỉ giữ lại bản ghi cuối cùng (có ID lớn nhất)
  const periodHistory = history.filter((row) => within(row.date, period));
  const byDay = new Map<string, WeightRecord>();
  for (const row of periodHistory) {
    byDay.set(row.date as string, row);
  }
  const points = [...byDay.values()].map((row) => ({
    date: row.date as string,
    weightKg: row.weightKg as number,
  }));

  // Tính BMI từ cân nặng hiện tại và chiều cao trong hồ sơ
  const heightCm = positive(profile?.heightCm);
  let bmi: number | null = null;
  if (currentKg !== null && heightCm !== null) {
    const heightInMeters = heightCm / 100;
    const bmiRaw = currentKg / (heightInMeters * heightInMeters);
    if (Number.isFinite(bmiRaw)) {
      bmi = Math.round(bmiRaw * 10) / 10;
    }
  }

  const changeKg = points.length >= 2 ? points.at(-1)!.weightKg - points[0].weightKg : null;
  const invalidRecordCount = weights.filter(
    (row) => !isStatisticsDate(row.date) || positive(row.weightKg) === null
  ).length;

  return {
    currentKg,
    source,
    recordedDate: latest ? (latest.date as string) : null,
    bmi,
    bmiGroup: classifyBmiGroup(bmi),
    points,
    changeKg,
    invalidRecordCount,
  };
}

/**
 * Tính phần trăm hoàn thành mục tiêu (`actual / target * 100`).
 *
 * @param actual Số liệu thực tế đạt được
 * @param targetValue Giá trị mục tiêu cam kết
 * @returns Đối tượng tiến độ gồm `actual`, `target`, `percent` và `fillPercent` (tối đa 100%)
 */
function progress(actual: StatisticsMetric, targetValue: unknown) {
  const target = positive(targetValue);
  const canCalculatePercent = target !== null && actual.complete && actual.value !== null;
  const percent = canCalculatePercent ? (actual.value! / target!) * 100 : null;
  const fillPercent = percent === null ? null : Math.min(percent, 100);

  return { actual, target, percent, fillPercent };
}

/**
 * Tính toán Tiến độ mục tiêu trong tuần hiện tại:
 * - Cam kết số phút tập mỗi tuần (`minMinutesPerWeek` từ `userGoals`).
 * - Cam kết số buổi tập mỗi tuần (`sessionsPerWeek` từ `profiles`).
 * - Đối chiếu cân nặng hiện tại với cân nặng đích (`targetWeightKg`).
 *
 * @param userGoals Danh sách mục tiêu cá nhân của người dùng
 * @param profile Hồ sơ sức khỏe của người dùng
 * @param workouts Danh sách buổi tập theo lịch
 * @param goals Danh mục tên các loại mục tiêu
 * @param currentKg Cân nặng hiện tại (kg)
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @returns Kết quả thống kê tiến độ mục tiêu
 */
export function calculateTargets(
  userGoals: readonly UserGoalRecord[],
  profile: ProfileRecord | null,
  workouts: readonly WorkoutRecord[],
  goals: readonly GoalRecord[],
  currentKg: number | null,
  today: string
) {
  const week = getStatisticsPeriod('week', today);
  const schedule = calculateSchedule(workouts, week, today);

  // Chỉ xác định mục tiêu khi người dùng có đúng 1 bản ghi userGoal duy nhất
  let state: 'missing' | 'selected' | 'ambiguous' = 'ambiguous';
  if (userGoals.length === 0) {
    state = 'missing';
  } else if (userGoals.length === 1) {
    state = 'selected';
  }

  const selected = state === 'selected' ? userGoals[0] : null;
  let goal = goals.find((row) => sameId(row.id, selected?.goalId)) ?? null;
  if (!goal && sameId(selected?.goal?.id, selected?.goalId)) {
    goal = selected?.goal ?? null;
  }

  const targetWeightKg = positive(selected?.targetWeightKg);
  const sessions: StatisticsMetric = {
    value: schedule.counts.done,
    complete: true,
    missingCount: 0,
  };

  return {
    state,
    selected,
    name: text(goal?.name),
    code: text(goal?.code),
    week,
    minutes: progress(schedule.minutes, selected?.minMinutesPerWeek),
    sessions: progress(sessions, profile?.sessionsPerWeek),
    targetWeightKg,
    weightDifferenceKg:
      currentKg !== null && targetWeightKg !== null ? currentKg - targetWeightKg : null,
  };
}

// ============================================================================
// PHẦN 6: HÀM TỔNG HỢP CHÍNH (CALCULATE STATISTICS)
// ============================================================================

/**
 * Hàm trung tâm tổng hợp toàn bộ báo cáo thống kê cho một người dùng trong kỳ được chọn.
 *
 * @param input Dữ liệu đầu vào gồm `userId`, `today`, `kind`, `anchor` và các bảng dữ liệu
 * @returns Báo cáo thống kê đầy đủ `StatisticsReport`
 */
export function calculateStatistics(input: StatisticsInput) {
  const { userId, today } = input;
  parseDay(today);

  const period = getStatisticsPeriod(input.kind, input.anchor);

  // Bước 1: Lọc dữ liệu đúng chủ sở hữu (userId) cho tất cả các bảng
  const workouts = owned(input.workouts, userId);
  const runs = deduplicateStatisticsRuns(input.runs, userId);
  const profiles = owned(input.profiles, userId);
  const profile = profiles.length === 1 ? profiles[0] : null;
  const weights = owned(input.weights, userId);
  const userGoals = owned(input.userGoals, userId);

  // Bước 2: Tính toán từng mảng thống kê chuyên biệt
  const schedule = calculateSchedule(workouts, period, today, input.exercises);
  const running = calculateRuns(runs, period, today);
  const weight = calculateWeight(weights, profile, period, today);
  const habits = calculateHabits(workouts, runs, period, today);
  const targets = calculateTargets(
    userGoals,
    profile,
    workouts,
    input.goals ?? [],
    weight.currentKg,
    today
  );

  // Bước 3: Tạo chuỗi dữ liệu (series) theo từng ngày (hoặc từng tháng nếu xem theo năm) để vẽ biểu đồ
  const series = period.keys.map((key) => {
    const bucketKind = period.kind === 'year' ? 'month' : 'day';
    const bucketAnchor = key.length === 7 ? `${key}-01` : key;
    const bucket = getStatisticsPeriod(bucketKind, bucketAnchor);

    const bucketSchedule = calculateSchedule(workouts, bucket, today);
    const bucketRuns = calculateRuns(runs, bucket, today);

    return {
      key,
      schedule: {
        sessions: bucketSchedule.counts.done,
        minutes: bucketSchedule.minutes,
        calories: bucketSchedule.calories,
      },
      running: {
        sessions: bucketRuns.sessions,
        durationSec: bucketRuns.durationSec,
        distanceKm: bucketRuns.distanceKm,
        steps: bucketRuns.steps,
        calories: bucketRuns.calories,
      },
    };
  });

  // Bước 4: Tính thêm số liệu của riêng ngày hôm nay, tuần hiện tại và buổi chạy gần nhất
  const day = getStatisticsPeriod('day', today);
  const allTimeUpToToday: StatisticsPeriod = {
    kind: 'day',
    start: '0001-01-01',
    end: today,
    keys: [],
  };

  return {
    period,
    schedule,
    running,
    weight,
    targets,
    habits,
    series,
    today: {
      schedule: calculateSchedule(workouts, day, today, input.exercises),
      running: calculateRuns(runs, day, today),
    },
    weekSchedule: calculateSchedule(workouts, targets.week, today, input.exercises),
    latestRun: calculateRuns(runs, allTimeUpToToday, today).latest,
    quality: {
      invalidWorkoutDates: workouts.filter((row) => !isStatisticsDate(row.date)).length,
      invalidRunDates: runs.filter((row) => !isStatisticsDate(row.date)).length,
      profileAmbiguous: profiles.length > 1,
      unownedRunsExcluded: input.runs.filter((row) => !hasId(row.userId)).length,
    },
  };
}

export type StatisticsReport = ReturnType<typeof calculateStatistics>;
