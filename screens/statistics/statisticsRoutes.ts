// ============================================================================
// Module: screens/statistics/statisticsRoutes.ts
// Chức năng: Định nghĩa danh sách 7 danh mục thống kê của FitLog và các hàm
// kiểm tra / tạo đường dẫn (URL params) khi chuyển giữa màn Tóm tắt, màn
// Tất cả danh mục và 7 màn Chi tiết.
// ============================================================================

import { isStatisticsDate } from '../../domain/statistics/statistics';
import type { PeriodKind } from '../../domain/statistics/types';

/**
 * Danh sách cố định 7 danh mục thống kê trong ứng dụng, kèm kỳ mặc định (`kind`)
 * khi người dùng mở danh mục đó lần đầu.
 */
export const statisticsCategories = [
  {
    key: 'time',
    title: 'Thời gian luyện tập',
    description: 'Phút tập theo lịch và thời gian chạy bộ',
    kind: 'week',
  },
  {
    key: 'calories',
    title: 'Calo luyện tập',
    description: 'Năng lượng từ lịch tập và chạy bộ, theo từng nguồn',
    kind: 'week',
  },
  {
    key: 'running',
    title: 'Chạy bộ',
    description: 'Quãng đường, thời gian, bước chân và lịch sử chạy',
    kind: 'week',
  },
  {
    key: 'schedule',
    title: 'Lịch tập và mức độ hoàn thành',
    description: 'Buổi hoàn thành, bỏ lỡ và bài tập đã thực hiện',
    kind: 'week',
  },
  {
    key: 'weight',
    title: 'Cân nặng và BMI',
    description: 'Số đo gần nhất và diễn biến cân nặng đã lưu',
    kind: 'month',
  },
  {
    key: 'goals',
    title: 'Tiến độ mục tiêu',
    description: 'Cam kết số buổi, phút tập và cân nặng đích',
    kind: 'week',
  },
  {
    key: 'habits',
    title: 'Thói quen luyện tập',
    description: 'Chuỗi buổi theo lịch và những ngày hoạt động',
    kind: 'month',
  },
] as const;

/** Mã định danh của 1 trong 7 danh mục thống kê */
export type StatisticsCategory = (typeof statisticsCategories)[number]['key'];

/** Đích đến khi mở một màn hình thống kê chi tiết */
export interface StatisticsDestination {
  category: StatisticsCategory;
  kind: PeriodKind;
  anchor: string;
}

/**
 * Kiểm tra và chuẩn hóa các tham số đọc từ URL (`useLocalSearchParams`):
 * - Nếu `category` không nằm trong 7 danh mục hợp lệ -> trả về `null`.
 * - Nếu `kind` không hợp lệ -> dùng kỳ mặc định của danh mục đó.
 * - Nếu `date` không hợp lệ hoặc nằm ở tương lai (`> today`) -> dùng ngày `today`.
 *
 * @param category Tham số danh mục từ URL
 * @param kind Tham số loại kỳ từ URL
 * @param date Tham số ngày neo từ URL
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @returns Đối tượng `StatisticsDestination` hợp lệ hoặc `null`
 */
export function parseStatisticsDestination(
  category: unknown,
  kind: unknown,
  date: unknown,
  today: string
): StatisticsDestination | null {
  const entry = statisticsCategories.find((item) => item.key === category);
  if (!entry) {
    return null;
  }

  const isValidPeriodKind =
    kind === 'day' || kind === 'week' || kind === 'month' || kind === 'year';
  const period: PeriodKind = isValidPeriodKind ? kind : entry.kind;

  const anchor = isStatisticsDate(date) && date <= today ? date : today;
  return { category: entry.key, kind: period, anchor };
}

/**
 * Tạo đối tượng đường dẫn (`href`) chuẩn của Expo Router để điều hướng tới
 * màn hình chi tiết `/statistics/[category]`.
 *
 * @param destination Đích đến gồm `category`, `kind` và `anchor`
 * @returns Đối tượng `{ pathname, params }` dùng cho `router.push(...)`
 */
export function statisticsDetailHref(destination: StatisticsDestination) {
  return {
    pathname: '/statistics/[category]' as const,
    params: {
      category: destination.category,
      kind: destination.kind,
      date: destination.anchor,
    },
  };
}
