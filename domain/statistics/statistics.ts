import type {
  ExerciseRecord, GoalRecord, OwnedRecord, PeriodKind, ProfileRecord, RunRecord,
  StatisticsId, StatisticsInput, StatisticsMetric, StatisticsPeriod,
  UserGoalRecord, WeightRecord, WorkoutRecord, WorkoutState,
} from './types';

// Chỉ tính toán trên dữ liệu đầu vào. Không gọi API, lưu trữ hoặc sửa bản ghi.
function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function dateKey(date: Date): string {
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999) throw new RangeError('Ngày ngoài khoảng hỗ trợ');
  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function isStatisticsDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = calendarDate(year, month, day);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

function parseDay(value: string): Date {
  if (!isStatisticsDate(value)) throw new RangeError('Ngày phải hợp lệ và có dạng YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  return calendarDate(year, month, day);
}

// UTC chỉ dùng làm lịch Gregorian nội bộ, không đổi ngày địa phương thành ngày UTC.
// Đầu vào đã là ngày địa phương do tầng đọc cung cấp; không dùng new Date('YYYY-MM-DD').
export function getStatisticsPeriod(kind: PeriodKind, anchor: string): StatisticsPeriod {
  const startDate = parseDay(anchor);
  const endDate = parseDay(anchor);
  if (kind === 'week') {
    startDate.setUTCDate(startDate.getUTCDate() - (startDate.getUTCDay() + 6) % 7);
    endDate.setTime(startDate.getTime());
    endDate.setUTCDate(endDate.getUTCDate() + 6);
  } else if (kind === 'month') {
    startDate.setUTCDate(1);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1, 0);
  } else if (kind === 'year') {
    startDate.setUTCMonth(0, 1);
    endDate.setUTCMonth(11, 31);
  } else if (kind !== 'day') {
    throw new RangeError('Kỳ thống kê không hợp lệ');
  }
  const start = dateKey(startDate);
  const end = dateKey(endDate);
  const keys: string[] = [];
  if (kind === 'year') {
    for (let month = 1; month <= 12; month += 1) keys.push(`${start.slice(0, 4)}-${String(month).padStart(2, '0')}`);
  } else {
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      keys.push(dateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return { kind, start, end, keys };
}

export function shiftStatisticsPeriod(kind: PeriodKind, anchor: string, offset: number): StatisticsPeriod {
  if (!Number.isSafeInteger(offset)) throw new RangeError('Số kỳ dịch chuyển phải là số nguyên an toàn');
  const date = parseDay(getStatisticsPeriod(kind, anchor).start);
  if (kind === 'day' || kind === 'week') date.setUTCDate(date.getUTCDate() + offset * (kind === 'week' ? 7 : 1));
  else if (kind === 'month') date.setUTCMonth(date.getUTCMonth() + offset);
  else date.setUTCFullYear(date.getUTCFullYear() + offset);
  return getStatisticsPeriod(kind, dateKey(date));
}

function hasId(value: unknown): value is StatisticsId {
  return (typeof value === 'string' && value.trim().length > 0)
    || (typeof value === 'number' && Number.isFinite(value));
}

function sameId(a: unknown, b: unknown): boolean {
  return hasId(a) && hasId(b) && String(a) === String(b);
}

function owned<T extends OwnedRecord>(rows: readonly T[], userId: StatisticsId): T[] {
  if (!hasId(userId)) throw new RangeError('Thiếu mã người dùng');
  return rows.filter(row => sameId(row.userId, userId));
}

function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function positive(value: unknown): number | null {
  const number = nonNegative(value);
  return number !== null && number > 0 ? number : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sum<T>(rows: readonly T[], read: (row: T) => unknown): StatisticsMetric {
  let total = 0;
  let missingCount = 0;
  for (const row of rows) {
    const number = nonNegative(read(row));
    if (number === null) missingCount += 1;
    else total += number;
  }
  return { value: rows.length > 0 && missingCount === rows.length ? null : total, missingCount, complete: missingCount === 0 };
}

function average(metric: StatisticsMetric, count: number): StatisticsMetric {
  return { ...metric, value: metric.value === null || count === 0 ? null : metric.value / (count - metric.missingCount) };
}

function within(date: unknown, period: StatisticsPeriod): boolean {
  return isStatisticsDate(date) && date >= period.start && date <= period.end;
}

function compareId(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const left = String(a ?? '');
  const right = String(b ?? '');
  // id dạng số trong JSON Server có thể được trả về dưới dạng chuỗi.
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    if (left.length !== right.length) return left.length - right.length;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareWorkouts(a: WorkoutRecord, b: WorkoutRecord): number {
  const left = `${a.date ?? ''} ${text(a.time) ?? ''}`;
  const right = `${b.date ?? ''} ${text(b.time) ?? ''}`;
  return left < right ? -1 : left > right ? 1 : compareId(a.id, b.id);
}

export function getWorkoutState(row: WorkoutRecord, today: string): WorkoutState {
  parseDay(today);
  if (!isStatisticsDate(row.date)) return 'unknown';
  if (row.status === 'planned') return row.date < today ? 'missed' : 'pending';
  if ((row.status === 'done' || row.status === 'missed') && row.date <= today) return row.status;
  return 'unknown';
}

// Có thể dùng cho dữ liệu đã ghép ở giai đoạn 3; queue không rõ chủ bị loại.
// Server ưu tiên hơn pending, cả khi pending xuất hiện trước trong đầu vào.
export function deduplicateStatisticsRuns(rows: readonly RunRecord[], userId: StatisticsId): RunRecord[] {
  const byKey = new Map<string, RunRecord>();
  const noKey: RunRecord[] = [];
  for (const row of owned(rows, userId)) {
    const clientId = text(row.clientId);
    const key = clientId ? `client:${clientId}` : hasId(row.id) ? `id:${row.id}` : null;
    if (key === null) { noKey.push(row); continue; }
    const previous = byKey.get(key);
    if (!previous || (previous._queued === true && row._queued !== true)) byKey.set(key, row);
  }
  return [...byKey.values(), ...noKey];
}

function runTimestamp(value: unknown): number | null {
  const string = text(value);
  // Chỉ nhận thời điểm có múi giờ để kết quả không phụ thuộc máy đang chạy.
  if (!string || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(string)
    || !isStatisticsDate(string.slice(0, 10))) return null;
  // Date.parse có thể chuẩn hóa 24:00 sang ngày sau; dữ liệu giờ sai phải bị loại.
  const hour = Number(string.slice(11, 13));
  const minute = Number(string.slice(14, 16));
  const second = Number(string.slice(17, 19));
  if (hour > 23 || minute > 59 || second > 59) return null;
  const time = Date.parse(string);
  return Number.isFinite(time) ? time : null;
}

function completedRun(row: RunRecord): boolean {
  const start = runTimestamp(row.startedAt);
  const end = runTimestamp(row.endedAt);
  return start !== null && end !== null && end >= start;
}

function compareRuns(a: RunRecord, b: RunRecord): number {
  return (runTimestamp(a.startedAt) ?? 0) - (runTimestamp(b.startedAt) ?? 0) || compareId(a.id, b.id);
}

function groupWorkouts(rows: readonly WorkoutRecord[], exercises: readonly ExerciseRecord[], muscle: boolean) {
  const groups = new Map<string, { key: string; label: string; rows: WorkoutRecord[] }>();
  for (const row of rows) {
    const exercise = exercises.find(item => sameId(item.id, row.exerciseId))
      ?? (sameId(row.exercise?.id, row.exerciseId) ? row.exercise : null);
    const label = muscle ? text(exercise?.muscleGroup) ?? 'Chưa rõ nhóm cơ'
      : text(exercise?.name) ?? 'Chưa rõ bài tập';
    const key = muscle ? label : hasId(row.exerciseId) ? String(row.exerciseId) : 'unknown';
    const group = groups.get(key) ?? { key, label, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({
    key: group.key, label: group.label, sessions: group.rows.length,
    minutes: sum(group.rows, row => row.durationMin), calories: sum(group.rows, row => row.caloriesBurned),
  })).sort((a, b) => b.sessions - a.sessions || compareId(a.key, b.key));
}

export function calculateSchedule(rows: readonly WorkoutRecord[], period: StatisticsPeriod, today: string, exercises: readonly ExerciseRecord[] = []) {
  parseDay(today);
  const records = rows.filter(row => within(row.date, period)).slice().sort(compareWorkouts);
  const done = records.filter(row => getWorkoutState(row, today) === 'done');
  const counts = { done: 0, missed: 0, pending: 0, unknown: 0 };
  for (const row of records) counts[getWorkoutState(row, today)] += 1;
  const evaluated = counts.done + counts.missed;
  const minutes = sum(done, row => row.durationMin);
  const calories = sum(done, row => row.caloriesBurned);
  return {
    records, counts, minutes, calories,
    averageMinutes: average(minutes, done.length), averageCalories: average(calories, done.length),
    completionPercent: evaluated === 0 ? null : counts.done / evaluated * 100,
    latest: done.at(-1) ?? null,
    byExercise: groupWorkouts(done, exercises, false), byMuscleGroup: groupWorkouts(done, exercises, true),
  };
}

export function calculateRuns(rows: readonly RunRecord[], period: StatisticsPeriod, today: string) {
  parseDay(today);
  const inPeriod = rows.filter(row => within(row.date, period) && (row.date as string) <= today);
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
    if (seconds !== null && km !== null) { pairSeconds += seconds; pairKm += km; }
    else paceExcluded += 1;
    if (seconds !== null && steps !== null) { cadenceSeconds += seconds; cadenceSteps += steps; }
    else cadenceExcluded += 1;
    const distance = nonNegative(row.distanceKm);
    if (distance !== null && (!longest || distance >= (nonNegative(longest.distanceKm) ?? 0))) longest = row;
  }
  const durationSec = sum(records, row => row.durationSec);
  const calories = sum(records, row => row.calories);
  return {
    records, sessions: records.length, queuedCount: records.filter(row => row._queued === true).length,
    incompleteRecords: inPeriod.length - records.length,
    durationSec, pausedSec: sum(records, row => row.pausedSec),
    distanceKm: sum(records, row => row.distanceKm), steps: sum(records, row => row.steps), calories,
    averageDurationSec: average(durationSec, records.length), averageCalories: average(calories, records.length),
    paceSecPerKm: pairKm > 0 ? pairSeconds / pairKm : null,
    avgSpeedKmh: pairSeconds > 0 ? pairKm / (pairSeconds / 3600) : null,
    cadenceSpm: cadenceSeconds > 0 ? cadenceSteps / (cadenceSeconds / 60) : null,
    paceExcluded, cadenceExcluded, longest, latest: records.at(-1) ?? null,
  };
}

export function calculateHabits(workouts: readonly WorkoutRecord[], runs: readonly RunRecord[], period: StatisticsPeriod, today: string) {
  parseDay(today);
  let currentStreak = 0;
  let longestStreak = 0;
  let unknownScheduleCount = 0;
  for (const row of workouts.slice().sort(compareWorkouts)) {
    if (isStatisticsDate(row.date) && row.date > today) continue;
    const state = getWorkoutState(row, today);
    if (state === 'done') {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (state === 'missed') currentStreak = 0;
    else if (state === 'unknown') {
      // Không khẳng định hai chuỗi nối liền qua một buổi chưa xác định.
      currentStreak = 0;
      unknownScheduleCount += 1;
    }
  }
  const dates = new Set<string>();
  for (const row of workouts) {
    if (getWorkoutState(row, today) === 'done' && within(row.date, period)) dates.add(row.date as string);
  }
  for (const row of runs) {
    if (completedRun(row) && within(row.date, period) && (row.date as string) <= today) dates.add(row.date as string);
  }
  const activeDates = [...dates].sort();
  const weekdays = Array.from({ length: 7 }, (_, index) => ({ weekday: index + 1, activeDays: 0 }));
  for (const date of activeDates) weekdays[(parseDay(date).getUTCDay() + 6) % 7].activeDays += 1;
  return { currentStreak, longestStreak, unknownScheduleCount, streakComplete: unknownScheduleCount === 0,
    activeDates, activeDays: dates.size, weekdays };
}

export function calculateWeight(weights: readonly WeightRecord[], profile: ProfileRecord | null, period: StatisticsPeriod, today: string) {
  parseDay(today);
  const history = weights.filter(row => isStatisticsDate(row.date) && row.date <= today && positive(row.weightKg) !== null)
    .slice().sort((a, b) => (a.date as string).localeCompare(b.date as string) || compareId(a.id, b.id));
  const latest = history.at(-1) ?? null;
  const currentKg = latest ? positive(latest.weightKg) : positive(profile?.weightKg);
  const source = latest ? 'history' as const : currentKg !== null ? 'profile' as const : null;
  const periodHistory = history.filter(row => within(row.date, period));
  // Một điểm/ngày: id lớn nhất thắng, không tự dựng thứ tự đo trong ngày.
  const byDay = new Map<string, WeightRecord>();
  for (const row of periodHistory) byDay.set(row.date as string, row);
  const points = [...byDay.values()].map(row => ({ date: row.date as string, weightKg: row.weightKg as number }));
  const heightCm = positive(profile?.heightCm);
  const bmiRaw = currentKg !== null && heightCm !== null ? currentKg / ((heightCm / 100) ** 2) : null;
  const bmi = bmiRaw !== null && Number.isFinite(bmiRaw) ? Math.round(bmiRaw * 10) / 10 : null;
  const bmiGroup = bmi === null ? null : bmi < 18.5 ? 'thin' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese';
  return {
    currentKg, source, recordedDate: latest ? latest.date as string : null, bmi, bmiGroup, points,
    changeKg: points.length >= 2 ? points.at(-1)!.weightKg - points[0].weightKg : null,
    invalidRecordCount: weights.filter(row => !isStatisticsDate(row.date) || positive(row.weightKg) === null).length,
  };
}

function progress(actual: StatisticsMetric, targetValue: unknown) {
  const target = positive(targetValue);
  const percent = target !== null && actual.complete && actual.value !== null ? actual.value / target * 100 : null;
  return { actual, target, percent, fillPercent: percent === null ? null : Math.min(percent, 100) };
}

export function calculateTargets(userGoals: readonly UserGoalRecord[], profile: ProfileRecord | null,
  workouts: readonly WorkoutRecord[], goals: readonly GoalRecord[], currentKg: number | null, today: string) {
  const week = getStatisticsPeriod('week', today);
  const schedule = calculateSchedule(workouts, week, today);
  const state = userGoals.length === 0 ? 'missing' : userGoals.length === 1 ? 'selected' : 'ambiguous';
  const selected = state === 'selected' ? userGoals[0] : null;
  const goal = goals.find(row => sameId(row.id, selected?.goalId))
    ?? (sameId(selected?.goal?.id, selected?.goalId) ? selected?.goal : null);
  const targetWeightKg = positive(selected?.targetWeightKg);
  const sessions = { value: schedule.counts.done, complete: true, missingCount: 0 };
  return { state, selected, name: text(goal?.name), code: text(goal?.code), week,
    minutes: progress(schedule.minutes, selected?.minMinutesPerWeek),
    sessions: progress(sessions, profile?.sessionsPerWeek), targetWeightKg,
    weightDifferenceKg: currentKg !== null && targetWeightKg !== null ? currentKg - targetWeightKg : null,
  };
}

export function calculateStatistics(input: StatisticsInput) {
  const { userId, today } = input;
  parseDay(today);
  const period = getStatisticsPeriod(input.kind, input.anchor);
  const workouts = owned(input.workouts, userId);
  const runs = deduplicateStatisticsRuns(input.runs, userId);
  const profiles = owned(input.profiles, userId);
  const profile = profiles.length === 1 ? profiles[0] : null;
  const weights = owned(input.weights, userId);
  const userGoals = owned(input.userGoals, userId);
  const schedule = calculateSchedule(workouts, period, today, input.exercises);
  const running = calculateRuns(runs, period, today);
  const weight = calculateWeight(weights, profile, period, today);
  const habits = calculateHabits(workouts, runs, period, today);
  const targets = calculateTargets(userGoals, profile, workouts, input.goals ?? [], weight.currentKg, today);
  const day = getStatisticsPeriod('day', today);
  const series = period.keys.map(key => {
    const bucket = getStatisticsPeriod(period.kind === 'year' ? 'month' : 'day', key.length === 7 ? `${key}-01` : key);
    const bucketSchedule = calculateSchedule(workouts, bucket, today);
    const bucketRuns = calculateRuns(runs, bucket, today);
    return { key, schedule: { sessions: bucketSchedule.counts.done, minutes: bucketSchedule.minutes, calories: bucketSchedule.calories },
      running: { sessions: bucketRuns.sessions, durationSec: bucketRuns.durationSec,
        distanceKm: bucketRuns.distanceKm, steps: bucketRuns.steps, calories: bucketRuns.calories } };
  });
  return {
    period, schedule, running, weight, targets, habits, series,
    today: { schedule: calculateSchedule(workouts, day, today, input.exercises), running: calculateRuns(runs, day, today) },
    weekSchedule: calculateSchedule(workouts, targets.week, today, input.exercises),
    latestRun: calculateRuns(runs, { kind: 'day', start: '0001-01-01', end: today, keys: [] }, today).latest,
    quality: { invalidWorkoutDates: workouts.filter(row => !isStatisticsDate(row.date)).length,
      invalidRunDates: runs.filter(row => !isStatisticsDate(row.date)).length,
      profileAmbiguous: profiles.length > 1,
      unownedRunsExcluded: input.runs.filter(row => !hasId(row.userId)).length },
  };
}

export type StatisticsReport = ReturnType<typeof calculateStatistics>;
