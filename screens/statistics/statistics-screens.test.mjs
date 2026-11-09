import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFileSync } from 'node:fs';
import { h, act, render, colors, darkColors, StyleSheet } from '../../test-support/statisticsUiHarness.mjs';
const { createStatisticsRepository } = await import('../../services/statisticsRepository.ts');
const screens = await import('./index.ts');
const { buildStatisticsView } = await import('./viewModel.ts');

const now = () => new Date(2026, 10, 5, 12);
const workout = (changes = {}) => ({ id: 1, userId: 1, date: '2026-11-05', time: '08:00', status: 'done', durationMin: 30,
  caloriesBurned: 200, exerciseId: 1, exercise: { id: 1, name: 'Hít đất', muscleGroup: 'Ngực, tay sau' }, ...changes });
const run = (changes = {}) => ({ id: 1, clientId: 'r1', userId: 1, date: '2026-11-05', startedAt: '2026-11-05T01:00:00Z', endedAt: '2026-11-05T01:30:00Z',
  durationSec: 1800, pausedSec: 60, distanceKm: 3, steps: 4500, calories: 200, ...changes });
const definitions = [
  ['Chạy bộ', screens.RunningStatisticsScreen], ['Lịch tập và mức độ hoàn thành', screens.ScheduleStatisticsScreen],
  ['Thời gian luyện tập', screens.TimeStatisticsScreen], ['Calo luyện tập', screens.CaloriesStatisticsScreen],
  ['Cân nặng và BMI', screens.WeightStatisticsScreen], ['Tiến độ mục tiêu', screens.GoalsStatisticsScreen], ['Thói quen luyện tập', screens.HabitsStatisticsScreen],
];
function fixture(overrides = {}) {
  const data = {
    workouts: [workout(), workout({ id: 2, date: '2026-11-04', status: 'planned' })],
    runs: [run()], profiles: [{ id: 1, userId: 1, heightCm: 175, weightKg: 60, sessionsPerWeek: 4 }],
    weights: [{ id: 1, userId: 1, weightKg: 60, date: '2026-11-02' }, { id: 2, userId: 1, weightKg: 59.5, date: '2026-11-05' }],
    userGoals: [{ id: 1, userId: 1, goalId: 2, minMinutesPerWeek: 150, targetWeightKg: 65, goal: { id: 2, name: 'Tăng cân', code: 'weight_gain' } }],
    queue: [], cache: [], ...overrides,
  };
  let session = { userId: '1', revision: 1 };
  let listener;
  const readers = Object.fromEntries(Object.keys(data).map(key => [key, () => typeof data[key] === 'function' ? data[key]() : Promise.resolve(data[key])]));
  const repo = createStatisticsRepository({ read: readers, getSession: () => session, ownsQueuedRun: () => false,
    subscribeSession: handler => { listener = handler; return () => { listener = null; }; } });
  return { repo, data, createRepository: () => repo, session: value => { session = value; listener?.(); } };
}
async function show(Component, f = fixture(), props = {}, dark = false) {
  const element = h(screens.StatisticsDataProvider, { createRepository: f.createRepository, now }, h(Component, { chartWidth: 254, ...props }));
  const node = await render(element, dark);
  await act(async () => { await f.repo.refresh(); });
  return { node, f, element };
}
const failed = () => Promise.reject(Object.assign(new Error('Giả lập mất mạng'), { status: 0 }));

for (const [title, Component] of definitions) {
  test(`${title}: hiển thị dữ liệu, chọn kỳ và theme sáng/tối`, async () => {
    const { node, element } = await show(Component);
    assert.ok(node.textContent.includes(title));
    assert.equal(node.querySelectorAll('[role="tab"]').length, 4);
    assert.ok(!node.textContent.includes('Cần đăng nhập'));
    assert.ok(node.querySelector('svg'));
    assert.ok(node.innerHTML.includes('rgb(15, 23, 42)'));
    await render(element, true);
    assert.ok(node.innerHTML.includes('rgb(248, 250, 252)'));
    await act(async () => node.querySelector('[aria-label="Xem theo năm"]').click());
    assert.ok(node.textContent.includes('Năm 2026'));
    assert.equal(node.querySelector('[aria-label="Xem theo năm"]').getAttribute('aria-selected'), 'true');
  });
}

