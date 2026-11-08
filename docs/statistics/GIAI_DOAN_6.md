# Giai đoạn 6 — Tóm tắt và điều hướng thống kê

Ngày thực hiện: 05/11/2026. Hoàn thiện trang tóm tắt, danh mục và kết nối 7 màn chuyên sâu. Không thay đổi cơ sở dữ liệu.

## Nội dung trang tóm tắt

| Thẻ | Số liệu | Màn/kỳ mở khi bấm |
| --- | --- | --- |
| Cam kết thời gian tuần này | Phút từ buổi theo lịch đã hoàn thành / cam kết tuần của mục tiêu xác định được | Tiến độ mục tiêu · Tuần |
| Calo theo lịch | Kcal của buổi theo lịch đã hoàn thành hôm nay | Calo luyện tập · Ngày |
| Quãng đường chạy | Km của buổi chạy hoàn chỉnh hôm nay, gồm buổi chờ đồng bộ đủ căn cứ về chủ sở hữu | Chạy bộ · Ngày |
| Buổi hoàn thành | Số buổi theo lịch hoàn thành tuần này | Lịch tập · Tuần |
| Cân nặng gần nhất | Số đo/ngày đo đã lưu, có thể dự phòng từ hồ sơ và ghi rõ nguồn | Cân nặng · Tháng chứa ngày đo; thiếu ngày dùng tháng hiện tại |
| Chuỗi hoàn thành | Số buổi theo lịch hoàn thành liên tiếp | Thói quen · Tháng |
| Phút tập theo lịch | Tổng phút hoàn thành tuần này | Thời gian · Tuần |
| Buổi chạy gần nhất | Ngày, km, thời gian, nhãn chờ đồng bộ nếu có | Chạy bộ · Ngày của buổi chạy đó |

Một buổi theo lịch có 30 phút và 200 kcal vẫn là **1 buổi, 30 phút, 200 kcal**. Không cộng buổi chạy vào các thẻ lịch tập. Buổi chạy gần nhất không thay thế số liệu hôm nay.

Cuối trang có nút **Xem tất cả danh mục**, mở màn riêng với đúng 7 mục: Thời gian luyện tập; Calo luyện tập; Chạy bộ; Lịch tập và mức độ hoàn thành; Cân nặng và BMI; Tiến độ mục tiêu; Thói quen luyện tập. Mỗi mục mở màn chi tiết đã xây dựng ở giai đoạn 5.

## Điều hướng và vòng đời dữ liệu

- Thực hiện yêu cầu Expo Router của `AGENTS.md`: điểm vào `index.ts` dùng `expo-router/entry`, route nằm trong `src/app/`, thành phần/hook vẫn ngoài thư mục route.
- Chuyển lớp điều hướng gốc và 5 tab sang Router, giữ giao diện tab hiện có. Đăng nhập/đăng ký dùng URL Router; `Stack.Protected` phân tách nhóm đăng nhập và nhóm tab theo trạng thái xác thực.
- `App.tsx` tiếp tục tải font, áp dụng sáng/tối, StatusBar và SafeArea; dùng ThemeProvider của Router, không tạo NavigationContainer riêng.
- Cài qua `expo install` các gói tương thích SDK 58: `expo-router`, `expo-linking`, `expo-constants`. Bổ sung plugin, scheme `fitlog` và cấu hình typed routes. SDK 58 có API tab bar mới: `emitter` và `navigateToTab`, đã dùng theo kiểu của gói thực tế.
- Stack thống kê dùng chung một `StatisticsDataProvider` cho tóm tắt, danh mục và các màn chi tiết. Không tạo repository mới cho mỗi lần chuyển màn.
- Khi màn dữ liệu được focus, làm mới nếu không có lượt tải đang chạy. Callback không thay đổi theo từng snapshot, tránh vòng lặp tải. Vẫn giữ cơ chế kéo xuống, nút làm mới, foreground và thay đổi queue của các giai đoạn trước.
- Các thẻ truyền danh mục/kỳ/ngày. Adapter kiểm tra danh mục trong danh sách 7 mục, kỳ hợp lệ, ngày hợp lệ và không vượt hôm nay; tham số mảng/sai định dạng dùng kỳ/ngày dự phòng. Danh mục lạ có trạng thái riêng.
- Nút quay lại dùng lịch sử Router; khi không có lịch sử, thay route bằng `/statistics`. Đổi tham số cùng route tạo lại trạng thái bộ lọc đúng đích mới.
- Số liệu chưa tải hiển thị dấu `—`; nguồn rỗng đã tải thành công mới hiển thị 0 hoạt động. Lỗi làm mới giữ dữ liệu cũ cùng nhãn chưa đầy đủ. Logout không giữ số liệu tài khoản cũ.
- Sáng/tối lấy trực tiếp từ theme FitLog. Thẻ và danh mục có nhãn trợ năng, vùng chạm tối thiểu, nội dung co giãn.

