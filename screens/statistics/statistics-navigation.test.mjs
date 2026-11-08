import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import { h, act, render } from '../../test-support/statisticsUiHarness.mjs';

// Kiểm thử adapter và hành vi UI với Navigation spy; bundle Metro kiểm tra tích hợp package thật.
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/navigation/RootNavigator.tsx')) {
      if (specifier === '../store/authStore' || specifier === '../store/locationStore' || specifier === '../store/TrainingContext') {
        return { url: `statistics-router:${specifier}`, shortCircuit: true };
      }
      if (specifier.startsWith('../screens/') || specifier === './MainTabs') {
        return { url: 'statistics-router:dummy-screen', shortCircuit: true };
      }
    }
    if (context.parentURL?.endsWith('/navigation/MainTabs.tsx')) {
      if (specifier.startsWith('../screens/') || specifier === './StatisticsNavigator') {
        return { url: 'statistics-router:dummy-screen', shortCircuit: true };
      }
    }
    if (specifier === '@react-navigation/native' || specifier === '@react-navigation/native-stack' || specifier === '@react-navigation/bottom-tabs' || specifier === '@expo/vector-icons') {
      return { url: `statistics-router:${specifier}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'statistics-router:dummy-screen') {
      return { format: 'module', shortCircuit: true, source: 'export default () => null;' };
    }
    if (url === 'statistics-router:../store/authStore') {
      return { format: 'module', shortCircuit: true, source: 'export const useAuthStore = selector => selector(globalThis.statsRouter.auth);' };
    }
    if (url === 'statistics-router:../store/locationStore') {
      return { format: 'module', shortCircuit: true, source: 'export const useLocationStore = { getState: () => globalThis.statsRouter.location };' };
    }
    if (url === 'statistics-router:../store/TrainingContext') {
      return { format: 'module', shortCircuit: true, source: 'export const useTraining = () => ({ setup: globalThis.statsRouter.setup });' };
    }
    if (url === 'statistics-router:@expo/vector-icons') {
      return { format: 'module', shortCircuit: true, source: 'export const Ionicons = () => null;' };
    }
    if (url === 'statistics-router:@react-navigation/native') {
      return { format: 'module', shortCircuit: true, source: `
        import React from ${JSON.stringify(new URL('../../node_modules/react/index.js', import.meta.url).href)};
        export function useFocusEffect(callback) {
          React.useEffect(() => {
            globalThis.statsRouter.focus = callback;
            return callback();
          }, [callback]);
        }
        export function useNavigation() {
          return {
            navigate: (name, params) => globalThis.statsRouter.calls.push(['navigate', name, params]),
            goBack: () => globalThis.statsRouter.calls.push(['goBack']),
          };
        }
        export const DarkTheme = { colors: {} };
        export const DefaultTheme = { colors: {} };
        export function NavigationContainer({ children }) { return children; }
      ` };
    }
    if (url === 'statistics-router:@react-navigation/native-stack') {
      return { format: 'module', shortCircuit: true, source: `
        import React from ${JSON.stringify(new URL('../../node_modules/react/index.js', import.meta.url).href)};
        export function createNativeStackNavigator() {
          return {
            Navigator: ({ children }) => children,
            Screen: ({ name }) => React.createElement('div', { 'data-route': name }),
          };
        }
      ` };
    }
    if (url === 'statistics-router:@react-navigation/bottom-tabs') {
      return { format: 'module', shortCircuit: true, source: `
        import React from ${JSON.stringify(new URL('../../node_modules/react/index.js', import.meta.url).href)};
        export function createBottomTabNavigator() {
          return {
            Navigator: ({ children }) => children,
            Screen: ({ name }) => React.createElement('div', { 'data-route': name }),
          };
        }
      ` };
    }
    return next(url, context);
  },
});

const { createStatisticsRepository } = await import('../../services/statisticsRepository.ts');
const { StatisticsDataProvider } = await import('./StatisticsDataProvider.tsx');
const { default: Summary } = await import('./StatisticsSummaryScreen.tsx');
const { default: Categories } = await import('./StatisticsCategoriesScreen.tsx');
const { statisticsCategories, parseStatisticsDestination, statisticsDetailHref } = await import('./statisticsRoutes.ts');
const {
  StatisticsSummaryRoute,
  StatisticsCategoriesRoute,
  StatisticsDetailRoute,
} = await import('../../navigation/StatisticsNavigator.tsx');
const { backToStatistics } = await import('./useStatisticsNavigation.ts');
const { FitLogBottomTabBar } = await import('../../navigation/MainTabs.tsx');
const { default: RootNavigator } = await import('../../navigation/RootNavigator.tsx');

beforeEach(() => {
  globalThis.statsRouter = {
    calls: [],
    params: {},
    focus: null,
    auth: { isLoggedIn: false, isRestoring: false, restoreSession: () => {} },
    location: { startWatching: () => {}, stopWatching: () => {} },
    setup: null,
  };
});

const now = () => new Date(2026, 10, 5, 12);
const today = '2026-11-05';
const workout = { id: 1, userId: 1, date: today, time: '08:00', status: 'done', durationMin: 30, caloriesBurned: 200 };
const run = { id: 1, userId: 1, clientId: 'r1', date: today, startedAt: '2026-11-05T01:00:00Z', endedAt: '2026-11-05T01:30:00Z',
  durationSec: 1800, pausedSec: 0, distanceKm: 3, steps: 4500, calories: 200 };

function fixture(overrides = {}) {
  const data = { workouts: [workout], runs: [run], profiles: [{ userId: 1, weightKg: 60, heightCm: 175, sessionsPerWeek: 4 }],
    weights: [{ userId: 1, date: '2026-10-30', weightKg: 59.5 }],
    userGoals: [{ userId: 1, minMinutesPerWeek: 150, goalId: 1 }], queue: [], cache: [], ...overrides };
  let session = { userId: '1', revision: 1 }, listener;
  const counts = {};
  const read = Object.fromEntries(Object.entries(data).map(([key]) => [key, async () => {
    counts[key] = (counts[key] ?? 0) + 1;
    return typeof data[key] === 'function' ? data[key]() : data[key];
  }]));
  const repo = createStatisticsRepository({ getSession: () => session, read, ownsQueuedRun: () => false,
    subscribeSession: callback => { listener = callback; return () => { listener = null; }; } });
  let creations = 0;
  const createRepository = () => { creations++; return repo; };
  const wrap = child => h(StatisticsDataProvider, { createRepository, now }, child);
  return { repo, data, counts, wrap, creations: () => creations,
    logout() { session = { userId: null, revision: 2 }; listener?.(); } };
}

async function show(Component = Summary, props = {}, f = fixture(), dark = false) {
  const element = f.wrap(h(Component, { onOpenDetail() {}, onOpenCategories() {}, ...props }));
  const node = await render(element, dark);
  await act(async () => {});
  return { node, f, element };
}

const card = (node, title) => node.querySelector(`[role="button"][aria-label^="${title}."]`);
const click = async button => { assert.ok(button); await act(async () => button.click()); };
const fail = async () => { throw new Error('Mất mạng giả lập'); };

test('Tóm tắt: một buổi hoàn chỉnh là 1 buổi, 30 phút và 200 kcal; chạy tách riêng', async () => {
  const { node } = await show();
  assert.match(card(node, 'Buổi hoàn thành').textContent, /1buổi/);
  assert.match(card(node, 'Phút tập theo lịch').textContent, /30phút/);
  assert.match(card(node, 'Calo theo lịch').textContent, /200kcal/);
  assert.match(card(node, 'Quãng đường chạy').textContent, /3km/);
  assert.match(card(node, 'Cam kết thời gian tuần này').textContent, /30 \/ 150/);
  assert.equal(node.textContent.includes('400kcal'), false);
});

test('Tất cả thẻ tóm tắt mở đúng danh mục, kỳ và ngày; nút cuối mở danh mục', async () => {
  const calls = []; let categories = 0;
  const { node } = await show(Summary, { onOpenDetail: value => calls.push(value), onOpenCategories: () => categories++ });
  for (const [title, category, kind, anchor] of [
    ['Cam kết thời gian tuần này', 'goals', 'week', today], ['Calo theo lịch', 'calories', 'day', today],
    ['Quãng đường chạy', 'running', 'day', today], ['Buổi hoàn thành', 'schedule', 'week', today],
    ['Cân nặng gần nhất', 'weight', 'month', '2026-10-30'], ['Chuỗi hoàn thành', 'habits', 'month', today],
    ['Phút tập theo lịch', 'time', 'week', today], ['Chạy bộ', 'running', 'day', today],
  ]) {
    await click(card(node, title));
    assert.deepEqual(calls.at(-1), { category, kind, anchor });
  }
  await click([...node.querySelectorAll('[role="button"]')].find(item => item.textContent.includes('Xem tất cả danh mục')));
  assert.equal(categories, 1);
});

test('Buổi chạy cũ chỉ hiện ở gần nhất, không thay thế quãng đường hôm nay', async () => {
  const calls = [];
  const { node } = await show(Summary, { onOpenDetail: value => calls.push(value) }, fixture({ runs: [{ ...run, date: '2026-10-30' }] }));
  assert.match(card(node, 'Quãng đường chạy').textContent, /0km/);
  assert.ok(card(node, 'Chạy bộ').textContent.includes('30/10/2026'));
  await click(card(node, 'Chạy bộ'));
  assert.deepEqual(calls[0], { category: 'running', kind: 'day', anchor: '2026-10-30' });
});

test('Nguồn tải thành công rỗng có 0 hoạt động, số đo và mục tiêu thiếu có dấu —', async () => {
  const { node } = await show(Summary, {}, fixture({ workouts: [], runs: [], weights: [], profiles: [], userGoals: [] }));
  assert.match(card(node, 'Buổi hoàn thành').textContent, /0buổi/);
  assert.match(card(node, 'Cân nặng gần nhất').textContent, /—/);
  assert.match(card(node, 'Cam kết thời gian tuần này').textContent, /0 \/ —/);
  assert.equal(node.textContent.includes('Chạy bộ. '), false);
});

test('Mất nguồn lịch không bịa 0 và không làm mất số liệu chạy', async () => {
  const { node } = await show(Summary, {}, fixture({ workouts: fail, userGoals: fail }));
  assert.match(card(node, 'Buổi hoàn thành').textContent, /—/);
  assert.match(card(node, 'Calo theo lịch').textContent, /—/);
  assert.match(card(node, 'Quãng đường chạy').textContent, /3km/);
  assert.ok(node.textContent.includes('Không tải được dữ liệu'));
});

test('Nguồn lịch còn tải: thẻ chờ dữ liệu, nguồn chạy đã xong vẫn hiện ngay', async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const { node } = await show(Summary, {}, fixture({ workouts: () => waiting }));
  assert.match(card(node, 'Buổi hoàn thành').textContent, /—/);
  assert.match(card(node, 'Quãng đường chạy').textContent, /3km/);
  assert.ok(node.textContent.includes('Đang cập nhật'));
  await act(async () => { finish([workout]); await waiting; });
  assert.match(card(node, 'Buổi hoàn thành').textContent, /1buổi/);
});

test('Refresh lỗi giữ số cũ và gắn nhãn chưa đầy đủ', async () => {
  const { node, f } = await show();
  f.data.workouts = fail;
  await act(async () => { await f.repo.refresh(); });
  assert.match(card(node, 'Calo theo lịch').textContent, /200kcal/);
  assert.ok(card(node, 'Calo theo lịch').textContent.includes('Số liệu chưa đầy đủ'));
  assert.ok(node.textContent.includes('Đang hiển thị dữ liệu đã lưu'));
});

test('Tóm tắt offline: trùng clientId server chỉ tính một lần, buổi mới có nhãn chờ đồng bộ', async () => {
  const { node } = await show(Summary, {}, fixture({ queue: [run, { ...run, id: 2, clientId: 'r2', distanceKm: 4 }] }));
  assert.match(card(node, 'Quãng đường chạy').textContent, /7km/);
  assert.ok(node.textContent.includes('1 buổi chờ đồng bộ'));
  assert.ok(card(node, 'Chạy bộ').textContent.includes('Chờ đồng bộ'));
  assert.equal(node.textContent.includes('10km'), false);
});

test('Đồng bộ xong giữ nguyên tổng tóm tắt và bỏ nhãn chờ đồng bộ', async () => {
  const extra = { ...run, id: 2, clientId: 'r2', distanceKm: 4 };
  const { node, f } = await show(Summary, {}, fixture({ queue: [run, extra] }));
  assert.match(card(node, 'Quãng đường chạy').textContent, /7km/);
  f.data.runs = [run, extra]; f.data.queue = [];
  await act(async () => { await f.repo.refresh(); });
  assert.match(card(node, 'Quãng đường chạy').textContent, /7km/);
  assert.equal(node.textContent.includes('chờ đồng bộ'), false);
  assert.equal(node.textContent.includes('Chờ đồng bộ'), false);
});

test('Logout khi đang xem tóm tắt không giữ dữ liệu tài khoản cũ', async () => {
  const { node, f } = await show();
  await act(async () => f.logout());
  assert.ok(node.textContent.includes('Cần đăng nhập'));
  assert.equal(card(node, 'Calo theo lịch'), null);
});

test('Tóm tắt và danh mục phản ứng với theme sáng/tối FitLog', async () => {
  const { node, element } = await show();
  assert.ok(node.innerHTML.includes('rgb(15, 23, 42)'));
  await render(element, true);
  assert.ok(node.innerHTML.includes('rgb(248, 250, 252)'));
  const categoryElement = h(Categories, { today, onBack() {}, onOpenDetail() {} });
  const list = await render(categoryElement, false);
  assert.ok(list.innerHTML.includes('rgb(15, 23, 42)'));
  await render(categoryElement, true);
  assert.ok(list.innerHTML.includes('rgb(248, 250, 252)'));
});

test('Danh mục gồm đúng 7 mục, đủ callback và nút quay lại', async () => {
  const calls = []; let back = 0;
  const node = await render(h(Categories, { today, onBack: () => back++, onOpenDetail: value => calls.push(value) }));
  assert.equal(node.querySelectorAll('[aria-label$=". Xem chi tiết"]').length, 7);
  for (const item of statisticsCategories) {
    await click(card(node, item.title));
    assert.deepEqual(calls.at(-1), { category: item.key, kind: item.kind, anchor: today });
  }
  await click(node.querySelector('[aria-label="Quay lại"]'));
  assert.equal(back, 1);
});

test('Tham số điều hướng kiểm tra danh mục/kỳ/ngày, bỏ mảng, ngày sai và ngày tương lai', () => {
  for (const item of statisticsCategories) for (const kind of ['day', 'week', 'month', 'year']) {
    const destination = parseStatisticsDestination(item.key, kind, '2026-10-30', today);
    assert.deepEqual(destination, { category: item.key, kind, anchor: '2026-10-30' });
    assert.deepEqual(statisticsDetailHref(destination), { pathname: '/statistics/[category]', params: { category: item.key, kind, date: '2026-10-30' } });
  }
  for (const category of [undefined, 'steps', '../profile', ['running']]) assert.equal(parseStatisticsDestination(category, 'week', today, today), null);
  for (const date of ['2026-02-30', '2026-11-06', ['2026-10-30'], undefined, 'bad']) {
    assert.deepEqual(parseStatisticsDestination('weight', ['day'], date, today), { category: 'weight', kind: 'month', anchor: today });
  }
});

test('StatisticsSummaryRoute gọi navigation.navigate đúng màn chi tiết và danh mục', async () => {
  const calls = [];
  const navigation = {
    navigate: (name, params) => calls.push([name, params]),
    goBack: () => calls.push(['goBack']),
  };
  const { node } = await show(StatisticsSummaryRoute, { navigation });
  await click(card(node, 'Calo theo lịch'));
  assert.deepEqual(calls.at(-1), ['StatisticsDetail', { category: 'calories', kind: 'day', date: today }]);
  await click([...node.querySelectorAll('[role="button"]')].find(item => item.textContent.includes('Xem tất cả danh mục')));
  assert.deepEqual(calls.at(-1), ['StatisticsCategories', undefined]);
});

test('StatisticsCategoriesRoute mở được cả bảy danh mục và quay lại', async () => {
  const calls = [];
  const navigation = {
    navigate: (name, params) => calls.push([name, params]),
    goBack: () => calls.push(['goBack']),
  };
  const { node } = await show(StatisticsCategoriesRoute, { navigation });
  for (const item of statisticsCategories) {
    await click(card(node, item.title));
    assert.deepEqual(calls.at(-1), ['StatisticsDetail', { category: item.key, kind: item.kind, date: today }]);
  }
  await click(node.querySelector('[aria-label="Quay lại"]'));
  assert.deepEqual(calls.at(-1), ['goBack']);
});

for (const item of statisticsCategories) test(`StatisticsDetailRoute ${item.key}: render màn thật đúng tiêu đề, ngày được truyền và quay lại`, async () => {
  const calls = [];
  const navigation = {
    navigate: (name, params) => calls.push([name, params]),
    goBack: () => calls.push(['goBack']),
  };
  const route = { params: { category: item.key, kind: 'day', date: '2026-10-30' } };
  const { node } = await show(StatisticsDetailRoute, { route, navigation });
  assert.ok(node.textContent.includes(item.title));
  assert.equal(node.querySelector('[aria-label="Xem theo ngày"]').getAttribute('aria-selected'), 'true');
  assert.ok(node.textContent.includes('30/10/2026'));
  await click(node.querySelector('[aria-label="Quay lại"]'));
  assert.deepEqual(calls.at(-1), ['goBack']);
});

test('Tham số danh mục không hợp lệ hiển thị trạng thái riêng và Thử lại gọi goBack', async () => {
  const calls = [];
  const navigation = {
    navigate: (name, params) => calls.push([name, params]),
    goBack: () => calls.push(['goBack']),
  };
  const route = { params: { category: 'steps' } };
  const { node } = await show(StatisticsDetailRoute, { route, navigation });
  assert.ok(node.textContent.includes('Danh mục không tồn tại'));
  await click([...node.querySelectorAll('[role="button"]')].find(item => item.textContent === 'Thử lại'));
  assert.deepEqual(calls.at(-1), ['goBack']);
  backToStatistics(navigation);
  assert.deepEqual(calls.at(-1), ['goBack']);
});

test('Provider dùng chung giữa các route; focus không lặp refresh theo snapshot', async () => {
  const f = fixture();
  const navigation = {
    navigate: () => {},
    goBack: () => {},
  };
  const { node } = await show(StatisticsSummaryRoute, { navigation }, f);
  assert.equal(f.counts.workouts, 1);
  assert.equal(f.creations(), 1);
  await act(async () => { globalThis.statsRouter.focus(); });
  assert.equal(f.counts.workouts, 2);
  assert.ok(node.textContent.includes('Tóm tắt'));
  await render(f.wrap(h(StatisticsCategoriesRoute, { navigation })));
  const route = { params: { category: 'running', kind: 'day', date: today } };
  await render(f.wrap(h(StatisticsDetailRoute, { route, navigation })));
  assert.equal(f.creations(), 1);
  assert.equal(f.counts.workouts, 3);
  await render(f.wrap(h(StatisticsSummaryRoute, { navigation })));
  assert.equal(f.creations(), 1);
  assert.equal(f.counts.workouts, 4);
  assert.match(card(node, 'Quãng đường chạy').textContent, /3km/);
});

test('Tab bar: giữ 5 tab React Navigation, chuyển đúng route và tôn trọng preventDefault', async () => {
  const routes = ['Today', 'Schedule', 'Run', 'Stats', 'Profile'].map(name => ({ name, key: name + '-key' }));
  const calls = [], events = [];
  let prevented = false;
  const navigation = {
    emit: event => { events.push(event); return { defaultPrevented: prevented }; },
    navigate: name => calls.push(name),
  };
  const node = await render(h(FitLogBottomTabBar, {
    state: { index: 0, routes },
    descriptors: Object.fromEntries(routes.map(route => [route.key, { options: {} }])),
    navigation,
  }));
  const tabs = node.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 5);
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  await click(tabs[3]);
  assert.deepEqual(calls, ['Stats']);
  assert.equal(events.at(-1).type, 'tabPress');
  prevented = true;
  await click(tabs[2]);
  assert.deepEqual(calls, ['Stats']);
  await click(tabs[0]);
  assert.equal(calls.length, 1);
  assert.equal(node.querySelectorAll('svg').length, 5);
});

test('Root guard chờ phục hồi phiên, chỉ mở Login/Register hoặc Main theo trạng thái tài khoản', async () => {
  let restore = 0, starts = 0, stops = 0;
  globalThis.statsRouter.auth = { isLoggedIn: false, isRestoring: true, restoreSession: () => { restore++; } };
  globalThis.statsRouter.location = { startWatching: () => { starts++; }, stopWatching: () => { stops++; } };
  globalThis.statsRouter.setup = null;
  const node = await render(h(RootNavigator));
  assert.equal(node.querySelectorAll('[data-route]').length, 0);
  globalThis.statsRouter.auth.isRestoring = false;
  await render(h(RootNavigator));
  assert.deepEqual([...node.querySelectorAll('[data-route]')].map(item => item.dataset.route), ['Login', 'Register', 'ForgotPassword']);
  globalThis.statsRouter.auth.isLoggedIn = true;
  await render(h(RootNavigator));
  assert.deepEqual([...node.querySelectorAll('[data-route]')].map(item => item.dataset.route), ['Onboarding']);
  globalThis.statsRouter.setup = { weight: 60, height: 175 };
  await render(h(RootNavigator));
  assert.deepEqual([...node.querySelectorAll('[data-route]')].map(item => item.dataset.route), ['Main', 'EditTraining']);
  globalThis.statsRouter.auth.isLoggedIn = false;
  await render(h(RootNavigator));
  assert.deepEqual([...node.querySelectorAll('[data-route]')].map(item => item.dataset.route), ['Login', 'Register', 'ForgotPassword']);
  assert.equal(restore, 1); assert.equal(starts, 1); assert.equal(stops, 2);
});
