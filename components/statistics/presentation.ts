import type { StatisticsMetric } from '../../domain/statistics/types';

export type StatisticsUnit = 'count' | 'km' | 'kcal' | 'kg' | 'minutes' | 'seconds' | 'pace' | 'speed' | 'cadence' | 'bmi';
export const STATISTICS_UNITS: Record<StatisticsUnit, string> = {
  count: 'buổi', km: 'km', kcal: 'kcal', kg: 'kg', minutes: 'phút', seconds: '',
  pace: 'phút/km', speed: 'km/h', cadence: 'bước/phút', bmi: '',
};

function valid(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function formatStatisticsNumber(value: number | null, digits = 0): string {
  return valid(value) ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value) : '—';
}

// Pace nhận GIÂY/km; không truyền nhầm vào helper phút/km của màn chạy.
export function formatStatisticsValue(value: number | null, unit: StatisticsUnit): string {
  if (!valid(value)) return '—';
  if (unit === 'pace') {
    if (value === 0) return '—';
    const total = Math.round(value);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
  if (unit === 'seconds') {
    const total = Math.round(value);
    return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor(total % 3600 / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  return formatStatisticsNumber(value, ['km', 'kg', 'speed'].includes(unit) ? 2 : ['minutes', 'bmi', 'cadence'].includes(unit) ? 1 : 0);
}

export function describeStatisticsMetric(metric: StatisticsMetric | null, unit: StatisticsUnit, unitLabel?: string) {
  const value = metric && valid(metric.value) ? metric.value : null;
  const display = formatStatisticsValue(value, unit);
  const suffix = display === '—' ? '' : unitLabel ?? STATISTICS_UNITS[unit];
  const note = value === null ? 'Chưa có dữ liệu' : metric?.complete === false ? 'Số liệu chưa đầy đủ' : null;
  return { value: display, unit: suffix, note, accessible: [display, suffix, note].filter(Boolean).join(' ') };
}

export function describeStatisticsProgress(metric: StatisticsMetric | null, target: number | null) {
  const value = metric?.value;
  const known = valid(value) && metric?.complete === true && valid(target) && target > 0;
  const percent = known ? value / target * 100 : null;
  return {
    percent: percent !== null && Number.isFinite(percent) ? percent : null,
    fill: percent !== null && Number.isFinite(percent) ? Math.min(percent, 100) / 100 : 0,
    message: !metric || !valid(value) ? 'Chưa có dữ liệu luyện tập'
      : metric.complete === false ? 'Chưa đủ dữ liệu để tính tiến độ'
        : !valid(target) || target <= 0 ? 'Chưa có cam kết cho chỉ số này' : null,
  };
}

export interface StatisticsChartPoint {
  key: string;
  label: string;
  axisLabel?: string;
  value: number | null;
  complete?: boolean;
  // Tọa độ thời gian, ví dụ số ngày từ đầu kỳ, để khoảng cách lần cân đúng thực tế.
  position?: number;
}

export interface StatisticsChartGeometry {
  width: number;
  height: number;
  minimum: number;
  maximum: number;
  ticks: { value: number; y: number }[];
  points: { x: number; y: number | null; value: number | null; baseline: number }[];
  paths: string[];
}

export function buildStatisticsChart(points: readonly StatisticsChartPoint[], viewport: number, kind: 'bar' | 'line'): StatisticsChartGeometry {
  const height = 184;
  const top = 16;
  const bottom = height - 28;
  const left = 24;
  const values = points.map(point => valid(point.value) ? point.value : null);
  const known = values.filter((value): value is number => value !== null);
  const low = known.length ? Math.min(...known) : 0;
  const high = known.length ? Math.max(...known) : 0;
  const padding = Math.max((high - low) * 0.15, high * 0.01, 0.5);
  const minimum = kind === 'line' ? Math.max(0, low - padding) : 0;
  const maximum = Math.max(kind === 'line' ? high + padding : high * 1.1, minimum + 1);
  const positions = points.map((point, index) => valid(point.position) ? point.position : index);
  const ordered = kind === 'line' && positions.every((position, index) => index === 0 || position > positions[index - 1]);
  const steps = ordered && points.length > 1 ? positions.slice(1).map((position, index) => position - positions[index]) : [1];
  const span = ordered && points.length > 1 ? positions.at(-1)! - positions[0] : Math.max(points.length - 1, 1);
  const gap = Math.min(...steps);
  const width = Math.max(Number.isFinite(viewport) ? viewport : 0, 100, kind === 'bar' ? points.length * 48 + left * 2 : span / gap * 48 + left * 2);
  const plotWidth = width - left * 2;
  const y = (value: number) => top + (maximum - value) / (maximum - minimum) * (bottom - top);
  const dots = values.map((value, index) => ({
    x: kind === 'bar' ? left + (index + 0.5) * plotWidth / Math.max(points.length, 1)
      : points.length === 1 ? width / 2 : left + (ordered ? positions[index] - positions[0] : index) / span * plotWidth,
    y: value === null ? null : y(value), value, baseline: bottom,
  }));
  const paths: string[] = [];
  let path = '';
  for (const dot of dots) {
    if (dot.y === null) { if (path) paths.push(path); path = ''; }
    else path += `${path ? ' L' : 'M'}${dot.x},${dot.y}`;
  }
  if (path) paths.push(path);
  return { width, height, minimum, maximum, points: dots, paths,
    ticks: [maximum, (maximum + minimum) / 2, minimum].map(value => ({ value, y: y(value) })) };
}
