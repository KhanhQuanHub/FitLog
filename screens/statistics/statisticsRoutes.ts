import { isStatisticsDate } from '../../domain/statistics/statistics';
import type { PeriodKind } from '../../domain/statistics/types';

export const statisticsCategories = [
  { key: 'time', title: 'Thời gian luyện tập', description: 'Phút tập theo lịch và thời gian chạy bộ', kind: 'week' },
  { key: 'calories', title: 'Calo luyện tập', description: 'Năng lượng từ lịch tập và chạy bộ, theo từng nguồn', kind: 'week' },
  { key: 'running', title: 'Chạy bộ', description: 'Quãng đường, thời gian, bước chân và lịch sử chạy', kind: 'week' },
  { key: 'schedule', title: 'Lịch tập và mức độ hoàn thành', description: 'Buổi hoàn thành, bỏ lỡ và bài tập đã thực hiện', kind: 'week' },
  { key: 'weight', title: 'Cân nặng và BMI', description: 'Số đo gần nhất và diễn biến cân nặng đã lưu', kind: 'month' },
  { key: 'goals', title: 'Tiến độ mục tiêu', description: 'Cam kết số buổi, phút tập và cân nặng đích', kind: 'week' },
  { key: 'habits', title: 'Thói quen luyện tập', description: 'Chuỗi buổi theo lịch và những ngày hoạt động', kind: 'month' },
] as const;

export type StatisticsCategory = typeof statisticsCategories[number]['key'];
export interface StatisticsDestination { category: StatisticsCategory; kind: PeriodKind; anchor: string }
export function parseStatisticsDestination(category: unknown, kind: unknown, date: unknown, today: string): StatisticsDestination | null {
  const entry = statisticsCategories.find(item => item.key === category);
  if (!entry) return null;
  const period: PeriodKind = kind === 'day' || kind === 'week' || kind === 'month' || kind === 'year' ? kind : entry.kind;
  return { category: entry.key, kind: period, anchor: isStatisticsDate(date) && date <= today ? date : today };
}

export function statisticsDetailHref(destination: StatisticsDestination) {
  return { pathname: '/statistics/[category]' as const,
    params: { category: destination.category, kind: destination.kind, date: destination.anchor } };
}
