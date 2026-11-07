import { calculateStatistics, getStatisticsPeriod, isStatisticsDate } from '../../domain/statistics/statistics';
import type { PeriodKind, StatisticsMetric } from '../../domain/statistics/types';
import type { StatisticsDataSnapshot, StatisticsSource } from '../../services/statisticsRepository';
import type { StatisticsChartPoint } from '../../components/statistics/presentation';

export function statisticsDateLabel(date: unknown): string {
  if (!isStatisticsDate(date)) return 'Chưa rõ ngày';
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function statisticsPeriodLabel(kind: PeriodKind, anchor: string): string {
  const period = getStatisticsPeriod(kind, anchor);
  if (kind === 'day') return statisticsDateLabel(period.start);
  if (kind === 'month') return `Tháng ${Number(period.start.slice(5, 7))}/${period.start.slice(0, 4)}`;
  if (kind === 'year') return `Năm ${period.start.slice(0, 4)}`;
  return `${statisticsDateLabel(period.start)} – ${statisticsDateLabel(period.end)}`;
}

export function sourceMetric(source: StatisticsSource<unknown>, metric: StatisticsMetric): StatisticsMetric | null {
  if (source.data === null) return null;
  return { ...metric, complete: metric.complete && isStatisticsSourceCurrent(source) };
}

export function isStatisticsSourceCurrent(source: StatisticsSource<unknown>): boolean {
  return source.data !== null && source.complete && source.status === 'success' && !source.stale;
}

export function counted(source: StatisticsSource<unknown>, value: number, complete = true): StatisticsMetric | null {
  return sourceMetric(source, { value, complete, missingCount: 0 });
}

export function toMinutes(metric: StatisticsMetric): StatisticsMetric {
  return { ...metric, value: metric.value === null ? null : metric.value / 60 };
}

export function measurement(value: unknown): StatisticsMetric {
  const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
  return { value: valid ? value : null, complete: valid, missingCount: valid ? 0 : 1 };
}

export function buildStatisticsView(snapshot: StatisticsDataSnapshot, today: string, kind: PeriodKind, anchor: string) {
  if (snapshot.session.userId === null) return null;
  // [] chỉ phục vụ phép tính thuần; màn hình phải đi qua cổng nguồn tương ứng.
  const report = calculateStatistics({
    userId: snapshot.session.userId, today, kind, anchor,
    workouts: snapshot.workouts.data ?? [], runs: snapshot.runs.data ?? [],
    profiles: snapshot.profiles.data ?? [], weights: snapshot.weights.data ?? [], userGoals: snapshot.userGoals.data ?? [],
  });
  const label = statisticsPeriodLabel(kind, anchor);
  function series(source: 'schedule' | 'running', field: 'minutes' | 'calories' | 'distanceKm' | 'steps' | 'sessions'): StatisticsChartPoint[] {
    const dataSource = source === 'schedule' ? snapshot.workouts : snapshot.runs;
    if (dataSource.data === null) return [];
    return report.series.filter(bucket => bucket.key <= (kind === 'year' ? today.slice(0, 7) : today)).map(bucket => {
      const values = bucket[source];
      const raw = field === 'minutes' && source === 'running' ? toMinutes(bucket.running.durationSec)
        : field in values ? values[field as keyof typeof values] : null;
      const metric = typeof raw === 'number' ? measurement(raw) : raw as StatisticsMetric | null;
      const full = kind === 'year' ? `Tháng ${Number(bucket.key.slice(5, 7))}/${bucket.key.slice(0, 4)}` : statisticsDateLabel(bucket.key);
      return { key: bucket.key, label: full, axisLabel: kind === 'year' ? `T${Number(bucket.key.slice(5, 7))}` : bucket.key.slice(8),
        value: metric?.value ?? null, complete: !!metric?.complete && dataSource.complete && !dataSource.stale };
    });
  }
  const weightSource = report.weight.source === 'history' ? snapshot.weights : snapshot.profiles;
  const currentWeight = sourceMetric(weightSource, measurement(report.weight.currentKg));
  if (currentWeight && (!snapshot.weights.complete || snapshot.weights.data === null)) currentWeight.complete = false;
  const bmi = snapshot.profiles.data === null ? null : sourceMetric(snapshot.profiles, measurement(report.weight.bmi));
  if (bmi && currentWeight?.complete !== true) bmi.complete = false;
  const activityAvailable = snapshot.workouts.data !== null || snapshot.runs.data !== null;
  const activityComplete = snapshot.workouts.complete && snapshot.runs.complete && !snapshot.workouts.stale && !snapshot.runs.stale
    && report.quality.invalidWorkoutDates === 0 && report.schedule.counts.unknown === 0
    && report.quality.invalidRunDates === 0 && report.running.incompleteRecords === 0;
  return { report, label, series, currentWeight, bmi, activityAvailable, activityComplete };
}

export type StatisticsView = NonNullable<ReturnType<typeof buildStatisticsView>>;
