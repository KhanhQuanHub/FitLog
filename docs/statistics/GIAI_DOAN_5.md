# Giai đoạn 5 — Bảy màn thống kê chuyên sâu

Ngày thực hiện: 05/11/2026. Phạm vi: nội dung 7 màn, bộ lọc và kết nối tầng dữ liệu đã có. Không thay đổi cơ sở dữ liệu.

## 1. Các màn đã hoàn thiện

Mã màn hình ở `screens/statistics/`, export tại `index.ts`.

| Màn hình | File | Nội dung |
| --- | --- | --- |
| Chạy bộ | `RunningStatisticsScreen.tsx` | Buổi chạy, km, bước, thời gian, calo ước tính, pace/tốc độ/nhịp bước có trọng số, buổi xa nhất, biểu đồ km/bước, lịch sử và chi tiết buổi chạy chỉ đọc |
| Lịch tập và mức độ hoàn thành | `ScheduleStatisticsScreen.tsx` | Hoàn thành/bỏ lỡ/còn chờ, tỷ lệ hoàn thành, biểu đồ buổi theo kỳ, bài thường tập, nhóm cơ và danh sách lịch |
| Thời gian luyện tập | `TimeStatisticsScreen.tsx` | Tổng/trung bình phút theo lịch, tổng/trung bình thời gian chạy, tạm dừng và hai biểu đồ riêng |
| Calo luyện tập | `CaloriesStatisticsScreen.tsx` | Tổng/trung bình kcal từ lịch và chạy, biểu đồ riêng, ghi rõ là ước tính |
| Cân nặng và BMI | `WeightStatisticsScreen.tsx` | Cân gần nhất/ngày đo/nguồn, BMI hiện tại, mức tăng/giảm trong kỳ, đường cân theo ngày thực, lịch sử và cân nặng đích đã lưu |
| Tiến độ mục tiêu | `GoalsStatisticsScreen.tsx` | Một mục tiêu xác định được, phút và số buổi lịch của tuần hiện tại, cân hiện tại/đích và lịch sử thực hiện theo kỳ chọn |
| Thói quen luyện tập | `HabitsStatisticsScreen.tsx` | Chuỗi hiện tại/dài nhất theo lịch, ngày có hoạt động, lịch đánh dấu ngày/tuần/tháng, biểu đồ năm theo tháng và phân bố theo thứ |

Các màn dùng thành phần giai đoạn 4, màu sáng/tối theo theme FitLog. Không tạo tổng chung giữa chạy và lịch tập để tránh tính trùng cùng một hoạt động.

## 2. Kết nối và vòng đời

### `StatisticsDataProvider.tsx`

- Một provider giữ một instance repository giai đoạn 3; có thể dùng chung giữa nhiều màn.
- Instance được tạo trong effect và hủy bằng dispose, tránh rò subscription khi React StrictMode chạy lại effect.
- `useSyncExternalStore` theo dõi snapshot; nguồn tải xong cập nhật riêng, lỗi không biến thành mảng rỗng thành công.
- Tải lần đầu, hỗ trợ làm mới thủ công/kéo xuống và khi ứng dụng trở lại foreground.
- Theo dõi ngày địa phương mỗi phút và lúc foreground. Kỳ hiện tại tự đổi khi qua ngày; kỳ lịch sử người dùng đã chọn được giữ nguyên.
- Nhận thông báo queue/đổi phiên từ repository hiện có. Logout xóa dữ liệu đang xem và đóng chi tiết buổi chạy.
- Các màn tự tạo provider nếu được dùng độc lập. Giai đoạn 6 nên bọc provider chung cho khu vực thống kê để giữ dữ liệu khi chuyển màn.

### `StatisticsDetailScreen.tsx`

- Khung SafeArea, tiêu đề, mô tả, bộ chọn Ngày/Tuần/Tháng/Năm, nút trước/sau/về hiện tại và làm mới.
- Mặc định xem tuần hiện tại, tuần từ thứ Hai. Nút kỳ sau bị khóa nếu kỳ sau chưa tới.
- `onBack` là callback của host, chưa tạo hoặc sửa điều hướng ứng dụng.
- `initialKind`/`initialAnchor` dành cho host mở một kỳ hợp lệ từ thẻ tóm tắt. Chỉ nhận ngày/kỳ đã được kiểm tra từ bên gọi.
- `chartWidth` tùy chọn khi host biết chính xác chiều rộng vùng biểu đồ; mặc định biểu đồ tự đo onLayout. Kiểm thử JSDOM/preview truyền kích thước cố định để render SVG, không giả vờ đã đo layout native.
- Giữ trạng thái thiếu đăng nhập riêng, không hiển thị số liệu tài khoản cũ.

