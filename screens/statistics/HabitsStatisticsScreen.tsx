import { StyleSheet, Text, View } from 'react-native';
import Card from '../../components/ui/Card';
import { StatisticsBarChart, StatisticsSourceNotice } from '../../components/statistics';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type { StatisticsScreenContext, StatisticsScreenProps } from './StatisticsDetailScreen';
import { StatisticsInfo, StatisticsMetricGrid, StatisticsSection, StatisticsSourceSection } from './shared';
import { counted, measurement, statisticsDateLabel } from './viewModel';

function ActivityCalendar({ context }: { context: StatisticsScreenContext }) {
  const { colors } = useTheme();
  const { report, activityComplete } = context.view;
  const active = new Set(report.habits.activeDates);
  const keys = report.period.keys;
  const dayOfWeek = new Date(`${report.period.start}T00:00:00Z`).getUTCDay();
  const offset = (dayOfWeek + 6) % 7;
  return <Card style={styles.calendar}>
    <View style={styles.grid}>
      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <Text key={day} style={[styles.weekday, { color: colors.textSecondary }]}>{day}</Text>)}
      {Array.from({ length: offset }, (_, index) => <View key={`blank-${index}`} style={styles.cell} />)}
      {keys.map(date => {
        const future = date > context.today;
        const hasActivity = active.has(date);
        const label = future ? 'Chưa tới ngày' : hasActivity ? 'Có hoạt động đã ghi nhận' : activityComplete ? 'Chưa ghi nhận hoạt động' : 'Chưa đủ dữ liệu để xác định';
        return <View key={date} accessible accessibilityLabel={`${statisticsDateLabel(date)}. ${label}`} style={[styles.cell,
          { backgroundColor: hasActivity ? colors.primaryLight : colors.surfaceAlt, borderColor: date === context.today ? colors.primary : colors.border }]}>
          <Text style={[styles.day, { color: future ? colors.textMuted : colors.text }]}>{Number(date.slice(8))}</Text>
          <Text accessible={false} style={[styles.dot, { color: colors.textSecondary }]}>{hasActivity ? '●' : future ? '·' : activityComplete ? '–' : '?'}</Text>
        </View>;
      })}
    </View>
  </Card>;
}

function HabitsContent(context: StatisticsScreenContext) {
  const { snapshot, view, today, kind, refresh, chartWidth } = context;
  const { report, label } = view;
  const habits = report.habits;
  const source = snapshot.workouts;
  const activeMetric = view.activityAvailable ? { ...measurement(habits.activeDays), complete: view.activityComplete } : null;
  const activitySeries = report.period.keys.filter(key => key <= (kind === 'year' ? today.slice(0, 7) : today)).map(key => ({
    key, label: kind === 'year' ? `Tháng ${key.slice(5, 7)}` : statisticsDateLabel(key),
    axisLabel: kind === 'year' ? `T${Number(key.slice(5, 7))}` : key.slice(8),
    value: view.activityAvailable ? habits.activeDates.filter(date => kind === 'year' ? date.startsWith(key) : date === key).length : null,
    complete: view.activityComplete,
  }));
  return <>
    <StatisticsSourceSection title="Chuỗi hoàn thành theo lịch" source={source} refresh={refresh}>
      <StatisticsMetricGrid items={[
        { title: 'Chuỗi hiện tại', periodLabel: 'Toàn bộ lịch đến hôm nay', metric: counted(source, habits.currentStreak, habits.streakComplete), unit: 'count', unitLabel: 'buổi liên tiếp' },
        { title: 'Chuỗi dài nhất', periodLabel: 'Toàn bộ lịch đến hôm nay', metric: counted(source, habits.longestStreak, habits.streakComplete), unit: 'count', unitLabel: 'buổi liên tiếp' },
      ]} />
      <StatisticsInfo>Ngày nghỉ không ngắt chuỗi; buổi bỏ lỡ ngắt chuỗi. Kết quả phản ánh trạng thái lịch đang lưu, chưa phân biệt được mọi trường hợp tập bù trong quá khứ.</StatisticsInfo>
    </StatisticsSourceSection>
    <StatisticsSection title="Ngày có hoạt động đã ghi nhận">
      <StatisticsSourceNotice source={snapshot.workouts} onRetry={refresh} />
      <StatisticsSourceNotice source={snapshot.runs} onRetry={refresh} />
      <StatisticsMetricGrid items={[
        { title: 'Ngày có hoạt động', periodLabel: label, metric: activeMetric, unit: 'count', unitLabel: 'ngày' },
      ]} />
      {kind !== 'year' ? <ActivityCalendar context={context} /> : null}
      <StatisticsBarChart width={chartWidth} title={kind === 'year' ? 'Ngày hoạt động theo tháng' : 'Ngày hoạt động trong kỳ'} unit="count" unitLabel="ngày" points={activitySeries} />
      <StatisticsBarChart width={chartWidth} title="Phân bố theo thứ" unit="count" unitLabel="ngày" points={habits.weekdays.map(day => ({
        key: String(day.weekday), label: day.weekday === 7 ? 'Chủ nhật' : `Thứ ${day.weekday + 1}`,
        axisLabel: day.weekday === 7 ? 'CN' : `T${day.weekday + 1}`, value: view.activityAvailable ? day.activeDays : null, complete: view.activityComplete,
      }))} />
      <StatisticsInfo>Mỗi ngày chỉ tính một lần dù có nhiều buổi hoặc xuất hiện ở cả lịch tập và chạy bộ. Đây là số ngày đã ghi nhận, không phải phép cộng tổng buổi giữa hai nguồn.</StatisticsInfo>
    </StatisticsSection>
  </>;
}

export default function HabitsStatisticsScreen(props: StatisticsScreenProps) {
  return <StatisticsDetailScreen {...props} title="Thói quen luyện tập" description="Theo dõi sự đều đặn qua lịch tập và các ngày có hoạt động.">
    {context => <HabitsContent {...context} />}
  </StatisticsDetailScreen>;
}

const styles = StyleSheet.create({
  calendar: { padding: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '0%' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: fontSize.caption, paddingVertical: spacing.sm },
  cell: { width: `${100 / 7}%`, minHeight: 56, borderWidth: 1, borderRadius: radius.xs, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xs },
  day: { fontSize: fontSize.caption }, dot: { fontSize: fontSize.caption },
});
