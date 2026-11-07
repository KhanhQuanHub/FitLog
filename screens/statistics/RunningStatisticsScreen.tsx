// ============================================================================
// Module: screens/statistics/RunningStatisticsScreen.tsx
// Chức năng: Màn hình thống kê chi tiết "Chạy bộ":
// - Hiển thị 9 chỉ số tổng hợp: Số buổi chạy, Quãng đường (km), Bước chân,
//   Thời gian vận động, Calo, Pace trung bình, Tốc độ trung bình, Nhịp bước,
//   và Buổi chạy xa nhất.
// - Hiển thị 2 biểu đồ cột: Quãng đường theo kỳ và Bước chân đã ghi nhận.
// - Hiển thị danh sách Lịch sử buổi chạy và Modal xem chi tiết từng buổi chạy.
// ============================================================================

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  StatisticsActivityRow,
  StatisticsBarChart,
  StatisticsStatusBadge,
} from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import { formatStatisticsValue } from '../../components/statistics/presentation';
import { calculateRuns } from '../../domain/statistics/statistics';
import type { RunRecord, StatisticsMetric, StatisticsPeriod } from '../../domain/statistics/types';
import type { StatisticsSource } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { StatisticsDetailScreen } from './StatisticsDetailScreen';
import type {
  StatisticsScreenContext,
  StatisticsScreenProps,
} from './StatisticsDetailScreen';
import {
  StatisticsHistory,
  StatisticsInfo,
  StatisticsMetricGrid,
  StatisticsSection,
  StatisticsSourceSection,
} from './shared';
import {
  counted,
  measurement,
  sourceMetric,
  statisticsDateLabel,
} from './viewModel';

/**
 * Tạo khóa định danh duy nhất cho một bản ghi buổi chạy để chọn mở Modal chi tiết.
 * Gắn tiền tố `'client:'` cho mã tạo trên máy và `'id:'` cho mã trên Server
 * để nếu có một buổi chạy có `clientId = "id:1"` thì khóa của nó là `"client:id:1"`,
 * không bao giờ trùng với buổi có `id = 1` (khóa là `"id:1"`).
 *
 * @param row Bản ghi buổi chạy
 * @returns Chuỗi khóa duy nhất của bản ghi
 */
function getRunRecordKey(row: RunRecord): string {
  if (typeof row.clientId === 'string' && row.clientId.trim()) {
    return `client:${row.clientId}`;
  }
  return `id:${String(row.id)}`;
}

/**
 * Đóng gói chỉ số tỷ lệ (Pace, Tốc độ, Nhịp bước) kèm kiểm tra số bản ghi bị loại (`excluded`).
 * Nếu có buổi chạy bị thiếu dữ liệu (`excluded > 0`), đánh dấu `complete: false`.
 *
 * @param source Nguồn dữ liệu chạy bộ (`snapshot.runs`)
 * @param value Giá trị trung bình đã tính (pace, tốc độ hoặc nhịp bước)
 * @param excluded Số buổi chạy bị bỏ qua khi tính tỷ lệ do thiếu số đo
 * @returns Đối tượng `StatisticsMetric` hoặc `null`
 */
function buildRateMetric(
  source: StatisticsSource<RunRecord>,
  value: number | null,
  excluded: number
): StatisticsMetric | null {
  const base = measurement(value);
  return sourceMetric(source, {
    value: base.value,
    complete: value !== null && excluded === 0,
    missingCount: excluded,
  });
}

/**
 * Component hiển thị cửa sổ bật lên (Modal) xem chi tiết 8 chỉ số của một buổi chạy.
 *
 * @param props Bản ghi được chọn `selected`, kỳ `period`, ngày `today`, nguồn `source` và hàm đóng `onClose`
 * @returns JSX Modal chi tiết buổi chạy
 */
