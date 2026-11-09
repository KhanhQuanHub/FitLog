# BÁO CÁO TOÀN DIỆN CHỨC NĂNG THỐNG KÊ

Tài liệu này tổng hợp toàn bộ kiến trúc mã nguồn và luồng hoạt động của chức năng Thống kê trong ứng dụng di động **FitLog** (sử dụng kiến trúc điều hướng **React Navigation** đồng nhất toàn app), được trình bày theo cấu trúc rõ ràng, dễ hiểu:
1. **Lấy dữ liệu nào từ Cơ sở dữ liệu (`db.json` & `AsyncStorage`) để thống kê?**
2. **Luồng dữ liệu (Data Flow) đi từ CSDL lên màn hình như thế nào?**
3. **Danh sách các React Hooks cơ bản và các biến State quan trọng được sử dụng.**
4. **Thiết kế mã nguồn đơn giản, tường minh và dễ đọc hiểu.**
5. **Kiến trúc điều hướng chuẩn React Navigation (`@react-navigation/native-stack`, `@react-navigation/bottom-tabs`) đồng nhất toàn dự án.**
6. **Ranh giới trách nhiệm & Danh mục toàn bộ các file phụ trách.**
7. **Hướng dẫn ôn tập & Bộ câu hỏi vấn đáp khi bảo vệ đồ án.**

---

## 1. DỮ LIỆU LẤY TỪ CƠ SỞ DỮ LIỆU (`db.json`) & BỘ NHỚ MÁY (`AsyncStorage`)

Chức năng thống kê **chỉ đọc dữ liệu (GET)** thông qua `services/api.js` và `services/statisticsData.ts`, hoàn toàn không ghi đè hay làm hỏng dữ liệu gốc. Cụ thể gồm **5 nguồn dữ liệu trên Server** và **2 nguồn bộ nhớ cục bộ trên điện thoại**:

| STT | Tên nguồn trong code | Đường dẫn API / Khóa bộ nhớ | Các trường dữ liệu lấy ra để tính thống kê | Phục vụ màn hình nào? |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `workouts` | `GET /workouts?_expand=exercise&_sort=date&_order=desc` | `id`, `userId`, `date` (ngày tập), `time` (giờ tập), `status` (`done` / `missed` / `planned`), `durationMin` (số phút), `caloriesBurned` (calo), `exerciseId`, `exercise.name` (tên bài tập), `exercise.muscleGroup` (nhóm cơ) | Tóm tắt, Thời gian, Calo, Lịch tập, Mục tiêu, Thói quen |
| 2 | `runs` | `GET /runs?_sort=date&_order=desc` | `id`, `clientId`, `userId`, `date`, `startedAt`, `endedAt`, `durationSec` (giây chạy), `pausedSec` (giây nghỉ), `distanceKm` (quãng đường km), `steps` (số bước), `calories` (calo chạy) | Tóm tắt, Thời gian, Calo, Chạy bộ, Thói quen |
| 3 | `profiles` | `GET /profiles` | `id`, `userId`, `heightCm` (chiều cao để tính BMI), `weightKg` (cân nặng dự phòng khi chưa có lịch sử cân), `sessionsPerWeek` (cam kết số buổi tập/tuần) | Tóm tắt, Cân nặng & BMI, Tiến độ mục tiêu |
| 4 | `weights` | `GET /weightHistory?_sort=date&_order=asc` | `id`, `userId`, `date` (ngày cân), `weightKg` (số cân nặng kg) | Tóm tắt, Cân nặng & BMI, Tiến độ mục tiêu |
| 5 | `userGoals` | `GET /userGoals?_expand=goal` | `id`, `userId`, `goalId`, `minMinutesPerWeek` (cam kết số phút tập/tuần), `targetWeightKg` (cân nặng đích), `goal.name` (tên mục tiêu) | Tóm tắt, Cân nặng & BMI, Tiến độ mục tiêu |
| 6 | `queue` | `AsyncStorage.getItem('@figlog/run_queue_v1')` | Các buổi chạy vừa hoàn thành khi **mất mạng** đang chờ đồng bộ lên server (được gắn cờ `_queued: true`) | Tóm tắt, Chạy bộ, Thời gian, Calo, Thói quen |
| 7 | `cache` | `AsyncStorage.getItem('@figlog/run_history_cache_v1')` | Lịch sử các buổi chạy đã lưu tạm trên máy để hiển thị khi điện thoại không có kết nối mạng | Chạy bộ (khi offline) |

