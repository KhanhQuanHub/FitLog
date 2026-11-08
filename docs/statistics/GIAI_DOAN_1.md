# Giai đoạn 1 — Khảo sát và chốt quy tắc thống kê FitLog

Ngày khảo sát: 05/11/2026. Trạng thái: hoàn thành khảo sát, chưa triển khai tính năng.

## 1. Phạm vi đã chốt

- Chỉ thống kê cá nhân, đọc dữ liệu hiện có. Không sửa cấu trúc, dữ liệu mẫu, middleware hoặc logic ghi dữ liệu server.
- Giữ 7 danh mục. Chạy bộ và tập theo lịch trình bày riêng; không cộng hai nguồn thành tổng buổi, thời gian hoặc calo.
- Tiến độ tuần lấy từ `workouts` hoàn thành; chạy tự do chỉ nằm trong thống kê chạy.
- Tóm tắt → tất cả danh mục → màn chi tiết riêng; thẻ tóm tắt mở trực tiếp chi tiết.
- Ngày / Tuần / Tháng / Năm; tuần từ thứ Hai; không có khoảng ngày tự chọn.
- Dùng sáng/tối theo FitLog. Không số giả, không biểu đồ mô phỏng, không mục tiêu tự đặt.
- Không triển khai các giai đoạn 2–7 trong lần khảo sát này.

## 2. Kiến trúc và nguồn đã đọc

| Thành phần | Hiện trạng |
| --- | --- |
| Công cụ | npm, `package-lock.json`; không có Bun lock. Expo `~58.0.23`, React Native `0.88.1`, TypeScript strict |
| Dữ liệu server | JSON Server 0.17.4; `fitlog-server/db.json` là dữ liệu đang lưu, `db.jsonc` là nguồn seed có chú thích |
| Xác thực | `services/api.js`, `store/authStore.ts`, `fitlog-server/auth.js` |
| Bản nháp thống kê | `screens/StatsScreen.tsx`, gắn vào tab Stats trong `navigation/MainTabs.tsx` |
| Ngoại tuyến | `services/runRepository.js`: AsyncStorage, queue, checkpoint, cache lịch sử |
| Luồng tạo buổi chạy | `hooks/useRunTracker.js`: chạy cảm biến và nhập tay |
| Dùng chung | `constants/theme.ts`, `store/themeStore.ts`, `components/ui/`, `utils/dateLocal.js`, `utils/format.ts`, `utils/runMath.js`, `domain/bmi.ts` |
| Điều hướng hiện tại | React Navigation; chưa có Expo Router trong dependencies, các màn hiện ở `screens/` |

Đã đối chiếu sơ đồ `.archify/erd-fitlog-database-20261104-205900/fitlog-database.html` với dữ liệu và mã nguồn; mã nguồn hiện tại là căn cứ khi có khác biệt.

Lưu ý cho giai đoạn giao diện: `AGENTS.md` yêu cầu Expo Router, trong khi dự án hiện dùng React Navigation. Đây là khác biệt kiến trúc cần xử lý theo quy tắc dự án ở giai đoạn điều hướng; chưa tự chuyển toàn bộ ứng dụng trong giai đoạn 1. Trước khi viết mã chạm Expo/React Native phải đọc tài liệu phiên bản SDK 58 theo `AGENTS.md`; lần này chỉ khảo sát và viết Markdown, chưa viết mã API.

## 3. Bảng dữ liệu hiện có

Số lượng dưới đây chỉ là ảnh chụp lúc khảo sát, không phải giá trị để hardcode.

| Bảng | Số dòng | Vai trò trong thống kê |
| --- | ---: | --- |
| `users` | 6 | Chỉ dùng định danh phiên đăng nhập; không tải danh sách tài khoản cho thống kê |
| `profiles` | 2 | Chiều cao, cân nặng dự phòng, cam kết số buổi mỗi tuần |
| `weightHistory` | 5 | Cân nặng theo ngày |
| `goals` | 8 | Tên và mã loại mục tiêu |
| `userGoals` | 2 | Mục tiêu cá nhân, cân nặng đích, phút cam kết mỗi tuần |
| `exercises` | 8 | Tên bài, nhóm cơ, thông tin tham chiếu |
| `workouts` | 6 | Một dòng là một buổi theo lịch; trạng thái và kết quả buổi |
| `runs` | 7 | Kết quả từng buổi chạy, không có liên kết với `workouts` |

