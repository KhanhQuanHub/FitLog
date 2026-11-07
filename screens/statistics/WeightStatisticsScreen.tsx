import { StatisticsActivityRow, StatisticsLineChart, StatisticsSourceNotice } from '../../components/statistics';
import { formatStatisticsValue } from '../../components/statistics/presentation';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type { StatisticsScreenContext, StatisticsScreenProps } from './StatisticsDetailScreen';
import { StatisticsHistory, StatisticsInfo, StatisticsMetricGrid, StatisticsSection, StatisticsSourceSection } from './shared';
import { measurement, sourceMetric, statisticsDateLabel } from './viewModel';

function WeightContent({ snapshot, view, refresh, chartWidth }: StatisticsScreenContext) {
  const { report, label } = view;
  const { weight } = report;
  const firstDate = weight.points[0]?.date;
  const position = (date: string) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / 86_400_000;
  const changes = weight.changeKg === null ? 'Cần hai ngày có số đo trong kỳ để so sánh.'
    : weight.changeKg > 0 ? 'Cân nặng tăng trong kỳ.' : weight.changeKg < 0 ? 'Cân nặng giảm trong kỳ.' : 'Cân nặng không thay đổi giữa hai mốc.';
  const bmiLabels: Record<string, string> = { thin: 'Gầy', normal: 'Bình thường', overweight: 'Thừa cân', obese: 'Béo phì' };
  const weightPeriod = weight.recordedDate ? `Ghi nhận ${statisticsDateLabel(weight.recordedDate)}`
    : weight.source === 'profile' ? 'Từ hồ sơ · chưa có ngày đo' : 'Chưa có số đo';
  return <>
    <StatisticsSection title="Số đo gần nhất">
      <StatisticsSourceNotice source={snapshot.weights} onRetry={refresh} />
      <StatisticsSourceNotice source={snapshot.profiles} onRetry={refresh} />
      <StatisticsMetricGrid items={[
        { title: 'Cân nặng gần nhất', periodLabel: weightPeriod, metric: view.currentWeight, unit: 'kg',
          hint: weight.source === 'profile' ? 'Số đo đang lưu trong hồ sơ.' : 'Số đo hợp lệ gần nhất trong lịch sử.' },
        { title: 'BMI hiện tại', periodLabel: weightPeriod, metric: view.bmi, unit: 'bmi',
          hint: view.bmi?.complete && weight.bmiGroup ? bmiLabels[weight.bmiGroup] : 'Chưa đủ dữ liệu để phân loại BMI.' },
      ]} />
      {snapshot.profiles.data === null && snapshot.weights.data === null ? <StatisticsInfo>Chưa có số đo dùng được. Tải lại hồ sơ hoặc lịch sử cân để xem chỉ số.</StatisticsInfo> : null}
      {report.quality.profileAmbiguous ? <StatisticsInfo>Có nhiều hồ sơ trong dữ liệu, chưa xác định được chiều cao và số đo hồ sơ đang áp dụng.</StatisticsInfo> : null}
    </StatisticsSection>
    <StatisticsSourceSection title="Diễn biến trong kỳ" source={snapshot.weights} refresh={refresh}>
      <StatisticsMetricGrid items={[
        { title: 'Thay đổi cân nặng', periodLabel: label,
          metric: sourceMetric(snapshot.weights, measurement(weight.changeKg === null ? null : Math.abs(weight.changeKg))), unit: 'kg', hint: changes },
      ]} />
      <StatisticsLineChart width={chartWidth} title="Cân nặng đã ghi nhận" unit="kg" points={weight.points.map(point => ({ key: point.date,
        label: statisticsDateLabel(point.date), axisLabel: `${point.date.slice(8)}/${point.date.slice(5, 7)}`,
        value: point.weightKg, position: position(point.date), complete: snapshot.weights.complete && !snapshot.weights.stale }))} />
      <StatisticsSection title="Lịch sử cân">
        <StatisticsHistory records={weight.points.slice().reverse()} emptyMessage="Chưa có lần cân hợp lệ trong kỳ này." renderRow={row =>
          <StatisticsActivityRow key={row.date} title="Cân nặng" dateLabel={statisticsDateLabel(row.date)} detail={`${formatStatisticsValue(row.weightKg, 'kg')} kg`} />} />
      </StatisticsSection>
      {weight.invalidRecordCount > 0 ? <StatisticsInfo>Có số đo không hợp lệ nên chưa được đưa vào biểu đồ.</StatisticsInfo> : null}
    </StatisticsSourceSection>
    <StatisticsSourceSection title="Cân nặng đích đã lưu" source={snapshot.userGoals} refresh={refresh}>
      {report.targets.state === 'selected' ? <StatisticsMetricGrid items={[
        { title: 'Cân nặng đích', periodLabel: 'Mục tiêu đang lưu', metric: sourceMetric(snapshot.userGoals, measurement(report.targets.targetWeightKg)), unit: 'kg' },
      ]} /> : <StatisticsInfo>{report.targets.state === 'ambiguous' ? 'Chưa xác định được mục tiêu đang áp dụng.'
        : snapshot.userGoals.complete ? 'Chưa có mục tiêu được ghi nhận.' : 'Chưa đủ dữ liệu để xác định mục tiêu đang áp dụng.'}</StatisticsInfo>}
    </StatisticsSourceSection>
    <StatisticsInfo>BMI chỉ thể hiện số đo hiện tại. Biểu đồ cân chỉ dùng các lần ghi nhận thực tế, không điền số đo cho ngày trống.</StatisticsInfo>
  </>;
}

export default function WeightStatisticsScreen(props: StatisticsScreenProps) {
  return <StatisticsDetailScreen {...props} title="Cân nặng và BMI" description="Xem số đo gần nhất và biến động qua những lần cân.">
    {context => <WeightContent {...context} />}
  </StatisticsDetailScreen>;
}
