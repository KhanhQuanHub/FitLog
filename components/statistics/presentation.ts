// ============================================================================
// Module: components/statistics/presentation.ts
// Chức năng: Chứa các hàm định dạng số liệu sang chuỗi hiển thị tiếng Việt
// (số có dấu chấm/phẩy phân cách, pace phút:giây, thời gian giờ:phút:giây,
// phần trăm tiến độ) và tính toán tọa độ hình học (x, y, đường nối SVG) cho
// biểu đồ cột (Bar Chart) và biểu đồ đường (Line Chart).
// ============================================================================

import type { StatisticsMetric } from '../../domain/statistics/types';

/** Các loại đơn vị đo lường được hiển thị trong các thẻ và biểu đồ thống kê */
export type StatisticsUnit =
  | 'count'
  | 'km'
  | 'kcal'
  | 'kg'
  | 'minutes'
  | 'seconds'
  | 'pace'
  | 'speed'
  | 'cadence'
  | 'bmi';

/** Bảng tra cứu nhãn đơn vị tiếng Việt mặc định cho từng `StatisticsUnit` */
export const STATISTICS_UNITS: Record<StatisticsUnit, string> = {
  count: 'buổi',
  km: 'km',
  kcal: 'kcal',
  kg: 'kg',
  minutes: 'phút',
  seconds: '',
  pace: 'phút/km',
  speed: 'km/h',
  cadence: 'bước/phút',
  bmi: '',
};

// ============================================================================
// PHẦN 1: CÁC HÀM ĐỊNH DẠNG SỐ LIỆU & CHUỖI HIỂN THỊ TIẾNG VIỆT
// ============================================================================

/**
 * Kiểm tra một giá trị có phải là số hữu hạn không âm (`>= 0`) hay không.
 *
 * @param value Giá trị cần kiểm tra
 * @returns `true` nếu là số hợp lệ `>= 0`
 */
