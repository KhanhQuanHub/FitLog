import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatisticsActivityRow, StatisticsBarChart, StatisticsStatusBadge } from '../../components/statistics';
import { formatStatisticsValue } from '../../components/statistics/presentation';
import { calculateRuns } from '../../domain/statistics/statistics';
import type { RunRecord } from '../../domain/statistics/types';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type { StatisticsScreenContext, StatisticsScreenProps } from './StatisticsDetailScreen';
import { StatisticsHistory, StatisticsInfo, StatisticsMetricGrid, StatisticsSection, StatisticsSourceSection } from './shared';
import { counted, measurement, sourceMetric, statisticsDateLabel } from './viewModel';

// Hai loại mã có namespace riêng, tránh clientId "id:1" trỏ nhầm buổi có id=1.
const keyOf = (row: RunRecord) => typeof row.clientId === 'string' && row.clientId.trim()
  ? JSON.stringify(['client', row.clientId]) : JSON.stringify(['id', String(row.id)]);

function RunningContent({ snapshot, view, today, refresh, chartWidth }: StatisticsScreenContext) {
  const { colors } = useTheme();
  const { report, label, series } = view;
  const running = report.running;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Không giữ bản ghi cũ trong state: nếu đổi tài khoản/kỳ hoặc dữ liệu bị xóa thì đóng chi tiết.
  const selected = running.records.find(row => keyOf(row) === selectedKey) ?? null;
  const details = selected ? calculateRuns([selected], report.period, today) : null;
  const source = snapshot.runs;
  const rate = (value: number | null, excluded: number) => sourceMetric(source, {
    ...measurement(value), complete: value !== null && excluded === 0, missingCount: excluded,
  });
  return <StatisticsSourceSection title="Các buổi chạy đã ghi nhận" source={source} refresh={refresh}>
    {running.queuedCount > 0 ? <StatisticsStatusBadge tone="warning" label={`${running.queuedCount} buổi chờ đồng bộ`} /> : null}
    <StatisticsMetricGrid items={[
      { title: 'Buổi chạy', periodLabel: label, metric: counted(source, running.sessions), unit: 'count' },
      { title: 'Quãng đường', periodLabel: label, metric: sourceMetric(source, running.distanceKm), unit: 'km' },
      { title: 'Bước trong buổi chạy', periodLabel: label, metric: sourceMetric(source, running.steps), unit: 'count', unitLabel: 'bước' },
      { title: 'Thời gian vận động', periodLabel: label, metric: sourceMetric(source, running.durationSec), unit: 'seconds' },
      { title: 'Calo ước tính', periodLabel: label, metric: sourceMetric(source, running.calories), unit: 'kcal' },
      { title: 'Pace trung bình', periodLabel: label, metric: rate(running.paceSecPerKm, running.paceExcluded), unit: 'pace', hint: 'Thời gian hoàn thành 1 km.' },
      { title: 'Tốc độ trung bình', periodLabel: label, metric: rate(running.avgSpeedKmh, running.paceExcluded), unit: 'speed' },
      { title: 'Nhịp bước trung bình', periodLabel: label, metric: rate(running.cadenceSpm, running.cadenceExcluded), unit: 'cadence', hint: 'Số bước trong một phút vận động.' },
      { title: 'Buổi xa nhất', periodLabel: running.longest ? statisticsDateLabel(running.longest.date) : label,
        metric: sourceMetric(source, measurement(running.longest?.distanceKm)), unit: 'km' },
    ]} />
    <StatisticsBarChart width={chartWidth} title="Quãng đường theo kỳ" unit="km" points={series('running', 'distanceKm')} />
    <StatisticsBarChart width={chartWidth} title="Bước đã ghi nhận" unit="count" unitLabel="bước" points={series('running', 'steps')} />
    {running.incompleteRecords > 0 || report.quality.invalidRunDates > 0 ? <StatisticsInfo>Một số bản ghi chưa đủ thông tin ngày hoặc thời điểm kết thúc nên chưa được tính vào buổi chạy hoàn thành.</StatisticsInfo> : null}
    <StatisticsInfo>Bước và quãng đường chỉ thuộc các buổi đã ghi nhận, không phải toàn bộ vận động trong ngày.</StatisticsInfo>
    <StatisticsSection title="Lịch sử buổi chạy">
      <StatisticsHistory records={running.records.slice().reverse()} emptyMessage="Chưa có buổi chạy hoàn thành trong kỳ này." renderRow={(row, index) =>
        <StatisticsActivityRow key={`${keyOf(row)}:${index}`} title="Chạy bộ" dateLabel={statisticsDateLabel(row.date)} queued={row._queued}
          detail={`${formatStatisticsValue(typeof row.distanceKm === 'number' ? row.distanceKm : null, 'km')} km · ${formatStatisticsValue(typeof row.durationSec === 'number' ? row.durationSec : null, 'seconds')}`}
          onPress={() => setSelectedKey(keyOf(row))} />} />
    </StatisticsSection>
    <Modal visible={selected !== null} onRequestClose={() => setSelectedKey(null)} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng chi tiết buổi chạy" onPress={() => setSelectedKey(null)} style={styles.close}>
            <Text style={[styles.closeText, { color: colors.text }]}>‹ Quay lại thống kê chạy</Text>
          </Pressable>
          {selected && details ? <>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Chi tiết buổi chạy</Text>
            {selected._queued ? <StatisticsStatusBadge label="Chờ đồng bộ" tone="warning" /> : null}
            <StatisticsMetricGrid items={[
              { title: 'Quãng đường', periodLabel: statisticsDateLabel(selected.date), metric: sourceMetric(source, details.distanceKm), unit: 'km' },
              { title: 'Thời gian', periodLabel: statisticsDateLabel(selected.date), metric: sourceMetric(source, details.durationSec), unit: 'seconds' },
              { title: 'Bước chân', periodLabel: statisticsDateLabel(selected.date), metric: sourceMetric(source, details.steps), unit: 'count', unitLabel: 'bước' },
              { title: 'Calo ước tính', periodLabel: statisticsDateLabel(selected.date), metric: sourceMetric(source, details.calories), unit: 'kcal' },
              { title: 'Pace', periodLabel: statisticsDateLabel(selected.date), metric: rate(details.paceSecPerKm, details.paceExcluded), unit: 'pace' },
              { title: 'Tốc độ', periodLabel: statisticsDateLabel(selected.date), metric: rate(details.avgSpeedKmh, details.paceExcluded), unit: 'speed' },
              { title: 'Nhịp bước', periodLabel: statisticsDateLabel(selected.date), metric: rate(details.cadenceSpm, details.cadenceExcluded), unit: 'cadence' },
              { title: 'Tạm dừng', periodLabel: statisticsDateLabel(selected.date), metric: sourceMetric(source, details.pausedSec), unit: 'seconds' },
            ]} />
          </> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </StatisticsSourceSection>;
}

export default function RunningStatisticsScreen(props: StatisticsScreenProps) {
  return <StatisticsDetailScreen {...props} title="Chạy bộ" description="Quãng đường, bước, thời gian và hiệu suất từ từng buổi chạy.">
    {context => <RunningContent {...context} />}
  </StatisticsDetailScreen>;
}

const styles = StyleSheet.create({
  modal: { flex: 1 }, content: { padding: layout.screenPadding, paddingBottom: spacing.xxxl, gap: spacing.lg },
  close: { minHeight: layout.minTouchSize, justifyContent: 'center' },
  closeText: { fontSize: fontSize.body }, title: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
});
