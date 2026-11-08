# BÁO CÁO CHỈNH SỬA & GIẢI THÍCH CHỨC NĂNG THỐNG KÊ (DỄ HIỂU CHO SINH VIÊN NĂM 1)

Tài liệu này tổng hợp toàn bộ những thay đổi trên **36 file** của chức năng Thống kê trong dự án **FitLog** (hoàn chỉnh cả **4 Giai đoạn: Giai đoạn 1, Giai đoạn 2, Giai đoạn 3 và Giai đoạn 4**), giải thích rõ:
1. **Lấy dữ liệu nào từ Cơ sở dữ liệu (`db.json` & `AsyncStorage`) để thống kê?**
2. **Luồng dữ liệu (Data Flow) đi từ CSDL lên màn hình như thế nào?**
3. **Danh sách các React Hooks cơ bản và các biến State quan trọng được sử dụng.**
4. **Chi tiết cả 4 giai đoạn đã chỉnh sửa trên 36 file, thay đổi từ code khó hiểu thành code tường minh ra sao.**

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

> **Quy tắc lọc tài khoản an toàn:** Mọi bản ghi đọc về đều đi qua hàm `owned()` / `filterOwned()` để kiểm tra `String(row.userId) === String(currentUserId)`. Bản ghi của tài khoản khác hoặc không rõ chủ sở hữu sẽ bị loại bỏ ngay.

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

### 3.1. Các React Hooks và Router Hooks (Chỉ dùng các Hook cơ bản, quen thuộc)
1. **`useState`**:
   * Trong `StatisticsDataProvider.tsx`:
     * `[snapshot, setSnapshot]`: Lưu toàn bộ bản chụp dữ liệu thống kê của 5 bảng (thay thế hoàn toàn `useSyncExternalStore` khó hiểu trước đây).
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
   * Trong `StatisticsSummaryScreen.tsx` và `StatisticsDetailScreen.tsx`: Ghi nhớ kết quả của `getStatisticsPeriod(kind, anchor)` và `buildStatisticsView(snapshot, today, kind, anchor)`.
5. **`useCallback` & `useContext`**:
   * Trong `StatisticsDataProvider.tsx`: `useCallback` tạo hàm `refresh` ổn định; `useContext(StatisticsContext)` trong `useStatisticsData()` lấy trực tiếp `{ snapshot, today, refresh }`.
6. **`useFocusEffect` & `useLocalSearchParams`** (từ `expo-router`):
   * Trong `useStatisticsNavigation.ts` và `src/app/(tabs)/statistics/[category].tsx`: Tự động làm mới khi mở lại màn hình và đọc tham số `category`, `kind`, `date` trên URL.

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

## 4. CHI TIẾT CÁC THAY ĐỔI TRÊN 36 FILE QUA CẢ 4 GIAI ĐOẠN

### Giai đoạn 1: Đơn giản hóa & chú thích tầng Kiểu dữ liệu và Tính toán (`domain/statistics/`)
1. **`domain/statistics/types.ts`**:
   * **Thay đổi:** Bổ sung chú thích tiếng Việt đầy đủ cho toàn bộ 13 `interface` và `type` (`StatisticsPeriod`, `WorkoutRecord`, `RunRecord`, `ProfileRecord`, `WeightRecord`, `UserGoalRecord`, `StatisticsMetric`, `WorkoutState`, `StatisticsInput`...). Giải thích rõ tại sao dùng kiểu `unknown` cho dữ liệu JSON và ý nghĩa của `value`, `missingCount`, `complete`.
2. **`domain/statistics/statistics.ts`**:
   * **Thay đổi:**
     * Tách công thức tính thứ trong tuần khó hiểu `(startDate.getUTCDay() + 6) % 7` thành hàm riêng `getMondayBasedIndex(date: Date)` có chú thích giải thích cách đổi từ Chủ Nhật = 0 của JavaScript sang Thứ Hai = 0.
     * Tách biểu thức toán tử 3 ngôi 4 tầng phân loại BMI thành hàm riêng `classifyBmiGroup(bmi)` dùng `if (bmi < 18.5) ... if (bmi < 25) ...` cực kỳ dễ đọc.
     * Viết lại các hàm `getStatisticsPeriod`, `shiftStatisticsPeriod`, `sum`, `average`, `deduplicateStatisticsRuns`, `calculateSchedule`, `calculateRuns`, `calculateHabits`, `calculateWeight`, `calculateTargets`, `calculateStatistics` với cấu trúc `if / else` tường minh, đặt tên biến trung gian rõ nghĩa (`daysSinceMonday`, `validCount`, `allMissing`, `heightInMeters`, `canCalculatePercent`) và thêm JSDoc tiếng Việt (`@param`, `@returns`) ở đầu mỗi hàm.