> **Quy tắc lọc tài khoản an toàn:** Mọi bản ghi đọc về đều đi qua hàm `owned()` / `filterOwned()` để kiểm tra `String(row.userId) === String(currentUserId)`. Bản ghi của tài khoản khác hoặc không rõ chủ sở hữu sẽ bị loại bỏ ngay, đảm bảo tính riêng tư của dữ liệu người dùng.

---

## 2. LUỒNG DỮ LIỆU TỔNG THỂ (DATA FLOW)

Luồng dữ liệu của chức năng thống kê đi theo **5 bước một chiều** rất rõ ràng:

```text
[Bước 1: CSDL & AsyncStorage]
  (api.js, runRepository.js, statisticsSession.js)
        │
        ▼
[Bước 2: Tải & Hợp nhất 5 nguồn dữ liệu]
  (services/statisticsData.ts ──► services/statisticsRepository.ts)
  Tạo ra đối tượng `snapshot` chứa: { session, workouts, runs, profiles, weights, userGoals }
        │
        ▼
[Bước 3: Lưu vào React State & Cung cấp qua Context]
  (screens/statistics/StatisticsDataProvider.tsx)
  Dùng `useState(snapshot)` nhận dữ liệu qua `instance.subscribe(...)`.
  Hook `useStatisticsData()` trả về `{ snapshot, today, refresh }` cho mọi màn hình.
        │
        ▼
[Bước 4: Tính toán số liệu & Chuẩn bị ViewModel]
  (domain/statistics/statistics.ts ──► screens/statistics/viewModel.ts)
  Hàm `calculateStatistics()` tính tổng/trung bình/chuỗi/BMI ──► `buildStatisticsView()` tạo `view`
        │
        ▼
[Bước 5: Định dạng số & Vẽ lên Màn hình / Biểu đồ SVG]
  (screens/statistics/*Screen.tsx ──► components/statistics/presentation.ts & *.tsx)
```

---

## 3. CÁC HOOK VÀ BIẾN QUAN TRỌNG ĐƯỢC SỬ DỤNG

### 3.1. Các React Hooks và Navigation Hooks
1. **`useState`**:
   * Trong `StatisticsDataProvider.tsx`:
     * `[snapshot, setSnapshot]`: Lưu toàn bộ bản chụp dữ liệu thống kê của 5 bảng.
     * `[today, setToday]`: Lưu chuỗi ngày hôm nay theo giờ địa phương (`'YYYY-MM-DD'`).
   * Trong `StatisticsDetailScreen.tsx`:
     * `[kind, setKind]`: Lưu loại kỳ đang chọn (`'day'` | `'week'` | `'month'` | `'year'`).
     * `[selection, setSelection]`: Lưu ngày neo của kỳ khi người dùng bấm nút lùi `‹` hoặc tiến `›` (nếu `null` thì lấy ngày `today`).
   * Trong `RunningStatisticsScreen.tsx`:
     * `[selectedKey, setSelectedKey]`: Lưu mã của buổi chạy đang được bấm chọn để mở `RunDetailModal` xem chi tiết.
   * Trong `StatisticsChart.tsx`:
     * `[measuredWidth, setMeasuredWidth]`: Lưu chiều rộng thực tế của khung biểu đồ đo được qua `onLayout`.
     * `[selectedKey, setSelectedKey]`: Lưu cột/điểm trên biểu đồ mà người dùng vừa chạm vào.
   * Trong `shared.tsx` (`StatisticsHistory`):
     * `[limit, setLimit]`: Lưu số lượng dòng lịch sử đang hiển thị (mặc định `20`, mỗi lần bấm *"Xem thêm"* tăng thêm `20`).