Không có bảng bước cả ngày, dữ liệu theo giờ, huy chương, nhịp tim, dinh dưỡng hoặc lịch sử mục tiêu. `runs.source` là nguồn ghi nhận, không phải loại môn chạy/đi bộ.

## 4. Nguồn đọc cho từng chỉ số

| Chỉ số | Nguồn và trường | Quy tắc |
| --- | --- | --- |
| Phút tập theo lịch | `workouts.date/status/durationMin` | Lọc kỳ, chỉ `done`; cộng phút hợp lệ |
| Calo theo lịch | `workouts.caloriesBurned` | Chỉ buổi `done`; dùng số đã lưu, không tính lại bằng cân nặng hiện tại |
| Buổi theo lịch hoàn thành | `workouts.id/status` | Đếm buổi `done` trong kỳ |
| Lịch bỏ lỡ/còn chờ | `workouts.date/time/status` | Quy tắc trạng thái ở mục 5 |
| Theo bài/nhóm cơ | `workouts.exerciseId` → `exercises.id/name/muscleGroup` | Bài thường tập dựa trên buổi `done`; mất danh mục vẫn giữ buổi với nhãn chưa rõ bài |
| Thời gian chạy | `runs.durationSec` | Tổng giây vận động; `pausedSec` trình bày riêng, không cộng vào phút vận động |
| Calo chạy | `runs.calories` | Tổng giá trị đã lưu; ghi là ước tính |
| Số buổi chạy | `runs.id/clientId` | Loại trùng cùng tài khoản; chỉ bản ghi đã kết thúc/lưu |
| Bước, quãng đường | `runs.steps/distanceKm` | Tổng theo kỳ; nhãn giới hạn trong các buổi chạy |
| Pace cả kỳ | `runs.durationSec/distanceKm` | Tổng giây của các buổi có khoảng cách và thời gian > 0 / tổng km của chính các buổi đó |
| Tốc độ cả kỳ | Cùng tập buổi hợp lệ với pace | Tổng km / (tổng giây / 3600); không lấy trung bình đơn giản tốc độ từng buổi |
| Nhịp bước cả kỳ | `runs.steps/durationSec` | Tổng bước / tổng phút trên cùng tập buổi có bước hợp lệ và thời gian > 0 |
| Buổi xa nhất | `runs.distanceKm` | Max trong kỳ; đồng hạng chọn buổi mới nhất |
| Cân nặng hiện tại | `weightHistory.weightKg/date`; dự phòng `profiles.weightKg` | Lấy bản ghi cân hợp lệ mới nhất không ở tương lai; không dùng số mặc định trong authStore |
| Biến động cân | `weightHistory` | Cần ít nhất hai mốc; trong kỳ lấy mốc cuối trừ mốc đầu; không tự nội suy ngày thiếu |
| BMI hiện tại | Cân nặng hiện tại + `profiles.heightCm` | kg / (cm / 100)^2; thiếu số đo thì không phân loại; không dựng BMI lịch sử |
| Phút mục tiêu tuần | `userGoals.minMinutesPerWeek` + phút `workouts.done` | Thực tế / cam kết; không cộng `runs` |
| Buổi mục tiêu tuần | `profiles.sessionsPerWeek` + số `workouts.done` | Thực tế / cam kết; không cộng `runs` |
| Cân nặng đích | `userGoals.targetWeightKg` | Hiển thị hiện tại, đích và chênh lệch; không tạo % hành trình |
| Chuỗi theo lịch | `workouts.date/time/status` | Đếm buổi liên tiếp, không đếm ngày; xem mục 5 |
| Ngày có hoạt động | Ngày `workouts.done` và `runs` | Hợp các ngày, mỗi ngày tối đa một lần; chỉ gộp ngày có/không hoạt động, không gộp số buổi hoặc thời gian |

Nhóm cơ đang là chuỗi như `Ngực, tay sau`, `Chân, mông`, `Toàn thân`. Giai đoạn đầu nhóm theo nguyên nhãn đang lưu, không tự tách thành nhiều nhóm rồi cộng trùng buổi. Sets/reps trong `exercises` là hướng dẫn, không phải số lần thực hiện thực tế.

