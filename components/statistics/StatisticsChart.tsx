// ============================================================================
// Module: components/statistics/StatisticsChart.tsx
// Chức năng: Hiển thị biểu đồ cột (`StatisticsBarChart`) và biểu đồ đường
// (`StatisticsLineChart`) bằng thư viện `react-native-svg`:
// - Tự động đo chiều rộng vùng hiển thị (`onLayout`) hoặc nhận `width` từ cha.
// - Hỗ trợ cuộn ngang (`ScrollView horizontal`) khi kỳ có nhiều cột (như 30 ngày).
// - Cho phép người dùng chạm vào từng cột/điểm để xem chi tiết số liệu của mốc đó.
// ============================================================================

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import Card from '../ui/Card';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import {
  buildStatisticsChart,
  formatStatisticsNumber,
  formatStatisticsValue,
  STATISTICS_UNITS,
} from './presentation';
import type {
  StatisticsChartPlotPoint,
  StatisticsChartPoint,
  StatisticsUnit,
} from './presentation';
import { StatisticsDataState } from './StatisticsStatus';

/** Các thuộc tính đầu vào của component biểu đồ thống kê */
export interface StatisticsChartProps {
  title: string;
  points: readonly StatisticsChartPoint[];
  unit: StatisticsUnit;
  unitLabel?: string;
  hint?: string;
  onSelect?: (point: StatisticsChartPoint) => void;
  /** Chiều rộng cố định (nếu màn hình cha đã biết trước); nếu không truyền sẽ tự đo bằng `onLayout` */
  width?: number;
}

/**
 * Định dạng nhãn giá trị trên cột trục dọc (Y-axis) bên trái biểu đồ.
 * Nếu đơn vị là `'seconds'` thì chia 60 để hiển thị số phút ngắn gọn trên trục dọc.
 *
 * @param tickValue Giá trị số tại vạch chia trên trục Y
 * @param unit Đơn vị đo lường của biểu đồ
 * @returns Chuỗi nhãn hiển thị trên trục Y
 */
function formatYAxisTickLabel(tickValue: number, unit: StatisticsUnit): string {
  if (unit === 'pace') {
    return formatStatisticsValue(tickValue, unit);
  }
  const scaledValue = unit === 'seconds' ? tickValue / 60 : tickValue;
  return formatStatisticsNumber(scaledValue, 1);
}

/**
 * Tạo dòng hướng dẫn đơn vị và thao tác chạm hiển thị bên dưới biểu đồ.
 *
 * @param unit Đơn vị đo lường của biểu đồ
 * @param suffix Nhãn đơn vị tiếng Việt
 * @returns Chuỗi chú thích đơn vị và thao tác chạm
 */
function buildChartUnitCaption(unit: StatisticsUnit, suffix: string): string {
  if (unit === 'seconds') {
    return 'Trục dọc: phút. Chạm một mốc để xem số liệu.';
  }
  if (suffix) {
    return `Đơn vị: ${suffix}. Chạm một mốc để xem số liệu.`;
  }
  return 'Chạm một mốc để xem số liệu.';
}

/**
 * Component nội bộ vẽ biểu đồ cột (`kind = 'bar'`) hoặc biểu đồ đường (`kind = 'line'`).
 *
 * @param props Thuộc tính biểu đồ kèm loại biểu đồ `kind`
 * @returns JSX thẻ Card chứa biểu đồ SVG tương tác
 */