### `viewModel.ts` và `shared.tsx`

- Dùng kết quả tính toán giai đoạn 2; thêm nhãn kỳ/ngày, cờ chất lượng nguồn, chuyển giây sang phút và dữ liệu biểu đồ cho màn hình.
- Mảng thay thế [] chỉ dùng nội bộ để chạy hàm tính thuần. Mọi khối UI vẫn qua cổng nguồn; data=null không được hiển thị như 0 buổi/0 kg đã tải thành công.
- Chỉ số từ nguồn lỗi/stale/chưa đầy đủ giữ cảnh báo tương ứng. Phần phụ thuộc nhiều nguồn không tự kết luận đủ khi chỉ một nguồn đã tải xong.
- Biểu đồ thực hiện không dựng cột 0 cho ngày/tháng tương lai. Lịch dự kiến tương lai vẫn nằm trong danh sách lịch với trạng thái còn chờ.
- Danh sách dài hiển thị 20 dòng/lần và nút xem thêm; tổng số liệu vẫn tính trên toàn bộ nguồn đã tải.

## 3. Quy tắc nghiệp vụ được giữ

- Thời gian/calo chạy và lịch hiển thị thành hai nguồn riêng, kể cả khi một hoạt động xuất hiện ở hai bảng.
- Kết quả chạy đã loại trùng ở tầng đọc; có queue/server cùng buổi thì chỉ một buổi được tính. Nhãn chờ đồng bộ chỉ dành cho bản còn pending sau ghép.
- Chọn buổi chạy mở modal chi tiết chỉ đọc, có nút đóng và xử lý nút Back Android qua onRequestClose. Không gọi sync hoặc API ghi từ màn thống kê.
- Chi tiết không giữ bản ghi thô trong state; tra lại từ danh sách hiện tại theo mã. Đổi kỳ/phiên hoặc mất bản ghi thì không để chi tiết cũ tiếp tục hiện.
- Lịch chỉ coi planned quá ngày là bỏ lỡ; không PATCH trạng thái server. Tỷ lệ loại các buổi còn chờ.
- Bài/nhóm cơ giữ nguyên nhãn đang có; không tách một nhãn nhóm cơ rồi đếm trùng buổi.
- Cân gần nhất ưu tiên lịch sử, sau đó hồ sơ server; không lấy số giả trong authStore. Thiếu dữ liệu lịch sử thì số cân dự phòng được ghi chưa đầy đủ.
- Thiếu chiều cao/hồ sơ thì BMI không được phân loại chắc chắn. Cân giảm hiển thị mức thay đổi dương kèm chữ “giảm”, không bị bộ định dạng không âm đổi thành dấu gạch.
- Hai lần cân cách nhau một ngày và nhiều ngày có khoảng cách biểu đồ theo thời gian thực. Không tạo thêm số đo ở ngày trống.
- Mục tiêu tuần vẫn là tuần hiện tại khi xem lịch sử tháng/năm, không nhân cam kết lên theo số tuần. Không cộng chạy tự do vào cam kết theo lịch.
- Mục tiêu/hồ sơ mơ hồ không tự chọn dòng đầu hoặc kết luận là không có cam kết.
- Chuỗi xét toàn lịch sử đến hôm nay; không bị cắt khi đổi kỳ biểu đồ. Ngày nghỉ không ngắt chuỗi. Không khẳng định khôi phục được lịch sử tập bù vốn chưa có dữ liệu.
- Ngày hoạt động là hợp các ngày từ hai nguồn, không cộng số buổi. Khi một nguồn chưa đọc đủ, ngày không có dấu hoạt động được ghi “chưa đủ dữ liệu để xác định”, không tự gọi là ngày nghỉ.

## 4. Kiểm thử

| Nhóm | Kết quả |
| --- | --- |
| 7 màn và provider/view model mới | **40 ca** |
| Thành phần/định dạng giai đoạn 4 | **25 ca** |
| Tính toán và dữ liệu giai đoạn 2–3 | **93 ca** |
| Tổng chạy cùng nhau | **158/158 đạt** |
| `npm run lint` với CI=1 | Đạt |
| `npx --no-install tsc --noEmit` | Đạt |

