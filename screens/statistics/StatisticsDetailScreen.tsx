// ============================================================================
// Module: screens/statistics/StatisticsDetailScreen.tsx
// Chức năng: Khung màn hình dùng chung cho cả 7 màn thống kê chi tiết:
// - Hiển thị nút Quay lại (`‹`), tiêu đề, mô tả, bộ chọn kỳ (`StatisticsPeriodPicker`)
//   và nút "Làm mới thống kê" (cùng thao tác kéo xuống `RefreshControl`).
// - Quản lý state loại kỳ (`kind`: Ngày/Tuần/Tháng/Năm) và ngày neo (`selection`).
// - Tính toán `view` từ `buildStatisticsView` và truyền xuống nội dung màn hình con.
// ============================================================================

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  StatisticsDataState,
  StatisticsPeriodPicker,
} from '../../components/statistics';
import {
  getStatisticsPeriod,
  shiftStatisticsPeriod,
} from '../../domain/statistics/statistics';
import type { PeriodKind } from '../../domain/statistics/types';
import type { StatisticsDataSnapshot } from '../../services/statisticsRepository';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import {
  StatisticsDataProvider,
  useHasStatisticsProvider,
  useStatisticsData,
} from './StatisticsDataProvider';
import { buildStatisticsView, statisticsPeriodLabel } from './viewModel';
import type { StatisticsView } from './viewModel';

/** Các thuộc tính cơ bản mà mỗi màn hình thống kê chi tiết nhận vào */
export interface StatisticsScreenProps {
  onBack?: () => void;
  initialKind?: PeriodKind;
  initialAnchor?: string;
  /** Chiều rộng biểu đồ (chỉ truyền khi test giao diện; trên thiết bị thật tự đo bằng onLayout) */
  chartWidth?: number;
}

/** Dữ liệu ngữ cảnh được khung `StatisticsDetailScreen` chuẩn bị sẵn cho từng màn hình con */
export interface StatisticsScreenContext {
  snapshot: StatisticsDataSnapshot;
  view: StatisticsView;
  today: string;
  kind: PeriodKind;
  chartWidth?: number;
  refresh: () => void;
}

interface DetailProps extends StatisticsScreenProps {
  title: string;
  description: string;
  children: (context: StatisticsScreenContext) => ReactNode;
}

/**
 * Kiểm tra xem người dùng có thể bấm nút "Kỳ trước" (`canPrevious`) hoặc "Kỳ sau" (`canNext`)
 * từ kỳ hiện tại hay không (không cho phép chọn kỳ vượt quá ngày hôm nay `today`).
 *
 * @param kind Loại kỳ đang chọn ('day' | 'week' | 'month' | 'year')
 * @param anchor Ngày neo hiện tại ('YYYY-MM-DD')
 * @param today Ngày hôm nay ('YYYY-MM-DD')
 * @returns Đối tượng `{ canPrevious, canNext }`
 */
function checkPeriodShiftBounds(
  kind: PeriodKind,
  anchor: string,
  today: string
): { canPrevious: boolean; canNext: boolean } {
  let canPrevious = false;
  let canNext = false;

  try {
    const previousPeriod = shiftStatisticsPeriod(kind, anchor, -1);
    canPrevious = previousPeriod.start >= '0001-01-01';
  } catch {
    // Đã chạm biên lịch nhỏ nhất (năm 0001)
  }

  try {
    const nextPeriod = shiftStatisticsPeriod(kind, anchor, 1);
    canNext = nextPeriod.start <= today;
  } catch {
    // Đã chạm biên lịch lớn nhất (năm 9999)
  }

  return { canPrevious, canNext };
}

/**
 * Component khung cho màn hình thống kê chi tiết.
 * Nếu màn hình được gọi độc lập bên ngoài mà chưa có `StatisticsDataProvider`,
 * nó sẽ tự bọc thêm `StatisticsDataProvider` để luôn hoạt động an toàn.
 *
 * @param props Tiêu đề, mô tả, kỳ khởi tạo và hàm render nội dung `children`
 * @returns JSX màn hình chi tiết
 */
export function StatisticsDetailScreen(props: DetailProps) {
  const hasProvider = useHasStatisticsProvider();
  if (hasProvider) {
    return <StatisticsDetailBody {...props} />;
  }
  return (
    <StatisticsDataProvider>
      <StatisticsDetailBody {...props} />
    </StatisticsDataProvider>
  );
}

