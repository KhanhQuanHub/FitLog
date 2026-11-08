import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStatisticsRepository, mergeStatisticsRuns, parseStatisticsStorage } from './statisticsRepository.ts';
import { calculateStatistics } from '../domain/statistics/statistics.ts';
import {
  getStatisticsSession, setStatisticsIdentity, rememberQueuedRunOwner, ownsQueuedRun,
} from './statisticsSession.js';

const run = (changes = {}) => ({
  id: 1, clientId: 'r1', userId: 1, date: '2026-11-05',
  startedAt: '2026-11-05T01:00:00Z', endedAt: '2026-11-05T01:30:00Z',
  durationSec: 1800, pausedSec: 0, distanceKm: 3, steps: 4500, calories: 200, ...changes,
});
const fail = (status = 0) => Promise.reject(Object.assign(new Error('Thông tin lỗi nội bộ không được lộ'), { status }));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
  let session = { userId: '1', revision: 1 };
  let sessionListener;
  let runListener;
  const read = Object.fromEntries(['workouts', 'runs', 'profiles', 'weights', 'userGoals', 'queue', 'cache'].map(key => [key, async () => []]));
  Object.assign(read, overrides);
  const repo = createStatisticsRepository({
    read, getSession: () => session, ownsQueuedRun: () => false, now: () => 100,
    subscribeSession: listener => { sessionListener = listener; return () => { sessionListener = undefined; }; },
    subscribeRuns: listener => { runListener = listener; return () => { runListener = undefined; }; },
  });
  return { repo, read, session: value => { session = value; },
    notifySession: () => sessionListener?.(), notifyRuns: () => runListener?.() };
}

test('Chưa tải có data=null; mảng rỗng thành công mới là dữ liệu rỗng', async () => {
  const { repo } = fixture();
  assert.equal(repo.getSnapshot().runs.status, 'idle');
  assert.equal(repo.getSnapshot().runs.data, null);
  const result = await repo.refresh();
  for (const key of ['workouts', 'runs', 'profiles', 'weights', 'userGoals']) {
    assert.equal(result[key].status, 'success');
    assert.deepEqual(result[key].data, []);
    assert.equal(result[key].complete, true);
    assert.equal(result[key].updatedAt, 100);
  }
});

test('Các nguồn tải độc lập, không chờ nguồn chậm để hiển thị nguồn đã xong', async () => {
  const pending = deferred();
  const { repo } = fixture({ workouts: () => pending.promise, runs: async () => [run()] });
  const loaded = repo.refresh();
  assert.equal(repo.getSnapshot().workouts.status, 'loading');
  await tick();
  assert.equal(repo.getSnapshot().runs.status, 'success');
  assert.equal(repo.getSnapshot().workouts.status, 'loading');
  pending.resolve([]);
  await loaded;
});

test('Một nguồn lỗi không biến thành [] và không làm mất nguồn khác', async () => {
  const { repo } = fixture({ workouts: () => fail(500), runs: async () => [run()] });
  const result = await repo.refresh();
  assert.equal(result.workouts.status, 'error');
  assert.equal(result.workouts.data, null);
  assert.equal(result.workouts.error.kind, 'server');
  assert.equal(result.runs.data.length, 1);
  assert.equal(result.runs.status, 'success');
});

test('Làm mới thất bại giữ dữ liệu đã tải, đánh dấu stale và thời điểm cũ', async () => {
  const f = fixture({ workouts: async () => [{ id: 1, userId: 1, status: 'done' }], runs: async () => [run()] });
  await f.repo.refresh();
  f.read.workouts = () => fail();
  f.read.runs = () => fail();
  const result = await f.repo.refresh();
  assert.equal(result.workouts.data.length, 1);
  assert.equal(result.workouts.status, 'error');
  assert.equal(result.workouts.stale, true);
  assert.equal(result.runs.data.length, 1);
  assert.equal(result.runs.complete, false);
  assert.equal(result.runs.updatedAt, 100);
});

test('Response sai kiểu và hàng primitive là lỗi dữ liệu, không là mảng rỗng', async () => {
  for (const wrong of [null, {}, { data: [] }, [null], [1], [[]]]) {
    const { repo } = fixture({ workouts: async () => wrong, runs: async () => wrong });
    const result = await repo.refresh();
    assert.equal(result.workouts.error.kind, 'data');
    assert.equal(result.runs.error.kind, 'data');
    assert.equal(result.runs.data, null);
  }
});

