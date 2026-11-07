// ============================================================================
// Module: screens/statistics/viewModel.ts
// Chức năng: Chuyển đổi dữ liệu thô trong `StatisticsDataSnapshot` và kết quả
// tính toán `calculateStatistics` thành các đối tượng hiển thị trực tiếp trên
// màn hình (nhãn ngày tháng tiếng Việt, danh sách cột biểu đồ, chỉ số có kiểm
// tra trạng thái nguồn tải).
// ============================================================================

import {
  calculateStatistics,
  getStatisticsPeriod,
  isStatisticsDate,
} from '../../domain/statistics/statistics';
import type { StatisticsReport } from '../../domain/statistics/statistics';
import type { PeriodKind, StatisticsMetric } from '../../domain/statistics/types';
import type {
  StatisticsDataSnapshot,
  StatisticsSource,
} from '../../services/statisticsRepository';
import type { StatisticsChartPoint } from '../../components/statistics/presentation';

// ============================================================================
// PHẦN 1: CÁC HÀM ĐỊNH DẠNG NHÃN NGÀY THÁNG & KỲ THỐNG KÊ
// ============================================================================

/**
 * Đổi chuỗi ngày chuẩn `'YYYY-MM-DD'` sang định dạng ngày Việt Nam `'DD/MM/YYYY'`.
 *
 * @param date Chuỗi ngày cần đổi định dạng
 * @returns Chuỗi `'DD/MM/YYYY'` hoặc `'Chưa rõ ngày'` nếu ngày không hợp lệ
 */
export function statisticsDateLabel(date: unknown): string {
  if (!isStatisticsDate(date)) {
    return 'Chưa rõ ngày';
  }
  // Cắt chuỗi YYYY-MM-DD theo vị trí ký tự cố định để ghép thành DD/MM/YYYY
  const day = date.slice(8, 10);
  const month = date.slice(5, 7);
  const year = date.slice(0, 4);
  return `${day}/${month}/${year}`;
}

/**
 * Tạo nhãn hiển thị cho kỳ thống kê đang chọn:
 * - Ngày (`'day'`): `'05/11/2026'`
 * - Tuần (`'week'`): `'02/11/2026 – 08/11/2026'`
 * - Tháng (`'month'`): `'Tháng 11/2026'`
 * - Năm (`'year'`): `'Năm 2026'`
 *
 * @param kind Loại kỳ ('day' | 'week' | 'month' | 'year')
 * @param anchor Ngày neo của kỳ ('YYYY-MM-DD')
 * @returns Chuỗi nhãn kỳ bằng tiếng Việt
 */
export function statisticsPeriodLabel(kind: PeriodKind, anchor: string): string {
  const period = getStatisticsPeriod(kind, anchor);
  if (kind === 'day') {
    return statisticsDateLabel(period.start);
  }
  if (kind === 'month') {
    const monthNumber = Number(period.start.slice(5, 7));
    const year = period.start.slice(0, 4);
    return `Tháng ${monthNumber}/${year}`;
  }
  if (kind === 'year') {
    return `Năm ${period.start.slice(0, 4)}`;
  }
  // Mặc định là kỳ tuần ('week'): hiển thị ngày đầu tuần (Thứ 2) đến cuối tuần (Chủ nhật)
  return `${statisticsDateLabel(period.start)} – ${statisticsDateLabel(period.end)}`;
}

// ============================================================================
// PHẦN 2: CÁC HÀM ĐÓNG GÓI CHỈ SỐ KÈM KIỂM TRA TRẠNG THÁI NGUỒN DỮ LIỆU
// ============================================================================

/**
 * Kiểm tra xem một nguồn dữ liệu đã tải thành công, đầy đủ và không bị cũ (`!stale`) hay chưa.
 *
 * @param source Nguồn dữ liệu cần kiểm tra
 * @returns `true` nếu dữ liệu đang là bản mới nhất và đầy đủ từ server
 */
export function isStatisticsSourceCurrent(source: StatisticsSource<unknown>): boolean {
  return (
    source.data !== null &&
    source.complete &&
    source.status === 'success' &&
    !source.stale
  );
}

