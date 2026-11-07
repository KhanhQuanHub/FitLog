import { useCallback, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useStatisticsData } from './StatisticsDataProvider';

export function backToStatistics() {
  if (router.canGoBack()) router.back();
  else router.replace('/statistics');
}

export function useStatisticsFocusRefresh() {
  const { snapshot, refresh } = useStatisticsData();
  const latest = useRef(snapshot);
  latest.current = snapshot;
  // Provider tải lần đầu; không khởi động thêm một lượt đọc khi lượt đó còn chạy.
  // Ref giữ callback ổn định, tránh refresh lại sau mỗi snapshot trả về.
  useFocusEffect(useCallback(() => {
    const current = latest.current;
    if (current && ![current.workouts, current.runs, current.profiles, current.weights, current.userGoals]
      .some(source => source.status === 'loading')) refresh();
  }, [refresh]));
}