test('Quay về kỳ hiện tại, kỳ trước và nút quay lại đúng callback', async () => {
  let back = 0;
  const { node } = await show(screens.RunningStatisticsScreen, fixture(), { onBack: () => { back += 1; } });
  await act(async () => node.querySelector('[aria-label="Kỳ trước"]').click());
  assert.ok(node.textContent.includes('26/10/2026 – 01/11/2026'));
  await act(async () => [...node.querySelectorAll('[role="button"]')].find(item => item.textContent === 'Về kỳ hiện tại').click());
  assert.ok(node.textContent.includes('02/11/2026 – 08/11/2026'));
  await act(async () => node.querySelector('[aria-label="Quay lại"]').click());
  assert.equal(back, 1);
  assert.equal(node.querySelector('[aria-label="Kỳ sau"]').getAttribute('aria-disabled'), 'true');
});

test('Thời gian và calo giữ hai nguồn riêng, không xuất tổng gộp', async () => {
  const { node } = await show(screens.TimeStatisticsScreen);
  assert.ok(node.textContent.includes('Thời gian đã tập'));
  assert.ok(node.textContent.includes('Thời gian chạy'));
  assert.equal(node.textContent.includes('60phút'), false);
  assert.ok(node.textContent.includes('tránh tính hai lần'));
});

test('Một nguồn lịch lỗi không mất chạy và không hiện số 0 như lịch đã tải đủ', async () => {
  const { node } = await show(screens.TimeStatisticsScreen, fixture({ workouts: failed }));
  assert.ok(node.textContent.includes('Chưa tải được dữ liệu'));
  assert.equal(node.textContent.includes('Thời gian đã tập'), false);
  assert.ok(node.textContent.includes('Thời gian chạy'));
  assert.ok(node.textContent.includes('30phút'));
});

test('Chạy offline đã xác định chủ có nhãn, trùng server không tăng số buổi', async () => {
  const { node } = await show(screens.RunningStatisticsScreen, fixture({ queue: [run({ id: undefined }), run({ id: 2, clientId: 'r2' })] }));
  assert.ok(node.textContent.includes('1 buổi chờ đồng bộ'));
  assert.ok(node.textContent.includes('2buổi'));
  assert.ok(node.textContent.includes('9.000'));
  assert.equal(node.textContent.includes('13.500'), false);
});

test('Bấm lịch sử chạy mở chi tiết và đóng được', async () => {
  const { node } = await show(screens.RunningStatisticsScreen);
  const row = node.querySelector('[aria-label*="Chạy bộ. 05/11/2026"]');
  assert.ok(row);
  await act(async () => row.click());
  assert.ok(document.body.textContent.includes('Chi tiết buổi chạy'));
  assert.ok(document.body.textContent.includes('Nhịp bước'));
  await act(async () => document.querySelector('[aria-label="Đóng chi tiết buổi chạy"]').click());
  assert.equal(document.body.textContent.includes('Chi tiết buổi chạy'), false);
});

test('Đổi kỳ khi chi tiết đang mở không giữ bản ghi ngoài kỳ', async () => {
  const { node } = await show(screens.RunningStatisticsScreen);
  await act(async () => node.querySelector('[aria-label*="Chạy bộ. 05/11/2026"]').click());
  await act(async () => node.querySelector('[aria-label="Kỳ trước"]').click());
  assert.equal(document.body.textContent.includes('Chi tiết buổi chạy'), false);
});

test('Lịch bỏ lỡ được ghi đúng, không gắn nhãn còn chờ', async () => {
  const { node } = await show(screens.ScheduleStatisticsScreen);
  assert.ok(node.textContent.includes('Bỏ lỡ'));
  assert.ok(node.textContent.includes('50%'));
  assert.ok(node.textContent.includes('Ngực, tay sau'));
});

test('Cân giảm hiển thị đúng hướng, chỉ vẽ các ngày có số đo', async () => {
  const { node } = await show(screens.WeightStatisticsScreen);
  assert.ok(node.textContent.includes('0,5kg'));
  assert.ok(node.textContent.includes('Cân nặng giảm trong kỳ'));
  assert.ok(node.textContent.includes('19,4'));
  assert.ok(node.textContent.includes('59,5'));
});

test('Mất lịch sử cân không biến hồ sơ thành số đo đầy đủ hoặc BMI chắc chắn', async () => {
  const { node } = await show(screens.WeightStatisticsScreen, fixture({ weights: failed }));
  assert.ok(node.textContent.includes('Số liệu chưa đầy đủ'));
  assert.ok(node.textContent.includes('Chưa đủ dữ liệu để phân loại BMI'));
  assert.equal(node.textContent.includes('Bình thường'), false);
});

