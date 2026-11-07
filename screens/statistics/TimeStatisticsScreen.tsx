import { StatisticsBarChart } from '../../components/statistics';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type { StatisticsScreenContext, StatisticsScreenProps } from './StatisticsDetailScreen';
import { StatisticsInfo, StatisticsMetricGrid, StatisticsSourceSection } from './shared';
import { sourceMetric, toMinutes } from './viewModel';

function TimeContent({ snapshot, view, refresh, chartWidth }: StatisticsScreenContext) {
  const { report, label, series } = view;
  return <>
    <StatisticsSourceSection title="Tập theo lịch" source={snapshot.workouts} refresh={refresh}>
      <StatisticsMetricGrid items={[
        { title: 'Thời gian đã tập', periodLabel: label, metric: sourceMetric(snapshot.workouts, report.schedule.minutes), unit: 'minutes' },
        { title: 'Trung bình mỗi buổi', periodLabel: label, metric: sourceMetric(snapshot.workouts, report.schedule.averageMinutes), unit: 'minutes' },
      ]} />
      <StatisticsBarChart width={chartWidth} title="Phút tập theo lịch" unit="minutes" points={series('schedule', 'minutes')} />
    </StatisticsSourceSection>
    <StatisticsSourceSection title="Chạy bộ" source={snapshot.runs} refresh={refresh}>
      <StatisticsMetricGrid items={[
        { title: 'Thời gian chạy', periodLabel: label, metric: sourceMetric(snapshot.runs, toMinutes(report.running.durationSec)), unit: 'minutes' },
        { title: 'Trung bình mỗi buổi chạy', periodLabel: label, metric: sourceMetric(snapshot.runs, toMinutes(report.running.averageDurationSec)), unit: 'minutes' },
        { title: 'Thời gian tạm dừng', periodLabel: label, metric: sourceMetric(snapshot.runs, toMinutes(report.running.pausedSec)), unit: 'minutes' },
      ]} />
      <StatisticsBarChart width={chartWidth} title="Phút chạy đã ghi nhận" unit="minutes" points={series('running', 'minutes')} hint="Thời gian vận động, không gồm tạm dừng." />
    </StatisticsSourceSection>
    <StatisticsInfo>Lịch tập và buổi chạy được trình bày riêng để tránh tính hai lần cùng một hoạt động.</StatisticsInfo>
  </>;
}

export default function TimeStatisticsScreen(props: StatisticsScreenProps) {
  return <StatisticsDetailScreen {...props} title="Thời gian luyện tập" description="Theo dõi thời gian từ các buổi đã ghi nhận.">
    {context => <TimeContent {...context} />}
  </StatisticsDetailScreen>;
}
