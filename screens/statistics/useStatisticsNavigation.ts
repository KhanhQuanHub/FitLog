// ============================================================================
// Module: screens/statistics/useStatisticsNavigation.ts
// Chức năng: Chứa các hàm điều hướng quay lại màn Tóm tắt thống kê và tự động
// làm mới số liệu mỗi khi người dùng chuyển tab quay lại màn hình thống kê.
// ============================================================================

import { useCallback, useEffect, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useStatisticsData } from './StatisticsDataProvider';

/**
 * Quay lại màn hình trước đó trong ngăn xếp điều hướng.
 * Nếu người dùng mở trực tiếp bằng đường dẫn sâu (deep link) mà không có lịch sử
 * quay lại (`!router.canGoBack()`), điều hướng thẳng về trang tổng quan `/statistics`.
 *
 * @returns {void}
 */
export function backToStatistics(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/statistics');
  }
}

/**
 * Hook tự động làm mới dữ liệu thống kê mỗi khi màn hình được người dùng mở lại (focus).
 *
 * Tại sao dùng `useRef` + `useEffect` để lưu `snapshot` mới nhất?
 * - Nếu đưa `snapshot` trực tiếp vào mảng phụ thuộc `[refresh, snapshot]` của `useCallback`,
 *   thì mỗi khi tải xong dữ liệu mới (`snapshot` đổi), `useFocusEffect` sẽ bị kích hoạt lại
 *   gây ra vòng lặp tải vô tận.
 * - Cập nhật `latest.current = snapshot` trong `useEffect` giúp đọc được trạng thái hiện tại
 *   mà chỉ chạy khi màn hình thực sự được focus.
 *
 * @returns {void}
 */
export function useStatisticsFocusRefresh(): void {
  const { snapshot, refresh } = useStatisticsData();
  const latest = useRef(snapshot);

  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);

  useFocusEffect(
    useCallback(() => {
      const current = latest.current;
      if (!current) return;

      // Kiểm tra xem có nguồn dữ liệu nào đang trong quá trình tải ('loading') hay không.
      // Nếu tất cả đều đã tải xong từ trước, mới gọi refresh() để cập nhật dữ liệu mới.
      const allSources = [
        current.workouts,
        current.runs,
        current.profiles,
        current.weights,
        current.userGoals,
      ];
      const isAnyLoading = allSources.some((source) => source.status === 'loading');

      if (!isAnyLoading) {
        refresh();
      }
    }, [refresh])
  );
}