function valid(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Định dạng một con số theo chuẩn tiếng Việt (`vi-VN`, dùng dấu chấm phân cách hàng nghìn
 * và dấu phẩy cho phần thập phân). Nếu số không hợp lệ (`null`, `NaN`, âm) thì trả về `'—'`.
 *
 * @param value Giá trị số cần định dạng (hoặc `null`)
 * @param digits Số chữ số thập phân tối đa (mặc định là 0)
 * @returns Chuỗi số đã định dạng hoặc `'—'`
 */
export function formatStatisticsNumber(value: number | null, digits = 0): string {
  if (!valid(value)) {
    return '—';
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
}

/**
 * Đổi số giây trên mỗi km (`pace`) sang chuỗi định dạng `'Phút:Giây'` (`M:SS`).
 * Ví dụ: `385` giây/km -> `6` phút và `25` giây -> `'6:25'`.
 *
 * @param secondsPerKm Số giây cần để hoàn thành 1 km
 * @returns Chuỗi `'M:SS'` hoặc `'—'` nếu pace bằng 0
 */
function formatPaceMmSs(secondsPerKm: number): string {
  if (secondsPerKm === 0) {
    return '—';
  }
  const totalSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * Đổi tổng số giây thời lượng sang chuỗi định dạng `'Giờ:Phút:Giây'` (`HH:MM:SS`).
 * Ví dụ: `3725` giây -> `1` giờ, `2` phút, `5` giây -> `'01:02:05'`.
 *
 * @param durationSec Tổng thời gian tính bằng giây
 * @returns Chuỗi `'HH:MM:SS'`
 */
function formatDurationHhMmSs(durationSec: number): string {
  const totalSeconds = Math.round(durationSec);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Định dạng giá trị số theo từng loại đơn vị đo (`unit`):
 * - `'pace'` (nhận đầu vào là số GIÂY/km): đổi sang dạng `M:SS`.
 * - `'seconds'` (nhận đầu vào là số GIÂY): đổi sang dạng `HH:MM:SS`.
 * - `'km'`, `'kg'`, `'speed'`: giữ tối đa 2 chữ số thập phân.
 * - `'minutes'`, `'bmi'`, `'cadence'`: giữ tối đa 1 chữ số thập phân.
 * - Các đơn vị đếm khác: làm tròn số nguyên.
 *
 * @param value Giá trị số cần định dạng
 * @param unit Đơn vị đo lường `StatisticsUnit`
 * @returns Chuỗi biểu diễn giá trị hoặc `'—'` nếu thiếu dữ liệu
 */
export function formatStatisticsValue(value: number | null, unit: StatisticsUnit): string {
  if (!valid(value)) {
    return '—';
  }

  if (unit === 'pace') {
    return formatPaceMmSs(value);
  }

  if (unit === 'seconds') {
    return formatDurationHhMmSs(value);
  }

  let digits = 0;
  if (['km', 'kg', 'speed'].includes(unit)) {
    digits = 2;
  } else if (['minutes', 'bmi', 'cadence'].includes(unit)) {
    digits = 1;
  }

  return formatStatisticsNumber(value, digits);
}

/**
 * Chuẩn bị dữ liệu hiển thị cho một thẻ chỉ số (`StatisticsMetricCard`):
 * gồm chuỗi giá trị (`value`), nhãn đơn vị (`unit`), ghi chú trạng thái (`note`)
 * và chuỗi đọc màn hình (`accessible`).
 *
 * @param metric Đối tượng chỉ số thống kê (hoặc `null`)
 * @param unit Loại đơn vị đo
 * @param unitLabel Nhãn đơn vị tùy chỉnh (nếu muốn ghi đè bảng `STATISTICS_UNITS`)
 * @returns Đối tượng chứa `{ value, unit, note, accessible }`
 */
export function describeStatisticsMetric(
  metric: StatisticsMetric | null,
  unit: StatisticsUnit,
  unitLabel?: string
) {
  const value = metric && valid(metric.value) ? metric.value : null;
  const display = formatStatisticsValue(value, unit);
  const suffix = display === '—' ? '' : unitLabel ?? STATISTICS_UNITS[unit];

  let note: string | null = null;
  if (value === null) {
    note = 'Chưa có dữ liệu';
  } else if (metric?.complete === false) {
    note = 'Số liệu chưa đầy đủ';
  }

  return {
    value: display,
    unit: suffix,
    note,
    accessible: [display, suffix, note].filter(Boolean).join(' '),
  };
}

/**
 * Tính toán phần trăm, tỷ lệ tô đầy (`fill` từ 0 đến 1) và thông báo giải thích
 * cho thanh hoặc vòng tròn tiến độ mục tiêu (`StatisticsProgress`).
 *
 * @param metric Số liệu thực tế đạt được
 * @param target Mục tiêu cam kết cần đạt
 * @returns Đối tượng `{ percent, fill, message }`
 */
export function describeStatisticsProgress(
  metric: StatisticsMetric | null,
  target: number | null
) {
  const value = metric?.value;
  const isKnown = valid(value) && metric?.complete === true && valid(target) && target > 0;
  const rawPercent = isKnown ? (value / target) * 100 : null;
  const percent = rawPercent !== null && Number.isFinite(rawPercent) ? rawPercent : null;

  // Tỷ lệ tô vòng tròn chỉ nằm trong khoảng [0, 1] dù người dùng đạt trên 100% mục tiêu
  const fill = percent !== null ? Math.min(percent, 100) / 100 : 0;

  let message: string | null = null;
  if (!metric || !valid(value)) {
    message = 'Chưa có dữ liệu luyện tập';
  } else if (metric.complete === false) {
    message = 'Chưa đủ dữ liệu để tính tiến độ';
  } else if (!valid(target) || target <= 0) {
    message = 'Chưa có cam kết cho chỉ số này';
  }

  return { percent, fill, message };
}

// ============================================================================
// PHẦN 2: CÁC HÀM TÍNH TỌA ĐỘ HÌNH HỌC CHO BIỂU ĐỒ CỘT & BIỂU ĐỒ ĐƯỜNG
// ============================================================================

/** Điểm dữ liệu đầu vào cho một cột hoặc một mốc trên biểu đồ */
export interface StatisticsChartPoint {
  key: string;
  label: string;
  axisLabel?: string;
  value: number | null;
  complete?: boolean;
  /** Tọa độ thời gian thực (ví dụ: số ngày tính từ đầu kỳ) dùng cho biểu đồ đường cân nặng */
  position?: number;
}

/** Tọa độ pixel `(x, y)` đã tính của một điểm trên khung vẽ SVG */
export interface StatisticsChartPlotPoint {
  x: number;
  y: number | null;
  value: number | null;
  baseline: number;
}

/** Kết quả tính tọa độ hình học để vẽ biểu đồ bằng SVG */
export interface StatisticsChartGeometry {
  width: number;
  height: number;
  minimum: number;
  maximum: number;
  ticks: { value: number; y: number }[];
  points: StatisticsChartPlotPoint[];
  paths: string[];
}

/**
 * Tính giá trị nhỏ nhất (`minimum`) và lớn nhất (`maximum`) trên trục dọc (Y) của biểu đồ.
 * Thêm khoảng đệm (`padding`) để đỉnh cột hoặc điểm tròn không chạm sát mép khung vẽ.
 *
 * @param knownValues Mảng các giá trị số hợp lệ có trong kỳ
 * @param kind Loại biểu đồ ('bar' | 'line')
 * @returns Cặp `{ minimum, maximum }`
 */
function calculateChartVerticalRange(
  knownValues: readonly number[],
  kind: 'bar' | 'line'
): { minimum: number; maximum: number } {
  const low = knownValues.length > 0 ? Math.min(...knownValues) : 0;
  const high = knownValues.length > 0 ? Math.max(...knownValues) : 0;
  const padding = Math.max((high - low) * 0.15, high * 0.01, 0.5);

  // Biểu đồ cột luôn bắt đầu từ đáy 0; biểu đồ đường (như cân nặng) thu phóng quanh khoảng [low, high]
  const minimum = kind === 'line' ? Math.max(0, low - padding) : 0;
  const maximum = Math.max(
    kind === 'line' ? high + padding : high * 1.1,
    minimum + 1
  );

  return { minimum, maximum };
}

/**
 * Tính chiều rộng tổng của biểu đồ (`width`, `plotWidth`) và thông số vị trí ngang (`positions`, `span`).
 * Đảm bảo mỗi mốc cách nhau ít nhất 48px để người dùng dễ chạm ngón tay trên điện thoại.
 *
 * @param points Danh sách các điểm dữ liệu đầu vào
 * @param viewport Chiều rộng vùng nhìn thấy hiện tại (pixel)
 * @param leftMargin Lề trái/phải của vùng vẽ (pixel)
 * @param kind Loại biểu đồ ('bar' | 'line')
 * @returns Thông số bố cục ngang `{ width, plotWidth, positions, isStrictlyOrdered, span }`
 */
function calculateChartHorizontalLayout(
  points: readonly StatisticsChartPoint[],
  viewport: number,
  leftMargin: number,
  kind: 'bar' | 'line'
): {
  width: number;
  plotWidth: number;
  positions: number[];
  isStrictlyOrdered: boolean;
  span: number;
} {
  const positions = points.map((point, index) =>
    valid(point.position) ? point.position : index
  );

  const isStrictlyOrdered =
    kind === 'line' &&
    positions.every(
      (position, index) => index === 0 || position > positions[index - 1]
    );

  const steps =
    isStrictlyOrdered && points.length > 1
      ? positions.slice(1).map((position, index) => position - positions[index])
      : [1];

  const span =
    isStrictlyOrdered && points.length > 1
      ? positions.at(-1)! - positions[0]
      : Math.max(points.length - 1, 1);

  const minGap = Math.min(...steps);

  const minContentWidth =
    kind === 'bar'
      ? points.length * 48 + leftMargin * 2
      : (span / minGap) * 48 + leftMargin * 2;

  const safeViewport = Number.isFinite(viewport) ? viewport : 0;
  const width = Math.max(safeViewport, 100, minContentWidth);
  const plotWidth = width - leftMargin * 2;

  return { width, plotWidth, positions, isStrictlyOrdered, span };
}

/**
 * Tính tọa độ `(x, y)` cho từng cột trong biểu đồ cột (`kind === 'bar'`).
 * Các cột được chia đều khoảng cách dọc theo `plotWidth`.
 *
 * @param values Mảng giá trị số (hoặc `null` nếu thiếu)
 * @param leftMargin Lề trái của vùng vẽ
 * @param plotWidth Chiều rộng vùng vẽ
 * @param bottomY Tọa độ Y của đáy cột
 * @param valueToY Hàm đổi giá trị số sang tọa độ trục dọc Y
 * @returns Mảng điểm tọa độ `StatisticsChartPlotPoint[]`
 */
function buildBarChartPlotPoints(
  values: readonly (number | null)[],
  leftMargin: number,
  plotWidth: number,
  bottomY: number,
  valueToY: (value: number) => number
): StatisticsChartPlotPoint[] {
  const count = Math.max(values.length, 1);
  return values.map((value, index) => {
    const x = leftMargin + ((index + 0.5) * plotWidth) / count;
    const y = value === null ? null : valueToY(value);
    return { x, y, value, baseline: bottomY };
  });
}

/**
 * Tính tọa độ `(x, y)` cho từng điểm trong biểu đồ đường (`kind === 'line'`).
 * Nếu chỉ có 1 điểm duy nhất thì đặt ở chính giữa biểu đồ (`width / 2`);
 * nếu có nhiều điểm thì đặt theo đúng khoảng cách thời gian thực (`positions`).
 *
 * @param values Mảng giá trị số (hoặc `null` nếu thiếu)
 * @param positions Mảng vị trí thời gian của từng điểm
 * @param isStrictlyOrdered Các vị trí có tăng dần nghiêm ngặt hay không
 * @param span Tổng khoảng cách từ điểm đầu tới điểm cuối
 * @param leftMargin Lề trái của vùng vẽ
 * @param width Tổng chiều rộng khung SVG
 * @param plotWidth Chiều rộng vùng vẽ
 * @param bottomY Tọa độ Y của đáy biểu đồ
 * @param valueToY Hàm đổi giá trị số sang tọa độ trục dọc Y
 * @returns Mảng điểm tọa độ `StatisticsChartPlotPoint[]`
 */
function buildLineChartPlotPoints(
  values: readonly (number | null)[],
  positions: readonly number[],
  isStrictlyOrdered: boolean,
  span: number,
  leftMargin: number,
  width: number,
  plotWidth: number,
  bottomY: number,
  valueToY: (value: number) => number
): StatisticsChartPlotPoint[] {
  return values.map((value, index) => {
    let x: number;
    if (values.length === 1) {
      x = width / 2;
    } else {
      const offsetFromStart = isStrictlyOrdered
        ? positions[index] - positions[0]
        : index;
      x = leftMargin + (offsetFromStart / span) * plotWidth;
    }

    const y = value === null ? null : valueToY(value);
    return { x, y, value, baseline: bottomY };
  });
}

/**
 * Tạo danh sách các chuỗi lệnh SVG Path (`'M x,y L x2,y2'`) nối các điểm của biểu đồ đường.
 * Nếu gặp một mốc bị thiếu dữ liệu (`dot.y === null`), ngắt đoạn thẳng tại đó chứ không nối bắc cầu.
 *
 * @param dots Danh sách tọa độ các điểm trên biểu đồ
 * @returns Mảng các chuỗi lệnh SVG Path
 */
function buildSvgLinePaths(dots: readonly StatisticsChartPlotPoint[]): string[] {
  const paths: string[] = [];
  let currentPath = '';

  for (const dot of dots) {
    if (dot.y === null) {
      if (currentPath) {
        paths.push(currentPath);
      }
      currentPath = '';
    } else {
      const command = currentPath ? ' L' : 'M';
      currentPath += `${command}${dot.x},${dot.y}`;
    }
  }

  if (currentPath) {
    paths.push(currentPath);
  }

  return paths;
}

/**
 * Tính toán kích thước khung vẽ (`width`, `height`), các đường kẻ ngang (`ticks`),
 * tọa độ `(x, y)` của từng điểm dữ liệu và các đoạn thẳng nối điểm (`paths`)
 * cho biểu đồ cột (`kind === 'bar'`) hoặc biểu đồ đường (`kind === 'line'`).
 *
 * @param points Danh sách các điểm dữ liệu cần vẽ
 * @param viewport Chiều rộng vùng nhìn thấy hiện tại trên màn hình (pixel)
 * @param kind Loại biểu đồ ('bar' | 'line')
 * @returns Đối tượng hình học `StatisticsChartGeometry` để component SVG render
 */
export function buildStatisticsChart(
  points: readonly StatisticsChartPoint[],
  viewport: number,
  kind: 'bar' | 'line'
): StatisticsChartGeometry {
  const height = 184;
  const topY = 16;
  const bottomY = height - 28;
  const leftMargin = 24;

  // Bước 1: Tìm khoảng giá trị [minimum, maximum] trên trục dọc Y
  const values = points.map((point) => (valid(point.value) ? point.value : null));
  const knownValues = values.filter((value): value is number => value !== null);
  const { minimum, maximum } = calculateChartVerticalRange(knownValues, kind);

  // Bước 2: Tính chiều rộng biểu đồ và khoảng cách trên trục ngang X
  const { width, plotWidth, positions, isStrictlyOrdered, span } =
    calculateChartHorizontalLayout(points, viewport, leftMargin, kind);

  /**
   * Quy đổi một giá trị số sang tọa độ trục dọc Y trong SVG.
   * Lưu ý: Trong hệ tọa độ SVG, y = `topY` nằm ở phía trên (ứng với `maximum`),
   * còn y = `bottomY` nằm ở phía dưới (ứng với `minimum`).
   */
  const valueToY = (value: number): number => {
    const ratio = (maximum - value) / (maximum - minimum);
    return topY + ratio * (bottomY - topY);
  };

  // Bước 3: Tính tọa độ (x, y) cho từng điểm theo loại biểu đồ cột hoặc đường
  const plotPoints =
    kind === 'bar'
      ? buildBarChartPlotPoints(values, leftMargin, plotWidth, bottomY, valueToY)
      : buildLineChartPlotPoints(
          values,
          positions,
          isStrictlyOrdered,
          span,
          leftMargin,
          width,
          plotWidth,
          bottomY,
          valueToY
        );

  // Bước 4: Tạo đường nối SVG Path và 3 vạch chia (ticks) trên trục Y
  const paths = buildSvgLinePaths(plotPoints);
  const tickValues = [maximum, (maximum + minimum) / 2, minimum];
  const ticks = tickValues.map((value) => ({
    value,
    y: valueToY(value),
  }));

  return {
    width,
    height,
    minimum,
    maximum,
    points: plotPoints,
    paths,
    ticks,
  };
}
