import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStatisticsChart, describeStatisticsMetric, describeStatisticsProgress, formatStatisticsValue } from './presentation.ts';

const metric = (value, complete = true) => ({ value, complete, missingCount: complete ? 0 : 1 });

test('Định dạng tiếng Việt và đơn vị, giữ số 0 hợp lệ', () => {
  assert.equal(formatStatisticsValue(12345, 'count'), '12.345');
  assert.equal(formatStatisticsValue(3.25, 'km'), '3,25');
  assert.equal(formatStatisticsValue(0, 'kcal'), '0');
  assert.equal(describeStatisticsMetric(metric(4500), 'count', 'bước').unit, 'bước');
});
test('Pace nhận giây/km và làm tròn đúng khi chuyển phút', () => {
  assert.equal(formatStatisticsValue(359.6, 'pace'), '6:00');
  assert.equal(formatStatisticsValue(385, 'pace'), '6:25');
  assert.equal(formatStatisticsValue(0, 'pace'), '—');
});
test('Thời lượng chạy không nhầm phút và giây', () => {
  assert.equal(formatStatisticsValue(3725, 'seconds'), '01:02:05');
  assert.equal(formatStatisticsValue(0, 'seconds'), '00:00:00');
});
test('Không ép thiếu/NaN/âm thành số 0', () => {
  for (const value of [null, NaN, Infinity, -1]) assert.equal(formatStatisticsValue(value, 'kg'), '—');
  assert.equal(describeStatisticsMetric(null, 'kg').note, 'Chưa có dữ liệu');
  assert.equal(describeStatisticsMetric(metric(30, false), 'minutes').note, 'Số liệu chưa đầy đủ');
});
test('Vượt mục tiêu hiển thị 120%, chỉ tô một vòng', () => {
  const result = describeStatisticsProgress(metric(180), 150);
  assert.equal(result.percent, 120);
  assert.equal(result.fill, 1);
});
test('Không tạo % mục tiêu khi thiếu cam kết hoặc số liệu thiếu', () => {
  for (const target of [null, 0, -1, Infinity]) assert.equal(describeStatisticsProgress(metric(30), target).percent, null);
  assert.equal(describeStatisticsProgress(metric(30, false), 150).percent, null);
  assert.equal(describeStatisticsProgress(metric(null), 150).percent, null);
});
test('Biểu đồ 31 ngày cuộn ngang, mỗi mốc có chỗ cho vùng chạm', () => {
  const points = Array.from({ length: 31 }, (_, index) => ({ key: String(index), label: String(index + 1), value: index }));
  const chart = buildStatisticsChart(points, 220, 'bar');
  assert.ok(chart.width >= 31 * 44);
  for (let i = 1; i < chart.points.length; i += 1) assert.ok(chart.points[i].x - chart.points[i - 1].x >= 44);
});
test('Cột 0 không dựng chiều cao giả; mốc thiếu vẫn là null', () => {
  const chart = buildStatisticsChart([{ key: '1', label: '1', value: 0 }, { key: '2', label: '2', value: null }], 250, 'bar');
  assert.equal(chart.points[0].y, chart.points[0].baseline);
  assert.equal(chart.points[1].y, null);
});
test('Đường không nối qua mốc chưa có số liệu', () => {
  const chart = buildStatisticsChart([60, null, 61].map((value, i) => ({ key: String(i), label: String(i), value })), 250, 'line');
  assert.equal(chart.paths.length, 2);
  assert.ok(chart.paths.every(path => !path.includes('L')));
});
test('Khoảng cách các lần cân theo thời gian thực, không chia đều ba lần cân', () => {
  const points = [0, 1, 30].map((position, i) => ({ key: String(i), label: String(i), value: 60 + i, position }));
  const chart = buildStatisticsChart(points, 250, 'line');
  const firstGap = chart.points[1].x - chart.points[0].x;
  const lastGap = chart.points[2].x - chart.points[1].x;
  assert.ok(Math.abs(lastGap / firstGap - 29) < 1e-8);
  assert.ok(firstGap >= 44);
});
test('Một lần cân vẫn có một điểm giữa biểu đồ, không tạo thêm số đo', () => {
  const chart = buildStatisticsChart([{ key: '1', label: '1', value: 60 }], 250, 'line');
  assert.equal(chart.points.length, 1);
  assert.equal(chart.points[0].x, chart.width / 2);
  assert.ok(Number.isFinite(chart.points[0].y));
});
test('Tập rỗng hoặc toàn 0 không chia cho 0 trong tọa độ', () => {
  for (const points of [[], [0, 0].map((value, i) => ({ key: String(i), label: String(i), value }))]) {
    const chart = buildStatisticsChart(points, 250, 'bar');
    assert.ok(chart.maximum > chart.minimum);
    assert.ok(chart.ticks.every(tick => Number.isFinite(tick.y)));
  }
});