test('Thông báo lỗi đã chuẩn hóa, không lộ message gốc', async () => {
  for (const [status, kind] of [[401, 'auth'], [403, 'auth'], [408, 'timeout'], [503, 'server'], [0, 'network']]) {
    const { repo } = fixture({ weights: () => fail(status) });
    const result = await repo.refresh();
    assert.equal(result.weights.error.kind, kind);
    assert.equal(result.weights.error.retryable, kind !== 'auth');
    assert.equal(JSON.stringify(result).includes('Thông tin lỗi nội bộ'), false);
  }
});

test('Tất cả bảng cá nhân được lọc userId, kể cả response của admin', async () => {
  const mixed = [{ id: 1, userId: '1' }, { id: 2, userId: 2 }];
  const { repo } = fixture({
    workouts: async () => mixed, profiles: async () => mixed,
    weights: async () => mixed, userGoals: async () => mixed,
    runs: async () => [run(), run({ userId: 2, clientId: 'other' })],
  });
  const result = await repo.refresh();
  for (const key of ['workouts', 'runs', 'profiles', 'weights', 'userGoals']) assert.equal(result[key].data.length, 1);
});

test('Đăng xuất xóa ngay snapshot; phản hồi cũ về trễ không khôi phục dữ liệu', async () => {
  const delayed = deferred();
  const f = fixture({ runs: () => delayed.promise });
  const loading = f.repo.refresh();
  f.session({ userId: null, revision: 2 });
  f.notifySession();
  assert.equal(f.repo.getSnapshot().runs.data, null);
  delayed.resolve([run()]);
  await loading;
  assert.equal(f.repo.getSnapshot().runs.data, null);
  assert.equal(f.repo.getSnapshot().session.userId, null);
});

test('Đổi tài khoản, phản hồi cũ không ghi đè tài khoản mới', async () => {
  const old = deferred();
  const f = fixture({ runs: () => old.promise });
  const first = f.repo.refresh();
  f.session({ userId: '2', revision: 2 });
  f.read.runs = async () => [run({ userId: 2, clientId: 'new-account' })];
  await f.repo.refresh();
  old.resolve([run()]);
  await first;
  assert.equal(f.repo.getSnapshot().runs.data[0].clientId, 'new-account');
  assert.equal(f.repo.getSnapshot().session.userId, '2');
});

test('Đăng xuất rồi đăng nhập cùng id vẫn không dùng dữ liệu từ phiên cũ', async () => {
  const f = fixture({ runs: async () => [run()] });
  await f.repo.refresh();
  f.session({ userId: '1', revision: 3 });
  assert.equal(f.repo.getSnapshot().runs.data, null);
});

test('Hai refresh đồng thời chỉ nhận kết quả của yêu cầu mới nhất', async () => {
  const old = deferred();
  const f = fixture({ runs: () => old.promise });
  const first = f.repo.refresh();
  f.read.runs = async () => [run({ clientId: 'latest' })];
  await f.repo.refresh();
  old.resolve([run({ clientId: 'old' })]);
  await first;
  assert.equal(f.repo.getSnapshot().runs.data[0].clientId, 'latest');
});

test('Không có phiên thì không gọi API/storage', async () => {
  const f = fixture(Object.fromEntries(['workouts', 'runs', 'profiles', 'weights', 'userGoals', 'queue', 'cache'].map(key => [key, () => { throw new Error('Không được gọi'); }])));
  f.session({ userId: null, revision: 2 });
  const result = await f.repo.refresh();
  assert.equal(result.runs.status, 'idle');
});

test('Queue có chủ được tính ngay, queue khác chủ bị bỏ', async () => {
  const { repo } = fixture({ queue: async () => [run({ _queued: true }), run({ userId: 2, clientId: 'other' })] });
  const result = await repo.refresh();
  assert.equal(result.runs.data.length, 1);
  assert.equal(result.runs.data[0]._queued, true);
  assert.equal(result.runs.origin, 'mixed');
});

test('Mạng còn chờ: dữ liệu local đã xuất hiện trước khi API kết thúc', async () => {
  const network = deferred();
  const { repo } = fixture({ runs: () => network.promise, queue: async () => [run()] });
  const loaded = repo.refresh();
  await tick();
  const local = repo.getSnapshot().runs;
  assert.equal(local.status, 'loading');
  assert.equal(local.complete, false);
  assert.equal(local.data.length, 1);
  assert.equal(local.data[0]._queued, true);
  network.resolve([run({ id: 99 })]);
  const final = await loaded;
  assert.equal(final.runs.data.length, 1);
  assert.equal(final.runs.data[0]._queued, false);
  assert.equal(final.runs.status, 'success');
});

