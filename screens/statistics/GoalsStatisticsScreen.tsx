import { StatisticsBarChart, StatisticsProgress, StatisticsSourceNotice } from '../../components/statistics';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type { StatisticsScreenContext, StatisticsScreenProps } from './StatisticsDetailScreen';
import { StatisticsInfo, StatisticsMetricGrid, StatisticsSourceSection, StatisticsText } from './shared';
import { isStatisticsSourceCurrent, measurement, sourceMetric, statisticsDateLabel, statisticsPeriodLabel } from './viewModel';

function GoalsContent({ snapshot, view, today, refresh, chartWidth }: StatisticsScreenContext) {
  const { report, label, series } = view;
  const { targets } = report;
  const goalCurrent = isStatisticsSourceCurrent(snapshot.userGoals);
  const profileCurrent = isStatisticsSourceCurrent(snapshot.profiles);
  const minutes = sourceMetric(snapshot.workouts, targets.minutes.actual);
  if (minutes && (!goalCurrent || report.weekSchedule.counts.unknown > 0 || report.quality.invalidWorkoutDates > 0)) minutes.complete = false;
  const sessions = sourceMetric(snapshot.workouts, targets.sessions.actual);
  if (sessions && (!profileCurrent || report.weekSchedule.counts.unknown > 0 || report.quality.invalidWorkoutDates > 0)) sessions.complete = false;
  const weekLabel = statisticsPeriodLabel('week', today);
  return <>
    <StatisticsSourceSection title="Mục tiêu đang áp dụng" source={snapshot.userGoals} refresh={refresh}>
      {targets.state !== 'selected' ? <StatisticsInfo>{targets.state === 'ambiguous'
        ? 'Có nhiều mục tiêu trong dữ liệu, chưa xác định được mục tiêu đang áp dụng.'
        : snapshot.userGoals.complete ? 'Chưa có mục tiêu được ghi nhận.' : 'Chưa đủ dữ liệu để xác định mục tiêu đang áp dụng.'}</StatisticsInfo> : <>
        <StatisticsInfo>{targets.name ?? 'Mục tiêu đã lưu'}</StatisticsInfo>
        <StatisticsSourceSection title="Cam kết thời gian tuần này" source={snapshot.workouts} refresh={refresh}>
          <StatisticsProgress title="Phút tập theo lịch" periodLabel={weekLabel} actual={minutes} target={goalCurrent ? targets.minutes.target : null} />
        </StatisticsSourceSection>
        <StatisticsSourceNotice source={snapshot.weights} onRetry={refresh} />
        <StatisticsSourceNotice source={snapshot.profiles} onRetry={refresh} />
        <StatisticsMetricGrid items={[
          { title: 'Cân nặng đích', periodLabel: 'Mục tiêu đang lưu', metric: sourceMetric(snapshot.userGoals, measurement(targets.targetWeightKg)), unit: 'kg' },
          { title: 'Cân nặng gần nhất', periodLabel: report.weight.recordedDate ? `Ghi nhận ${statisticsDateLabel(report.weight.recordedDate)}`
            : report.weight.source === 'profile' ? 'Từ hồ sơ' : 'Chưa có số đo',
            metric: view.currentWeight, unit: 'kg' },
        ]} />
        <StatisticsText>Chỉ đối chiếu số đo hiện tại với cân nặng đích; chưa tính phần trăm hành trình cân nặng.</StatisticsText>
      </>}
    </StatisticsSourceSection>
    <StatisticsSourceSection title="Cam kết số buổi tuần này" source={snapshot.profiles} refresh={refresh}>
      <StatisticsSourceSection title="Buổi theo lịch đã hoàn thành" source={snapshot.workouts} refresh={refresh}>
        {report.quality.profileAmbiguous ? <StatisticsInfo>Có nhiều hồ sơ trong dữ liệu, chưa xác định được cam kết số buổi đang áp dụng.</StatisticsInfo>
          : <StatisticsProgress title="Số buổi theo lịch" periodLabel={weekLabel} actual={sessions} target={profileCurrent ? targets.sessions.target : null} unitLabel="buổi" />}
      </StatisticsSourceSection>
    </StatisticsSourceSection>
    <StatisticsSourceSection title={`Kết quả trong kỳ · ${label}`} source={snapshot.workouts} refresh={refresh}>
      <StatisticsBarChart width={chartWidth} title="Phút tập theo lịch trong kỳ" unit="minutes" points={series('schedule', 'minutes')} />
      <StatisticsBarChart width={chartWidth} title="Buổi hoàn thành trong kỳ" unit="count" points={series('schedule', 'sessions')} />
    </StatisticsSourceSection>
    <StatisticsInfo>Cam kết chỉ áp dụng cho tuần hiện tại, không nhân lên thành mục tiêu tháng hoặc năm. Buổi chạy được theo dõi riêng và chưa cộng vào tiến độ theo lịch.</StatisticsInfo>
  </>;
}

export default function GoalsStatisticsScreen(props: StatisticsScreenProps) {
  return <StatisticsDetailScreen {...props} title="Tiến độ mục tiêu" description="Đối chiếu luyện tập theo lịch với cam kết đang lưu.">
    {context => <GoalsContent {...context} />}
  </StatisticsDetailScreen>;
}