### Giai đoạn 2: Đơn giản hóa sâu tầng Quản lý State & Dịch vụ (`services/`, `StatisticsDataProvider.tsx`)
3. **`screens/statistics/StatisticsDataProvider.tsx`**:
   * **Thay đổi lớn:** Loại bỏ hoàn toàn hook nâng cao `useSyncExternalStore` (cùng các hàm giả `noopSubscribe`, `noSnapshot`), thay bằng `useState<StatisticsDataSnapshot | null>(null)` + `useEffect` + `useRef` truyền thống.
   * Trong `useEffect`, đăng ký `instance.subscribe(() => setSnapshot(instance.getSnapshot()))` để cập nhật state `snapshot`; `StatisticsContext` truyền trực tiếp `{ snapshot, today, refresh }` xuống các màn hình con.
4. **`services/statisticsRepository.ts`**:
   * **Thay đổi lớn 1:** Loại bỏ hoàn toàn thuật toán **Disjoint-Set (Union-Find)** dùng mảng `parents[]` và nén đường đi `root(index)` trong hàm `mergeStatisticsRuns`, thay bằng vòng lặp duyệt qua danh sách nhóm `mergedGroups` chứa `Set` các `clientIds` và `serverIds`.
   * **Thay đổi lớn 2:** Tách nhỏ hàm `mergeRunSources` và `refresh` thành các hàm phụ độc lập, dễ đọc:
     * `resolveRunsOrigin(online, hasPending, hasPrevious, hasCached)`: Dùng `if / else` xác định nguồn dữ liệu (`'network'`, `'mixed'`, `'memory'`, `'cache'`, `'queue'`).
     * `extractQueuedRuns(queueResult, session, ownsQueuedRun)`: Tách riêng bước đọc và kiểm tra chủ sở hữu của các buổi chạy trong hàng đợi offline (`QUEUE`).
     * `loadStandardTableSource(readFn, previousSource, userId, now)`: Tách riêng bước gọi API và xử lý lỗi cho 4 bảng thông thường (`workouts`, `profiles`, `weights`, `userGoals`), giúp hàm `refresh()` ngắn gọn và dễ theo dõi.
5. **`services/statisticsSession.js`**, **`services/statisticsData.ts`**, **`services/api.js`**, **`services/runRepository.js`**, **`screens/statistics/useStatisticsNavigation.ts`**:
   * **Thay đổi:** Bổ sung đầy đủ JSDoc tiếng Việt (`@param`, `@returns`) cho tất cả các hàm và tách các biểu thức điều kiện phức tạp thành biến trung gian rõ nghĩa (`isValidNumber`, `isValidString`, `isMatchingUser`, `loginChanged`, `userChanged`, `isAnyLoading`).

### Giai đoạn 3: Làm phẳng sâu cấu trúc các Màn hình thống kê & ViewModel (`screens/statistics/` & `src/app/(tabs)/statistics/`)
6. **`screens/statistics/viewModel.ts`**:
   * **Thay đổi lớn:**
     * Tách hàm `buildChartSeries` độc lập ở cấp module để lọc ngày tương lai và chuẩn bị các cột biểu đồ.
     * Tách hàm `buildWeightAndBmiMetrics(snapshot, report)` để tính chỉ số Cân nặng hiện tại và BMI mà **không cần gán đè `.complete = false` rải rác** trên đối tượng.
     * Tách hàm `checkCombinedActivityStatus(snapshot, report)` để kiểm tra trạng thái sẵn sàng (`activityAvailable`) và đầy đủ (`activityComplete`) của dữ liệu hoạt động kết hợp (phục vụ màn Thói quen luyện tập).