test('Lịch sử cân đọc được nhưng hồ sơ lỗi: vẫn có cân, BMI chưa xác định', async () => {
  const { node } = await show(screens.WeightStatisticsScreen, fixture({ profiles: failed }));
  assert.ok(node.textContent.includes('59,5kg'));
  assert.ok(node.textContent.includes('Chưa đủ dữ liệu để phân loại BMI'));
  assert.equal(node.textContent.includes('Bình thường'), false);
});

test('Không có số đo thì không ghi nhầm nguồn là hồ sơ', async () => {
  const { node } = await show(screens.WeightStatisticsScreen, fixture({ weights: [], profiles: [] }));
  assert.ok(node.textContent.includes('Chưa có số đo'));
  assert.equal(node.textContent.includes('Từ hồ sơ · chưa có ngày đo'), false);
});

test('Một mục tiêu áp dụng, tiến độ tuần không cộng thêm 30 phút chạy', async () => {
  const { node } = await show(screens.GoalsStatisticsScreen);
  assert.ok(node.textContent.includes('Tăng cân'));
  assert.ok(node.textContent.includes('30 / 150'));
  assert.equal(node.textContent.includes('60 / 150'), false);
});

test('Cam kết còn làm mới không hiển thị phần trăm chắc chắn từ giá trị cũ', async () => {
  const { node, f } = await show(screens.GoalsStatisticsScreen);
  let finishGoal, finishProfile;
  f.data.userGoals = () => new Promise(resolve => { finishGoal = resolve; });
  f.data.profiles = () => new Promise(resolve => { finishProfile = resolve; });
  let refreshing;
  await act(async () => { refreshing = f.repo.refresh(); await new Promise(resolve => setImmediate(resolve)); });
  const minutes = node.querySelector('[aria-label^="Phút tập theo lịch."]');
  const sessions = node.querySelector('[aria-label^="Số buổi theo lịch."]');
  const pendingPercent = [minutes.getAttribute('aria-valuenow'), sessions.getAttribute('aria-valuenow')];
  // Hoàn tất promise dù assertion thất bại để không giữ tác vụ chưa kết thúc.
  await act(async () => {
    finishGoal([{ userId: 1, minMinutesPerWeek: 300 }]);
    finishProfile([{ userId: 1, sessionsPerWeek: 2 }]);
    await refreshing;
  });
  assert.deepEqual(pendingPercent, [null, null]);
  assert.equal(node.querySelector('[aria-label^="Phút tập theo lịch."]').getAttribute('aria-valuenow'), '10');
  assert.equal(node.querySelector('[aria-label^="Số buổi theo lịch."]').getAttribute('aria-valuenow'), '50');
});

test('Mã client trùng chuỗi id của buổi khác vẫn mở đúng chi tiết buổi đã bấm', async () => {
  const { node } = await show(screens.RunningStatisticsScreen, fixture({ runs: [
    run({ clientId: undefined, distanceKm: 2 }),
    run({ id: 2, clientId: 'id:1', distanceKm: 5, startedAt: '2026-11-05T02:00:00Z', endedAt: '2026-11-05T02:30:00Z' }),
  ] }));
  const row = [...node.querySelectorAll('[aria-label*="Chạy bộ. 05/11/2026"]')].find(item => item.textContent.includes('5 km'));
  assert.ok(row);
  await act(async () => row.click());
  assert.ok(document.querySelector('[aria-modal="true"]').textContent.includes('5km'));
});

test('Chọn tháng/năm chỉ đổi lịch sử, không nhân cam kết tuần', async () => {
  const { node } = await show(screens.GoalsStatisticsScreen);
  await act(async () => node.querySelector('[aria-label="Xem theo năm"]').click());
  assert.ok(node.textContent.includes('30 / 150'));
  assert.ok(node.textContent.includes('Cam kết thời gian tuần này'));
});

test('Không có mục tiêu/mục tiêu mơ hồ không dựng vòng % giả', async () => {
  const { node, f } = await show(screens.GoalsStatisticsScreen, fixture({ userGoals: [] }));
  assert.ok(node.textContent.includes('Chưa có mục tiêu được ghi nhận'));
  f.data.userGoals = [{ id: 1, userId: 1 }, { id: 2, userId: 1 }];
  await act(async () => { await f.repo.refresh(); });
  assert.ok(node.textContent.includes('Có nhiều mục tiêu'));
  f.data.profiles = [{ id: 1, userId: 1, sessionsPerWeek: 4 }, { id: 2, userId: 1, sessionsPerWeek: 6 }];
  await act(async () => { await f.repo.refresh(); });
  assert.ok(node.textContent.includes('chưa xác định được cam kết số buổi'));
});