2. **`useEffect`**:
   * Trong `StatisticsDataProvider.tsx`:
     * `useEffect` thứ nhất: Khởi tạo `instance = createRepository()`, đăng ký `instance.subscribe(() => setSnapshot(instance.getSnapshot()))` và gọi `instance.refresh()` để tải dữ liệu lần đầu.
     * `useEffect` thứ hai: Đặt bộ đếm `setInterval` 60 giây và lắng nghe `AppState` để tự cập nhật ngày `today` khi qua nửa đêm hoặc khi mở lại ứng dụng.
   * Trong `useStatisticsNavigation.ts`: Cập nhật `latest.current = snapshot` mỗi khi `snapshot` thay đổi.
3. **`useRef`**:
   * Trong `StatisticsDataProvider.tsx`: `repositoryRef` giữ tham chiếu tới đối tượng `repository` hiện tại để hàm `refresh()` có thể gọi bất kỳ lúc nào mà không tạo lại hàm.
   * Trong `useStatisticsNavigation.ts`: `latest` giữ bản chụp `snapshot` mới nhất phục vụ kiểm tra trạng thái `'loading'` khi màn hình được focus.
4. **`useMemo`**:
   * Trong `StatisticsSummaryScreen.tsx` và `StatisticsDetailScreen.tsx`: Ghi nhớ kết quả của `getStatisticsPeriod(kind, anchor)` và `buildStatisticsView(snapshot, today, kind, anchor)` để tránh tính toán lại khi không có thay đổi.
5. **`useCallback` & `useContext`**:
   * Trong `StatisticsDataProvider.tsx`: `useCallback` tạo hàm `refresh` ổn định; `useContext(StatisticsContext)` trong `useStatisticsData()` lấy trực tiếp `{ snapshot, today, refresh }`.
6. **`useFocusEffect`** (từ `@react-navigation/native`):
   * Trong `useStatisticsNavigation.ts` và `ScheduleScreen.tsx`: Tự động kích hoạt làm mới số liệu mỗi khi người dùng chuyển màn hình/tab quay trở lại giao diện (đảm bảo số liệu luôn cập nhật sau khi vừa lưu buổi tập mới).

### 3.2. Các biến cốt lõi trong tính toán & vẽ biểu đồ (`domain/statistics/statistics.ts` & `components/statistics/presentation.ts`)
* `period` (`{ kind, start, end, keys }`): Khoảng thời gian đang xét, ví dụ tuần từ `'2026-11-02'` đến `'2026-11-08'` với 7 ngày trong mảng `keys`.
* `counts` (`{ done, missed, pending, unknown }`): Số lượng buổi tập theo từng trạng thái trong kỳ.
* `evaluated` (`counts.done + counts.missed`): Tổng số buổi tập đã có kết quả (dùng làm mẫu số tính `completionPercent`, không tính các buổi `pending` chưa tới giờ tập).
* `pairSeconds`, `pairKm`: Tổng thời gian (giây) và tổng quãng đường (km) của những buổi chạy có đủ cả 2 thông số, dùng để tính `paceSecPerKm = pairSeconds / pairKm` và `avgSpeedKmh`.
* `currentStreak`, `longestStreak`: Chuỗi số buổi tập hoàn thành liên tiếp hiện tại và dài nhất trong lịch sử.
* `activeDates` (`Set<string>`): Tập hợp các ngày có ít nhất 1 buổi tập hoàn thành hoặc 1 buổi chạy bộ (dùng `Set` để 1 ngày tập 2–3 lần vẫn chỉ tính là 1 ngày hoạt động).
* `bmi` (`currentKg / ((heightCm / 100) ** 2)`): Chỉ số khối cơ thể làm tròn 1 chữ số thập phân và phân loại vào `bmiGroup` (`'thin'` | `'normal'` | `'overweight'` | `'obese'`).
* `minimum`, `maximum`, `plotWidth`, `valueToY`: Các biến hình học dùng để quy đổi giá trị số ra tọa độ pixel `(x, y)` trên khung vẽ SVG cao `184px`.