/**
 * Kết hợp một chỉ số `metric` với trạng thái của nguồn dữ liệu `source`:
 * - Nếu nguồn chưa có dữ liệu (`source.data === null`), trả về `null` để thẻ hiện dấu `'—'`.
 * - Nếu nguồn đang bị cũ (`stale`) hoặc thiếu bản ghi, đánh dấu `complete: false`
 *   để thẻ hiện ghi chú `"Số liệu chưa đầy đủ"`.
 *
 * @param source Nguồn dữ liệu chứa chỉ số đó
 * @param metric Chỉ số đã tính từ `calculateStatistics`
 * @returns Đối tượng `StatisticsMetric` đã gắn cờ toàn vẹn hoặc `null`
 */
export function sourceMetric(
  source: StatisticsSource<unknown>,
  metric: StatisticsMetric
): StatisticsMetric | null {
  if (source.data === null) {
    return null;
  }
  const isComplete = metric.complete && isStatisticsSourceCurrent(source);
  return {
    value: metric.value,
    missingCount: metric.missingCount,
    complete: isComplete,
  };
}

/**
 * Đóng gói một số đếm nguyên (ví dụ: số buổi hoàn thành, số buổi chạy, chuỗi ngày)
 * thành đối tượng `StatisticsMetric` có kiểm tra trạng thái nguồn `source`.
 *
 * @param source Nguồn dữ liệu
 * @param value Số lượng đếm được
 * @param complete Cờ cho biết phép đếm có đầy đủ hay không (mặc định `true`)
 * @returns Đối tượng `StatisticsMetric` hoặc `null`
 */
export function counted(
  source: StatisticsSource<unknown>,
  value: number,
  complete = true
): StatisticsMetric | null {
  return sourceMetric(source, { value, complete, missingCount: 0 });
}

/**
 * Đổi một chỉ số thời gian từ đơn vị GIÂY sang đơn vị PHÚT (`value / 60`).
 *
 * @param metric Chỉ số thời gian tính bằng giây
 * @returns Chỉ số thời gian tính bằng phút
 */
export function toMinutes(metric: StatisticsMetric): StatisticsMetric {
  return {
    value: metric.value === null ? null : metric.value / 60,
    missingCount: metric.missingCount,
    complete: metric.complete,
  };
}

/**
 * Chuyển một số đo đơn lẻ (như cân nặng, BMI, pace, tốc độ) thành đối tượng `StatisticsMetric`.
 *
 * @param value Giá trị số cần đóng gói
 * @returns Đối tượng `StatisticsMetric`
 */
export function measurement(value: unknown): StatisticsMetric {
  const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
  return {
    value: valid ? value : null,
    complete: valid,
    missingCount: valid ? 0 : 1,
  };
}

// ============================================================================
// PHẦN 3: CÁC HÀM PHỤ XÂY DỰNG DỮ LIỆU BIỂU ĐỒ, CÂN NẶNG & HOẠT ĐỘNG
// ============================================================================

/**
 * Tạo danh sách các điểm cột (`StatisticsChartPoint[]`) cho biểu đồ từ báo cáo thống kê.
 * Loại bỏ các ngày hoặc tháng nằm ở tương lai (lớn hơn `today`) để không vẽ cột 0 giả.
 *
 * @param snapshot Bản chụp 5 nguồn dữ liệu
 * @param report Kết quả tính toán từ `calculateStatistics`
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @param kind Loại kỳ đang chọn ('day' | 'week' | 'month' | 'year')
 * @param source Nguồn hoạt động ('schedule' cho lịch tập, 'running' cho chạy bộ)
 * @param field Trường số liệu cần vẽ ('minutes' | 'calories' | 'distanceKm' | 'steps' | 'sessions')
 * @returns Mảng các điểm `StatisticsChartPoint` để truyền vào `StatisticsBarChart`
 */