## Tệp chính

- `screens/statistics/StatisticsSummaryScreen.tsx`: giao diện tóm tắt, cổng kiểm tra nguồn và callback mở chi tiết.
- `screens/statistics/StatisticsCategoriesScreen.tsx`: danh sách 7 danh mục.
- `screens/statistics/statisticsRoutes.ts`: danh mục, kiểm tra tham số và tạo đích điều hướng.
- `screens/statistics/useStatisticsNavigation.ts`: quay lại/dự phòng và làm mới khi focus.
- `screens/StatsScreen.tsx`: export màn tóm tắt mới, thay bản nháp.
- `src/app/`: các route và layout; khu vực thống kê ở `(tabs)/statistics/`.
- `App.tsx`, `index.ts`, `navigation/RootNavigator.tsx`, `navigation/MainTabs.tsx`, hai màn auth, `app.json`, `package.json`, `package-lock.json`: kết nối shell Router theo quy định dự án.
- `screens/statistics/statistics-navigation.test.mjs`, `test-support/statisticsUiHarness.mjs`: kiểm thử mới và bổ sung safe-area inset cho host kiểm thử.

Các thay đổi của giai đoạn trước trong services, domain và components được giữ lại; giai đoạn này không sửa phép tính domain hoặc luồng ghi dữ liệu chạy bộ.

## Kiểm chứng

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| Bộ tính toán, repository, tích hợp dữ liệu, thành phần, 7 màn và tóm tắt/adapter | **185/185 đạt**, gồm 27 bài mới | `phase6-tests.txt` |
| `npm run lint` | Đạt, mã thoát 0 | `phase6-lint.txt` |
| `npx --no-install tsc --noEmit` | Đạt, mã thoát 0 | `phase6-typecheck.txt` |
| `expo export --platform web` | Đạt | `phase6-web-export.txt` |
| `expo export --platform android` có Hermes | Đạt khi chạy lại ngoài sandbox | `phase6-android-export-retry.txt` |
| `git diff --check` | Đạt; chỉ có thông báo quy đổi LF/CRLF của Git | Kiểm tra terminal |

Bài mới kiểm tra số liệu tóm tắt, mọi thẻ và cả 7 mục, tham số URL sai, mở màn thật từ adapter, đổi tham số, quay lại/dự phòng, dùng chung provider, tránh refresh lặp, lỗi/chờ tải, logout, sáng/tối, tab bar SDK 58 và guard xác thực. Có kiểm thử queue trùng server, tổng giữ nguyên sau đồng bộ và bỏ nhãn chờ đồng bộ.

Lệnh chạy bộ kiểm thử:

```powershell
node --test screens/statistics/statistics-navigation.test.mjs screens/statistics/statistics-screens.test.mjs components/statistics/presentation.test.mjs components/statistics/statistics-ui.test.mjs domain/statistics/statistics.test.mjs services/statisticsRepository.test.mjs services/statisticsData.integration.test.mjs
```

Kiểm thử giao diện dùng React Native Web/JSDOM và SVG web thật. Router/store gốc được thay bằng spy trong bài kiểm thử adapter/guard; kết quả này không tương đương thao tác điều hướng trên thiết bị thật. Metro web và Android kiểm tra tích hợp package thật; Android đã tạo bytecode Hermes, chưa tạo APK/AAB, chưa cài trên máy và chưa kiểm thử iOS. Lần export Android đầu trong sandbox thất bại tại Hermes với mã 6; lần chạy lại ngoài sandbox thành công. Hai log được giữ để đối chiếu.

## Cơ sở dữ liệu giữ nguyên

Không chạy máy chủ, reset/build dữ liệu, migration hoặc API ghi trong quá trình kiểm thử này. SHA-256 sau thực hiện khớp giá trị trước khi làm:

| Tệp | SHA-256 |
| --- | --- |
| `fitlog-server/db.json` | `91EFF17E311D538CD7DBA75587D9F7A04C95C074E2CD7368EDE8EBCB5A25903E` |
| `fitlog-server/db.jsonc` | `E653DC5C07B46C57E5A0809F124EEF574C620AE99E0FC66C1013EFB826C80B92` |
| `fitlog-server/auth.js` | `D4EC286DC71C8B8A428A4B642C6BECAC4770FF062691D68A701BE7D7B272A6B3` |
| `fitlog-server/build-db.js` | `FEFBADF227C47FB1D034DA5BA1C1162BCFCFDD94E7CB5EDB67E9B379C4E13897` |

Giới hạn dữ liệu của các giai đoạn trước tiếp tục áp dụng: không suy đoán quan hệ giữa chạy và lịch, không gán queue cũ thiếu chủ cho tài khoản mới, không bổ sung lịch sử tập bù hoặc mục tiêu chưa có trong dữ liệu.