---

## 4. THIẾT KẾ MÃ NGUỒN ĐƠN GIẢN, TƯỜNG MINH VÀ DỄ HIỂU

Toàn bộ mã nguồn của chức năng Thống kê được thiết kế theo các nguyên tắc lập trình cơ bản, trong sáng, dễ đọc và dễ bảo trì:

### 4.1. Tầng Tính toán thuần túy (`domain/statistics/`): Tách biệt logic và giao diện
* **Hàm thuần túy (Pure Functions):** Toàn bộ các hàm tính toán (`sum`, `average`, `calculateSchedule`, `calculateRuns`, `calculateHabits`, `calculateWeight`) được viết dưới dạng hàm thuần túy: chỉ nhận tham số đầu vào và trả về kết quả mới. Hàm hoàn toàn không gọi API bên ngoài và không làm thay đổi mảng dữ liệu gốc, giúp việc kiểm thử và theo dõi cực kỳ dễ dàng.
* **Cấu trúc rẽ nhánh `if / else` tường minh:** Tránh việc lạm dụng các toán tử 3 ngôi (`? :`) lồng nhau nhiều tầng. Ví dụ: hàm phân loại BMI `classifyBmiGroup(bmi)` được viết bằng các nhánh `if (bmi < 18.5) return 'thin'; if (bmi < 25) return 'normal'; ...` rất tự nhiên, đọc vào là hiểu ngay logic.
* **Hàm trợ giúp nhỏ, đặt tên rõ nghĩa:** Các đoạn tính toán ngày tháng được tách thành hàm riêng có tên tiếng Anh rõ nghĩa và chú thích tiếng Việt:
  * `getMondayBasedIndex(date)`: Chuyển đổi cách đánh số thứ trong tuần từ quy ước Chủ Nhật = 0 của JavaScript sang Thứ Hai = 0 theo lịch Việt Nam.
  * `calendarDate(year, month, day)`: Khởi tạo ngày ở mốc UTC 00:00:00 để tránh sai lệch giờ do múi giờ địa phương.
* **Biến trung gian dễ đọc:** Các phép tính được chia nhỏ với biến trung gian cụ thể như `daysSinceMonday`, `validCount`, `allMissing`, `heightInMeters` thay vì gộp nhiều công thức vào một dòng code dài.

### 4.2. Tầng Quản lý State & Dịch vụ (`services/`, `StatisticsDataProvider.tsx`): Đơn giản và an toàn
* **Chỉ dùng React Hooks chuẩn:** Bản chụp dữ liệu `snapshot` được quản lý bằng bộ đôi quen thuộc `useState` và `useEffect` truyền thống trong `StatisticsDataProvider.tsx`, sau đó cung cấp xuống toàn bộ các màn hình con thông qua React Context (`useContext`).
* **Cấu trúc dữ liệu mảng và Set cơ bản:** Trong `services/statisticsRepository.ts`, dữ liệu chạy bộ và hàng đợi offline được gom nhóm, kiểm tra trùng lặp bằng các vòng lặp duyệt mảng và cấu trúc `Set` cơ bản, dễ hiểu đối với bất kỳ lập trình viên nào.
* **Chia nhỏ tác vụ bất đồng bộ thành các hàm đơn nhiệm:** Hàm làm mới dữ liệu `refresh()` được chia nhỏ thành các hàm phụ trợ độc lập:
  * `resolveRunsOrigin`: Sử dụng `if / else` xác định nguồn dữ liệu đang lấy từ mạng (`network`), bộ nhớ đệm (`cache`), hay hàng đợi (`queue`).
  * `extractQueuedRuns`: Tách riêng bước đọc và kiểm tra chủ sở hữu của các buổi chạy trong hàng đợi offline.
  * `loadStandardTableSource`: Tải và bắt lỗi riêng cho từng bảng CSDL, giữ lại dữ liệu cũ khi mất mạng mà không làm crash ứng dụng.