test('Phản hồi local và mạng đến sau logout đều không phục hồi dữ liệu', async () => {
  const network = deferred();
  const queue = deferred();
  const f = fixture({ runs: () => network.promise, queue: () => queue.promise });
  const loaded = f.repo.refresh();
  f.session({ userId: null, revision: 2 });
  f.notifySession();
  queue.resolve([run()]);
  await tick();
  assert.equal(f.repo.getSnapshot().runs.data, null);
  network.resolve([run()]);
  await loaded;
  assert.equal(f.repo.getSnapshot().runs.data, null);
});

test('Queue cũ thiếu chủ không được gán cho người đang đăng nhập', async () => {
  const unknown = run({ userId: undefined });
  const { repo } = fixture({ queue: async () => [unknown] });
  const result = await repo.refresh();
  assert.deepEqual(result.runs.data, []);
  assert.equal(result.runs.complete, false);
  assert.ok(result.runs.issues.includes('unknown-owners:1'));
  assert.equal(unknown.userId, undefined);
});

test('Dấu vết phiên RAM nhận được queue mới thiếu userId, không sửa payload', async () => {
  const unknown = Object.freeze(run({ userId: undefined }));
  const repo = createStatisticsRepository({
    getSession: () => ({ userId: '1', revision: 1 }),
    ownsQueuedRun: (client, session) => client === 'r1' && session.revision === 1,
    read: { ...fixture().read, queue: async () => [unknown] },
  });
  const result = await repo.refresh();
  assert.equal(result.runs.data.length, 1);
  assert.equal(result.runs.data[0].userId, '1');
  assert.equal(result.runs.data[0]._queued, true);
  assert.equal(unknown.userId, undefined);
});

test('Server thắng queue cùng clientId dù khác id hoặc khác giá trị', async () => {
  const { repo } = fixture({ runs: async () => [run({ id: 99, distanceKm: 5 })], queue: async () => [run({ distanceKm: 3 })] });
  const result = await repo.refresh();
  assert.equal(result.runs.data.length, 1);
  assert.equal(result.runs.data[0].distanceKm, 5);
  assert.equal(result.runs.data[0]._queued, false);
});

test('Sau đồng bộ tổng không tăng, nhãn queued được bỏ', async () => {
  const f = fixture({ queue: async () => [run()] });
  const before = await f.repo.refresh();
  f.read.queue = async () => [];
  f.read.runs = async () => [run({ id: 99 })];
  const after = await f.repo.refresh();
  function totals(snapshot) {
    return calculateStatistics({ userId: 1, today: '2026-11-05', kind: 'day', anchor: '2026-11-05',
      runs: snapshot.runs.data, workouts: [], profiles: [], weights: [], userGoals: [] }).running;
  }
  assert.equal(totals(before).sessions, 1);
  assert.equal(totals(after).sessions, 1);
  assert.equal(totals(before).calories.value, totals(after).calories.value);
  assert.equal(totals(after).queuedCount, 0);
});

test('Ghép clientId/id bắc cầu, dự phòng id và không trộn hai người', () => {
  const result = mergeStatisticsRuns([
    [run({ id: 10, clientId: undefined, distanceKm: 5 })],
    [run({ id: undefined }), run({ id: 10 })],
    [run({ userId: 2, id: 10 })],
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].distanceKm, 5);
  assert.equal(result[1].userId, 2);
});

test('Chạy khác clientId cùng ngày/thời gian vẫn là hai buổi riêng', async () => {
  const { repo } = fixture({ runs: async () => [run(), run({ id: 2, clientId: 'r2' })] });
  assert.equal((await repo.refresh()).runs.data.length, 2);
});

test('API đọc toàn bộ: hơn 20/50/60 buổi không bị cắt ở trang/cache', async () => {
  const all = Array.from({ length: 125 }, (_, index) => run({ id: index, clientId: `r${index}` }));
  const { repo } = fixture({ runs: async () => all, cache: async () => all.slice(0, 20) });
  const result = await repo.refresh();
  assert.equal(result.runs.data.length, 125);
  assert.equal(result.runs.complete, true);
});

test('Mất mạng dùng cache đúng chủ kèm trạng thái lỗi/chưa đầy đủ', async () => {
  const { repo } = fixture({ runs: () => fail(), cache: async () => [run(), run({ userId: 2, clientId: 'other' })] });
  const result = await repo.refresh();
  assert.equal(result.runs.status, 'error');
  assert.equal(result.runs.origin, 'cache');
  assert.equal(result.runs.complete, false);
  assert.equal(result.runs.stale, true);
  assert.equal(result.runs.updatedAt, null);
  assert.equal(result.runs.data.length, 1);
});

