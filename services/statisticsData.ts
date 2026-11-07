// ============================================================================
// Module: services/statisticsData.ts
// Chức năng: Kết nối `createStatisticsRepository` với các dịch vụ thực tế của
// ứng dụng FitLog:
// - Lấy thông tin đăng nhập từ `useAuthStore` (Zustand) và `statisticsSession`.
// - Đọc 5 bảng dữ liệu từ JSON Server thông qua `services/api.js`:
//   `/workouts`, `/runs`, `/userGoals`, `/weightHistory`, `/profiles`.
// - Đọc hàng đợi chờ đồng bộ (`QUEUE`) và lịch sử bộ nhớ đệm (`HISTORY_CACHE`)
//   từ `AsyncStorage`.
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllRuns, getAllWorkouts, getUserGoals, getWeightHistory, request } from './api';
import { STORAGE_KEYS } from './runRepository';
import { useAuthStore } from '../store/authStore';
import { createStatisticsRepository, parseStatisticsStorage } from './statisticsRepository';
import {
  getStatisticsSession,
  ownsQueuedRun,
  subscribeRunStatistics,
  subscribeStatisticsSession,
} from './statisticsSession';

/**
 * Khởi tạo bộ đọc dữ liệu thống kê gắn với API và bộ nhớ thiết bị của FitLog.
 * Được gọi trong `StatisticsDataProvider` khi mở khu vực thống kê và tự động
 * giải phóng (`dispose`) khi thoát.
 *
 * @returns Đối tượng `StatisticsRepository` quản lý việc tải dữ liệu thống kê
 */
export function createFitLogStatisticsData() {
  return createStatisticsRepository({
    /**
     * Lấy phiên người dùng hiện tại.
     * Chỉ trả về `userId` khi cả token trong `statisticsSession` và `useAuthStore`
     * đều xác nhận đã đăng nhập trùng khớp một người dùng.
     */
    getSession: () => {
      const session = getStatisticsSession();
      const auth = useAuthStore.getState();
      const isMatchingUser = auth.isLoggedIn && String(auth.user?.id) === session.userId;
      return {
        ...session,
        userId: isMatchingUser ? session.userId : null,
      };
    },

    ownsQueuedRun,

    /**
     * Lắng nghe sự kiện đăng nhập / đăng xuất từ cả `statisticsSession` và `useAuthStore`.
     */
    subscribeSession: (listener) => {
      const stopIdentity = subscribeStatisticsSession(listener);
      const stopAuth = useAuthStore.subscribe((state, previous) => {
        const loginChanged = state.isLoggedIn !== previous.isLoggedIn;
        const userChanged = state.user?.id !== previous.user?.id;
        if (loginChanged || userChanged) {
          listener();
        }
      });
      return () => {
        stopIdentity();
        stopAuth();
      };
    },

    subscribeRuns: subscribeRunStatistics,

    /**
     * Các hàm đọc dữ liệu từ CSDL (JSON Server) và bộ nhớ cục bộ (AsyncStorage).
     */
    read: {
      workouts: getAllWorkouts,
      runs: getAllRuns,
      userGoals: getUserGoals,
      weights: getWeightHistory,
      // Đọc toàn bộ danh sách `/profiles` rồi lọc theo `userId` để không lấy nhầm
      // hồ sơ của người khác khi tài khoản có quyền admin.
      profiles: () => request('/profiles'),
      queue: async () => parseStatisticsStorage(await AsyncStorage.getItem(STORAGE_KEYS.QUEUE)),
      cache: async () =>
        parseStatisticsStorage(await AsyncStorage.getItem(STORAGE_KEYS.HISTORY_CACHE)),
    },
  });
}