function StatisticsChart({
  title,
  points,
  unit,
  unitLabel,
  hint,
  onSelect,
  width,
  kind,
}: StatisticsChartProps & { kind: 'bar' | 'line' }) {
  const { colors } = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Tìm điểm đang được người dùng chạm chọn; mặc định chọn điểm cuối cùng trong danh sách
  const selected =
    points.find((point) => point.key === selectedKey) ?? points.at(-1) ?? null;
  const selectedIndex = selected ? points.indexOf(selected) : -1;

  // Chiều rộng khả dụng để vẽ biểu đồ (trừ 52px dành cho cột nhãn trục Y bên trái)
  const usableWidth =
    width !== undefined && Number.isFinite(width) && width > 0 ? width : measuredWidth;
  const chart = buildStatisticsChart(points, usableWidth - 52, kind);

  const allMissing = !chart.points.some((point) => point.value !== null);
  const suffix = unitLabel ?? STATISTICS_UNITS[unit];

  // Chuỗi mô tả mốc đang được chọn hiển thị ngay phía trên biểu đồ
  const incompleteNote =
    selected?.complete === false ? '. Số liệu chưa đầy đủ' : '';
  const selectedText = selected
    ? `${selected.label}: ${formatStatisticsValue(selected.value, unit)} ${suffix}${incompleteNote}`
    : '';

  const hasPartialData =
    points.some((point) => point.complete === false) ||
    chart.points.some((point) => point.value === null);

  const unitCaption = buildChartUnitCaption(unit, suffix);

  /**
   * Vẽ hình ảnh SVG cho một mốc dữ liệu tại vị trí `index`:
   * - Nếu không có số liệu (`point.y === null`): vẽ vạch ngang nhỏ ở đáy biểu đồ.
   * - Nếu là biểu đồ cột (`kind === 'bar'`): vẽ hình chữ nhật `Rect`.
   * - Nếu là biểu đồ đường (`kind === 'line'`): vẽ chấm tròn `Circle`.
   */
  const renderChartPointSvg = (point: StatisticsChartPlotPoint, index: number) => {
    const itemKey = points[index].key;
    const isSelected = index === selectedIndex;

    if (point.y === null) {
      return (
        <Line
          key={itemKey}
          x1={point.x - 5}
          x2={point.x + 5}
          y1={point.baseline}
          y2={point.baseline}
          stroke={colors.textMuted}
          strokeWidth={2}
        />
      );
    }

    if (kind === 'bar') {
      const barHeight = Math.max(0, point.baseline - point.y);
      const barColor = isSelected ? colors.primary : colors.info;
      const barOpacity = points[index].complete === false ? 0.55 : 1;
      return (
        <Rect
          key={itemKey}
          x={point.x - 9}
          y={point.y}
          width={18}
          height={barHeight}
          rx={4}
          fill={barColor}
          opacity={barOpacity}
        />
      );
    }

    return (
      <Circle
        key={itemKey}
        cx={point.x}
        cy={point.y}
        r={isSelected ? 6 : 4}
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={2}
      />
    );
  };

  /**
   * Vẽ vùng chạm trong suốt (`Pressable`) đặt chồng lên mỗi mốc dữ liệu kèm nhãn trục ngang (X-axis)
   * để người dùng chạm chọn mốc và trình đọc màn hình đọc được giá trị từng cột/điểm.
   */
  const renderTouchTargetOverlay = (
    point: StatisticsChartPlotPoint,
    index: number
  ) => {
    const item = points[index];
    const isSelected = index === selectedIndex;
    const itemIncomplete = item.complete === false ? '. Số liệu chưa đầy đủ' : '';
    const formattedItemValue = formatStatisticsValue(item.value, unit);

    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        aria-selected={isSelected}
        accessibilityLabel={`${item.label}: ${formattedItemValue} ${suffix}${itemIncomplete}`}
        onPress={() => {
          setSelectedKey(item.key);
          onSelect?.(item);
        }}
        style={({ pressed }) => [
          styles.pointTarget,
          {
            left: Math.max(0, point.x - layout.minTouchSize / 2),
            height: chart.height + 32,
            opacity: pressed ? 0.65 : 1,
          },
        ]}
      >
        <Text
          accessible={false}
          numberOfLines={2}
          style={[
            styles.pointLabel,
            {
              color: isSelected ? colors.text : colors.textSecondary,
              fontWeight: isSelected ? fontWeight.bold : fontWeight.regular,
            },
          ]}
        >
          {item.axisLabel ?? item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.caption, { color: colors.textSecondary }]}>{hint}</Text>
      ) : null}

      {points.length === 0 || allMissing ? (
        <StatisticsDataState
          state="empty"
          message="Chưa có số liệu hợp lệ để vẽ biểu đồ trong kỳ này."
        />
      ) : (
        <>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.selection, { color: colors.text }]}
          >
            {selectedText}
          </Text>

          <View
            style={styles.chartRow}
            onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
          >
            {/* Cột nhãn giá trị trục dọc (Y-axis) cố định bên trái */}
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={styles.axis}
            >
              {chart.ticks.map((tick, index) => (
                <Text
                  key={index}
                  style={[
                    styles.axisLabel,
                    { top: tick.y - 8, color: colors.textSecondary },
                  ]}
                >
                  {formatYAxisTickLabel(tick.value, unit)}
                </Text>
              ))}
            </View>

            {/* Vùng biểu đồ có thể vuốt ngang */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              style={styles.scroll}
              accessibilityLabel={`${title}. Vuốt ngang để xem các mốc còn lại`}
            >
              <View style={{ width: chart.width, height: chart.height + 36 }}>
                {usableWidth > 0 ? (
                  <View
                    aria-hidden
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    pointerEvents="none"
                  >
                    <Svg
                      width={chart.width}
                      height={chart.height}
                      viewBox={`0 0 ${chart.width} ${chart.height}`}
                    >
                      {/* Ba đường kẻ lưới ngang */}
                      {chart.ticks.map((tick, index) => (
                        <Line
                          key={`grid-${index}`}
                          x1={0}
                          x2={chart.width}
                          y1={tick.y}
                          y2={tick.y}
                          stroke={colors.border}
                          strokeWidth={1}
                          strokeDasharray={index === 2 ? undefined : '3 5'}
                        />
                      ))}

                      {/* Các đoạn thẳng nối điểm (chỉ vẽ khi là biểu đồ đường) */}
                      {kind === 'line'
                        ? chart.paths.map((path, index) => (
                            <Path
                              key={index}
                              d={path}
                              fill="none"
                              stroke={colors.primary}
                              strokeWidth={2}
                            />
                          ))
                        : null}

                      {/* Các cột hoặc chấm điểm dữ liệu */}
                      {chart.points.map((point, index) =>
                        renderChartPointSvg(point, index)
                      )}
                    </Svg>
                  </View>
                ) : null}

                {/* Các nút chạm trong suốt đặt chồng lên từng mốc */}
                {chart.points.map((point, index) =>
                  renderTouchTargetOverlay(point, index)
                )}
              </View>
            </ScrollView>
          </View>

          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            {unitCaption}
          </Text>

          {hasPartialData ? (
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              Một số mốc chưa có dữ liệu hoặc chưa đầy đủ. Dấu gạch biểu thị mốc chưa
              có số liệu.
            </Text>
          ) : null}

          {kind === 'line' ? (
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              Các điểm là số đo đã ghi nhận; không tạo thêm số đo cho ngày trống.
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

/**
 * Component Biểu đồ Cột (dùng cho Thời gian, Calo, Quãng đường, Số buổi, Ngày hoạt động).
 *
 * @param props Các thuộc tính `StatisticsChartProps`
 * @returns JSX Biểu đồ cột
 */
export function StatisticsBarChart(props: StatisticsChartProps) {
  return <StatisticsChart {...props} kind="bar" />;
}

/**
 * Component Biểu đồ Đường (dùng cho Diễn biến cân nặng theo thời gian).
 *
 * @param props Các thuộc tính `StatisticsChartProps`
 * @returns JSX Biểu đồ đường
 */
export function StatisticsLineChart(props: StatisticsChartProps) {
  return <StatisticsChart {...props} kind="line" />;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { fontSize: fontSize.subtitle, fontWeight: fontWeight.bold },
  caption: { fontSize: fontSize.caption, lineHeight: 21 },
  selection: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  chartRow: { flexDirection: 'row', minWidth: 0, marginTop: spacing.sm },
  axis: { width: 52, height: 184 },
  axisLabel: {
    position: 'absolute',
    left: 0,
    right: spacing.xs,
    fontSize: fontSize.caption,
    textAlign: 'right',
  },
  scroll: { flex: 1 },
  pointTarget: {
    position: 'absolute',
    top: 0,
    width: layout.minTouchSize,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  pointLabel: {
    fontSize: fontSize.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
});