## 5. Quy tắc xử lý dữ liệu

### 5.1. Kỳ thời gian

- Hàm tính nhận mốc hiện tại làm đầu vào để kiểm thử được. Không đóng băng ngày bằng `useMemo(..., [])`.
- Ngày dùng `YYYY-MM-DD` địa phương; không chuyển chuỗi ngày thuần sang UTC rồi so sánh ngày.
- Tuần gồm thứ Hai–Chủ nhật, tháng theo lịch thực, năm từ 01/01–31/12. Chuyển kỳ theo lịch, tránh cộng cố định 24 giờ cho từng ngày.
- Hoạt động chạy theo `runs.date` (ngày bắt đầu đã lưu), không chia nhỏ buổi qua nửa đêm.
- Dữ liệu thực hiện ở tương lai không đưa vào tổng đã thực hiện; lịch tương lai vẫn được hiển thị là kế hoạch.
- Ngày: tổng và danh sách buổi; tuần/tháng: cột theo ngày; năm: cột theo tháng. Cột 0 chỉ khi nguồn đã tải thành công, không dùng 0 thay lỗi.
- Cân/BMI là thông tin gần nhất có nhãn ngày riêng. Biểu đồ cân theo kỳ chọn; không đổi cân cũ thành một lần cân hôm nay.
- Tiến độ mục tiêu là tuần hiện tại. Khi chọn Ngày/Tháng/Năm ở màn mục tiêu, hiển thị lịch sử thực hiện theo kỳ cùng khối cam kết tuần hiện tại có nhãn rõ; không nhân mục tiêu tuần thành mục tiêu tháng/năm.
- Chưa bổ sung % so sánh kỳ trước: không nằm trong phạm vi tối thiểu đã chốt.

### 5.2. Trạng thái và chuỗi

- `done`: hoàn thành; `missed`: bỏ lỡ; `planned` với `date < hôm nay`: bỏ lỡ suy ra để hiển thị; `planned` hôm nay/tương lai: còn chờ.
- Không PATCH trạng thái từ phần thống kê. Trạng thái/ngày không hợp lệ được báo chưa xác định, không tự coi là hoàn thành hoặc bỏ lỡ.
- Tỷ lệ = done / (done + missed), với các buổi hợp lệ trong kỳ và không ở tương lai. Mẫu số 0 hiển thị chưa có buổi được đánh giá, không kết luận đạt 100%.
- Chuỗi xét lịch hợp lệ toàn bộ đến hôm nay, sắp tăng theo ngày, giờ; cùng thời điểm thì theo id ổn định. Buổi còn chờ không tăng/ngắt chuỗi. Mỗi done tăng 1, mỗi missed đặt lại 0; lấy độ dài cuối và max cho chuỗi hiện tại/dài nhất.
- Ngày không có lịch không ảnh hưởng chuỗi. Chạy tự do không tham gia chuỗi theo lịch. Giao diện ghi đơn vị **buổi liên tiếp**, không phải ngày.
- Không có `completedAt`/lịch sử trạng thái nên không thể phát hiện một buổi quá khứ được sửa từ missed thành done sau khi tập bù. Chỉ phản ánh trạng thái hiện có, không hứa giữ chuỗi lịch sử; không thêm trường để khắc phục.

### 5.3. Mục tiêu, hồ sơ và giá trị thiếu

