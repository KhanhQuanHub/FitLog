// ============================================================================
// Module: components/statistics/StatisticsStatus.tsx
// Chức năng: Các component hiển thị trạng thái tải dữ liệu, nhãn cảnh báo và
// nút "Thử lại" cho các màn hình thống kê:
// - `StatisticsStatusBadge`: Nhãn nhỏ (ví dụ: "Chờ đồng bộ", "Đã hoàn thành").
// - `StatisticsRetryButton`: Nút bấm "Thử lại" khi mất mạng.
// - `StatisticsDataState`: Khung thông báo Đang tải / Chưa có dữ liệu / Lỗi.
// - `StatisticsSourceNotice`: Hiển thị ghi chú cảnh báo khi nguồn dữ liệu bị cũ
//   (`stale`), có buổi chờ đồng bộ (`queuedCount`) hoặc có bản ghi lỗi.
// - `StatisticsSourceContent`: Cổng kiểm tra nguồn dữ liệu trước khi hiển thị nội dung.
// ============================================================================

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StatisticsSource } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

/** Bản đồ tiêu đề và câu giải thích mặc định cho 4 trạng thái dữ liệu */
const DEFAULT_DATA_STATE_TEXT: Record<
  'idle' | 'loading' | 'empty' | 'error',
  { defaultTitle: string; defaultMessage: string }
> = {
  idle: {
    defaultTitle: 'Chưa tải dữ liệu',
    defaultMessage: 'Tải dữ liệu để xem thống kê của bạn.',
  },
  loading: {
    defaultTitle: 'Đang tải thống kê',
    defaultMessage: 'Số liệu sẽ xuất hiện khi tải xong.',
  },
  empty: {
    defaultTitle: 'Chưa có dữ liệu',
    defaultMessage: 'Chưa có hoạt động được ghi nhận trong kỳ này.',
  },
  error: {
    defaultTitle: 'Chưa tải được dữ liệu',
    defaultMessage: 'Kiểm tra kết nối rồi thử lại.',
  },
};

/**
 * Thu thập danh sách các câu thông báo tiếng Việt thân thiện từ trạng thái và
 * danh sách mã lỗi kỹ thuật (`issues`) của một nguồn dữ liệu `source`.
 *
 * @param source Nguồn dữ liệu cần kiểm tra
 * @returns Mảng các chuỗi thông báo tiếng Việt
 */
function collectSourceWarningNotes(source: StatisticsSource<unknown>): string[] {
  const notes: string[] = [];

  if (source.status === 'loading') {
    notes.push('Đang cập nhật số liệu…');
  }
  if (source.error) {
    notes.push(source.error.message);
  }
  if (source.stale) {
    notes.push('Đang hiển thị dữ liệu đã lưu; số liệu có thể chưa đầy đủ.');
  }
  if (source.issues.some((issue) => issue.startsWith('unknown-owners:'))) {
    notes.push('Một số bản ghi chưa xác định được tài khoản nên chưa được tính.');
  }
  if (source.issues.includes('queue-read-failed')) {
    notes.push('Chưa đọc được các buổi chờ đồng bộ trên máy.');
  }
  if (source.issues.includes('cache-read-failed')) {
    notes.push('Chưa đọc được lịch sử đã lưu trên máy.');
  }
  if (source.issues.some((issue) => issue.startsWith('unidentified-runs:'))) {
    notes.push('Một số buổi thiếu mã nhận diện nên chưa được tính.');
  }
  if (
    !source.complete &&
    source.status !== 'idle' &&
    source.status !== 'loading' &&
    notes.length === 0
  ) {
    notes.push('Số liệu hiện chưa đầy đủ.');
  }

  return notes;
}

/**
 * Định dạng mốc thời gian cập nhật gần nhất (`updatedAt` tính bằng mili-giây)
 * sang chuỗi ngày giờ tiếng Việt (`vi-VN`).
 *
 * @param updatedAt Timestamp mili-giây hoặc `null`
 * @returns Chuỗi ngày giờ hoặc `null` nếu chưa có thời điểm cập nhật
 */
function formatUpdatedTimeLabel(updatedAt: number | null): string | null {
  if (updatedAt === null || !Number.isFinite(updatedAt)) {
    return null;
  }
  const dateObj = new Date(updatedAt);
  if (!Number.isFinite(dateObj.getTime())) {
    return null;
  }
  return dateObj.toLocaleString('vi-VN');
}

/**
 * Hiển thị một nhãn trạng thái nhỏ (badge) với 3 tông màu: trung tính, cảnh báo, thành công.
 *
 * @param props Nhãn `label` và tông màu `tone` ('neutral' | 'warning' | 'success')
 * @returns JSX Badge
 */