function RunDetailModal({
  selected,
  period,
  today,
  source,
  onClose,
}: {
  selected: RunRecord | null;
  period: StatisticsPeriod;
  today: string;
  source: StatisticsSource<RunRecord>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  // Tái sử dụng hàm `calculateRuns` với mảng 1 phần tử `[selected]` để tính đúng Pace, Tốc độ, Nhịp bước của buổi đó
  const details = selected ? calculateRuns([selected], period, today) : null;
  const dateLabel = selected ? statisticsDateLabel(selected.date) : '';

  const detailItems: StatisticsMetricCardProps[] =
    selected && details
      ? [
          {
            title: 'Quãng đường',
            periodLabel: dateLabel,
            metric: sourceMetric(source, details.distanceKm),
            unit: 'km',
          },
          {
            title: 'Thời gian',
            periodLabel: dateLabel,
            metric: sourceMetric(source, details.durationSec),
            unit: 'seconds',
          },
          {
            title: 'Bước chân',
            periodLabel: dateLabel,
            metric: sourceMetric(source, details.steps),
            unit: 'count',
            unitLabel: 'bước',
          },
          {
            title: 'Calo ước tính',
            periodLabel: dateLabel,
            metric: sourceMetric(source, details.calories),
            unit: 'kcal',
          },
          {
            title: 'Pace',
            periodLabel: dateLabel,
            metric: buildRateMetric(source, details.paceSecPerKm, details.paceExcluded),
            unit: 'pace',
          },
          {
            title: 'Tốc độ',
            periodLabel: dateLabel,
            metric: buildRateMetric(source, details.avgSpeedKmh, details.paceExcluded),
            unit: 'speed',
          },
          {
            title: 'Nhịp bước',
            periodLabel: dateLabel,
            metric: buildRateMetric(source, details.cadenceSpm, details.cadenceExcluded),
            unit: 'cadence',
          },
          {
            title: 'Tạm dừng',
            periodLabel: dateLabel,
            metric: sourceMetric(source, details.pausedSec),
            unit: 'seconds',
          },
        ]
      : [];

  return (
    <Modal
      visible={selected !== null}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng chi tiết buổi chạy"
            onPress={onClose}
            style={styles.close}
          >
            <Text style={[styles.closeText, { color: colors.text }]}>
              ‹ Quay lại thống kê chạy
            </Text>
          </Pressable>

          {selected && details ? (
            <>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: colors.text }]}
              >
                Chi tiết buổi chạy
              </Text>
              {selected._queued ? (
                <StatisticsStatusBadge label="Chờ đồng bộ" tone="warning" />
              ) : null}
              <StatisticsMetricGrid items={detailItems} />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Nội dung bên trong màn hình Thống kê Chạy bộ.
 *
 * @param context Ngữ cảnh dữ liệu từ `StatisticsDetailScreen`
 * @returns JSX hiển thị các thẻ chỉ số, biểu đồ, lịch sử và Modal chi tiết buổi chạy
 */
function RunningContent({
  snapshot,
  view,
  today,
  refresh,
  chartWidth,
}: StatisticsScreenContext) {
  const { report, label, series } = view;
  const running = report.running;
  const source = snapshot.runs;

  // Chỉ lưu khóa (`selectedKey`) thay vì lưu nguyên object buổi chạy trong state:
  // nếu người dùng đổi kỳ hoặc đăng xuất làm danh sách `running.records` đổi,
  // `selected` sẽ tự động về `null` và đóng Modal an toàn.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected =
    running.records.find((row) => getRunRecordKey(row) === selectedKey) ?? null;

  const summaryItems: StatisticsMetricCardProps[] = [
    {
      title: 'Buổi chạy',
      periodLabel: label,
      metric: counted(source, running.sessions),
      unit: 'count',
    },
    {
      title: 'Quãng đường',
      periodLabel: label,
      metric: sourceMetric(source, running.distanceKm),
      unit: 'km',
    },
    {
      title: 'Bước trong buổi chạy',
      periodLabel: label,
      metric: sourceMetric(source, running.steps),
      unit: 'count',
      unitLabel: 'bước',
    },
    {
      title: 'Thời gian vận động',
      periodLabel: label,
      metric: sourceMetric(source, running.durationSec),
      unit: 'seconds',
    },
    {
      title: 'Calo ước tính',
      periodLabel: label,
      metric: sourceMetric(source, running.calories),
      unit: 'kcal',
    },
    {
      title: 'Pace trung bình',
      periodLabel: label,
      metric: buildRateMetric(source, running.paceSecPerKm, running.paceExcluded),
      unit: 'pace',
      hint: 'Thời gian hoàn thành 1 km.',
    },
    {
      title: 'Tốc độ trung bình',
      periodLabel: label,
      metric: buildRateMetric(source, running.avgSpeedKmh, running.paceExcluded),
      unit: 'speed',
    },
    {
      title: 'Nhịp bước trung bình',
      periodLabel: label,
      metric: buildRateMetric(source, running.cadenceSpm, running.cadenceExcluded),
      unit: 'cadence',
      hint: 'Số bước trong một phút vận động.',
    },
    {
      title: 'Buổi xa nhất',
      periodLabel: running.longest
        ? statisticsDateLabel(running.longest.date)
        : label,
      metric: sourceMetric(source, measurement(running.longest?.distanceKm)),
      unit: 'km',
    },
  ];

  const hasIncompleteRunRecords =
    running.incompleteRecords > 0 || report.quality.invalidRunDates > 0;

  /**
   * Vẽ một dòng buổi chạy trong danh sách "Lịch sử buổi chạy".
   */
  const renderRunHistoryRow = (row: RunRecord, index: number) => {
    const distanceDisplay = formatStatisticsValue(
      typeof row.distanceKm === 'number' ? row.distanceKm : null,
      'km'
    );
    const durationDisplay = formatStatisticsValue(
      typeof row.durationSec === 'number' ? row.durationSec : null,
      'seconds'
    );
    const rowKey = getRunRecordKey(row);

    return (
      <StatisticsActivityRow
        key={`${rowKey}:${index}`}
        title="Chạy bộ"
        dateLabel={statisticsDateLabel(row.date)}
        queued={row._queued}
        detail={`${distanceDisplay} km · ${durationDisplay}`}
        onPress={() => setSelectedKey(rowKey)}
      />
    );
  };

  return (
    <StatisticsSourceSection
      title="Các buổi chạy đã ghi nhận"
      source={source}
      refresh={refresh}
    >
      {running.queuedCount > 0 ? (
        <StatisticsStatusBadge
          tone="warning"
          label={`${running.queuedCount} buổi chờ đồng bộ`}
        />
      ) : null}

      {/* 1. Lưới 9 chỉ số tổng hợp của Chạy bộ */}
      <StatisticsMetricGrid items={summaryItems} />

      {/* 2. Biểu đồ Quãng đường và Bước chân */}
      <StatisticsBarChart
        width={chartWidth}
        title="Quãng đường theo kỳ"
        unit="km"
        points={series('running', 'distanceKm')}
      />
      <StatisticsBarChart
        width={chartWidth}
        title="Bước đã ghi nhận"
        unit="count"
        unitLabel="bước"
        points={series('running', 'steps')}
      />

      {hasIncompleteRunRecords ? (
        <StatisticsInfo>
          Một số bản ghi chưa đủ thông tin ngày hoặc thời điểm kết thúc nên chưa được
          tính vào buổi chạy hoàn thành.
        </StatisticsInfo>
      ) : null}

      <StatisticsInfo>
        Bước và quãng đường chỉ thuộc các buổi đã ghi nhận, không phải toàn bộ vận động
        trong ngày.
      </StatisticsInfo>

      {/* 3. Danh sách lịch sử các buổi chạy (đảo ngược để buổi mới nhất lên đầu) */}
      <StatisticsSection title="Lịch sử buổi chạy">
        <StatisticsHistory
          records={running.records.slice().reverse()}
          emptyMessage="Chưa có buổi chạy hoàn thành trong kỳ này."
          renderRow={renderRunHistoryRow}
        />
      </StatisticsSection>

      {/* 4. Cửa sổ Modal xem chi tiết từng buổi chạy */}
      <RunDetailModal
        selected={selected}
        period={report.period}
        today={today}
        source={source}
        onClose={() => setSelectedKey(null)}
      />
    </StatisticsSourceSection>
  );
}

/**
 * Component màn hình Thống kê Chạy bộ.
 *
 * @param props Các thuộc tính điều hướng và kỳ mặc định `StatisticsScreenProps`
 * @returns JSX màn hình Chạy bộ
 */
export default function RunningStatisticsScreen(props: StatisticsScreenProps) {
  return (
    <StatisticsDetailScreen
      {...props}
      title="Chạy bộ"
      description="Quãng đường, bước, thời gian và hiệu suất từ từng buổi chạy."
    >
      {(context) => <RunningContent {...context} />}
    </StatisticsDetailScreen>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  close: { minHeight: layout.minTouchSize, justifyContent: 'center' },
  closeText: { fontSize: fontSize.body },
  title: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
});
