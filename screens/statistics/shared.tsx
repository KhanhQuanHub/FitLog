// ============================================================================
// Module: screens/statistics/shared.tsx
// Chức năng: Chứa các component bố cục dùng chung cho các màn hình thống kê:
// - `StatisticsText`: Đoạn chữ ghi chú màu phụ.
// - `StatisticsSection`: Một khu vực có tiêu đề lớn (`header`).
// - `StatisticsSourceSection`: Khu vực gắn với một nguồn dữ liệu, tự động hiện
//   trạng thái đang tải / lỗi / nút thử lại nếu nguồn đó chưa sẵn sàng.
// - `StatisticsInfo`: Hộp thông tin giải thích quy tắc tính toán cho người dùng.
// - `StatisticsMetricGrid`: Lưới 2 cột hiển thị các thẻ chỉ số `StatisticsMetricCard`.
// - `StatisticsHistory`: Danh sách lịch sử có phân trang "Xem thêm" (mỗi lần 20 dòng).
// ============================================================================

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/ui/Card';
import {
  StatisticsDataState,
  StatisticsMetricCard,
  StatisticsSourceContent,
} from '../../components/statistics';
import type { StatisticsMetricCardProps } from '../../components/statistics';
import type { StatisticsSource } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';

/**
 * Hiển thị đoạn văn bản chú thích với cỡ chữ nhỏ và màu chữ phụ (`textSecondary`).
 *
 * @param props.children Nội dung văn bản
 * @returns JSX Text
 */
export function StatisticsText({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.text, { color: colors.textSecondary }]}>{children}</Text>;
}

/**
 * Hiển thị một phân mục (section) gồm tiêu đề và nội dung bên dưới.
 *
 * @param props.title Tiêu đề phân mục
 * @param props.children Các phần tử con bên trong phân mục
 * @returns JSX View chứa tiêu đề và nội dung
 */
export function StatisticsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Hiển thị một phân mục gắn với một nguồn dữ liệu cụ thể (`source`).
 * Nếu nguồn dữ liệu bị lỗi hoặc đang tải lần đầu, tự động hiển thị khung báo lỗi
 * kèm nút "Thử lại" thay vì hiển thị nội dung trống.
 *
 * @param props Tiêu đề `title`, nguồn `source`, hàm làm mới `refresh` và `children`
 * @returns JSX `StatisticsSection` bọc `StatisticsSourceContent`
 */
export function StatisticsSourceSection({
  title,
  source,
  refresh,
  children,
}: {
  title: string;
  source: StatisticsSource<unknown>;
  refresh: () => void;
  children: ReactNode;
}) {
  return (
    <StatisticsSection title={title}>
      <StatisticsSourceContent source={source} onRetry={refresh}>
        {children}
      </StatisticsSourceContent>
    </StatisticsSection>
  );
}

/**
 * Hiển thị một thẻ Card chứa lời giải thích ngắn gọn về cách tính thống kê.
 *
 * @param props.children Nội dung giải thích
 * @returns JSX Card chứa văn bản
 */
export function StatisticsInfo({ children }: { children: ReactNode }) {
  return (
    <Card>
      <StatisticsText>{children}</StatisticsText>
    </Card>
  );
}

/**
 * Hiển thị lưới các thẻ chỉ số thống kê (`StatisticsMetricCard`) tự động xuống dòng
 * (mỗi hàng thường gồm 2 thẻ trên màn hình điện thoại).
 *
 * @param props.items Danh sách cấu hình các thẻ chỉ số cần hiển thị
 * @returns JSX lưới thẻ chỉ số
 */
export function StatisticsMetricGrid({
  items,
}: {
  items: StatisticsMetricCardProps[];
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <StatisticsMetricCard key={item.title} {...item} style={styles.tile} />
      ))}
    </View>
  );
}

/**
 * Hiển thị danh sách các bản ghi lịch sử (buổi chạy, buổi tập, lần cân).
 * Mặc định hiển thị tối đa 20 dòng đầu tiên để màn hình mượt mà; khi bấm
 * "Xem thêm" sẽ mở rộng thêm 20 dòng mỗi lần.
 *
 * @param props Danh sách `records`, hàm vẽ từng dòng `renderRow` và câu thông báo khi rỗng `emptyMessage`
 * @returns JSX danh sách lịch sử hoặc trạng thái rỗng
 */
export function StatisticsHistory<T>({
  records,
  renderRow,
  emptyMessage,
}: {
  records: readonly T[];
  renderRow: (row: T, index: number) => ReactNode;
  emptyMessage: string;
}) {
  const [limit, setLimit] = useState(20);
  const { colors } = useTheme();

  if (records.length === 0) {
    return <StatisticsDataState state="empty" message={emptyMessage} />;
  }

  const visibleRecords = records.slice(0, limit);
  const remainingCount = records.length - limit;

  return (
    <Card>
      {visibleRecords.map(renderRow)}
      {remainingCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setLimit((currentLimit) => currentLimit + 20)}
          style={({ pressed }) => [styles.more, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.text, { color: colors.text }]}>
            Xem thêm ({remainingCount} mục còn lại)
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  title: { fontSize: fontSize.subtitle, fontWeight: fontWeight.bold },
  text: { fontSize: fontSize.caption, lineHeight: 22 },
  more: {
    minHeight: layout.minTouchSize,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: 134, flexGrow: 1, minWidth: 0 },
});