Lệnh kiểm thử:

```powershell
$env:FITLOG_STATS_SCREENS_PREVIEW='1'
node --test screens/statistics/statistics-screens.test.mjs components/statistics/presentation.test.mjs components/statistics/statistics-ui.test.mjs domain/statistics/statistics.test.mjs services/statisticsRepository.test.mjs services/statisticsData.integration.test.mjs
```

Các ca mới kiểm tra cả 7 màn với dữ liệu và tập rỗng, thay theme, đổi kỳ/về hiện tại, nút quay lại, nguồn lỗi độc lập, dữ liệu chờ đồng bộ/trùng, mở/đóng chi tiết, logout, phân trang UI, qua nửa đêm, StrictMode, mục tiêu/hồ sơ mơ hồ và phần phụ thuộc nhiều nguồn. Có kiểm tra SVG thực sự được render trong các màn có dữ liệu.

Đã tách phần chuẩn bị React Native Web/JSDOM của test giai đoạn 4 sang `test-support/statisticsUiHarness.mjs` để dùng lại cho test màn hình. Không thay assertions giai đoạn 4. Native storage/haptics/SecureStore và SafeAreaView được giả lập trong test; dữ liệu fixture chỉ ở bộ nhớ.

Log cuối: `phase5-tests.txt`, `phase5-lint.txt`, `phase5-typecheck.txt`. Cảnh báo MODULE_TYPELESS_PACKAGE_JSON của Node là cấu hình module hiện có, không phải lỗi kiểm thử; không đổi package để bỏ cảnh báo.

## 5. Preview và giới hạn xác minh

- `phase5-light.html` và `phase5-dark.html`: mỗi file có đủ 7 màn và 15 SVG, xuất từ component thật ở chiều rộng mẫu 320 px. Có dòng ghi rõ dữ liệu minh họa, không kết nối CSDL.
- HTML là bản tĩnh, các nút không chạy khi mở file. Tương tác được kiểm thử riêng trong JSDOM.
- Chưa kiểm tra pixel/overflow bằng browser screenshot, chưa kiểm tra cỡ chữ hệ thống lớn, thiết bị Android/iOS, mạng thật hoặc bản build. Hạn chế môi trường xem trước đã ghi ở giai đoạn 4; không tuyên bố đã vượt qua kiểm tra trực quan native.
- Dữ liệu hiện tại vẫn chưa đủ để biết mọi trường hợp tập bù hoặc chủ queue cũ thiếu userId sau khi mất phiên. Màn hình giữ các giới hạn và cảnh báo giai đoạn 1–3.

## 6. Ranh giới với giai đoạn 6

- Chưa thay `screens/StatsScreen.tsx`, trang tóm tắt và danh sách danh mục cũ; chưa đăng ký 7 màn vào navigation của ứng dụng.
- Giai đoạn 6 sẽ nối thẻ tóm tắt/danh mục tới các màn export trong `screens/statistics/index.ts`, dùng provider chung và xử lý focus của màn theo hệ điều hướng.
- Dự án hiện dùng React Navigation nhưng AGENTS.md yêu cầu Expo Router. Giai đoạn 5 không thêm một navigator mới trái quy tắc, cũng không tự chuyển toàn bộ auth/chạy/hồ sơ ngoài phạm vi. Khác biệt kiến trúc này phải được giải quyết khi thực hiện phần điều hướng ở giai đoạn 6.

## 7. Bảo toàn dữ liệu

Không cài package, đổi app entry, sửa API/server, seed hoặc chạy các script dựng lại CSDL. Sau kiểm tra đã đối chiếu SHA-256 của `fitlog-server/db.json`, `db.jsonc`, `auth.js`, `build-db.js` với giai đoạn 1: giữ nguyên.

Tài liệu API đã đọc trước khi viết: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo llms.txt](https://docs.expo.dev/llms.txt), [Safe Area SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/safe-area-context/), [AppState](https://reactnative.dev/docs/appstate), [RefreshControl](https://reactnative.dev/docs/refreshcontrol), [Modal](https://reactnative.dev/docs/modal), đối chiếu thêm kiểu dữ liệu các phiên bản đã cài trong dự án.