test('Nguồn mục tiêu thiếu chủ không được kết luận chắc chắn là chưa có mục tiêu', async () => {
  const { node } = await show(screens.GoalsStatisticsScreen, fixture({ userGoals: [{ id: 1, goalId: 2 }] }));
  assert.ok(node.textContent.includes('Chưa đủ dữ liệu để xác định mục tiêu'));
  assert.equal(node.textContent.includes('Chưa có mục tiêu được ghi nhận'), false);
});

test('Nguồn lịch lỗi không tạo tiến độ 0/150 từ dữ liệu thay thế', async () => {
  const { node } = await show(screens.GoalsStatisticsScreen, fixture({ workouts: failed }));
  assert.ok(node.textContent.includes('Chưa tải được dữ liệu'));
  assert.equal(node.textContent.includes('0 / 150'), false);
});

test('Thói quen chỉ đếm một ngày dù có cả chạy và lịch; lỗi nguồn làm nhãn chưa đầy đủ', async () => {
  const { node } = await show(screens.HabitsStatisticsScreen, fixture({ runs: failed }));
  assert.ok(node.textContent.includes('1ngày'));
  assert.ok(node.textContent.includes('Số liệu chưa đầy đủ'));
  assert.ok(node.querySelector('[aria-label="05/11/2026. Có hoạt động đã ghi nhận"]'));
  assert.ok(node.querySelector('[aria-label="03/11/2026. Chưa đủ dữ liệu để xác định"]'));
});

test('Trạng thái lịch chưa xác định không biến ngày đó thành ngày chắc chắn không hoạt động', async () => {
  const { node } = await show(screens.HabitsStatisticsScreen, fixture({
    workouts: [workout({ date: '2026-11-03', status: 'unknown' })], runs: [],
  }));
  assert.ok(node.querySelector('[aria-label="03/11/2026. Chưa đủ dữ liệu để xác định"]'));
  assert.equal(node.querySelector('[aria-label="03/11/2026. Chưa ghi nhận hoạt động"]'), null);
  assert.ok(node.textContent.includes('Số liệu chưa đầy đủ'));
});

test('Chuỗi vẫn xét toàn lịch sử dù đang xem kỳ khác', async () => {
  const { node } = await show(screens.HabitsStatisticsScreen, fixture({ workouts: [workout({ date: '2026-10-29' }), workout({ id: 2, date: '2026-11-05' })] }));
  assert.ok(node.textContent.includes('2buổi liên tiếp'));
  await act(async () => node.querySelector('[aria-label="Kỳ trước"]').click());
  assert.ok(node.textContent.includes('2buổi liên tiếp'));
});

test('Lịch sử phân trang giao diện không cắt số liệu tổng', async () => {
  const all = Array.from({ length: 25 }, (_, index) => run({ id: index + 1, clientId: `r${index + 1}` }));
  const { node } = await show(screens.RunningStatisticsScreen, fixture({ runs: all }));
  assert.ok(node.textContent.includes('25buổi'));
  assert.equal(node.querySelectorAll('[aria-label*="Chạy bộ. 05/11/2026"]').length, 20);
  await act(async () => [...node.querySelectorAll('[role="button"]')].find(item => item.textContent.includes('Xem thêm (5')).click());
  assert.equal(node.querySelectorAll('[aria-label*="Chạy bộ. 05/11/2026"]').length, 25);
});

test('Logout xóa dữ liệu đang xem và đóng chi tiết chạy', async () => {
  const { node, f } = await show(screens.RunningStatisticsScreen);
  await act(async () => node.querySelector('[aria-label*="Chạy bộ. 05/11/2026"]').click());
  await act(async () => f.session({ userId: null, revision: 2 }));
  assert.ok(node.textContent.includes('Cần đăng nhập'));
  assert.equal(document.body.textContent.includes('Chi tiết buổi chạy'), false);
});

test('Tải ban đầu chưa xong không hiển thị số 0 từ mảng thay thế', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const f = fixture({ runs: () => waiting });
  const element = h(screens.StatisticsDataProvider, { createRepository: f.createRepository, now }, h(screens.RunningStatisticsScreen));
  const node = await render(element);
  assert.ok(node.textContent.includes('Đang tải thống kê'));
  assert.equal(node.textContent.includes('0buổi'), false);
  await act(async () => { release([]); await waiting; });
});