- Trong nghiệp vụ đã chốt có một mục tiêu. Nếu tải được đúng một `userGoals` của tài khoản thì dùng mục tiêu đó, ghép `goals` để lấy tên.
- Nếu 0 mục tiêu: chưa có mục tiêu; nếu >1: chưa xác định mục tiêu áp dụng, không tự lấy dòng đầu vì thiếu cờ active/ngày bắt đầu.
- `minMinutesPerWeek` và `sessionsPerWeek` phải là số dương hợp lệ; thiếu cam kết thì vẫn hiển thị thực tế, không có % hoặc vòng mục tiêu giả.
- % được phép >100%, phần tô vòng/thanh tối đa 100%. Cộng chính xác trước khi làm tròn hiển thị.
- Cân mới nhất ưu tiên weightHistory, sau đó hồ sơ server. Không dùng giá trị cân/chiều cao giả được authStore dự phòng hoặc bản nháp hồ sơ chỉ sửa trong RAM.
- Nếu nhiều mốc cân cùng ngày không có giờ: dùng id lớn nhất làm quy ước hiển thị ổn định, không khẳng định biết thứ tự đo thực tế. Hồ sơ fallback không có ngày đo nên ghi nguồn hồ sơ, không tự ghi ngày hôm nay.
- Thiếu số đo thì BMI là chưa có dữ liệu, không tái sử dụng kết quả `bmi: 0, label: Bình thường` của helper hiện tại làm kết luận.
- `deadlineWeeks` thiếu ngày bắt đầu; không tính hạn còn lại. Thiếu cân xuất phát mục tiêu; không tính % tiến độ cân. Mục tiêu phi cân nặng không được suy ra % cải thiện sức khỏe.
- Chỉ dùng số hữu hạn, đúng miền (không âm; cân/chiều cao > 0). Trường thiếu không được im lặng thay bằng số đo thật bằng 0. Tổng có dữ liệu thiếu phải có nhãn chưa đầy đủ.

## 6. API và ngoại tuyến

### 6.1. API đọc có thể dùng lại

`services/api.js` đã có `getAllWorkouts()` (expand exercise), `getAllRuns()`, `getUserGoals()` (expand goal), `getWeightHistory()`, `getMyProfile()`. Dùng `request()` hiện có để giữ xử lý token/lỗi. Không gọi `saveRun`, API PATCH, reset hoặc đồng bộ ghi server từ màn thống kê.

Middleware ép `userId` cho user thường, nhưng admin được đọc nhiều người. Vì tính năng luôn là cá nhân, phía thống kê vẫn lọc theo `authUser.id` cho mọi vai trò, chuẩn hóa kiểu id khi so sánh. Tách dữ liệu/lỗi theo nguồn; một API lỗi không biến thành mảng rỗng có vẻ tải thành công.

Không lấy một trang `getRunsPage()` hoặc cache lịch sử làm toàn bộ năm: trang mặc định 20, API giới hạn mỗi trang 50; cache tối đa 60 và hiện chỉ cập nhật từ trang đầu. Dùng dữ liệu đầy đủ qua API đọc hoặc phân trang đủ; cache thiếu phải báo phạm vi chưa đầy đủ.

### 6.2. Giới hạn phát hiện được

- Queue dùng khóa chung `@figlog/run_queue_v1`, cache dùng `@figlog/run_history_cache_v1`, không tách tài khoản.
- Payload cảm biến/nhập tay trong `useRunTracker.js` chưa gắn `userId` trước khi `finishAndSaveRun()` đưa vào queue; server mới ép userId lúc POST.
- Logout hiện xóa token và trạng thái xác thực, không thấy xóa/phân vùng queue/cache. Không thể xác nhận chủ sở hữu của queue cũ thiếu userId chỉ từ dữ liệu đang có.
- `fetchRunHistoryPage()` ghép queue không lọc chủ sở hữu và ưu tiên pending trước server; không dùng nguyên kết quả đó cho tổng thống kê cá nhân.

### 6.3. Hướng xử lý giai đoạn 3, không đổi CSDL

- Chỉ nhận bản ghi offline có `userId` trùng tài khoản hoặc có bằng chứng chủ sở hữu trong chính phiên hiện tại. Không gán mặc định toàn bộ queue cũ cho người vừa đăng nhập.
- Queue cũ không xác định được chủ sở hữu: không đưa vào số cá nhân, thông báo chưa thể tổng hợp các buổi chờ đồng bộ này. Không xóa, không tự sync để lấy userId, không đòi bổ sung trường server.
- Có thể giữ liên hệ clientId–tài khoản trong RAM ngay trong phiên khi nhận kết quả chạy của chính tài khoản đó; không đổi payload/CSDL. Nếu chưa có đường truyền sự kiện phù hợp, phải ghi nhận giới hạn thay vì tuyên bố offline hoàn chỉnh.
- Với bản ghi được xác định thuộc tài khoản: ghép theo (userId, clientId), dự phòng id server khi thiếu clientId; bản server thắng queue cùng khóa, bỏ nhãn chờ khi đã có trên server.
- Cache chỉ dùng sau khi lọc được userId và phải báo là dữ liệu đã lưu, có thể thiếu. Checkpoint đang chạy không tính là buổi hoàn thành.

