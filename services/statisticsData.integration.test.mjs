import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Tái sử dụng cách giả lập native bằng registerHooks đã có trong test-acceptance.
// Không import/chạy test server đó vì script dựng lại database.
const storage = new Map();
const secure = new Map();
const storageWrites = [];
globalThis.__statisticsNativeTest = { storage, secure, storageWrites };
registerHooks({
  resolve(specifier, context, next) {
    if (['react-native', 'expo-constants', 'expo-secure-store', '@react-native-async-storage/async-storage'].includes(specifier)) {
      return { url: `statistics-mock:${specifier}`, shortCircuit: true };
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:') && !/\.[a-z]+$/.test(specifier)) {
      for (const extension of ['.ts', '.js']) {
        const candidate = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}${extension}`);
        if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const result = source => ({ format: 'module', shortCircuit: true, source });
    if (url === 'statistics-mock:react-native') return result("export const Platform = { OS: 'web' };");
    if (url === 'statistics-mock:expo-constants') return result('export default {};');
    if (url === 'statistics-mock:expo-secure-store') return result(`
      const data = globalThis.__statisticsNativeTest.secure;
      export async function isAvailableAsync() { return true; }
      export async function getItemAsync(key) { return data.get(key) ?? null; }
      export async function setItemAsync(key, value) { data.set(key, value); }
      export async function deleteItemAsync(key) { data.delete(key); }
    `);
    if (url === 'statistics-mock:@react-native-async-storage/async-storage') return result(`
      const { storage: data, storageWrites: writes } = globalThis.__statisticsNativeTest;
      export default {
        async getItem(key) { return data.get(key) ?? null; },
        async setItem(key, value) { writes.push(['set', key]); data.set(key, value); },
        async removeItem(key) { writes.push(['remove', key]); data.delete(key); }
      };
    `);
    return next(url, context);
  },
});

const api = await import('./api.js');
const runRepo = await import('./runRepository.js');
const { useAuthStore } = await import('../store/authStore.ts');
const { createFitLogStatisticsData } = await import('./statisticsData.ts');
const { getStatisticsSession, ownsQueuedRun } = await import('./statisticsSession.js');
const { calculateStatistics } = await import('../domain/statistics/statistics.ts');
const { default: nativeStorage } = await import('@react-native-async-storage/async-storage');
const originalFetch = globalThis.fetch;
let requests;
let responses;
let active;
let offline;
let responseStatus;
const run = (changes = {}) => ({
  clientId: 'session-run', date: '2026-11-05', startedAt: '2026-11-05T01:00:00Z', endedAt: '2026-11-05T01:30:00Z',
  durationSec: 1800, pausedSec: 0, steps: 4500, distanceKm: 3, calories: 200, ...changes,
});
const tick = () => new Promise(resolve => setImmediate(resolve));
async function login(userId) {
  // Token fixture, không phải bí mật/khóa của dịch vụ thật.
  const body = Buffer.from(JSON.stringify({ id: userId, role: 'user' })).toString('base64url');
  await api.setAuthToken(`${body}.test-signature`);
  useAuthStore.setState({ isLoggedIn: true, user: { id: String(userId) } });
}
function count(snapshot) {
  return calculateStatistics({ userId: 1, today: '2026-11-05', kind: 'day', anchor: '2026-11-05',
    runs: snapshot.runs.data ?? [], workouts: [], profiles: [], weights: [], userGoals: [] }).running;
}
beforeEach(async () => {
  await api.clearAuthToken();
  useAuthStore.setState({ isLoggedIn: false, user: null });
  storage.clear();
  secure.clear();
  storageWrites.length = 0;
  requests = [];
  responses = { '/runs': [], '/workouts': [], '/profiles': [], '/weightHistory': [], '/userGoals': [] };
  offline = false;
  responseStatus = 200;
  runRepo.configureRunRepository({ storage: nativeStorage, api: { saveRun: api.saveRun } });
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    requests.push({ path, method: options.method ?? 'GET' });
    if (offline) throw new TypeError('Mock offline');
    return new Response(JSON.stringify(responses[path] ?? []), { status: responseStatus });
  };
});
afterEach(() => {
  active?.dispose();
  active = undefined;
  globalThis.fetch = originalFetch;
});

test('Adapter thật chỉ dùng GET và getItem, đọc hết bảng hồ sơ trước khi lọc tài khoản', async () => {
  await login(1);
  responses['/profiles'] = [{ id: 9, userId: 2 }, { id: 1, userId: 1, weightKg: 60 }];
  active = createFitLogStatisticsData();
  const result = await active.refresh();
  assert.deepEqual(requests.map(item => item.path).sort(), ['/profiles', '/runs', '/userGoals', '/weightHistory', '/workouts']);
  assert.ok(requests.every(item => item.method === 'GET'));
  assert.deepEqual(storageWrites, []);
  assert.equal(result.profiles.data.length, 1);
  assert.equal(result.profiles.data[0].userId, 1);
});

test('Lưu queue bằng luồng hiện có tạo provenance RAM, không thêm trường vào payload', async () => {
  await login(1);
  const record = run();
  await runRepo.enqueueRun(record);
  const stored = JSON.parse(storage.get(runRepo.STORAGE_KEYS.QUEUE));
  assert.deepEqual(stored, [record]);
  assert.equal(Object.hasOwn(stored[0], 'userId'), false);
  assert.equal(ownsQueuedRun(record.clientId, getStatisticsSession()), true);
  active = createFitLogStatisticsData();
  const result = await active.refresh();
  assert.equal(count(result).sessions, 1);
  assert.equal(count(result).queuedCount, 1);
});

test('Queue cũ không có userId từ trước đăng nhập không nhận chủ bằng suy đoán', async () => {
  storage.set(runRepo.STORAGE_KEYS.QUEUE, JSON.stringify([run()]));
  await login(1);
  active = createFitLogStatisticsData();
  const result = await active.refresh();
  assert.equal(count(result).sessions, 0);
  assert.ok(result.runs.issues.includes('unknown-owners:1'));
  assert.equal(storage.get(runRepo.STORAGE_KEYS.QUEUE), JSON.stringify([run()]));
});

test('Khi refresh một clientId đã tồn tại từ phiên cũ thì không tự nhận lại chủ', async () => {
  storage.set(runRepo.STORAGE_KEYS.QUEUE, JSON.stringify([run()]));
  await login(1);
  await runRepo.enqueueRun(run({ distanceKm: 4 }));
  assert.equal(ownsQueuedRun('session-run', getStatisticsSession()), false);
});

test('Đang mở thống kê, enqueue buổi mới tự làm mới và tính ngay khi offline', async () => {
  await login(1);
  active = createFitLogStatisticsData();
  await active.refresh();
  offline = true;
  await runRepo.enqueueRun(run());
  await tick();
  const snapshot = active.getSnapshot();
  assert.equal(snapshot.runs.status, 'error');
  assert.equal(count(snapshot).sessions, 1);
  assert.equal(count(snapshot).queuedCount, 1);
});

test('Queue và server cùng buổi chỉ tính một; sau đồng bộ không tăng tổng', async () => {
  await login(1);
  await runRepo.enqueueRun(run());
  active = createFitLogStatisticsData();
  const before = await active.refresh();
  responses['/runs'] = [run({ id: 99, userId: 1 })];
  const overlap = await active.refresh();
  await runRepo.removeQueuedRun('session-run');
  const after = await active.refresh();
  for (const snapshot of [before, overlap, after]) {
    assert.equal(count(snapshot).sessions, 1);
    assert.equal(count(snapshot).durationSec.value, 1800);
    assert.equal(count(snapshot).calories.value, 200);
  }
  assert.equal(count(before).queuedCount, 1);
  assert.equal(count(after).queuedCount, 0);
});

test('finishAndSaveRun offline rồi syncQueuedRuns: tổng giữ nguyên và payload không đổi', async () => {
  await login(1);
  const record = run();
  let reachable = false;
  runRepo.configureRunRepository({ api: { saveRun: async payload => {
    assert.deepEqual(payload, record);
    if (!reachable) throw Object.assign(new Error('Offline giả lập'), { status: 0 });
    const saved = { ...payload, id: 99, userId: 1 };
    responses['/runs'] = [saved];
    return saved;
  } } });
  const queued = await runRepo.finishAndSaveRun(record, { backoffDelaysMs: [] });
  assert.equal(queued.status, 'queued');
  active = createFitLogStatisticsData();
  const before = await active.refresh();
  assert.equal(count(before).queuedCount, 1);
  reachable = true;
  const synced = await runRepo.syncQueuedRuns();
  assert.equal(synced.syncedCount, 1);
  assert.equal(synced.remainingCount, 0);
  const after = await active.refresh();
  assert.equal(count(after).sessions, 1);
  assert.equal(count(after).durationSec.value, count(before).durationSec.value);
  assert.equal(count(after).calories.value, count(before).calories.value);
  assert.equal(count(after).queuedCount, 0);
  assert.ok(requests.every(item => item.method === 'GET'));
});

test('Server lưu thành công nhưng mất phản hồi: queue còn đó vẫn chỉ tính một buổi', async () => {
  await login(1);
  let acknowledge = false;
  runRepo.configureRunRepository({ api: { saveRun: async payload => {
    const saved = { ...payload, id: 99, userId: 1 };
    responses['/runs'] = [saved]; // Dịch vụ giả lập ghi idempotent theo clientId.
    if (!acknowledge) throw Object.assign(new Error('Mất phản hồi giả lập'), { status: 0 });
    return saved;
  } } });
  await runRepo.finishAndSaveRun(run(), { backoffDelaysMs: [] });
  active = createFitLogStatisticsData();
  const overlap = await active.refresh();
  assert.equal(count(overlap).sessions, 1);
  assert.equal(count(overlap).queuedCount, 0);
  acknowledge = true;
  await runRepo.syncQueuedRuns();
  const after = await active.refresh();
  assert.equal(count(after).sessions, 1);
  assert.equal(count(after).calories.value, 200);
  assert.equal(responses['/runs'].length, 1);
});

test('Đổi người khi ghi queue còn chờ không gán buổi của phiên cũ cho người mới', async () => {
  await login(1);
  let release;
  const pendingWrite = new Promise(resolve => { release = resolve; });
  runRepo.configureRunRepository({ storage: { ...nativeStorage, setItem: async (key, value) => {
    if (key === runRepo.STORAGE_KEYS.QUEUE) await pendingWrite;
    await nativeStorage.setItem(key, value);
  } } });
  const enqueue = runRepo.enqueueRun(run());
  await tick();
  await api.clearAuthToken();
  await login(2);
  release();
  await enqueue;
  assert.equal(ownsQueuedRun('session-run', getStatisticsSession()), false);
  active = createFitLogStatisticsData();
  const result = await active.refresh();
  assert.equal(result.runs.data.length, 0);
  assert.ok(result.runs.issues.includes('unknown-owners:1'));
});

test('Logout rồi login cùng tài khoản không nhận queue thiếu chủ của phiên cũ', async () => {
  await login(1);
  await runRepo.enqueueRun(run());
  active = createFitLogStatisticsData();
  await active.refresh();
  useAuthStore.getState().logout();
  assert.equal(active.getSnapshot().runs.data, null);
  await login(1);
  const result = await active.refresh();
  assert.equal(count(result).sessions, 0);
  assert.ok(result.runs.issues.includes('unknown-owners:1'));
});

test('Đổi tài khoản không lộ cache hoặc queue của người trước', async () => {
  await login(1);
  await runRepo.enqueueRun(run());
  storage.set(runRepo.STORAGE_KEYS.HISTORY_CACHE, JSON.stringify([run({ id: 1, userId: 1 })]));
  active = createFitLogStatisticsData();
  await active.refresh();
  await api.clearAuthToken();
  await login(2);
  offline = true;
  const result = await active.refresh();
  assert.equal(result.session.userId, '2');
  assert.equal(result.runs.data, null);
});

test('SecureStore khôi phục token cập nhật định danh cho queue trong phiên mới', async () => {
  const body = Buffer.from(JSON.stringify({ id: 1 })).toString('base64url');
  secure.set('figlog_auth_token', `${body}.test-signature`);
  await api.getAuthToken();
  assert.equal(getStatisticsSession().userId, '1');
  await runRepo.enqueueRun(run());
  assert.equal(ownsQueuedRun('session-run', getStatisticsSession()), true);
});

test('401 từ request thật xóa số liệu của phiên cũ, không dùng cache bù vào', async () => {
  await login(1);
  responses['/runs'] = [run({ id: 1, userId: 1 })];
  active = createFitLogStatisticsData();
  await active.refresh();
  responseStatus = 401;
  await active.refresh();
  assert.equal(active.getSnapshot().runs.data, null);
  assert.equal(active.getSnapshot().session.userId, null);
});

test('Storage JSON hỏng được báo riêng, vẫn giữ dữ liệu mạng', async () => {
  await login(1);
  responses['/runs'] = [run({ id: 1, userId: 1 })];
  storage.set(runRepo.STORAGE_KEYS.QUEUE, '{broken');
  active = createFitLogStatisticsData();
  const result = await active.refresh();
  assert.equal(count(result).sessions, 1);
  assert.equal(result.runs.complete, false);
  assert.ok(result.runs.issues.includes('queue-read-failed'));
  assert.equal(storage.get(runRepo.STORAGE_KEYS.QUEUE), '{broken');
});