export function StatisticsStatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const { colors } = useTheme();
  let backgroundColor = colors.surfaceAlt;
  if (tone === 'warning') {
    backgroundColor = colors.warningLight;
  } else if (tone === 'success') {
    backgroundColor = colors.primaryLight;
  }

  return (
    <View accessible accessibilityLabel={label} style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

/**
 * Nút bấm "Thử lại" (hoặc "Tải dữ liệu") khi nguồn thống kê gặp lỗi mạng.
 *
 * @param props Hàm xử lý `onPress`, cờ `disabled` và nhãn nút `label`
 * @returns JSX nút bấm
 */
export function StatisticsRetryButton({
  onPress,
  disabled = false,
  label = 'Thử lại',
}: {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.retry,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.retryText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Khung thông báo trạng thái dữ liệu (`idle` | `loading` | `empty` | `error`).
 *
 * @param props Trạng thái `state`, tiêu đề tùy chọn `title`, nội dung `message` và hàm `onRetry`
 * @returns JSX khung trạng thái
 */
export function StatisticsDataState({
  state,
  title,
  message,
  onRetry,
}: {
  state: 'idle' | 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const { defaultTitle, defaultMessage } = DEFAULT_DATA_STATE_TEXT[state];

  return (
    <View
      style={[
        styles.state,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
    >
      {state === 'loading' ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Đang tải" />
      ) : null}
      <Text
        accessibilityRole={state === 'error' ? 'alert' : 'text'}
        accessibilityLiveRegion="polite"
        style={[styles.stateTitle, { color: colors.text }]}
      >
        {title ?? defaultTitle}
      </Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message ?? defaultMessage}
      </Text>
      {onRetry && state !== 'loading' ? (
        <StatisticsRetryButton
          onPress={onRetry}
          label={state === 'idle' ? 'Tải dữ liệu' : 'Thử lại'}
        />
      ) : null}
    </View>
  );
}

/**
 * Hiển thị danh sách thông báo về tình trạng nguồn dữ liệu (đang cập nhật, mất mạng,
 * dữ liệu lưu tạm, số buổi chờ đồng bộ, thời gian cập nhật gần nhất từ server).
 *
 * @param props Nguồn dữ liệu `source`, số buổi chờ đồng bộ `queuedCount` và hàm `onRetry`
 * @returns JSX khối cảnh báo hoặc `null` nếu nguồn hoàn toàn bình thường
 */
export function StatisticsSourceNotice({
  source,
  queuedCount = 0,
  onRetry,
}: {
  source: StatisticsSource<unknown>;
  queuedCount?: number;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const notes = collectSourceWarningNotes(source);
  const updatedLabel = formatUpdatedTimeLabel(source.updatedAt);

  if (notes.length === 0 && queuedCount <= 0 && !updatedLabel) {
    return null;
  }

  return (
    <View style={styles.notice}>
      {queuedCount > 0 ? (
        <StatisticsStatusBadge tone="warning" label={`${queuedCount} buổi chờ đồng bộ`} />
      ) : null}
      {notes.map((note) => (
        <Text
          key={note}
          accessibilityLiveRegion="polite"
          style={[styles.message, { color: colors.textSecondary }]}
        >
          {note}
        </Text>
      ))}
      {updatedLabel ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Cập nhật từ máy chủ: {updatedLabel}
        </Text>
      ) : null}
      {source.error?.retryable && onRetry ? (
        <StatisticsRetryButton onPress={onRetry} disabled={source.status === 'loading'} />
      ) : null}
    </View>
  );
}

/**
 * Component bọc nội dung của một nguồn dữ liệu:
 * - Nếu nguồn chưa có dữ liệu (`source.data === null`), hiển thị khung `StatisticsDataState`
 *   (Đang tải hoặc Lỗi) chứ không hiển thị nội dung con bên trong với số 0 giả.
 * - Nếu đã có dữ liệu, hiển thị cảnh báo `StatisticsSourceNotice` (nếu có) kèm `children`.
 *
 * @param props Nguồn `source`, nội dung `children`, cờ `empty` và hàm `onRetry`
 * @returns JSX nội dung nguồn dữ liệu
 */
export function StatisticsSourceContent({
  source,
  children,
  empty,
  onRetry,
}: {
  source: StatisticsSource<unknown>;
  children: ReactNode;
  empty?: boolean;
  onRetry?: () => void;
}) {
  if (source.data === null) {
    const state = source.status === 'success' ? 'empty' : source.status;
    const retryHandler = source.error?.retryable === false ? undefined : onRetry;
    return (
      <StatisticsDataState
        state={state}
        message={source.error?.message}
        onRetry={retryHandler}
      />
    );
  }

  return (
    <View style={styles.notice}>
      <StatisticsSourceNotice source={source} onRetry={onRetry} />
      {empty && source.status === 'success' && source.complete ? (
        <StatisticsDataState state="empty" />
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  retry: {
    alignSelf: 'flex-start',
    minHeight: layout.minTouchSize,
    minWidth: layout.minTouchSize,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  retryText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
  state: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  stateTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  message: { fontSize: fontSize.caption, lineHeight: 21 },
  notice: { gap: spacing.sm },
});