Yêu cầu tính ngay buổi chờ đồng bộ chỉ đáp ứng được khi xác định đúng chủ sở hữu. Đây là giới hạn của luồng lưu hiện tại, không phải yêu cầu thay đổi CSDL hay phạm vi sửa luồng chạy trong giai đoạn 1.

## 7. Đánh giá bản nháp và danh sách thay đổi

Các vị trí là dòng lúc khảo sát trong `screens/StatsScreen.tsx`.

| Vị trí | Hiện trạng | Thay đổi cần làm ở giai đoạn sau |
| --- | --- | --- |
| 40–92 | Vòng tiến độ SVG | Dùng lại ý tưởng hình học; nhận số thực và theme, bỏ mục tiêu mặc định |
| 95–136 | MiniBarChart có mảng chiều cao/ô sáng cố định | Thay bằng các mốc tính từ dữ liệu, bỏ nhãn giờ không có căn cứ |
| 155 | Ngày hôm nay được memo cố định | Cập nhật theo lúc tải/focus/đổi ngày |
| 157–180 | Mỗi API catch thành []/null | Giữ trạng thái thành công/lỗi riêng, không giả 0 khi lỗi |
| 200–219 | Hôm nay rỗng thì lấy buổi cũ; gộp calo chạy/lịch; fallback 212 | Lọc đúng ngày, tách nguồn, không số giả |
| 222 | Mục tiêu calo 400 | Thay vòng bằng phút lịch tuần / minMinutesPerWeek |
| 225–227 | Chưa có done thì lấy cả buổi planned/missed | Hoạt động hoàn thành gần nhất chỉ lấy bản ghi hoàn thành |
| 236–244 | Cân fallback authStore/60, mục tiêu lấy dòng đầu/150 | Chỉ số thật từ nguồn server, xử lý thiếu/đa mục tiêu |
| 247–256 | "Tuần" cộng toàn bộ lịch sử, gộp chạy/lịch, làm tròn từng buổi | Lọc tuần; dùng workouts cho tiến độ; làm tròn sau tổng |
| 259–263 | Streak bằng số ngày khác nhau, tối thiểu 1 | Chuỗi buổi theo thứ tự lịch, cho phép 0 |
| 266–293 | Mẹo HLV tự soạn | Bỏ khỏi phạm vi thống kê đã chốt |
| 296–299 | Màu nền/chữ ghi trực tiếp | Dùng token từ theme |
| Thẻ buổi tập | Tên/thời lượng có fallback giả | Empty state khi chưa có hoạt động |
| 488, 503 trở đi | Chỉ nút danh mục có hành động; modal mở rộng 4 nhóm | Thẻ bấm được; danh sách 7 mục và màn chi tiết riêng |
| 620 | Mọi trạng thái ngoài done hiển thị chờ | Phân biệt missed, planned quá hạn, còn chờ và chưa xác định |

Có thể tái sử dụng: API đọc, xác thực và thông báo lỗi, `useTheme`, theme tokens, các UI primitives, định dạng thời lượng/số nguyên, `localDateString`, ý tưởng vòng tiến độ và khóa `clientId`.

Cần adapter cẩn thận: `utils/format.ts::formatPace` nhận **phút/km**, trong khi `runs.paceSecPerKm` là **giây/km**. `formatDistance` hiện dùng dấu chấm; hiển thị thống kê cần định dạng tiếng Việt. Không thay helper toàn ứng dụng chỉ để phục vụ thống kê nếu ảnh hưởng màn khác.

## 8. Đối chiếu số liệu đọc trực tiếp

Đây là tổng toàn bộ lịch sử trong db tại lúc khảo sát, không phải số hôm nay/tuần này.