test('Thử lại sau lỗi đọc lại dữ liệu và hiển thị thành công', async () => {
  const f = fixture({ runs: failed });
  const { node } = await show(screens.RunningStatisticsScreen, f);
  f.data.runs = [run()];
  await act(async () => [...node.querySelectorAll('[role="button"]')].find(item => item.textContent === 'Thử lại').click());
  assert.ok(node.textContent.includes('3km'));
});

test('View model không tạo cột số 0 cho ngày tương lai', async () => {
  const f = fixture();
  const snapshot = await f.repo.refresh();
  const model = buildStatisticsView(snapshot, '2026-11-05', 'week', '2026-11-05');
  assert.equal(model.series('running', 'distanceKm').length, 4);
  assert.ok(model.series('running', 'distanceKm').every(point => point.key <= '2026-11-05'));
  f.repo.dispose();
});

test('StrictMode tạo/hủy provider không làm repository đang dùng bị dispose nhầm', async () => {
  const { StrictMode } = await import('react');
  const repositories = [];
  const createRepository = () => { const f = fixture(); repositories.push(f.repo); return f.repo; };
  const node = await render(h(StrictMode, null, h(screens.StatisticsDataProvider, { createRepository, now }, h(screens.TimeStatisticsScreen))));
  await act(async () => { await repositories.at(-1).refresh(); });
  assert.ok(node.textContent.includes('30phút'));
  assert.ok(repositories.length >= 2);
});

for (const [title, Component] of definitions) {
  test(`${title}: dữ liệu rỗng không tạo cân, mục tiêu hoặc số liệu mẫu`, async () => {
    const { node } = await show(Component, fixture({ workouts: [], runs: [], profiles: [], weights: [], userGoals: [] }));
    assert.equal(node.textContent.includes('NaN'), false);
    assert.equal(node.textContent.includes('undefined'), false);
    assert.equal(node.textContent.includes('60kg'), false);
    assert.equal(node.textContent.includes('/ 150'), false);
    assert.equal(node.textContent.includes('400kcal'), false);
  });
}

test('Qua ngày mới tự cập nhật kỳ hiện tại, nhưng không đổi kỳ lịch sử đã chọn', async () => {
  let currentDate = new Date(2026, 10, 5, 12);
  const movingNow = () => currentDate;
  let updateDay;
  const originalInterval = globalThis.setInterval;
  globalThis.setInterval = (callback, delay, ...args) => {
    if (delay === 60_000) updateDay = callback;
    return originalInterval(callback, delay, ...args);
  };
  try {
    const f = fixture();
    const element = h(screens.StatisticsDataProvider, { createRepository: f.createRepository, now: movingNow },
      h(screens.RunningStatisticsScreen, { initialKind: 'day' }));
    const node = await render(element);
    await act(async () => { await f.repo.refresh(); });
    currentDate = new Date(2026, 10, 6, 0, 1);
    await act(async () => updateDay());
    assert.ok(node.textContent.includes('06/11/2026'));
    assert.ok(node.textContent.includes('0buổi'));
    await act(async () => node.querySelector('[aria-label="Kỳ trước"]').click());
    currentDate = new Date(2026, 10, 7, 0, 1);
    await act(async () => updateDay());
    assert.ok(node.textContent.includes('05/11/2026'));
    assert.ok(node.textContent.includes('1buổi'));
  } finally { globalThis.setInterval = originalInterval; }
});

test('Xuất preview 7 màn từ component thật với dữ liệu minh họa', async () => {
  if (process.env.FITLOG_STATS_SCREENS_PREVIEW !== '1') return;
  for (const dark of [false, true]) {
    const palette = dark ? darkColors : colors;
    const fragments = [];
    for (const [title, Component] of definitions) {
      const { node } = await show(Component, fixture(), {}, dark);
      fragments.push(`<section><h2>${title}</h2>${node.innerHTML}</section>`);
    }
    const css = StyleSheet.getSheet();
    writeFileSync(`docs/statistics/phase5-${dark ? 'dark' : 'light'}.html`, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FitLog — QA 7 màn thống kê</title><style>html,body{margin:0;background:${palette.background};color:${palette.text};font:14px Arial}main{display:flex;gap:24px;align-items:flex-start;padding:16px;flex-wrap:wrap}section{width:320px;border:1px solid ${palette.border}}section>h2{font-size:16px;padding:12px}${css.textContent}</style></head><body><p>Dữ liệu minh hoạ để kiểm tra 7 màn, không kết nối CSDL. HTML tĩnh không chạy các nút tương tác.</p><main>${fragments.join('')}</main></body></html>`);
  }
});