test('Offline không có dữ liệu tin cậy thì null, không khẳng định tổng bằng 0', async () => {
  const { repo } = fixture({ runs: () => fail(), cache: async () => [run({ userId: undefined })] });
  const result = await repo.refresh();
  assert.equal(result.runs.data, null);
  assert.equal(result.runs.complete, false);
  assert.ok(result.runs.issues.includes('unknown-owners:1'));
});

test('Offline cache và queue cùng buổi vẫn chỉ có một bản, bản đã lưu thắng', async () => {
  const { repo } = fixture({ runs: () => fail(), cache: async () => [run()], queue: async () => [run()] });
  const result = await repo.refresh();
  assert.equal(result.runs.data.length, 1);
  assert.equal(result.runs.data[0]._queued, false);
});

test('Memory mới ưu tiên cache cũ khi mất mạng', async () => {
  const f = fixture({ runs: async () => [run({ distanceKm: 5 })], cache: async () => [run({ distanceKm: 1 })] });
  await f.repo.refresh();
  f.read.runs = () => fail();
  const result = await f.repo.refresh();
  assert.equal(result.runs.data[0].distanceKm, 5);
  assert.equal(result.runs.origin, 'memory');
});

test('JSON hỏng, storage lỗi và queue sai cấu trúc không được nuốt thành []', async () => {
  assert.deepEqual(parseStatisticsStorage(null), []);
  assert.throws(() => parseStatisticsStorage('{broken'));
  for (const queue of [async () => parseStatisticsStorage('{bad'), () => fail(), async () => ({ bad: true })]) {
    const { repo } = fixture({ runs: async () => [run()], queue });
    const result = await repo.refresh();
    assert.equal(result.runs.data.length, 1);
    assert.equal(result.runs.complete, false);
    assert.ok(result.runs.issues.includes('queue-read-failed'));
  }
});

test('Queue đọc lỗi vẫn giữ pending trong RAM và đánh dấu stale', async () => {
  const f = fixture({ queue: async () => [run()] });
  await f.repo.refresh();
  f.read.queue = () => fail();
  const result = await f.repo.refresh();
  assert.equal(result.runs.data.length, 1);
  assert.equal(result.runs.data[0]._queued, true);
  assert.equal(result.runs.stale, true);
});

test('Cache lỗi không làm giảm độ đầy đủ khi server và queue đã đọc đủ', async () => {
  const { repo } = fixture({ runs: async () => [run()], cache: () => fail() });
  const result = await repo.refresh();
  assert.equal(result.runs.complete, true);
  assert.equal(result.runs.error, null);
});

test('Bản không có mã nhận diện bị loại và báo rõ thay vì đếm trùng', async () => {
  const { repo } = fixture({ runs: async () => [run({ id: undefined, clientId: undefined })] });
  const result = await repo.refresh();
  assert.equal(result.runs.data.length, 0);
  assert.equal(result.runs.complete, false);
  assert.ok(result.runs.issues.includes('unidentified-runs:1'));
});

test('Thông báo queue thay đổi tự làm mới sau lần tải đầu', async () => {
  const f = fixture();
  await f.repo.refresh();
  f.read.queue = async () => [run()];
  f.notifyRuns();
  await tick();
  assert.equal(f.repo.getSnapshot().runs.data.length, 1);
});

test('Dispose hủy đăng ký và không nhận phản hồi đến muộn', async () => {
  const pending = deferred();
  const f = fixture({ runs: () => pending.promise });
  let notifications = 0;
  f.repo.subscribe(() => { notifications += 1; });
  const loading = f.repo.refresh();
  f.repo.dispose();
  const afterDispose = notifications;
  pending.resolve([run()]);
  await loading;
  f.notifyRuns();
  assert.equal(f.repo.getSnapshot().runs.data, null);
  assert.equal(f.repo.getSnapshot().session.userId, null);
  assert.equal(notifications, afterDispose);
});

test('Provenance RAM không sống qua logout/đổi người, bỏ capture từ phiên cũ', () => {
  setStatisticsIdentity('1');
  const first = getStatisticsSession();
  rememberQueuedRunOwner('a', first);
  assert.equal(ownsQueuedRun('a', first), true);
  setStatisticsIdentity(null);
  setStatisticsIdentity('1');
  const second = getStatisticsSession();
  assert.equal(ownsQueuedRun('a', first), false);
  rememberQueuedRunOwner('old', first);
  assert.equal(ownsQueuedRun('old', second), false);
  setStatisticsIdentity('2');
  assert.equal(ownsQueuedRun('a', getStatisticsSession()), false);
  setStatisticsIdentity(null);
});
