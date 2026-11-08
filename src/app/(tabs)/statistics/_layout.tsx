// ============================================================================
// Module: src/app/(tabs)/statistics/_layout.tsx
// Chức năng: Định nghĩa bộ điều hướng ngăn xếp (Expo Router Stack) cho tab
// Thống kê (`/statistics`) và bọc chung một `StatisticsDataProvider` ở ngoài
// để cả 3 route (`index`, `categories`, `[category]`) dùng chung bộ nhớ dữ liệu.
// ============================================================================

import { Stack } from 'expo-router';
import { StatisticsDataProvider } from '../../../../screens/statistics/StatisticsDataProvider';

/** Cấu hình mặc định của Expo Router: luôn lấy màn `index` (Tóm tắt) làm gốc */
export const unstable_settings = { initialRouteName: 'index' };

/**
 * Layout bọc các màn hình thuộc tab Thống kê.
 *
 * @returns JSX `StatisticsDataProvider` bọc `Stack` 3 màn hình thống kê
 */
export default function StatisticsLayout() {
  return (
    <StatisticsDataProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="[category]" />
      </Stack>
    </StatisticsDataProvider>
  );
}