* **Lọc quyền sở hữu chặt chẽ:** Hàm `filterOwned` lọc dữ liệu an toàn bằng cách so sánh `String(row.userId) === String(currentUserId)`.

### 4.3. Tầng Màn hình & ViewModel (`screens/statistics/`): Làm phẳng giao diện
* **Tách nhỏ các hàm render giao diện:** Thay vì viết code JSX dài hàng trăm dòng với nhiều biểu thức điều kiện lồng nhau, các màn hình đều tách thành các hàm render phụ trợ sử dụng câu lệnh `if / else` tường minh:
  * Trong `StatisticsDetailScreen.tsx`: Tách hàm `renderMainDetailContent()` kiểm tra rõ ràng `if (!snapshot) ... if (!view) ...`.
  * Trong `StatisticsSummaryScreen.tsx`: Tách riêng các hàm `renderLatestRunSection()`, `renderDataSourcesStatusSection()`, và `renderSummaryMainContent()`.
* **Đóng gói dữ liệu hiển thị (ViewModel):** File `viewModel.ts` chuẩn bị sẵn toàn bộ các chuỗi định dạng (nhãn ngày tháng Việt Nam `DD/MM/YYYY`, nhãn kỳ `Tháng 11/2026`, chỉ số đã làm tròn kèm đơn vị) giúp các màn hình JSX chỉ việc đọc và hiển thị trực tiếp mà không cần tính toán phức tạp bên trong component.
* **Mã định danh khóa nhận diện rõ ràng:** Các bản ghi chạy bộ dùng chuỗi định danh đơn giản như `client:${row.clientId}` hoặc `id:${row.id}` để làm thuộc tính `key` cho danh sách, tránh nhầm lẫn bản ghi.

### 4.4. Tầng Giao diện & Biểu đồ SVG (`components/statistics/`): Trực quan, module hóa cao
* **Chia nhỏ quy trình vẽ biểu đồ SVG:** Hàm `buildStatisticsChart` trong `presentation.ts` được module hóa thành 5 hàm con độc lập, mỗi hàm đảm nhận đúng một nhiệm vụ toán học:
  1. `calculateChartVerticalRange`: Xác định giá trị nhỏ nhất và lớn nhất trên trục dọc Y kèm khoảng đệm an toàn.
  2. `calculateChartHorizontalLayout`: Tính chiều rộng khung vẽ và khoảng cách các cột (đảm bảo mỗi mốc cách nhau tối thiểu 48px để ngón tay dễ chạm trên điện thoại).
  3. `buildBarChartPlotPoints`: Tính tọa độ `(x, y)` cho từng cột của biểu đồ cột.
  4. `buildLineChartPlotPoints`: Tính tọa độ `(x, y)` cho từng điểm mốc của biểu đồ đường.
  5. `buildSvgLinePaths`: Nối các điểm có dữ liệu thành chuỗi lệnh SVG Path `'M x,y L x2,y2'`, tự động ngắt đoạn tại những mốc thiếu dữ liệu.
* **Tách riêng các lớp hiển thị:** Component `StatisticsChart.tsx` tách riêng hàm vẽ vạch trục (`formatYAxisTickLabel`), hàm vẽ cột/chấm tròn SVG (`renderChartPointSvg`), và hàm vẽ lớp nút bấm trong suốt (`renderTouchTargetOverlay`).
* **Chú thích hình học trực quan:** Các công thức chu vi vòng tròn (`2 * Math.PI * r`) hay độ lệch nét vẽ (`strokeDashoffset`) trong `StatisticsProgress.tsx` đều có chú thích tiếng Việt giải thích cặn kẽ bản chất hình học.

