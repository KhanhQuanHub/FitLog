import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateStatistics, deduplicateStatisticsRuns, getStatisticsPeriod,
  getWorkoutState, isStatisticsDate, shiftStatisticsPeriod,
} from './statistics.ts';

// Fixture chỉ nằm trong bộ nhớ. Không đọc/ghi db.json, không khởi động server.
const today = '2026-11-05';
const workout = (changes = {}) => ({
  id: 1, userId: 1, date: today, time: '08:00', status: 'done',
  exerciseId: 1, durationMin: 30, caloriesBurned: 200, ...changes,
});
const run = (changes = {}) => ({
  id: 1, clientId: 'run-1', userId: 1, date: today,
  startedAt: '2026-11-05T01:00:00.000Z', endedAt: '2026-11-05T01:30:00.000Z',
  durationSec: 1800, pausedSec: 60, distanceKm: 3, steps: 4500, calories: 200, ...changes,
});
const profile = (changes = {}) => ({ id: 1, userId: 1, heightCm: 175, weightKg: 60, sessionsPerWeek: 4, ...changes });
const weight = (changes = {}) => ({ id: 1, userId: 1, date: today, weightKg: 60, ...changes });
const goal = (changes = {}) => ({ id: 1, userId: 1, goalId: 2, minMinutesPerWeek: 150, targetWeightKg: 65, ...changes });
const input = (changes = {}) => ({
  userId: 1, today, kind: 'week', anchor: today,
  workouts: [], runs: [], profiles: [], weights: [], userGoals: [], ...changes,
});
const calculate = (changes = {}) => calculateStatistics(input(changes));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

test('Ngày hợp lệ, tháng nhuận và định dạng chặt chẽ', () => {
  for (const value of ['2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31']) assert.equal(isStatisticsDate(value), true);
  for (const value of ['2026-02-29', '1900-02-29', '2026-02-30', '2026-13-01', '2026-1-01', '0000-01-01', '', null]) {
    assert.equal(isStatisticsDate(value), false);
  }
});

test('Tuần bắt đầu thứ Hai và giao năm vẫn đủ 7 ngày', () => {
  const period = getStatisticsPeriod('week', '2027-01-01');
  assert.equal(period.start, '2026-12-28');
  assert.equal(period.end, '2027-01-03');
  assert.equal(period.keys.length, 7);
  assert.equal(getStatisticsPeriod('week', '2027-01-03').start, period.start);
  assert.equal(getStatisticsPeriod('week', '2027-01-04').start, '2027-01-04');
});