function buildChartSeries(
  snapshot: StatisticsDataSnapshot,
  report: StatisticsReport,
  today: string,
  kind: PeriodKind,
  source: 'schedule' | 'running',
  field: 'minutes' | 'calories' | 'distanceKm' | 'steps' | 'sessions'
): StatisticsChartPoint[] {
  const dataSource = source === 'schedule' ? snapshot.workouts : snapshot.runs;
  if (dataSource.data === null) {
    return [];
  }

  // Giới hạn mốc thời gian tối đa là hôm nay (hoặc tháng hiện tại nếu xem theo năm)
  const maxKey = kind === 'year' ? today.slice(0, 7) : today;
  const pastOrTodayBuckets = report.series.filter((bucket) => bucket.key <= maxKey);

  return pastOrTodayBuckets.map((bucket) => {
    const values = bucket[source];
    let raw: unknown = null;

    if (field === 'minutes' && source === 'running') {
      // Thời gian chạy lưu bằng giây nên cần đổi sang phút trước khi vẽ biểu đồ phút
      raw = toMinutes(bucket.running.durationSec);
    } else if (field in values) {
      raw = values[field as keyof typeof values];
    }

    const metric =
      typeof raw === 'number' ? measurement(raw) : (raw as StatisticsMetric | null);

    let fullLabel = statisticsDateLabel(bucket.key);
    let shortAxisLabel = bucket.key.slice(8);
    if (kind === 'year') {
      const monthNumber = Number(bucket.key.slice(5, 7));
      const year = bucket.key.slice(0, 4);
      fullLabel = `Tháng ${monthNumber}/${year}`;
      shortAxisLabel = `T${monthNumber}`;
    }

    return {
      key: bucket.key,
      label: fullLabel,
      axisLabel: shortAxisLabel,
      value: metric?.value ?? null,
      complete: Boolean(metric?.complete) && dataSource.complete && !dataSource.stale,
    };
  });
}

/**
 * Xây dựng hai chỉ số `currentWeight` (cân nặng gần nhất) và `bmi` (chỉ số khối cơ thể).
 * Tách riêng hàm này để kiểm tra rõ ràng độ tin cậy của cả 2 bảng `weights` và `profiles`
 * mà không cần gán đè `.complete = false` rải rác.
 *
 * @param snapshot Bản chụp 5 nguồn dữ liệu
 * @param report Kết quả tính toán từ `calculateStatistics`
 * @returns Cặp chỉ số `{ currentWeight, bmi }`
 */
function buildWeightAndBmiMetrics(
  snapshot: StatisticsDataSnapshot,
  report: StatisticsReport
): {
  currentWeight: StatisticsMetric | null;
  bmi: StatisticsMetric | null;
} {
  // 1. Tính chỉ số cân nặng gần nhất (lấy từ lịch sử cân hoặc dự phòng từ hồ sơ)
  const weightSource =
    report.weight.source === 'history' ? snapshot.weights : snapshot.profiles;
  const baseWeightMetric = sourceMetric(
    weightSource,
    measurement(report.weight.currentKg)
  );

  // Dù lấy cân nặng từ hồ sơ, nếu bảng lịch sử cân (`weights`) chưa tải đủ hoặc lỗi
  // thì ta vẫn phải đánh dấu `complete = false` vì có thể còn lần cân mới hơn chưa tải được
  const isWeightHistoryReady =
    snapshot.weights.data !== null && snapshot.weights.complete;

  const currentWeight: StatisticsMetric | null = baseWeightMetric
    ? {
        ...baseWeightMetric,
        complete: baseWeightMetric.complete && isWeightHistoryReady,
      }
    : null;

  // 2. Tính chỉ số BMI (cần cả chiều cao từ `profiles` và cân nặng tin cậy từ `currentWeight`)
  if (snapshot.profiles.data === null) {
    return { currentWeight, bmi: null };
  }

  const baseBmiMetric = sourceMetric(snapshot.profiles, measurement(report.weight.bmi));
  const bmi: StatisticsMetric | null = baseBmiMetric
    ? {
        ...baseBmiMetric,
        complete: baseBmiMetric.complete && currentWeight?.complete === true,
      }
    : null;

  return { currentWeight, bmi };
}