/**
 * Phần thân của màn hình thống kê chi tiết: quản lý bộ lọc kỳ và trạng thái tải.
 *
 * @param props Các thuộc tính cấu hình khung màn hình chi tiết
 * @returns JSX hiển thị thanh tiêu đề, bộ chọn kỳ và nội dung màn hình
 */
function StatisticsDetailBody({
  title,
  description,
  onBack,
  initialKind = 'week',
  initialAnchor,
  chartWidth,
  children,
}: DetailProps) {
  const { colors } = useTheme();
  const { snapshot, today, refresh } = useStatisticsData();

  // State lưu loại kỳ đang chọn ('day' | 'week' | 'month' | 'year')
  const [kind, setKind] = useState<PeriodKind>(initialKind);
  // State lưu ngày neo khi người dùng bấm lùi/tiến kỳ; nếu `null` thì luôn lấy `today`
  const [selection, setSelection] = useState<string | null>(initialAnchor ?? null);

  const anchor = selection ?? today;
  const period = useMemo(() => getStatisticsPeriod(kind, anchor), [kind, anchor]);
  const view = useMemo(
    () => (snapshot ? buildStatisticsView(snapshot, today, kind, anchor) : null),
    [snapshot, today, kind, anchor]
  );

  // Kiểm tra xem có bất kỳ nguồn nào đang tải ('loading') để hiện trạng thái làm mới
  const refreshing =
    snapshot !== null &&
    [
      snapshot.workouts,
      snapshot.runs,
      snapshot.profiles,
      snapshot.weights,
      snapshot.userGoals,
    ].some((source) => source.status === 'loading');

  const { canPrevious, canNext } = checkPeriodShiftBounds(kind, anchor, today);

  /**
   * Quyết định phần nội dung chính hiển thị bên dưới bộ chọn kỳ:
   * - Nếu chưa có `snapshot`: hiện trạng thái "Đang tải thống kê…".
   * - Nếu chưa đăng nhập (`!view`): hiện thông báo "Cần đăng nhập".
   * - Nếu đã sẵn sàng: gọi hàm `children` để vẽ nội dung của màn hình con.
   */
  const renderMainDetailContent = () => {
    if (!snapshot) {
      return <StatisticsDataState state="loading" />;
    }

    if (!view) {
      return (
        <StatisticsDataState
          state="idle"
          title="Cần đăng nhập"
          message="Đăng nhập để xem dữ liệu thống kê cá nhân của bạn."
        />
      );
    }

    const viewResetKey = `${snapshot.session.userId}:${snapshot.session.revision}:${period.kind}:${period.start}`;
    return (
      <View key={viewResetKey} style={styles.body}>
        {children({ snapshot, view, today, kind, chartWidth, refresh })}
      </View>
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Thanh tiêu đề kèm nút Quay lại */}
        <View style={styles.heading}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={onBack}
              style={styles.action}
            >
              <Text style={[styles.back, { color: colors.text }]}>‹</Text>
            </Pressable>
          ) : null}
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
        </View>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>

        {/* Bộ chọn kỳ: Ngày / Tuần / Tháng / Năm */}
        <StatisticsPeriodPicker
          value={kind}
          periodLabel={statisticsPeriodLabel(kind, anchor)}
          onChange={setKind}
          onShift={(direction) =>
            setSelection(shiftStatisticsPeriod(kind, anchor, direction).start)
          }
          onCurrent={() => setSelection(null)}
          canPrevious={canPrevious}
          canNext={canNext}
        />

        {/* Nút làm mới thủ công */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới thống kê"
          disabled={refreshing}
          accessibilityState={{ disabled: refreshing }}
          aria-disabled={refreshing}
          onPress={refresh}
          style={styles.refresh}
        >
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {refreshing ? 'Đang cập nhật…' : 'Làm mới thống kê'}
          </Text>
        </Pressable>

        {renderMainDetailContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: {
    minWidth: layout.minTouchSize,
    minHeight: layout.minTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { fontSize: fontSize.headline },
  title: { flex: 1, fontSize: fontSize.headline, fontWeight: fontWeight.bold },
  description: { fontSize: fontSize.caption, lineHeight: 22 },
  refresh: {
    alignSelf: 'flex-start',
    minHeight: layout.minTouchSize,
    justifyContent: 'center',
  },
  body: { gap: spacing.xl },
});
