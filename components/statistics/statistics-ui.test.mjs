import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFileSync } from 'node:fs';
import { h, act, ui, render, StyleSheet, colors, darkColors } from '../../test-support/statisticsUiHarness.mjs';

const metric = (value, complete = true) => ({ value, complete, missingCount: complete ? 0 : 1 });
const points = [12, 0, 25, null, 18, 30, 22].map((value, index) => ({ key: `d${index}`, label: `Ngày ${index + 1}`, axisLabel: String(index + 1), value }));
const source = (changes = {}) => ({ status: 'success', data: [], complete: true, stale: false, updatedAt: null, origin: 'network', error: null, issues: [], ...changes });

test('Thẻ dùng đúng palette sáng/tối và cập nhật khi theme thay đổi', async () => {
  const element = h(ui.StatisticsMetricCard, { title: 'Quãng đường', periodLabel: 'Hôm nay', metric: metric(3.25), unit: 'km' });
  const node = await render(element);
  assert.ok(node.innerHTML.includes('rgb(15, 23, 42)'));
  await render(element, true);
  assert.ok(node.innerHTML.includes('rgb(248, 250, 252)'));
  assert.ok(node.textContent.includes('3,25'));
});
test('Bấm thẻ gọi callback, thẻ không hành động không giả làm nút', async () => {
  let selected = 0;
  const props = { title: 'Calo', periodLabel: 'Hôm nay', metric: metric(200), unit: 'kcal' };
  const node = await render(h(ui.StatisticsMetricCard, { ...props, onPress: () => { selected += 1; } }));
  await act(async () => node.querySelector('[role="button"]').click());
  assert.equal(selected, 1);
  await render(h(ui.StatisticsMetricCard, props));
  assert.equal(node.querySelector('[role="button"]'), null);
});
test('Bộ chọn kỳ đổi tab, nút kỳ sau disabled và nút kỳ hiện tại hoạt động', async () => {
  const picked = [];
  const node = await render(h(ui.StatisticsPeriodPicker, { value: 'week', periodLabel: '02–08/11/2026', canNext: false,
    onChange: value => picked.push(value), onShift: value => picked.push(value), onCurrent: () => picked.push('current') }));
  const tabs = node.querySelectorAll('[role="tab"]');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  await act(async () => { tabs[2].click(); node.querySelector('[aria-label="Kỳ trước"]').click(); node.querySelector('[aria-label="Kỳ sau"]').click(); node.querySelectorAll('[role="button"]')[2].click(); });
  assert.deepEqual(picked, ['month', -1, 'current']);
});
test('Thiếu dữ liệu khác 0 và luôn có nhãn số liệu chưa đầy đủ', async () => {
  const node = await render(h('div', null,
    h(ui.StatisticsMetricValue, { metric: null, unit: 'kg' }),
    h(ui.StatisticsMetricValue, { metric: metric(0), unit: 'kcal' }),
    h(ui.StatisticsMetricValue, { metric: metric(30, false), unit: 'minutes' })));
  assert.ok(node.textContent.includes('Chưa có dữ liệu'));
  assert.ok(node.textContent.includes('0kcal'));
  assert.ok(node.textContent.includes('Số liệu chưa đầy đủ'));
});
test('Vòng tiến độ 120% có accessibility tối đa 100 và không mất số thực', async () => {
  const node = await render(h(ui.StatisticsProgress, { title: 'Mục tiêu tuần', periodLabel: 'Tuần này', actual: metric(180), target: 150 }));
  assert.ok(node.textContent.includes('120%'));
  assert.ok(node.textContent.includes('180 / 150'));
  assert.equal(node.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '100');
});
test('Không có cam kết không dựng phần trăm hoặc một vòng hoàn thành giả', async () => {
  const node = await render(h(ui.StatisticsProgress, { title: 'Mục tiêu tuần', periodLabel: 'Tuần này', actual: metric(30), target: null }));
  assert.equal(node.querySelector('[role="progressbar"]'), null);
  assert.ok(node.textContent.includes('Chưa có cam kết'));
});
test('Lỗi ban đầu không hiện children hoặc kết luận không có hoạt động', async () => {
  const node = await render(h(ui.StatisticsSourceContent, { source: source({ data: null, status: 'error', complete: false,
    error: { message: 'Mất kết nối', retryable: true } }), onRetry: () => {} }, h('span', null, '0 buổi giả')));
  assert.ok(node.textContent.includes('Mất kết nối'));
  assert.equal(node.textContent.includes('0 buổi giả'), false);
  assert.equal(node.textContent.includes('Chưa có hoạt động'), false);
});
test('Dữ liệu cũ vẫn hiện cùng cảnh báo, không thay bằng màn trống', async () => {
  const node = await render(h(ui.StatisticsSourceContent, { source: source({ status: 'error', complete: false, stale: true,
    error: { message: 'Mất mạng', retryable: true } }), empty: true, onRetry: () => {} }, h('span', null, 'Dữ liệu đã lưu')));
  assert.ok(node.textContent.includes('Dữ liệu đã lưu'));
  assert.ok(node.textContent.includes('số liệu có thể chưa đầy đủ'));
});
test('Nhãn chờ đồng bộ và thông tin chủ chưa rõ không làm lộ mã issue kỹ thuật', async () => {
  const node = await render(h(ui.StatisticsSourceNotice, { source: source({ complete: false, issues: ['unknown-owners:1', 'queue-read-failed'] }), queuedCount: 2 }));
  assert.ok(node.textContent.includes('2 buổi chờ đồng bộ'));
  assert.ok(node.textContent.includes('chưa xác định được tài khoản'));
  assert.equal(node.textContent.includes('unknown-owners'), false);
});
test('Chọn cột cập nhật số liệu được đọc và gọi callback', async () => {
  let picked;
  const node = await render(h(ui.StatisticsBarChart, { title: 'Phút tập theo lịch', unit: 'minutes', points, width: 256, onSelect: value => { picked = value; } }));
  const first = node.querySelector('[aria-label="Ngày 1: 12 phút"]');
  await act(async () => first.click());
  assert.equal(picked.key, 'd0');
  assert.ok(node.textContent.includes('Ngày 1: 12 phút'));
  assert.equal(first.getAttribute('aria-selected'), 'true');
});
test('Biểu đồ không vẽ dữ liệu giả khi toàn bộ số liệu thiếu', async () => {
  const node = await render(h(ui.StatisticsLineChart, { title: 'Cân nặng', unit: 'kg', width: 256,
    points: [{ key: 'one', label: '05/11', value: null }] }));
  assert.ok(node.textContent.includes('Chưa có số liệu hợp lệ'));
  assert.equal(node.querySelector('svg'), null);
});
test('Hàng hoạt động có nhãn trạng thái, chờ đồng bộ và hành động chi tiết', async () => {
  let count = 0;
  const node = await render(h(ui.StatisticsActivityRow, { title: 'Chạy bộ', dateLabel: '05/11/2026', detail: '3 km · 30 phút',
    statusLabel: 'Đã hoàn thành', queued: true, onPress: () => { count += 1; } }));
  assert.ok(node.textContent.includes('Chờ đồng bộ'));
  await act(async () => node.querySelector('[role="button"]').click());
  assert.equal(count, 1);
});
test('Xuất trang QA từ chính các thành phần, không gắn vào ứng dụng', async () => {
  if (process.env.FITLOG_STATS_PREVIEW !== '1') return;
  for (const dark of [false, true]) {
    const palette = dark ? darkColors : colors;
    const page = h('main', { style: { width: 320, boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, background: palette.background, color: palette.text } },
      h('h2', { style: { margin: 0, font: 'bold 22px Arial' } }, 'Thành phần thống kê'),
      h('p', { style: { margin: 0, font: '14px Arial' } }, 'Dữ liệu minh hoạ để kiểm tra giao diện.'),
      h(ui.StatisticsPeriodPicker, { value: 'week', periodLabel: '02–08/11/2026', onChange: () => {}, onShift: () => {} }),
      h(ui.StatisticsProgress, { title: 'Phút tập theo lịch', periodLabel: 'Tuần này', actual: metric(180), target: 150 }),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        h(ui.StatisticsMetricCard, { title: 'Calo', periodLabel: 'Hôm nay', metric: metric(200), unit: 'kcal', hint: 'Từ lịch tập', onPress: () => {} }),
        h(ui.StatisticsMetricCard, { title: 'Quãng đường', periodLabel: 'Hôm nay', metric: metric(3.25), unit: 'km', onPress: () => {} })),
      h(ui.StatisticsBarChart, { title: 'Phút tập theo lịch', unit: 'minutes', points, width: 254 }),
      h(ui.StatisticsLineChart, { title: 'Cân nặng', unit: 'kg', width: 254, points: [
        { key: 'a', label: '01/11', value: 60, position: 0 }, { key: 'b', label: '03/11', value: 59.7, position: 2 }, { key: 'c', label: '05/11', value: 59.5, position: 4 }] }),
      h(ui.StatisticsActivityRow, { title: 'Chạy bộ', dateLabel: '05/11/2026', detail: '3 km · 30 phút', queued: true }),
      h(ui.StatisticsDataState, { state: 'error', onRetry: () => {} }));
    const node = await render(page, dark);
    const css = StyleSheet.getSheet();
    writeFileSync(`docs/statistics/phase4-${dark ? 'dark' : 'light'}.html`, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FitLog — QA thành phần</title><style>html,body{margin:0;padding:0;background:${palette.background}}${css.textContent}</style></head><body>${node.innerHTML}</body></html>`);
  }
});