---

## 5. KIẾN TRÚC ĐIỀU HƯỚNG REACT NAVIGATION (CHUẨN HÓA TOÀN BỘ ỨNG DỤNG)

Để đảm bảo dự án chạy ổn định, đồng bộ với toàn bộ các thành viên khác trong nhóm phát triển, ứng dụng FitLog sử dụng **100% React Navigation** làm xương sống điều hướng:

1. **`index.ts` (Entry point)**:
   * Sử dụng hàm chuẩn của Expo: `registerRootComponent(App)` để khởi chạy component gốc `App`.
2. **`App.tsx` (Root Component)**:
   * Cung cấp ngữ cảnh toàn cục: `<SafeAreaProvider>`, `<NavigationContainer theme={navigationTheme}>` và `<TrainingProvider>`.
   * Bên trong render trực tiếp `<RootNavigator />`. Tải trước bộ font `Ionicons` và đăng ký bộ xử lý thông báo `Notifications.setNotificationHandler`.
3. **`navigation/RootNavigator.tsx` (Root Stack)**:
   * Tạo bằng `createNativeStackNavigator<RootStackParamList>()`.
   * Tự động kiểm tra token phiên làm việc (`restoreSession`).
   * Phân quyền (Guard):
     * Nếu chưa đăng nhập (`!isLoggedIn`): Mở cụm màn hình `Login`, `Register`, `ForgotPassword`.
     * Nếu đã đăng nhập nhưng chưa thiết lập thông số cơ bản (`!setup`): Mở màn `Onboarding` (`TrainingSetupScreen`).
     * Nếu đã đăng nhập và đã có thiết lập: Mở `Main` (`MainTabs`), `ChangePassword` và `EditTraining`.
   * Tự động kích hoạt dịch vụ theo dõi vị trí GPS (`startWatching()`) khi đăng nhập và tắt (`stopWatching()`) khi đăng xuất để tiết kiệm pin.
4. **`navigation/MainTabs.tsx` (Bottom Tabs 5 Màn hình)**:
   * Tạo bằng `createBottomTabNavigator<MainTabParamList>()`.
   * Gồm 5 tab chính:
     * `Today`: Màn hình Mục tiêu trong ngày (`TodayScreen`).
     * `Schedule`: Màn hình Lịch tập luyện (`ScheduleScreen`).
     * `Run`: Màn hình Theo dõi chạy bộ GPS (`RunScreen`).
     * `Stats`: Màn hình Phân hệ Thống kê (`StatisticsNavigator`).
     * `Profile`: Màn hình Hồ sơ cá nhân (`ProfileScreen`).
   * Thanh điều hướng tùy chỉnh `FitLogBottomTabBar` vẽ bằng SVG nguyên bản, giải quyết triệt để lỗi cắt chữ/icon trên hệ điều hành Android.
5. **`navigation/StatisticsNavigator.tsx` (Phân hệ Thống kê)**:
   * Tích hợp native stack trong tab `Stats`, quản lý chuyển đổi mượt mà giữa màn Tóm tắt (`StatisticsSummary`), danh mục (`StatisticsCategories`), và 7 màn chi tiết (`StatisticsDetail`).
   * Bọc bên ngoài bằng `StatisticsDataProvider` giúp chia sẻ bộ nhớ cache và snapshot 5 nguồn dữ liệu giữa các màn hình con.

---

## 6. DANH MỤC CÁC FILE PHỤ TRÁCH & RANH GIỚI TRÁCH NHIỆM