test('Tháng nhuận có 29 cột, tháng thường 28; năm có 12 tháng', () => {
  assert.equal(getStatisticsPeriod('month', '2024-02-15').keys.length, 29);
  assert.equal(getStatisticsPeriod('month', '2026-02-15').keys.length, 28);
  assert.equal(getStatisticsPeriod('month', '2026-04-01').end, '2026-04-30');
  assert.deepEqual(getStatisticsPeriod('year', today).keys, Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`));
});

test('Chuyển kỳ đúng qua cuối tháng, cuối năm và nhiều kỳ', () => {
  assert.equal(shiftStatisticsPeriod('day', '2024-02-28', 1).start, '2024-02-29');
  assert.equal(shiftStatisticsPeriod('month', '2026-01-31', 1).start, '2026-02-01');
  assert.equal(shiftStatisticsPeriod('month', '2026-12-31', 1).start, '2027-01-01');
  assert.equal(shiftStatisticsPeriod('year', '2024-02-29', 1).start, '2025-01-01');
  assert.equal(shiftStatisticsPeriod('week', today, -2).start, '2026-10-19');
  assert.throws(() => shiftStatisticsPeriod('day', today, 0.5), RangeError);
  assert.throws(() => getStatisticsPeriod('day', '2026-02-30'), RangeError);
  assert.throws(() => getStatisticsPeriod('hour', today), RangeError);
});

test('Lịch thuần ngày không lệch qua ranh giới DST', () => {
  assert.deepEqual(getStatisticsPeriod('week', '2026-03-08').keys,
    ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']);
  assert.equal(getStatisticsPeriod('month', '2026-11-01').keys.length, 30);
});

test('Dữ liệu rỗng không tạo mục tiêu, cân, BMI hay chuỗi giả', () => {
  const result = calculate();
  assert.equal(result.schedule.minutes.value, 0);
  assert.equal(result.running.sessions, 0);
  assert.equal(result.running.paceSecPerKm, null);
  assert.equal(result.schedule.completionPercent, null);
  assert.equal(result.weight.currentKg, null);
  assert.equal(result.weight.bmiGroup, null);
  assert.equal(result.targets.minutes.target, null);
  assert.equal(result.targets.minutes.percent, null);
  assert.equal(result.habits.currentStreak, 0);
  assert.equal(result.series.length, 7);
});

test('Lọc đúng tài khoản cho mọi nguồn, chuẩn hóa id số/chuỗi, bỏ bản thiếu chủ', () => {
  const result = calculate({
    userId: '1', workouts: [workout(), workout({ id: 2, userId: 2 }), workout({ id: 3, userId: undefined })],
    runs: [run(), run({ id: 2, clientId: 'other', userId: 2 }), run({ clientId: 'unknown', userId: undefined })],
    profiles: [profile({ userId: 2, weightKg: 150 })],
    weights: [weight({ userId: 2, weightKg: 150 })], userGoals: [goal({ userId: 2 })],
  });
  assert.equal(result.schedule.counts.done, 1);
  assert.equal(result.running.sessions, 1);
  assert.equal(result.weight.currentKg, null);
  assert.equal(result.targets.state, 'missing');
  assert.equal(result.quality.unownedRunsExcluded, 1);
  assert.throws(() => calculate({ userId: '' }), RangeError);
});

test('Cùng buổi tồn tại ở lịch/chạy vẫn giữ hai tổng RIÊNG, không cộng chung', () => {
  const result = calculate({ workouts: [workout()], runs: [run()] });
  assert.equal(result.schedule.minutes.value, 30);
  assert.equal(result.running.durationSec.value, 1800);
  assert.equal(result.schedule.calories.value, 200);
  assert.equal(result.running.calories.value, 200);
  assert.equal(result.schedule.counts.done, 1);
  assert.equal(result.running.sessions, 1);
  assert.equal(result.habits.activeDays, 1);
  assert.equal('totalSessions' in result, false);
});

test('Hôm nay không có hoạt động thì không lấy buổi cũ thay thế', () => {
  const result = calculate({ runs: [run({ date: '2026-11-04' })], workouts: [workout({ date: '2026-11-04' })] });
  assert.equal(result.today.running.distanceKm.value, 0);
  assert.equal(result.today.schedule.minutes.value, 0);
  assert.equal(result.latestRun.date, '2026-11-04');
});

test('Kỳ lọc gồm hai đầu, không cộng lịch sử ngoài tuần', () => {
  const result = calculate({ workouts: [
    workout({ id: 1, date: '2026-11-01' }), workout({ id: 2, date: '2026-11-02' }),
    workout({ id: 3, date: today }), workout({ id: 4, date: '2026-11-09' }),
  ] });
  assert.equal(result.schedule.counts.done, 2);
  assert.equal(result.schedule.minutes.value, 60);
});

test('Buổi quá ngày mới bỏ lỡ, không đổi trạng thái đầu vào', () => {
  const previous = freeze(workout({ status: 'planned', date: '2026-11-04' }));
  assert.equal(getWorkoutState(previous, today), 'missed');
  assert.equal(getWorkoutState(workout({ status: 'planned', time: '00:01' }), today), 'pending');
  assert.equal(getWorkoutState(workout({ status: 'planned', date: '2026-11-06' }), today), 'pending');
  assert.equal(getWorkoutState(workout({ status: 'other' }), today), 'unknown');
  assert.equal(getWorkoutState(workout({ date: 'bad' }), today), 'unknown');
  assert.equal(previous.status, 'planned');
});

test('Tỷ lệ bỏ qua chờ hôm nay và tương lai, phân biệt missed', () => {
  const result = calculate({ workouts: [workout(), workout({ id: 2, status: 'missed' }),
    workout({ id: 3, status: 'planned', date: '2026-11-04' }),
    workout({ id: 4, status: 'planned' }), workout({ id: 5, status: 'planned', date: '2026-11-06' })] });
  assert.deepEqual(result.schedule.counts, { done: 1, missed: 2, pending: 2, unknown: 0 });
  near(result.schedule.completionPercent, 100 / 3);
  assert.equal(result.schedule.minutes.value, 30);
});

test('Bản ghi done ở tương lai không tăng thực tế, mục tiêu hoặc chuỗi', () => {
  const result = calculate({ workouts: [workout({ date: '2026-11-06' })], runs: [run({ date: '2026-11-06' })] });
  assert.equal(result.schedule.counts.unknown, 1);
  assert.equal(result.schedule.counts.done, 0);
  assert.equal(result.running.sessions, 0);
  assert.equal(result.targets.sessions.actual.value, 0);
  assert.equal(result.habits.currentStreak, 0);
});

test('Chuỗi đếm buổi theo thứ tự, ngày nghỉ không ngắt, có thể nhiều buổi/ngày', () => {
  const result = calculate({ workouts: [
    workout({ id: 4, date: '2026-11-04', time: '18:00' }),
    workout({ id: 2, date: '2026-11-02', time: '18:00' }),
    workout({ id: 1, date: '2026-11-02', time: '08:00' }),
    workout({ id: 5, status: 'planned' }),
  ] });
  assert.equal(result.habits.currentStreak, 3);
  assert.equal(result.habits.longestStreak, 3);
  assert.equal(result.habits.activeDays, 2);
});

test('Bỏ lỡ ngắt chuỗi; chạy tự do/tập bù ngày sau không khôi phục lịch cũ', () => {
  const result = calculate({ workouts: [
    workout({ id: 1, date: '2026-10-29' }), workout({ id: 2, date: '2026-10-30' }),
    workout({ id: 3, date: '2026-11-02', status: 'planned' }),
    workout({ id: 4, date: '2026-11-04' }),
  ], runs: [run()] });
  assert.equal(result.habits.currentStreak, 1);
  assert.equal(result.habits.longestStreak, 2);
  assert.equal(result.habits.activeDays, 2);
});

test('Chuỗi bằng 0 nếu buổi đã đánh giá gần nhất là bỏ lỡ', () => {
  const result = calculate({ workouts: [workout({ date: '2026-11-02' }), workout({ id: 2, status: 'missed' })] });
  assert.equal(result.habits.currentStreak, 0);
  assert.equal(result.habits.longestStreak, 1);
});

test('Thứ tự cùng ngày/giờ dùng id; buổi chưa rõ không nối chuỗi chắc chắn', () => {
  const result = calculate({ workouts: [
    workout({ id: 10 }), workout({ id: 2, status: 'missed' }),
    workout({ id: 11, status: 'invalid' }), workout({ id: 12 }),
  ] });
  assert.equal(result.habits.currentStreak, 1);
  assert.equal(result.habits.longestStreak, 1);
  assert.equal(result.habits.streakComplete, false);
});

test('Pace/tốc độ có trọng số, không lấy trung bình từng buổi', () => {
  const result = calculate({ runs: [run({ distanceKm: 1, durationSec: 600 }),
    run({ id: 2, clientId: 'run-2', distanceKm: 9, durationSec: 2700 })] });
  assert.equal(result.running.paceSecPerKm, 330);
  near(result.running.avgSpeedKmh, 10 / (3300 / 3600));
});

test('Cadence tổng theo bước/thời gian, không cộng thời gian tạm dừng', () => {
  const result = calculate({ runs: [run({ steps: 1000, durationSec: 600 }),
    run({ id: 2, clientId: 'run-2', steps: 8000, durationSec: 2400 })] });
  assert.equal(result.running.cadenceSpm, 180);
  assert.equal(result.running.durationSec.value, 3000);
  assert.equal(result.running.pausedSec.value, 120);
});

test('Pace bỏ buổi 0 km hoặc thiếu thời gian, không ghép mẫu số khác tập', () => {
  const result = calculate({ runs: [run(), run({ id: 2, clientId: 'zero', distanceKm: 0, durationSec: 600 }),
    run({ id: 3, clientId: 'missing', distanceKm: 100, durationSec: undefined })] });
  assert.equal(result.running.paceSecPerKm, 600);
  assert.equal(result.running.paceExcluded, 2);
  assert.equal(result.running.distanceKm.value, 103);
  assert.equal(result.running.durationSec.complete, false);
  assert.equal(calculate({ runs: [run({ distanceKm: 0 })] }).running.paceSecPerKm, null);
});

test('Giữ phần tổng hợp hợp lệ và đánh dấu thiếu, không ép null/chuỗi thành 0', () => {
  const result = calculate({ workouts: [workout({ durationMin: 10.25 }),
    workout({ id: 2, durationMin: null, caloriesBurned: '200' }),
    workout({ id: 3, durationMin: -5, caloriesBurned: Infinity }),
    workout({ id: 4, durationMin: 0, caloriesBurned: 0 })] });
  assert.deepEqual(result.schedule.minutes, { value: 10.25, complete: false, missingCount: 2 });
  assert.deepEqual(result.schedule.calories, { value: 200, complete: false, missingCount: 2 });
  near(result.schedule.averageMinutes.value, 5.125);
  assert.equal(calculate({ workouts: [workout({ durationMin: NaN })] }).schedule.minutes.value, null);
});

test('Cộng trước khi làm tròn: hai buổi 31 giây là 62 giây', () => {
  const result = calculate({ runs: [run({ durationSec: 31 }), run({ clientId: 'run-2', durationSec: 31 })] });
  assert.equal(result.running.durationSec.value, 62);
});

test('Server thắng pending cùng clientId bất kể thứ tự, không trộn tài khoản', () => {
  const pending = run({ _queued: true, distanceKm: 1 });
  const server = run({ id: 99, distanceKm: 3 });
  for (const rows of [[pending, server], [server, pending]]) {
    const result = calculate({ runs: [...rows, run({ userId: 2, distanceKm: 100 })] });
    assert.equal(result.running.sessions, 1);
    assert.equal(result.running.queuedCount, 0);
    assert.equal(result.running.distanceKm.value, 3);
  }
});

test('Buổi chờ đồng bộ có chủ rõ được tính, queue không rõ chủ bị loại', () => {
  const result = calculate({ runs: [run({ _queued: true }), run({ clientId: 'old', userId: undefined, _queued: true })] });
  assert.equal(result.running.sessions, 1);
  assert.equal(result.running.queuedCount, 1);
});

test('Thiếu clientId dự phòng id, không nhầm tiền tố id với clientId', () => {
  assert.equal(deduplicateStatisticsRuns([run({ clientId: undefined }), run({ clientId: undefined })], 1).length, 1);
  assert.equal(deduplicateStatisticsRuns([run({ clientId: 'id:1' }), run({ clientId: undefined })], 1).length, 2);
});

test('Chưa kết thúc/giờ sai không được coi là buổi chạy hoàn thành', () => {
  const result = calculate({ runs: [run({ endedAt: undefined }),
    run({ clientId: 'invalid', endedAt: 'bad' }),
    run({ clientId: 'reverse', endedAt: '2026-11-05T00:00:00Z' }),
    run({ clientId: 'no-zone', endedAt: '2026-11-05T02:00:00' })] });
  assert.equal(result.running.sessions, 0);
  assert.equal(result.running.incompleteRecords, 4);
});

test('Thời điểm không tồn tại không được Date.parse chuẩn hóa thành buổi hợp lệ', () => {
  const result = calculate({ runs: [run({ endedAt: '2026-11-05T24:00:00Z' }),
    run({ clientId: 'bad-date', endedAt: '2026-02-30T01:30:00Z' })] });
  assert.equal(result.running.sessions, 0);
  assert.equal(result.running.incompleteRecords, 2);
});

test('Buổi qua nửa đêm theo ngày bắt đầu, không tự phân bổ sang ngày sau', () => {
  const result = calculate({ kind: 'day', runs: [run({ date: '2026-11-04',
    startedAt: '2026-11-04T23:50:00+07:00', endedAt: '2026-11-05T00:20:00+07:00' })] });
  assert.equal(result.running.sessions, 0);
  assert.equal(result.latestRun.date, '2026-11-04');
});

test('Buổi xa nhất đồng hạng chọn buổi mới nhất, latest theo giờ thực', () => {
  const result = calculate({ runs: [run({ id: 2, clientId: 'new', startedAt: '2026-11-05T02:00:00Z', endedAt: '2026-11-05T02:30:00Z' }), run()] });
  assert.equal(result.running.longest.clientId, 'new');
  assert.equal(result.running.latest.clientId, 'new');
});

test('Cân gần nhất ưu tiên lịch sử, bỏ ngày tương lai và cân không hợp lệ', () => {
  const result = calculate({ profiles: [profile({ weightKg: 100 })], weights: [
    weight({ id: 1, date: '2026-11-02', weightKg: 59 }), weight({ id: 2, weightKg: 60 }),
    weight({ id: 3, date: '2026-11-06', weightKg: 200 }), weight({ id: 4, weightKg: -10 }),
  ] });
  assert.equal(result.weight.currentKg, 60);
  assert.equal(result.weight.source, 'history');
  assert.equal(result.weight.recordedDate, today);
  assert.equal(result.weight.changeKg, 1);
  assert.equal(result.weight.bmi, 19.6);
  assert.equal(result.weight.bmiGroup, 'normal');
});

test('Fallback hồ sơ không bịa ngày cân; thiếu chiều cao không phân loại BMI', () => {
  const result = calculate({ profiles: [profile({ heightCm: 0 })] });
  assert.equal(result.weight.currentKg, 60);
  assert.equal(result.weight.source, 'profile');
  assert.equal(result.weight.recordedDate, null);
  assert.equal(result.weight.bmi, null);
  assert.equal(result.weight.bmiGroup, null);
  assert.equal(result.weight.changeKg, null);
});

test('Cân cùng ngày chọn id lớn nhất, biểu đồ không nội suy ngày trống', () => {
  const result = calculate({ weights: [weight({ id: '10', weightKg: 61 }), weight({ id: '2', weightKg: 60 }),
    weight({ id: '1', date: '2026-11-02', weightKg: 59 })] });
  assert.equal(result.weight.currentKg, 61);
  assert.deepEqual(result.weight.points, [{ date: '2026-11-02', weightKg: 59 }, { date: today, weightKg: 61 }]);
  assert.equal(result.weight.changeKg, 2);
});

test('Biến động cân cần hai ngày trong kỳ, cân gần nhất không bị giới hạn bởi kỳ biểu đồ', () => {
  const result = calculate({ kind: 'month', anchor: '2026-10-15', weights: [weight()] });
  assert.equal(result.weight.currentKg, 60);
  assert.equal(result.weight.points.length, 0);
  assert.equal(result.weight.changeKg, null);
});

test('BMI phân nhóm đúng tại các ngưỡng và không làm theo lời khuyên giao diện', () => {
  for (const [kg, expected] of [[18.4, 'thin'], [18.5, 'normal'], [24.9, 'normal'], [25, 'overweight'], [29.9, 'overweight'], [30, 'obese']]) {
    const result = calculate({ profiles: [profile({ heightCm: 100, weightKg: kg })] });
    assert.equal(result.weight.bmiGroup, expected);
  }
});

test('Tiến độ tuần chỉ lấy lịch done, không cộng chạy hoặc lịch tuần khác', () => {
  const result = calculate({ kind: 'month', workouts: [workout(), workout({ id: 2, date: '2026-10-30', durationMin: 999 })],
    runs: [run({ durationSec: 36000 })], profiles: [profile()], userGoals: [goal()],
    goals: [{ id: 2, name: 'Tăng cân', code: 'weight_gain' }] });
  assert.equal(result.targets.minutes.actual.value, 30);
  assert.equal(result.targets.minutes.percent, 20);
  assert.equal(result.targets.sessions.actual.value, 1);
  assert.equal(result.targets.sessions.percent, 25);
  assert.equal(result.targets.name, 'Tăng cân');
  assert.equal(result.targets.weightDifferenceKg, -5);
});

test('Vượt cam kết hiển thị % thực tế, thanh chỉ tô tối đa 100%', () => {
  const result = calculate({ workouts: [workout({ durationMin: 180 })], userGoals: [goal()] });
  assert.equal(result.targets.minutes.percent, 120);
  assert.equal(result.targets.minutes.fillPercent, 100);
});

test('Không tự chọn mục tiêu khi có nhiều dòng hoặc đặt cam kết khi dữ liệu thiếu', () => {
  const result = calculate({ userGoals: [goal(), goal({ id: 2 })], profiles: [profile({ sessionsPerWeek: 0 })] });
  assert.equal(result.targets.state, 'ambiguous');
  assert.equal(result.targets.selected, null);
  assert.equal(result.targets.minutes.target, null);
  assert.equal(result.targets.minutes.percent, null);
  assert.equal(result.targets.sessions.percent, null);
  assert.equal(calculate({ userGoals: [goal({ minMinutesPerWeek: -5 })] }).targets.minutes.target, null);
});

test('Tổng thiếu thời lượng không được hiển thị % tiến độ như đã đủ', () => {
  const result = calculate({ workouts: [workout(), workout({ id: 2, durationMin: null })], userGoals: [goal()] });
  assert.equal(result.targets.minutes.actual.value, 30);
  assert.equal(result.targets.minutes.actual.complete, false);
  assert.equal(result.targets.minutes.percent, null);
});

test('Hồ sơ trùng tài khoản không tự chọn dòng đầu', () => {
  const result = calculate({ profiles: [profile(), profile({ id: 2, weightKg: 100 })] });
  assert.equal(result.quality.profileAmbiguous, true);
  assert.equal(result.weight.currentKg, null);
  assert.equal(result.targets.sessions.target, null);
});

test('Nhóm theo nguyên nhãn cơ và giữ buổi mất danh mục', () => {
  const result = calculate({ workouts: [workout(), workout({ id: 2, exerciseId: 99 })],
    exercises: [{ id: 1, name: 'Hít đất', muscleGroup: 'Ngực, tay sau' }] });
  assert.equal(result.schedule.byMuscleGroup.find(row => row.key === 'Ngực, tay sau').sessions, 1);
  assert.equal(result.schedule.byMuscleGroup.length, 2);
  assert.equal(result.schedule.byExercise.find(row => row.key === '99').label, 'Chưa rõ bài tập');
});

test('Dùng danh mục expand hiện có và bỏ expand không khớp khóa ngoại', () => {
  const result = calculate({ workouts: [workout({ exercise: { id: 1, name: 'Plank', muscleGroup: 'Core' } })],
    userGoals: [goal({ goal: { id: 2, name: 'Tăng cân' } })] });
  assert.equal(result.schedule.byExercise[0].label, 'Plank');
  assert.equal(result.targets.name, 'Tăng cân');
  assert.equal(calculate({ workouts: [workout({ exercise: { id: 9, name: 'Sai bài' } })] }).schedule.byExercise[0].label, 'Chưa rõ bài tập');
});

test('Biểu đồ năm nhóm đúng tháng, tổng cột khớp tổng theo nguồn', () => {
  const result = calculate({ kind: 'year', workouts: [workout({ date: '2026-10-31' }), workout()], runs: [run()] });
  assert.equal(result.series.length, 12);
  assert.equal(result.series[9].schedule.minutes.value, 30);
  assert.equal(result.series[10].running.sessions, 1);
  assert.equal(result.series.reduce((total, bucket) => total + bucket.schedule.minutes.value, 0), result.schedule.minutes.value);
  assert.equal(result.series.reduce((total, bucket) => total + bucket.running.distanceKm.value, 0), result.running.distanceKm.value);
});

test('Ngày không dựng cột giờ; tháng không bịa số đo cân', () => {
  const result = calculate({ kind: 'day', workouts: [workout()], runs: [run()] });
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].key, today);
  assert.equal(result.series[0].running.sessions, 1);
});

test('Ngày hoạt động và phân bố thứ chỉ đếm một lần/ngày dù nhiều nguồn', () => {
  const result = calculate({ workouts: [workout(), workout({ id: 2 })], runs: [run()] });
  assert.equal(result.habits.activeDays, 1);
  assert.equal(result.habits.weekdays[3].activeDays, 1); // Thứ Năm
  assert.equal(result.habits.weekdays.reduce((total, row) => total + row.activeDays, 0), 1);
});

test('Ngày sai bị loại khỏi tổng, vẫn được báo chất lượng dữ liệu', () => {
  const result = calculate({ workouts: [workout({ date: '2026-02-30' })], runs: [run({ date: 'bad' })] });
  assert.equal(result.schedule.counts.done, 0);
  assert.equal(result.running.sessions, 0);
  assert.equal(result.quality.invalidWorkoutDates, 1);
  assert.equal(result.quality.invalidRunDates, 1);
});

test('Tính toán không sửa đầu vào và cùng đầu vào luôn cho cùng kết quả', () => {
  const data = freeze(input({ workouts: [workout()], runs: [run()], profiles: [profile()],
    userGoals: [goal()], weights: [weight()] }));
  const before = JSON.stringify(data);
  assert.deepEqual(calculateStatistics(data), calculateStatistics(data));
  assert.equal(JSON.stringify(data), before);
});
