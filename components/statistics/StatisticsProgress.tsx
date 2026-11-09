// ============================================================================
// Module: components/statistics/StatisticsProgress.tsx
// Chức năng: Hiển thị tiến độ hoàn thành mục tiêu dưới dạng:
// 1. Vòng tròn phần trăm SVG (`StatisticsProgress`) kèm tỷ số `thực tế / mục tiêu`.
// 2. Thanh tiến độ ngang (`StatisticsProgressBar`).
// ============================================================================

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { StatisticsMetric } from '../../domain/statistics/types';
import { fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import Card from '../ui/Card';
import {
  describeStatisticsProgress,
  formatStatisticsNumber,
  formatStatisticsValue,
} from './presentation';

/** Các thuộc tính đầu vào của thẻ vòng tròn tiến độ `StatisticsProgress` */
export interface StatisticsProgressProps {
  title: string;
  periodLabel: string;
  actual: StatisticsMetric | null;
  target: number | null;
  unitLabel?: string;
  onPress?: () => void;
}

/**
 * Component hiển thị vòng tròn tiến độ thực hiện cam kết tuần (ví dụ: 30 / 150 phút).
 *
 * Giải thích cách vẽ vòng tròn tiến độ bằng SVG:
 * - Vẽ một hình tròn nền màu xám (`colors.border`) có bán kính `r = 44`.
 * - Chu vi hình tròn là `circumference = 2 * Math.PI * 44`.
 * - Vẽ đè một hình tròn thứ hai màu chính (`colors.primary`) dùng thuộc tính nét đứt
 *   `strokeDasharray` và đẩy lùi `strokeDashoffset = circumference * (1 - progress.fill)`
 *   để chỉ tô đúng phần trăm đã đạt được, xoay `-90` độ để bắt đầu từ đỉnh 12 giờ.
 *
 * @param props Tiêu đề, nhãn kỳ, số thực tế `actual`, mục tiêu `target` và sự kiện `onPress`
 * @returns JSX thẻ vòng tròn tiến độ
 */
export function StatisticsProgress({
  title,
  periodLabel,
  actual,
  target,
  unitLabel = 'phút',
  onPress,
}: StatisticsProgressProps) {
  const { colors } = useTheme();
  const progress = describeStatisticsProgress(actual, target);

  const percentText =
    progress.percent === null ? '—' : `${formatStatisticsNumber(progress.percent)}%`;
  const actualText = formatStatisticsValue(actual?.value ?? null, 'minutes');
  const targetText =
    target !== null && Number.isFinite(target) && target > 0
      ? formatStatisticsNumber(target, 1)
      : '—';

  const statusText = progress.message ?? `Đạt ${percentText}`;
  const description = `${title}. ${periodLabel}. ${actualText} trên ${targetText} ${unitLabel}. ${statusText}`;

  const circleRadius = 44;
  const circumference = 2 * Math.PI * circleRadius;
  const clampedNow = progress.percent === null ? undefined : Math.min(progress.percent, 100);

  let subtitleMessage = progress.message;
  if (!subtitleMessage) {
    subtitleMessage =
      progress.percent! > 100 ? 'Đã vượt cam kết tuần' : 'Tiến độ thực hiện cam kết';
  }

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={onPress ? `${description}. Xem chi tiết` : undefined}
      style={styles.card}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{periodLabel}</Text>

      <View style={styles.content}>
        <View
          accessible={!onPress}
          accessibilityRole={progress.percent === null ? 'summary' : 'progressbar'}
          accessibilityLabel={description}
          accessibilityValue={{
            min: 0,
            max: 100,
            ...(clampedNow === undefined ? {} : { now: clampedNow }),
            text: percentText,
          }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedNow}
          aria-valuetext={percentText}
          style={styles.ring}
        >
          <View
            aria-hidden
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Svg width={112} height={112} viewBox="0 0 112 112">
              <Circle
                cx={56}
                cy={56}
                r={circleRadius}
                stroke={colors.border}
                strokeWidth={10}
                fill="none"
              />
              {progress.fill > 0 ? (
                <Circle
                  cx={56}
                  cy={56}
                  r={circleRadius}
                  stroke={colors.primary}
                  strokeWidth={10}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference * (1 - progress.fill)}
                  strokeLinecap="round"
                  transform="rotate(-90 56 56)"
                />
              ) : null}
            </Svg>
          </View>
          <View pointerEvents="none" style={styles.ringLabel}>
            <Text style={[styles.percent, { color: colors.text }]}>{percentText}</Text>
          </View>
        </View>

        <View style={styles.detail}>
          <Text style={[styles.numbers, { color: colors.text }]}>
            {actualText} / {targetText}
          </Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>{unitLabel}</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            {subtitleMessage}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/**
 * Component thanh tiến độ ngang đơn giản (`StatisticsProgressBar`).
 *
 * @param props Số liệu thực tế `actual`, mục tiêu `target` và nhãn `label`
 * @returns JSX thanh tiến độ ngang
 */
export function StatisticsProgressBar({
  actual,
  target,
  label,
}: {
  actual: StatisticsMetric | null;
  target: number | null;
  label: string;
}) {
  const { colors } = useTheme();
  const progress = describeStatisticsProgress(actual, target);
  const description =
    progress.message ?? `Đạt ${formatStatisticsNumber(progress.percent)}%`;
  const clampedNow = progress.percent === null ? undefined : Math.min(progress.percent, 100);

  return (
    <View
      accessible
      accessibilityRole={progress.percent === null ? 'summary' : 'progressbar'}
      accessibilityLabel={`${label}. ${description}`}
      accessibilityValue={{
        min: 0,
        max: 100,
        ...(clampedNow === undefined ? {} : { now: clampedNow }),
        text: description,
      }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedNow}
      aria-valuetext={description}
      style={styles.barGroup}
    >
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            { width: `${progress.fill * 100}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { fontSize: fontSize.subtitle, fontWeight: fontWeight.bold },
  caption: { fontSize: fontSize.caption, lineHeight: 21 },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  ring: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  percent: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  detail: { flexGrow: 1, flexShrink: 1, flexBasis: 132, gap: spacing.xs },
  numbers: { fontSize: fontSize.headline, fontWeight: fontWeight.bold },
  barGroup: { gap: spacing.sm },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
