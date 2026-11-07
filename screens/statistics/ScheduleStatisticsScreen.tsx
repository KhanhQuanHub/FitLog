import { StatisticsActivityRow, StatisticsBarChart } from '../../components/statistics';
import { formatStatisticsNumber, formatStatisticsValue } from '../../components/statistics/presentation';
import { getWorkoutState } from '../../domain/statistics/statistics';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type { StatisticsScreenContext, StatisticsScreenProps } from './StatisticsDetailScreen';
import { StatisticsHistory, StatisticsInfo, StatisticsMetricGrid, StatisticsSection, StatisticsSourceSection } from './shared';
import { counted, measurement, sourceMetric, statisticsDateLabel } from './viewModel';

function ScheduleContent({ snapshot, view, today, refresh, chartWidth }: StatisticsScreenContext) {
  const { report, label, series } = view;
  const { schedule } = report;
  const stateLabels = { done: 'Đã hoàn thành', missed: 'Bỏ lỡ', pending: 'Còn chờ', unknown: 'Chưa xác định' };
  return <StatisticsSourceSection title="Kết quả theo lịch" source={snapshot.workouts} refresh={refresh}>
    <StatisticsMetricGrid items={[
      { title: 'Buổi hoàn thành', periodLabel: label, metric: counted(snapshot.workouts, schedule.counts.done), unit: 'count' },
      { title: 'Buổi bỏ lỡ', periodLabel: label, metric: counted(snapshot.workouts, schedule.counts.missed), unit: 'count' },
      { title: 'Buổi còn chờ', periodLabel: label, metric: counted(snapshot.workouts, schedule.counts.pending), unit: 'count' },
      { title: 'Tỷ lệ hoàn thành', periodLabel: label, metric: sourceMetric(snapshot.workouts, measurement(schedule.completionPercent)), unit: 'bmi', unitLabel: '%' },
    ]} />
    <StatisticsBarChart width={chartWidth} title="Buổi theo lịch đã hoàn thành" unit="count" points={series('schedule', 'sessions')} />
    {schedule.counts.unknown > 0 || report.quality.invalidWorkoutDates > 0 ? <StatisticsInfo>Có buổi chưa rõ trạng thái hoặc ngày nên chưa thể đánh giá đầy đủ.</StatisticsInfo> : null}
    <StatisticsSection title="Bài tập thường thực hiện">
      <StatisticsHistory records={schedule.byExercise} emptyMessage="Chưa có buổi hoàn thành để thống kê bài tập." renderRow={row =>
        <StatisticsActivityRow key={row.key} title={row.label} dateLabel={label}
          detail={`${formatStatisticsNumber(row.sessions)} buổi · ${formatStatisticsValue(row.minutes.value, 'minutes')} phút${row.minutes.complete ? '' : ' (chưa đầy đủ)'}`} />} />
    </StatisticsSection>
    <StatisticsSection title="Phân bố nhóm cơ">
      <StatisticsBarChart width={chartWidth} title="Buổi tập theo nhóm cơ" unit="count" points={schedule.byMuscleGroup.map((group, index) => ({
        key: group.key, label: group.label, axisLabel: String(index + 1), value: group.sessions, complete: snapshot.workouts.complete,
      }))} />
      {schedule.byMuscleGroup.map((group, index) => <StatisticsInfo key={group.key}>{index + 1}. {group.label}: {group.sessions} buổi</StatisticsInfo>)}
    </StatisticsSection>
    <StatisticsSection title="Các buổi trong kỳ">
      <StatisticsHistory records={schedule.records.slice().reverse()} emptyMessage="Chưa có buổi nào được lên lịch trong kỳ này." renderRow={(row, index) => {
        const state = getWorkoutState(row, today);
        const time = typeof row.time === 'string' ? ` · ${row.time}` : '';
        return <StatisticsActivityRow key={String(row.id ?? index)} title={typeof row.exercise?.name === 'string' ? row.exercise.name : 'Chưa rõ bài tập'}
          dateLabel={`${statisticsDateLabel(row.date)}${time}`} statusLabel={stateLabels[state]}
          detail={state === 'done' ? `${formatStatisticsValue(typeof row.durationMin === 'number' ? row.durationMin : null, 'minutes')} phút · ${formatStatisticsValue(typeof row.caloriesBurned === 'number' ? row.caloriesBurned : null, 'kcal')} kcal ước tính` : 'Chưa có kết quả luyện tập hoàn thành.'} />;
      }} />
    </StatisticsSection>
    <StatisticsInfo>Tỷ lệ chỉ xét buổi hoàn thành và bỏ lỡ. Buổi còn chờ không làm giảm tỷ lệ; lịch chưa hoàn thành chỉ bị coi là bỏ lỡ sau khi hết ngày dự kiến.</StatisticsInfo>
  </StatisticsSourceSection>;
}

export default function ScheduleStatisticsScreen(props: StatisticsScreenProps) {
  return <StatisticsDetailScreen {...props} title="Lịch tập và mức độ hoàn thành" description="Một buổi trong lịch được tính là một buổi hoàn chỉnh.">
    {context => <ScheduleContent {...context} />}
  </StatisticsDetailScreen>;
}
