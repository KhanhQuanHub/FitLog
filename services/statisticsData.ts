import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllRuns, getAllWorkouts, getUserGoals, getWeightHistory, request } from './api';
import { STORAGE_KEYS } from './runRepository';
import { useAuthStore } from '../store/authStore';
import { createStatisticsRepository, parseStatisticsStorage } from './statisticsRepository';
import {
  getStatisticsSession, ownsQueuedRun, subscribeRunStatistics, subscribeStatisticsSession,
} from './statisticsSession';

// Tạo khi màn thống kê cần dùng; dispose khi không còn sử dụng.
export function createFitLogStatisticsData() {
  return createStatisticsRepository({
    getSession: () => {
      const session = getStatisticsSession();
      const auth = useAuthStore.getState();
      return { ...session, userId: auth.isLoggedIn && String(auth.user?.id) === session.userId ? session.userId : null };
    },
    ownsQueuedRun,
    subscribeSession: listener => {
      const stopIdentity = subscribeStatisticsSession(listener);
      const stopAuth = useAuthStore.subscribe((state, previous) => {
        if (state.isLoggedIn !== previous.isLoggedIn || state.user?.id !== previous.user?.id) listener();
      });
      return () => { stopIdentity(); stopAuth(); };
    },
    subscribeRuns: subscribeRunStatistics,
    read: {
      workouts: getAllWorkouts, runs: getAllRuns, userGoals: getUserGoals, weights: getWeightHistory,
      // Đọc danh sách để không bỏ mất hồ sơ cá nhân khi admin nhận nhiều người.
      profiles: () => request('/profiles'),
      queue: async () => parseStatisticsStorage(await AsyncStorage.getItem(STORAGE_KEYS.QUEUE)),
      cache: async () => parseStatisticsStorage(await AsyncStorage.getItem(STORAGE_KEYS.HISTORY_CACHE)),
    },
  });
}