### 6.1. Bảng phân chia 36 file nghiệp vụ Thống kê cốt lõi
* **Thành phần giao diện dùng chung (8 file):**
  1. `components/statistics/StatisticsActivityRow.tsx`
  2. `components/statistics/StatisticsChart.tsx`
  3. `components/statistics/StatisticsMetricCard.tsx`
  4. `components/statistics/StatisticsPeriodPicker.tsx`
  5. `components/statistics/StatisticsProgress.tsx`
  6. `components/statistics/StatisticsStatus.tsx`
  7. `components/statistics/index.ts`
  8. `components/statistics/presentation.ts`
* **Kiểu dữ liệu và tính toán thuần túy (2 file):**
  9. `domain/statistics/statistics.ts`
  10. `domain/statistics/types.ts`
* **Màn hình và phần hỗ trợ (17 file):**
  11. `screens/StatsScreen.tsx`
  12. `screens/statistics/StatisticsSummaryScreen.tsx`
  13. `screens/statistics/StatisticsCategoriesScreen.tsx`
  14. `screens/statistics/TimeStatisticsScreen.tsx`
  15. `screens/statistics/CaloriesStatisticsScreen.tsx`
  16. `screens/statistics/RunningStatisticsScreen.tsx`
  17. `screens/statistics/ScheduleStatisticsScreen.tsx`
  18. `screens/statistics/WeightStatisticsScreen.tsx`
  19. `screens/statistics/GoalsStatisticsScreen.tsx`
  20. `screens/statistics/HabitsStatisticsScreen.tsx`
  21. `screens/statistics/StatisticsDataProvider.tsx`
  22. `screens/statistics/StatisticsDetailScreen.tsx`
  23. `screens/statistics/shared.tsx`
  24. `screens/statistics/viewModel.ts`
  25. `screens/statistics/statisticsRoutes.ts`
  26. `screens/statistics/useStatisticsNavigation.ts`
  27. `screens/statistics/index.ts`
* **Đọc dữ liệu và kết nối dịch vụ (5 file):**
  28. `services/statisticsData.ts`
  29. `services/statisticsRepository.ts`
  30. `services/statisticsSession.js`
  31. `services/api.js` (phần bổ sung endpoint đọc dữ liệu phục vụ thống kê)
  32. `services/runRepository.js` (phần bổ sung thông báo thay đổi queue/cache)
* **File điều hướng React Navigation thay thế Expo Router (4 file chuyển đổi):**
  33. `navigation/StatisticsNavigator.tsx` (thay thế bộ route cũ `src/app/(tabs)/statistics/*`)

### 6.2. Các file phụ trợ bổ sung
* **Điểm cắm vào Bottom Tabs:** Đúng khai báo `<Tab.Screen name="Stats" component={StatisticsNavigator} />` trong `navigation/MainTabs.tsx`.
* **Tài liệu báo cáo:** `doc/bao_cao_toan_dien_chuc_nang_thong_ke.md`.

### 6.3. Ranh giới an toàn (Tuyệt đối không can thiệp code của thành viên khác)
* Không chỉnh sửa màn hình Xác thực: `screens/auth/LoginScreen.tsx`, `screens/auth/RegisterScreen.tsx`, `screens/auth/ForgotPasswordScreen.tsx`.
* Không chỉnh sửa màn hình Lịch tập: `screens/ScheduleScreen.tsx`.
* Không chỉnh sửa màn hình Hồ sơ cá nhân: `screens/ProfileScreen.tsx`.
* Không chỉnh sửa màn hình Chạy bộ GPS: `screens/running/RunScreen.tsx`.
* Không chỉnh sửa màn hình Mục tiêu trong ngày: `screens/TodayScreen.tsx`.

---

## 7. HƯỚNG DẪN ÔN TẬP & BỘ CÂU HỎI VẤN ĐÁP KHI BẢO VỆ ĐỒ ÁN

