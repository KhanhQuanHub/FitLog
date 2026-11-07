import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StatisticsSource } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

export function StatisticsStatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'warning' | 'success' }) {
  const { colors } = useTheme();
  const backgroundColor = tone === 'warning' ? colors.warningLight : tone === 'success' ? colors.primaryLight : colors.surfaceAlt;
  return <View accessible accessibilityLabel={label} style={[styles.badge, { backgroundColor }]}>
    <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>;
}

export function StatisticsRetryButton({ onPress, disabled = false, label = 'Thử lại' }: { onPress: () => void; disabled?: boolean; label?: string }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [styles.retry, { borderColor: colors.border, backgroundColor: colors.surface,
      opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
    <Text style={[styles.retryText, { color: colors.text }]}>{label}</Text>
  </Pressable>;
}

export function StatisticsDataState({ state, title, message, onRetry }: {
  state: 'idle' | 'loading' | 'empty' | 'error'; title?: string; message?: string; onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const defaults = {
    idle: ['Chưa tải dữ liệu', 'Tải dữ liệu để xem thống kê của bạn.'],
    loading: ['Đang tải thống kê', 'Số liệu sẽ xuất hiện khi tải xong.'],
    empty: ['Chưa có dữ liệu', 'Chưa có hoạt động được ghi nhận trong kỳ này.'],
    error: ['Chưa tải được dữ liệu', 'Kiểm tra kết nối rồi thử lại.'],
  };
  return <View style={[styles.state, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
    {state === 'loading' ? <ActivityIndicator color={colors.primary} accessibilityLabel="Đang tải" /> : null}
    <Text accessibilityRole={state === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite"
      style={[styles.stateTitle, { color: colors.text }]}>{title ?? defaults[state][0]}</Text>
    <Text style={[styles.message, { color: colors.textSecondary }]}>{message ?? defaults[state][1]}</Text>
    {onRetry && state !== 'loading' ? <StatisticsRetryButton onPress={onRetry} label={state === 'idle' ? 'Tải dữ liệu' : 'Thử lại'} /> : null}
  </View>;
}

export function StatisticsSourceNotice({ source, queuedCount = 0, onRetry }: {
  source: StatisticsSource<unknown>; queuedCount?: number; onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const notes: string[] = [];
  if (source.status === 'loading') notes.push('Đang cập nhật số liệu…');
  if (source.error) notes.push(source.error.message);
  if (source.stale) notes.push('Đang hiển thị dữ liệu đã lưu; số liệu có thể chưa đầy đủ.');
  if (source.issues.some(issue => issue.startsWith('unknown-owners:'))) notes.push('Một số bản ghi chưa xác định được tài khoản nên chưa được tính.');
  if (source.issues.includes('queue-read-failed')) notes.push('Chưa đọc được các buổi chờ đồng bộ trên máy.');
  if (source.issues.includes('cache-read-failed')) notes.push('Chưa đọc được lịch sử đã lưu trên máy.');
  if (source.issues.some(issue => issue.startsWith('unidentified-runs:'))) notes.push('Một số buổi thiếu mã nhận diện nên chưa được tính.');
  if (!source.complete && source.status !== 'idle' && source.status !== 'loading' && notes.length === 0) notes.push('Số liệu hiện chưa đầy đủ.');
  const updated = source.updatedAt !== null && Number.isFinite(source.updatedAt) ? new Date(source.updatedAt) : null;
  const updatedLabel = updated && Number.isFinite(updated.getTime()) ? updated.toLocaleString('vi-VN') : null;
  if (notes.length === 0 && queuedCount <= 0 && !updatedLabel) return null;
  return <View style={styles.notice}>
    {queuedCount > 0 ? <StatisticsStatusBadge tone="warning" label={`${queuedCount} buổi chờ đồng bộ`} /> : null}
    {notes.map(note => <Text key={note} accessibilityLiveRegion="polite" style={[styles.message, { color: colors.textSecondary }]}>{note}</Text>)}
    {updatedLabel ? <Text style={[styles.message, { color: colors.textSecondary }]}>Cập nhật từ máy chủ: {updatedLabel}</Text> : null}
    {source.error?.retryable && onRetry ? <StatisticsRetryButton onPress={onRetry} disabled={source.status === 'loading'} /> : null}
  </View>;
}

// Không biến lỗi/chưa tải thành một màn trống có vẻ đã tải thành công.
export function StatisticsSourceContent({ source, children, empty, onRetry }: {
  source: StatisticsSource<unknown>; children: ReactNode; empty?: boolean; onRetry?: () => void;
}) {
  if (source.data === null) return <StatisticsDataState state={source.status === 'success' ? 'empty' : source.status}
    message={source.error?.message} onRetry={source.error?.retryable === false ? undefined : onRetry} />;
  return <View style={styles.notice}>
    <StatisticsSourceNotice source={source} onRetry={onRetry} />
    {empty && source.status === 'success' && source.complete ? <StatisticsDataState state="empty" /> : children}
  </View>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  badgeLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  retry: { alignSelf: 'flex-start', minHeight: layout.minTouchSize, minWidth: layout.minTouchSize,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center' },
  retryText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
  state: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  stateTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  message: { fontSize: fontSize.caption, lineHeight: 21 },
  notice: { gap: spacing.sm },
});