| userId | Buổi lịch done | Phút lịch done | kcal lịch done | Buổi chạy | Bước chạy | km chạy | Giây chạy | kcal chạy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 70 | 335 | 4 | 23.645 | 17,17 | 7.680 | 1.054 |
| 2 | 1 | 45 | 117 | 1 | 4.500 | 3,01 | 1.800 | 144 |

Ngày hiện tại 05/11/2026 không có hoạt động hôm nay trong tập dữ liệu khảo sát. Không được thay bằng kết quả tháng 10. Người dùng có thể có buổi chạy nhưng chưa có hồ sơ/mục tiêu; các nhóm này phải hiển thị độc lập.

## 9. Phân chia công việc tiếp theo

| Giai đoạn | Đầu ra dự kiến, chưa thực hiện |
| --- | --- |
| 2 | Types và hàm thuần cho lọc kỳ, tổng hợp riêng nguồn, mục tiêu, lịch/chuỗi; kiểm thử quy tắc bằng fixture trong bộ nhớ |
| 3 | Tầng đọc thống kê; lọc tài khoản; trạng thái từng nguồn; ghép offline có chủ sở hữu; không ghi server |
| 4 | Bộ chọn kỳ, thẻ, biểu đồ, vòng tiến độ, trạng thái tải/trống/lỗi, nhãn đồng bộ theo theme |
| 5 | 7 màn chuyên sâu, cùng dùng phần tính toán; tránh dồn hết vào StatsScreen |
| 6 | Trang tóm tắt và điều hướng riêng, tuân thủ quy tắc routing sau khi giải quyết khác biệt kiến trúc |
| 7 | Kiểm thử tích hợp/giao diện, lint, typecheck, kiểm tra xuất ứng dụng và báo giới hạn thiết bị |

Giai đoạn 2 có thể tiến hành độc lập, không cần thay CSDL, điều hướng hoặc luồng ghi chạy bộ.

## 10. Kiểm tra và bảo toàn dữ liệu

| Kiểm tra đã chạy | Kết quả |
| --- | --- |
| `npm run lint` với CI=1 | Exit 0, không có chẩn đoán lỗi/cảnh báo trong output |
| `npx --no-install tsc --noEmit` | Exit 0, không có chẩn đoán |
| Đọc JSON và cộng số liệu theo tài khoản bằng Node | Thành công; chỉ đọc file, không ghi dữ liệu |

Output lệnh lưu tại `baseline-lint.txt`, `baseline-typecheck.txt` cùng thư mục. Không chạy app, kiểm tra thiết bị, build hoặc HTTP API trong giai đoạn 1. Vì vậy lint/typecheck không chứng minh chất lượng giao diện hay hành vi ngoại tuyến thực tế.

Không chạy `server:reset`, `build-db`, `fitlog-server/test-server.js`, `fitlog-server/test-acceptance.js`: các script dựng lại/ghi database. Không cài package hoặc đổi cấu hình lint để làm kết quả đẹp hơn.

SHA-256 trước khảo sát, dùng đối chiếu sau khi hoàn tất:

| File | SHA-256 |
| --- | --- |
| `fitlog-server/db.json` | `91EFF17E311D538CD7DBA75587D9F7A04C95C074E2CD7368EDE8EBCB5A25903E` |
| `fitlog-server/db.jsonc` | `E653DC5C07B46C57E5A0809F124EEF574C620AE99E0FC66C1013EFB826C80B92` |
| `fitlog-server/auth.js` | `D4EC286DC71C8B8A428A4B642C6BECAC4770FF062691D68A701BE7D7B272A6B3` |
| `fitlog-server/build-db.js` | `FEFBADF227C47FB1D034DA5BA1C1162BCFCFDD94E7CB5EDB67E9B379C4E13897` |

Đã đối chiếu lại sau khi viết tài liệu: SHA-256 của cả 4 file trên trùng khớp trước khảo sát. Cơ sở dữ liệu, seed, middleware và script dựng dữ liệu không thay đổi.

Trước khi làm đã có thay đổi chưa commit ở `.gitignore`, `navigation/MainTabs.tsx`, `package.json`, `package-lock.json`, `services/api.js` và file chưa theo dõi `screens/StatsScreen.tsx`. Giai đoạn 1 giữ nguyên các thay đổi đó, chỉ thêm tài liệu và log trong `docs/statistics/`.
