// ============================================================================
// Module: screens/statistics/StatisticsDataProvider.tsx
// Chức năng: Cung cấp dữ liệu thống kê chung (React Context) cho toàn bộ các
// màn hình thống kê của FitLog bằng các React Hooks cơ bản (`useState`,
// `useEffect`, `useRef`, `useCallback`, `useContext`):
// - Khởi tạo `StatisticsRepository` khi mở màn thống kê, đăng ký nhận dữ liệu
//   mới qua `instance.subscribe(...)` và lưu vào state `snapshot`.
// - Tự động cập nhật ngày hiện tại (`today`) mỗi phút hoặc khi người dùng mở lại
//   ứng dụng từ chế độ nền (`AppState === 'active'`).
// - Cung cấp hook `useStatisticsData()` để các màn hình con lấy `snapshot`,
//   ngày `today` và hàm `refresh()`.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { createFitLogStatisticsData } from '../../services/statisticsData';
import type {
  StatisticsDataSnapshot,
  StatisticsRepository,
} from '../../services/statisticsRepository';
import { localDateString } from '../../utils/dateLocal';

/** Hàm mặc định lấy thời gian hiện tại của hệ thống */
const systemNow = () => new Date();

/** Kiểu dữ liệu được lưu trong `StatisticsContext` */
interface StatisticsContextValue {
  snapshot: StatisticsDataSnapshot | null;
  today: string;
  refresh: () => void;
}

/** Context lưu trữ bản chụp dữ liệu `snapshot`, chuỗi ngày `today` và hàm `refresh` */
const StatisticsContext = createContext<StatisticsContextValue | null>(null);

/**
 * Component bọc ngoài (Provider) quản lý vòng đời dữ liệu cho các màn hình thống kê.
 *
 * Cách hoạt động dễ hiểu cho sinh viên năm 1:
 * 1. Dùng `useState` để lưu `snapshot` (dữ liệu thống kê của 5 bảng) và `today` (ngày hôm nay).
 * 2. Dùng `useRef` để giữ đối tượng `repository` phục vụ gọi `refresh()` khi người dùng kéo làm mới.
 * 3. Trong `useEffect`, tạo `instance = createRepository()`, đăng ký `instance.subscribe`
 *    để mỗi khi dữ liệu tải xong hoặc đổi tài khoản thì gọi `setSnapshot(instance.getSnapshot())`.
 *
 * @param props.children Các màn hình con bên trong
 * @param props.createRepository Hàm tạo bộ quản lý dữ liệu (mặc định là `createFitLogStatisticsData`)
 * @param props.now Hàm lấy đối tượng Date hiện tại (hỗ trợ truyền giờ cố định khi kiểm thử)
 * @returns JSX Provider bọc các màn hình thống kê
 */
export function StatisticsDataProvider({
  children,
  createRepository = createFitLogStatisticsData,
  now = systemNow,
}: {
  children: ReactNode;
  createRepository?: () => StatisticsRepository;
  now?: () => Date;
}) {
  // Lưu bản chụp dữ liệu thống kê hiện tại; ban đầu là null khi chưa tải
  const [snapshot, setSnapshot] = useState<StatisticsDataSnapshot | null>(null);
  // Lưu chuỗi ngày hôm nay theo định dạng 'YYYY-MM-DD'
  const [today, setToday] = useState(() => localDateString(now()));
  // Giữ tham chiếu tới repository hiện tại để gọi refresh() từ bất kỳ đâu
  const repositoryRef = useRef<StatisticsRepository | null>(null);

  // Khởi tạo repository trong useEffect, lắng nghe thay đổi và gọi refresh() lần đầu
  useEffect(() => {
    const instance = createRepository();
    repositoryRef.current = instance;

    // Mỗi khi repository báo có dữ liệu mới (hoặc khi người dùng đăng xuất),
    // cập nhật lại state `snapshot` để các màn hình tự động vẽ lại.
    const unsubscribe = instance.subscribe(() => {
      setSnapshot(instance.getSnapshot());
    });

    void instance.refresh();

    return () => {
      unsubscribe();
      instance.dispose();
      repositoryRef.current = null;
    };
  }, [createRepository]);

  // Theo dõi bước nhảy qua ngày mới (mỗi 60 giây) và khi người dùng mở lại app từ nền
  useEffect(() => {
    const updateDay = () => setToday(localDateString(now()));
    const timer = setInterval(updateDay, 60_000);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        updateDay();
        void repositoryRef.current?.refresh();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [now]);

  // Hàm làm mới dữ liệu khi người dùng kéo xuống (pull-to-refresh) hoặc bấm "Thử lại"
  const refresh = useCallback(() => {
    void repositoryRef.current?.refresh();
  }, []);

  return (
    <StatisticsContext.Provider value={{ snapshot, today, refresh }}>
      {children}
    </StatisticsContext.Provider>
  );
}

/**
 * Kiểm tra xem component hiện tại đã nằm bên trong `StatisticsDataProvider` hay chưa.
 * Giúp các màn hình thống kê không tạo trùng thêm một Provider mới nếu đã có sẵn.
 *
 * @returns `true` nếu đã có `StatisticsDataProvider` ở tầng cha
 */
export function useHasStatisticsProvider(): boolean {
  return useContext(StatisticsContext) !== null;
}

/**
 * Hook lấy dữ liệu thống kê (`snapshot`), ngày hôm nay (`today`) và hàm làm mới (`refresh`)
 * trực tiếp từ `StatisticsContext`.
 *
 * @returns Đối tượng gồm `{ snapshot, today, refresh }`
 */
export function useStatisticsData(): StatisticsContextValue {
  const context = useContext(StatisticsContext);
  if (!context) {
    throw new Error('Màn thống kê cần StatisticsDataProvider');
  }
  return context;
}
