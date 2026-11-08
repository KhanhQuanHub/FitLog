import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateStatistics } from '../domain/statistics/statistics.ts';
import { createStatisticsRepository } from './statisticsRepository.ts';

// Chỉ đọc bản dữ liệu hiện có vào bộ nhớ; không import bất kỳ script dựng server/DB nào.
const path = new URL('../fitlog-server/db.json', import.meta.url);
const original = readFileSync(path);
const fingerprint = bytes => createHash('sha256').update(bytes).digest('hex');
const db = JSON.parse(original.toString('utf8'));
const tables = ['workouts', 'runs', 'profiles', 'weights', 'userGoals'];
const data = { ...db, weights: db.weightHistory, queue: [], cache: [] };
const before = JSON.stringify(data);
const today = '2026-11-05';
const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const sum = (rows, field) => {
  const numbers = rows.map(row => row[field]).filter(validNumber);
  return rows.length && !numbers.length ? null : numbers.reduce((total, value) => total + value, 0);
};
const close = (actual, expected) => expected === null ? assert.equal(actual, null)
  : assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const userIds = [...new Set([...db.users.map(user => String(user.id)), ...tables.flatMap(table => data[table].map(row => String(row.userId)))])];

for (const [index, userId] of userIds.entries()) test(`Dữ liệu hiện có · tài khoản ${index + 1}: lọc chủ, đối chiếu ngày/tuần/tháng/năm và chống queue trùng`, async () => {
  const read = Object.fromEntries([...tables, 'queue', 'cache'].map(key => [key, async () =>
    key === 'queue' ? data.runs.map(row => ({ ...row })) : data[key]]));
  const repository = createStatisticsRepository({ read, getSession: () => ({ userId, revision: 1 }), ownsQueuedRun: () => false });
  try {
    const snapshot = await repository.refresh();
    for (const table of tables) {
      assert.equal(snapshot[table].status, 'success');
      assert.ok(snapshot[table].data.every(row => String(row.userId) === userId));
    }
    assert.equal(snapshot.runs.data.length, data.runs.filter(row => String(row.userId) === userId).length);
    assert.ok(snapshot.runs.data.every(row => row._queued === false));
    const anchors = [...new Set([today, ...data.workouts, ...data.runs].map(value => typeof value === 'string' ? value : value.date))]
      .filter(date => typeof date === 'string' && date <= today);
    for (const anchor of anchors) for (const kind of ['day', 'week', 'month', 'year']) {
      const report = calculateStatistics({ userId, today, kind, anchor, workouts: snapshot.workouts.data,
        runs: snapshot.runs.data, profiles: snapshot.profiles.data, weights: snapshot.weights.data, userGoals: snapshot.userGoals.data });
      const inPeriod = row => String(row.userId) === userId && row.date >= report.period.start && row.date <= report.period.end && row.date <= today;
      const done = data.workouts.filter(row => inPeriod(row) && row.status === 'done');
      const runs = data.runs.filter(row => inPeriod(row) && Number.isFinite(Date.parse(row.startedAt))
        && Number.isFinite(Date.parse(row.endedAt)) && Date.parse(row.endedAt) >= Date.parse(row.startedAt));
      assert.equal(report.schedule.counts.done, done.length);
      close(report.schedule.minutes.value, sum(done, 'durationMin'));
      close(report.schedule.calories.value, sum(done, 'caloriesBurned'));
      assert.equal(report.running.sessions, runs.length);
      close(report.running.distanceKm.value, sum(runs, 'distanceKm'));
      close(report.running.durationSec.value, sum(runs, 'durationSec'));
      close(report.running.calories.value, sum(runs, 'calories'));
      assert.equal(report.series.reduce((total, bucket) => total + bucket.schedule.sessions, 0), done.length);
      assert.equal(report.series.reduce((total, bucket) => total + bucket.running.sessions, 0), runs.length);
      const activeDays = new Set([...done, ...runs].map(row => row.date));
      assert.equal(report.habits.activeDays, activeDays.size);
      assert.equal(report.habits.weekdays.reduce((total, day) => total + day.activeDays, 0), activeDays.size);
      assert.ok(report.running.records.every(row => String(row.userId) === userId));
      for (const value of [report.running.paceSecPerKm, report.running.avgSpeedKmh, report.running.cadenceSpm,
        report.schedule.completionPercent, report.weight.bmi]) {
        assert.ok(value === null || (Number.isFinite(value) && value >= 0));
      }
    }
  } finally { repository.dispose(); }
});

after(() => {
  assert.equal(JSON.stringify(data), before, 'Không sửa dữ liệu đầu vào trong bộ nhớ');
  assert.equal(fingerprint(readFileSync(path)), fingerprint(original), 'Không thay đổi db.json');
});