7. **`screens/statistics/StatisticsDetailScreen.tsx`**:
   * **Thay đổi lớn:**
     * Tách hàm `checkPeriodShiftBounds(kind, anchor, today)` ra khỏi component để kiểm tra biên lùi/tiến kỳ (`canPrevious`, `canNext`).
     * Thay biểu thức toán tử 3 ngôi 3 tầng lồng nhau trong JSX (`!snapshot ? ... : !view ? ... : <View>...`) bằng hàm `renderMainDetailContent()` dùng `if (!snapshot) return ...; if (!view) return ...;` rõ ràng.
8. **`screens/statistics/StatisticsSummaryScreen.tsx`** & **`screens/StatsScreen.tsx`**:
   * **Thay đổi lớn:**
     * Tách hàm `buildWeeklyCommitmentProgress(snapshot, report)` và `buildSummaryMetricItems(snapshot, view, today, openDetail)` ra cấp module.
     * Tách các hàm `renderLatestRunSection`, `renderDataSourcesStatusSection`, và `renderSummaryMainContent` dùng `if / else` tường minh, xóa bỏ hoàn toàn các toán tử `? :` lồng nhau trong JSX.
9. **`screens/statistics/RunningStatisticsScreen.tsx`**:
   * **Thay đổi lớn:**
     * Thay `JSON.stringify(['client', row.clientId])` khó hiểu bằng hàm `getRunRecordKey(row)` trả về chuỗi ghép đơn giản `` `client:${row.clientId}` `` hoặc `` `id:${String(row.id)}` ``.
     * Tách hàm `buildRateMetric(source, value, excluded)` ra cấp module để đóng gói các chỉ số tỷ lệ (Pace, Tốc độ, Nhịp bước).
     * Tách toàn bộ cửa sổ bật lên xem chi tiết buổi chạy thành component riêng `RunDetailModal` và tách hàm `renderRunHistoryRow`.
10. **`screens/statistics/ScheduleStatisticsScreen.tsx`**:
    * **Thay đổi lớn:** Đưa bản đồ nhãn trạng thái `WORKOUT_STATE_LABELS` lên đầu file; tách 2 hàm `renderExerciseSummaryRow` và `renderScheduleWorkoutRow` sử dụng `if (state === 'done')` rõ ràng.
11. **`screens/statistics/WeightStatisticsScreen.tsx`**:
    * **Thay đổi lớn:** Tách 4 hàm phụ độc lập ở cấp module với đầy đủ JSDoc (`@param`, `@returns`): `calculateDayOffset`, `getWeightChangeDescription`, `getWeightPeriodLabel`, `getTargetGoalStatusMessage`, và hàm `renderTargetWeightContent()`.
12. **`screens/statistics/GoalsStatisticsScreen.tsx`**:
    * **Thay đổi lớn:** Tách 3 hàm phụ độc lập ở cấp module: `buildWeeklyTargetMetric` (thay thế việc gán đè `minutes.complete = false` và `sessions.complete = false`), `getMissingGoalMessage`, `getRecentWeightLabel`, và hàm `renderActiveGoalSectionContent()`.
13. **`screens/statistics/HabitsStatisticsScreen.tsx`**:
    * **Thay đổi lớn:** Tách 3 hàm phụ độc lập ở cấp module: `getCalendarCellStatus` (xác định nhãn và ký hiệu `●`, `–`, `·`, `?` cho từng ô lịch), `buildActivityChartPoints`, và `buildWeekdayChartPoints`.
14. **`screens/statistics/TimeStatisticsScreen.tsx`**, **`screens/statistics/CaloriesStatisticsScreen.tsx`**, **`screens/statistics/StatisticsCategoriesScreen.tsx`**, **`screens/statistics/shared.tsx`**, **`screens/statistics/statisticsRoutes.ts`**, **`screens/statistics/index.ts`** và **4 file Route trong `src/app/(tabs)/statistics/`**:
    * **Thay đổi:** Chuẩn bị trước mảng cấu hình thẻ chỉ số (`scheduleTimeItems`, `runningTimeItems`, `scheduleCalorieItems`, `runningCalorieItems`), tách biến `visibleRecords` và `remainingCount` trong `StatisticsHistory`, và chú thích Tiếng Việt chi tiết cho toàn bộ các hàm/component.

