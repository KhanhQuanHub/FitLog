import { StatisticsBarChart } from '../../components/statistics';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type { StatisticsScreenContext, StatisticsScreenProps } from './StatisticsDetailScreen';
import { StatisticsInfo, StatisticsMetricGrid, StatisticsSourceSection } from './shared';
import { sourceMetric } from './viewModel';

function CaloriesContent({ snapshot, view, refresh, chartWidth }: StatisticsScreenContext) {
  const { report, label, series } = view;
  return <>
    <StatisticsSourceSection title="Calo từ lịch tập" source={snapshot.workouts} refresh={refresh}>
      <StatisticsMetricGrid items={[
        { title: 'Calo tập theo lịch', periodLabel: label, metric: sourceMetric(snapshot.workouts, report.schedule.calories), unit: 'kcal', hint: 'Năng lượng tiêu hao ước tính.' },
        { title: 'Trung bình mỗi buổi', periodLabel: label, metric: sourceMetric(snapshot.workouts, report.schedule.averageCalories), unit: 'kcal' },
      ]} />
      <StatisticsBarChart width={chartWidth} title="Calo theo lịch đã hoàn thành" unit="kcal" points={series('schedule', 'calories')} />
    </StatisticsSourceSection>
    <StatisticsSourceSection title="Calo từ chạy bộ" source={snapshot.runs} refresh={refresh}>
      <StatisticsMetricGrid items={[
        { title: 'Calo từ buổi chạy', periodLabel: label, metric: sourceMetric(snapshot.runs, report.running.calories), unit: 'kcal', hint: 'Năng lượng tiêu hao ước tính.' },
        { title: 'Trung bình mỗi buổi chạy', periodLabel: label, metric: sourceMetric(snapshot.runs, report.running.averageCalories), unit: 'kcal' },
      ]} />
      <StatisticsBarChart width={chartWidth} title="Calo chạy đã ghi nhận" unit="kcal" points={series('running', 'calories')} />
    </StatisticsSourceSection>
    <StatisticsInfo>Đây là năng lượng luyện tập ước tính. Hai nguồn được giữ riêng, không cộng thành tổng calo cả ngày.</StatisticsInfo>
  </>;
}

export default function CaloriesStatisticsScreen(props: StatisticsScreenProps) {
  return <StatisticsDetailScreen {...props} title="Calo luyện tập" description="Xem năng lượng ước tính từ lịch tập và các buổi chạy.">
    {context => <CaloriesContent {...context} />}
  </StatisticsDetailScreen>;
}