### 7.1. Lộ trình 4 bước đọc hiểu mã nguồn
* **Bước 1 (Dữ liệu):** Đọc `domain/statistics/types.ts` để hiểu cấu trúc `WorkoutRecord`, `RunRecord`, `StatisticsPeriod`.
* **Bước 2 (Tính toán):** Đọc `domain/statistics/statistics.ts` để hiểu `getStatisticsPeriod` (tính tuần từ Thứ 2 đến Chủ nhật) và `calculateStatistics` (tính tổng calo, phút, km, streak).
* **Bước 3 (Quản lý State):** Đọc `services/statisticsRepository.ts` và `screens/statistics/StatisticsDataProvider.tsx` để hiểu cách `useState(snapshot)` chia sẻ dữ liệu qua `useStatisticsData()`.
* **Bước 4 (Giao diện):** Đọc `navigation/StatisticsNavigator.tsx` và `components/statistics/StatisticsChart.tsx` để hiểu luồng điều hướng 3 cấp và cách vẽ biểu đồ SVG.

### 7.2. Bộ 5 câu hỏi thường gặp khi bảo vệ đồ án và câu trả lời chuẩn

#### Câu 1: Chức năng Thống kê lấy dữ liệu từ đâu và có sửa đổi CSDL không?
> **Trả lời:** Chức năng Thống kê **chỉ đọc dữ liệu (GET)** từ 5 bảng trên server JSON Server (`/workouts`, `/runs`, `/profiles`, `/weightHistory`, `/userGoals`) và 2 khóa bộ nhớ cục bộ `AsyncStorage` (`QUEUE` và `CACHE`). Thống kê hoàn toàn không tạo mới hay ghi đè CSDL, đảm bảo an toàn 100% cho dữ liệu của người dùng.

#### Câu 2: Làm sao để đảm bảo người dùng A không nhìn thấy số liệu của người dùng B?
> **Trả lời:** Ở tầng `services/statisticsRepository.ts`, mọi bản ghi đọc về từ API đều phải đi qua hàm lọc `filterOwned(data, currentUserId)`. Bất kỳ bản ghi nào không trùng khớp `userId` đang đăng nhập hoặc không rõ chủ sở hữu đều bị loại bỏ ngay lập tức trước khi đưa vào `snapshot`.

#### Câu 3: Tại sao không dùng Redux mà dùng React Context + useState trong StatisticsDataProvider?
> **Trả lời:** Vì phân hệ Thống kê là luồng dữ liệu một chiều (chỉ đọc), việc dùng React Context kết hợp `useState` và `useEffect` truyền thống giúp code đơn giản, sáng sủa, dễ đọc đối với sinh viên năm 1 mà vẫn đạt hiệu năng cao, tránh sự cồng kềnh không cần thiết của Redux.

#### Câu 4: Khi điện thoại bị mất mạng (Offline), màn hình Thống kê xử lý ra sao?
> **Trả lời:** Repository áp dụng cơ chế Stale-While-Revalidate: khi mất mạng, ứng dụng vẫn đọc lịch sử chạy bộ đã lưu trong `AsyncStorage` (`CACHE`) và các buổi chạy offline đang chờ gửi lên server (`QUEUE`). Màn hình sẽ hiển thị số liệu cũ kèm nhãn cảnh báo *"Chưa đồng bộ"* hoặc *"Dữ liệu từ bộ nhớ tạm"*, không bao giờ làm màn hình bị trắng xoá hay hiện số 0 giả tạo.

#### Câu 5: Biểu đồ cột và đường được vẽ bằng kỹ thuật gì?
> **Trả lời:** Biểu đồ được vẽ bằng thư viện đồ họa véc-tơ `react-native-svg`. Hàm `buildStatisticsChart` trong `presentation.ts` quy đổi giá trị số sang tọa độ pixel `(x, y)` trên khung vẽ cao 184px. Biểu đồ hỗ trợ cuộn ngang (`ScrollView horizontal`) khi có nhiều cột (như 30 ngày trong tháng) và mỗi cột cách nhau tối thiểu 48px để người dùng dễ dàng chạm ngón tay xem chi tiết.
