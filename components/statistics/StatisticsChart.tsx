import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import Card from '../ui/Card';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { buildStatisticsChart, formatStatisticsNumber, formatStatisticsValue, STATISTICS_UNITS } from './presentation';
import type { StatisticsChartPoint, StatisticsUnit } from './presentation';
import { StatisticsDataState } from './StatisticsStatus';

export interface StatisticsChartProps {
  title: string;
  points: readonly StatisticsChartPoint[];
  unit: StatisticsUnit;
  unitLabel?: string;
  hint?: string;
  onSelect?: (point: StatisticsChartPoint) => void;
  // Khi cha biết chính xác kích thước; nếu không, đo bằng onLayout.
  width?: number;
}

function StatisticsChart({ title, points, unit, unitLabel, hint, onSelect, width, kind }: StatisticsChartProps & { kind: 'bar' | 'line' }) {
  const { colors } = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = points.find(point => point.key === selectedKey) ?? points.at(-1) ?? null;
  const selectedIndex = selected ? points.indexOf(selected) : -1;
  const usableWidth = width !== undefined && Number.isFinite(width) && width > 0 ? width : measuredWidth;
  const chart = buildStatisticsChart(points, usableWidth - 52, kind);
  const allMissing = !chart.points.some(point => point.value !== null);
  const suffix = unitLabel ?? STATISTICS_UNITS[unit];
  const selectedText = selected ? `${selected.label}: ${formatStatisticsValue(selected.value, unit)} ${suffix}${selected.complete === false ? '. Số liệu chưa đầy đủ' : ''}` : '';
  const partial = points.some(point => point.complete === false) || chart.points.some(point => point.value === null);
  return <Card style={styles.card}>
    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    {hint ? <Text style={[styles.caption, { color: colors.textSecondary }]}>{hint}</Text> : null}
    {points.length === 0 || allMissing ? <StatisticsDataState state="empty" message="Chưa có số liệu hợp lệ để vẽ biểu đồ trong kỳ này." /> : <>
      <Text accessibilityLiveRegion="polite" style={[styles.selection, { color: colors.text }]}>{selectedText}</Text>
      <View style={styles.chartRow} onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.axis}>
          {chart.ticks.map((tick, index) => <Text key={index} style={[styles.axisLabel, { top: tick.y - 8, color: colors.textSecondary }]}>
            {unit === 'pace' ? formatStatisticsValue(tick.value, unit)
              : formatStatisticsNumber(unit === 'seconds' ? tick.value / 60 : tick.value, 1)}
          </Text>)}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.scroll} accessibilityLabel={`${title}. Vuốt ngang để xem các mốc còn lại`}>
          <View style={{ width: chart.width, height: chart.height + 36 }}>
            {usableWidth > 0 ? <View aria-hidden accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
            <Svg width={chart.width} height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`}>
              {chart.ticks.map((tick, index) => <Line key={`grid-${index}`} x1={0} x2={chart.width} y1={tick.y} y2={tick.y}
                stroke={colors.border} strokeWidth={1} strokeDasharray={index === 2 ? undefined : '3 5'} />)}
              {kind === 'line' ? chart.paths.map((path, index) => <Path key={index} d={path} fill="none" stroke={colors.primary} strokeWidth={2} />) : null}
              {chart.points.map((point, index) => point.y !== null ? kind === 'bar'
                ? <Rect key={points[index].key} x={point.x - 9} y={point.y} width={18} height={Math.max(0, point.baseline - point.y)} rx={4}
                  fill={index === selectedIndex ? colors.primary : colors.info} opacity={points[index].complete === false ? 0.55 : 1} />
                : <Circle key={points[index].key} cx={point.x} cy={point.y} r={index === selectedIndex ? 6 : 4}
                  fill={colors.surface} stroke={colors.primary} strokeWidth={2} />
                : <Line key={points[index].key} x1={point.x - 5} x2={point.x + 5} y1={point.baseline} y2={point.baseline} stroke={colors.textMuted} strokeWidth={2} />)}
            </Svg></View> : null}
            {chart.points.map((point, index) => {
              const item = points[index];
              return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: index === selectedIndex }}
                aria-selected={index === selectedIndex}
                accessibilityLabel={`${item.label}: ${formatStatisticsValue(item.value, unit)} ${suffix}${item.complete === false ? '. Số liệu chưa đầy đủ' : ''}`}
                onPress={() => { setSelectedKey(item.key); onSelect?.(item); }}
                style={({ pressed }) => [styles.pointTarget, { left: Math.max(0, point.x - layout.minTouchSize / 2),
                  height: chart.height + 32, opacity: pressed ? 0.65 : 1 }]}>
                <Text accessible={false} numberOfLines={2} style={[styles.pointLabel, { color: index === selectedIndex ? colors.text : colors.textSecondary,
                  fontWeight: index === selectedIndex ? fontWeight.bold : fontWeight.regular }]}>
                  {item.axisLabel ?? item.label}
                </Text>
              </Pressable>;
            })}
          </View>
        </ScrollView>
      </View>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{unit === 'seconds' ? 'Trục dọc: phút. ' : suffix ? `Đơn vị: ${suffix}. ` : ''}Chạm một mốc để xem số liệu.</Text>
      {partial ? <Text style={[styles.caption, { color: colors.textSecondary }]}>Một số mốc chưa có dữ liệu hoặc chưa đầy đủ. Dấu gạch biểu thị mốc chưa có số liệu.</Text> : null}
      {kind === 'line' ? <Text style={[styles.caption, { color: colors.textSecondary }]}>Các điểm là số đo đã ghi nhận; không tạo thêm số đo cho ngày trống.</Text> : null}
    </>}
  </Card>;
}

export function StatisticsBarChart(props: StatisticsChartProps) { return <StatisticsChart {...props} kind="bar" />; }
export function StatisticsLineChart(props: StatisticsChartProps) { return <StatisticsChart {...props} kind="line" />; }

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { fontSize: fontSize.subtitle, fontWeight: fontWeight.bold },
  caption: { fontSize: fontSize.caption, lineHeight: 21 },
  selection: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  chartRow: { flexDirection: 'row', minWidth: 0, marginTop: spacing.sm },
  axis: { width: 52, height: 184 },
  axisLabel: { position: 'absolute', left: 0, right: spacing.xs, fontSize: fontSize.caption, textAlign: 'right' },
  scroll: { flex: 1 },
  pointTarget: { position: 'absolute', top: 0, width: layout.minTouchSize, justifyContent: 'flex-end', alignItems: 'center' },
  pointLabel: { fontSize: fontSize.caption, textAlign: 'center', paddingHorizontal: spacing.xs },
});