### Giai đoạn 4: Tách nhỏ logic vẽ biểu đồ SVG và định dạng hiển thị (`components/statistics/`)
15. **`components/statistics/presentation.ts`**:
    * **Thay đổi lớn 1 (Tách nhỏ định dạng thời gian & pace):**
      * Tách hàm `formatPaceMmSs(secondsPerKm)` để đổi số giây/km sang dạng `'Phút:Giây'` (`M:SS`).
      * Tách hàm `formatDurationHhMmSs(durationSec)` để đổi tổng số giây sang dạng `'Giờ:Phút:Giây'` (`HH:MM:SS`).
    * **Thay đổi lớn 2 (Chia hàm tính tọa độ biểu đồ `buildStatisticsChart` thành 5 hàm nhỏ độc lập):**
      * `calculateChartVerticalRange(knownValues, kind)`: Tính giới hạn giá trị nhỏ nhất (`minimum`) và lớn nhất (`maximum`) trên trục dọc Y kèm khoảng đệm (`padding`).
      * `calculateChartHorizontalLayout(points, viewport, leftMargin, kind)`: Tính chiều rộng tổng của biểu đồ (`width`, `plotWidth`), kiểm tra thứ tự tăng dần (`isStrictlyOrdered`) và khoảng cách (`span`), đảm bảo mỗi mốc cách nhau ít nhất `48px` để dễ chạm trên màn hình cảm ứng.
      * `buildBarChartPlotPoints(values, leftMargin, plotWidth, bottomY, valueToY)`: Tính tọa độ `(x, y)` cho từng cột trong biểu đồ cột (`kind === 'bar'`).
      * `buildLineChartPlotPoints(...)`: Tính tọa độ `(x, y)` cho từng điểm trong biểu đồ đường (`kind === 'line'`), đặt điểm duy nhất ở chính giữa hoặc dàn theo đúng khoảng cách ngày thực tế.
      * `buildSvgLinePaths(dots)`: Nối các điểm có dữ liệu liên tiếp thành chuỗi lệnh SVG Path (`'M x,y L x2,y2'`), ngắt đoạn tại những mốc thiếu dữ liệu (`dot.y === null`).
16. **`components/statistics/StatisticsChart.tsx`**:
    * **Thay đổi lớn:**
      * Tách hàm `formatYAxisTickLabel(tickValue, unit)` và `buildChartUnitCaption(unit, suffix)` ra cấp module để xóa bỏ các toán tử 3 ngôi lồng nhau trong JSX.
      * Tách hàm `renderChartPointSvg(point, index)` sử dụng `if (point.y === null)` và `if (kind === 'bar')` riêng biệt để vẽ vạch ngang `Line`, cột `Rect`, hoặc chấm tròn `Circle`.
      * Tách hàm `renderTouchTargetOverlay(point, index)` để vẽ lớp nút chạm trong suốt (`Pressable`) phía trên từng cột/điểm biểu đồ.
17. **`components/statistics/StatisticsStatus.tsx`**:
    * **Thay đổi lớn:**
      * Đưa bảng văn bản mặc định `DEFAULT_DATA_STATE_TEXT` lên đầu file.
      * Tách hàm `collectSourceWarningNotes(source)` và `formatUpdatedTimeLabel(updatedAt)` ra cấp module với đầy đủ JSDoc (`@param`, `@returns`), giúp component `StatisticsSourceNotice` ngắn gọn và dễ đọc.
18. **`components/statistics/StatisticsProgress.tsx`**, **`components/statistics/StatisticsPeriodPicker.tsx`**, **`components/statistics/StatisticsMetricCard.tsx`**, **`components/statistics/StatisticsActivityRow.tsx`**, **`components/statistics/index.ts`**:
    * **Thay đổi:**
      * Giải thích chi tiết công thức toán học vẽ vòng tròn tiến độ bằng chu vi hình tròn `circumference = 2 * Math.PI * circleRadius` và `strokeDashoffset`.
      * Tách hàm `renderArrowButton(direction)` trong `StatisticsPeriodPicker`.
      * Thay toán tử `? :` ở phần `return` của `StatisticsActivityRow` bằng câu lệnh `if (onPress) return <Pressable>...` rõ ràng.
      * Bổ sung chú thích Tiếng Việt ở đầu mọi file/hàm và các dòng xử lý cốt lõi.