/**
 * Kiểm tra trạng thái sẵn sàng và độ đầy đủ của dữ liệu hoạt động kết hợp
 * (hợp nhất từ cả bảng `workouts` và bảng `runs`, phục vụ màn Thói quen luyện tập).
 *
 * @param snapshot Bản chụp 5 nguồn dữ liệu
 * @param report Kết quả tính toán từ `calculateStatistics`
 * @returns Đối tượng `{ activityAvailable, activityComplete }`
 */
function checkCombinedActivityStatus(
  snapshot: StatisticsDataSnapshot,
  report: StatisticsReport
): {
  activityAvailable: boolean;
  activityComplete: boolean;
} {
  // Chỉ cần ít nhất 1 trong 2 nguồn (lịch tập hoặc chạy bộ) đã tải được mảng dữ liệu là có thể hiển thị
  const activityAvailable =
    snapshot.workouts.data !== null || snapshot.runs.data !== null;

  // Nhưng để kết luận chắc chắn "Ngày đó không tập" (`activityComplete = true`),
  // cả 2 nguồn phải tải đủ, không bị cũ và không có bản ghi nào hỏng ngày/trạng thái
  const bothSourcesComplete =
    snapshot.workouts.complete &&
    snapshot.runs.complete &&
    !snapshot.workouts.stale &&
    !snapshot.runs.stale;

  const noInvalidRecords =
    report.quality.invalidWorkoutDates === 0 &&
    report.schedule.counts.unknown === 0 &&
    report.quality.invalidRunDates === 0 &&
    report.running.incompleteRecords === 0;

  return {
    activityAvailable,
    activityComplete: bothSourcesComplete && noInvalidRecords,
  };
}

// ============================================================================
// PHẦN 4: HÀM CHÍNH XÂY DỰNG VIEW MODEL CHO MÀN HÌNH THỐNG KÊ
// ============================================================================

/**
 * Xây dựng toàn bộ mô hình hiển thị (`StatisticsView`) cho một màn hình thống kê
 * từ bản chụp dữ liệu `snapshot`, ngày hôm nay `today`, loại kỳ `kind` và ngày neo `anchor`.
 *
 * @param snapshot Bản chụp 5 nguồn dữ liệu từ `StatisticsRepository`
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @param kind Loại kỳ đang xem ('day' | 'week' | 'month' | 'year')
 * @param anchor Ngày neo của kỳ đang xem ('YYYY-MM-DD')
 * @returns Đối tượng `StatisticsView` hoặc `null` nếu người dùng chưa đăng nhập
 */
export function buildStatisticsView(
  snapshot: StatisticsDataSnapshot,
  today: string,
  kind: PeriodKind,
  anchor: string
) {
  if (snapshot.session.userId === null) {
    return null;
  }

  // Bước 1: Gọi hàm tính toán thuần túy từ tầng domain
  const report = calculateStatistics({
    userId: snapshot.session.userId,
    today,
    kind,
    anchor,
    workouts: snapshot.workouts.data ?? [],
    runs: snapshot.runs.data ?? [],
    profiles: snapshot.profiles.data ?? [],
    weights: snapshot.weights.data ?? [],
    userGoals: snapshot.userGoals.data ?? [],
  });

  // Bước 2: Tạo nhãn kỳ tiếng Việt và hàm tạo chuỗi điểm biểu đồ
  const label = statisticsPeriodLabel(kind, anchor);
  const series = (
    source: 'schedule' | 'running',
    field: 'minutes' | 'calories' | 'distanceKm' | 'steps' | 'sessions'
  ) => buildChartSeries(snapshot, report, today, kind, source, field);

  // Bước 3: Tính chỉ số Cân nặng hiện tại và BMI
  const { currentWeight, bmi } = buildWeightAndBmiMetrics(snapshot, report);

  // Bước 4: Kiểm tra dữ liệu hoạt động kết hợp (dùng cho màn Thói quen luyện tập)
  const { activityAvailable, activityComplete } = checkCombinedActivityStatus(
    snapshot,
    report
  );

  return {
    report,
    label,
    series,
    currentWeight,
    bmi,
    activityAvailable,
    activityComplete,
  };
}

export type StatisticsView = NonNullable<ReturnType<typeof buildStatisticsView>>;
