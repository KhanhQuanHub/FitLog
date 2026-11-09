# Giai đoạn 7 — Kiểm thử tổng thể và sửa lỗi thống kê

Ngày thực hiện: 05/11/2026. Phạm vi theo kế hoạch ở giai đoạn 1: kiểm thử tích hợp/giao diện, lint, TypeScript, xuất ứng dụng và báo giới hạn thiết bị. **Không thay đổi cơ sở dữ liệu.**

## Kết quả cuối

| Kiểm tra đã chạy | Kết quả | Bằng chứng |
| --- | --- | --- |
| `npm run test:statistics` | **194/194 đạt** | `phase7-tests.txt` |
| `node utils/runMath.test.js` | **9/9 đạt** | `phase7-runMath.txt` |
| `npm run test:statistics:browser` | **20/20 kịch bản đạt** trên Chrome headless, bundle web thật | `phase7-browser.txt`, `phase7-browser-result.json` |
| `npm run lint` | Đạt, mã thoát 0 | `phase7-lint.txt` |
| `npx --no-install tsc --noEmit` | Đạt, mã thoát 0 | `phase7-typecheck.txt` |
| `expo export --platform all --max-workers 2` | Web, Android và iOS đạt; hai nền tảng native tạo được bytecode Hermes | `phase7-export.txt` |
| `git diff --check` | Đạt | Terminal; Git chỉ nhắc quy đổi LF/CRLF |
| Mã băm CSDL/mã server | **4/4 giữ nguyên** | `phase7-database-hashes.json` |

## Ba lỗi đã tái hiện và sửa

### 1. Phần trăm mục tiêu dùng cam kết cũ khi đang tải lại

Khi lịch tập tải xong trước mục tiêu/hồ sơ, màn chuyên sâu vẫn hiện 20% và 25% từ các cam kết cũ, dù các nguồn cam kết còn ở trạng thái loading/stale. Trang tóm tắt đã có cổng kiểm tra chặt hơn nên hai màn không nhất quán.

- Thêm `isStatisticsSourceCurrent()` trong `viewModel.ts`, yêu cầu nguồn có dữ liệu, tải thành công, đầy đủ và không stale.
- Màn mục tiêu chỉ tính phần trăm khi nguồn cam kết tương ứng đã xác nhận. Trong lúc chờ, vẫn giữ phần kết quả lịch đã đọc được nhưng ẩn phần trăm và không coi cam kết cũ là cam kết hiện tại.
- Kiểm thử cho lịch trả về trước, mục tiêu/hồ sơ trả về sau; xác nhận phần trăm tạm thời không xuất hiện, sau đó cập nhật đúng 10% và 50% khi cam kết mới về.

### 2. Bấm buổi chạy có thể mở nhầm bản ghi do trùng chuỗi mã

Buổi có `clientId="id:1"` và buổi khác chỉ có `id=1` từng tạo cùng một khóa UI. Hai buổi vẫn được cộng đúng, nhưng bấm dòng 5 km có thể mở chi tiết dòng 2 km.

- Tách namespace của khóa client và khóa server bằng tuple JSON trong `RunningStatisticsScreen.tsx`.
- Không thay đổi mã bản ghi, payload, cách ghi chạy bộ hoặc quy tắc ghép offline.
- Kiểm thử xác nhận bấm dòng 5 km mở modal đúng 5 km.

### 3. Lịch hoạt động coi nguồn có trạng thái lạ là đầy đủ

Một buổi có trạng thái chưa xác định khiến chuỗi được báo thiếu thông tin, nhưng lịch ngày vẫn ghi như đã xác nhận không có hoạt động.

- `activityComplete` nay xét cả số buổi chưa xác định trong kỳ.
- Ngày chưa có bằng chứng hoạt động được ghi “Chưa đủ dữ liệu để xác định”; các hoạt động đã xác định vẫn được giữ.
- Kiểm thử ngày 03/11 với trạng thái `unknown` xác nhận nhãn và cờ chưa đầy đủ.

Các bài hồi quy đã được chạy trước khi sửa và thất bại đúng lỗi dự kiến. Log đối chiếu: `phase7-regressions-before.txt`, `phase7-regressions-after.txt`, `phase7-calendar-before.txt`. Kết quả cuối cho cả ba nằm trong bộ 194 bài đạt.

## Phạm vi kiểm thử

### Tính toán, tầng đọc và dữ liệu hiện có

- Giữ toàn bộ 185 bài của các giai đoạn trước: lọc kỳ, thứ Hai đầu tuần, ngày địa phương, phút/kcal/buổi, pace có trọng số, cân/BMI, mục tiêu, chuỗi, thiếu nguồn, lỗi mạng và phân quyền.
- Thêm 3 bài hồi quy cho các lỗi trên.
- Thêm 6 trường hợp đối chiếu với dữ liệu hiện có của 6 tài khoản, bao gồm tài khoản chưa có hoạt động/hồ sơ/mục tiêu.
- `services/statisticsDatabase.audit.test.mjs` chỉ đọc `fitlog-server/db.json` vào bộ nhớ. Với các mốc ngày đang có và ngày 05/11/2026, đối chiếu tổng ngày/tuần/tháng/năm, tổng các cột biểu đồ, số ngày hoạt động, lọc chủ sở hữu và trường hợp queue lặp bản server.
- Kiểm tra đầu vào trong bộ nhớ và mã băm tệp không bị thay đổi. Không log tên, email, mật khẩu hoặc token trong dữ liệu thật.
- Bộ tích hợp hiện có tiếp tục kiểm tra adapter thật qua fetch/storage giả lập: chỉ GET và đọc storage cho thống kê, không POST/PATCH/sync dữ liệu; logout/đổi tài khoản không nhận phản hồi cũ; queue thiếu chủ không bị gán nhầm; server thắng queue trùng; tổng không tăng sau đồng bộ.

### Trình duyệt với Router thật

`test-support/statistics-browser-smoke.mjs` chạy Chrome headless bằng profile riêng trong `.expo/`, serve bundle đã xuất trên cổng loopback ngẫu nhiên và thay fetch API bằng fixture trong trang. Không khởi động server dự án, không dùng tài khoản thật và không gọi API thật.

20 kịch bản kiểm tra:

- Đăng nhập qua form thật với phản hồi đăng nhập giả lập; shell ứng dụng và Expo Router chạy thật.
- Tóm tắt có 1 buổi, 30 phút, 200 kcal theo lịch và 3 km chạy riêng.
- Bảy thẻ mở đúng màn; đổi Ngày/Tuần/Tháng/Năm; quay lại tóm tắt.
- Bảy mục trong màn danh mục mở đúng màn chuyên sâu; quay lại danh mục.
- Mở/đóng modal buổi chạy.
- Kiểm tra không tràn chiều ngang toàn trang ở chiều rộng 320px và 390px cho các màn chuyên sâu; tóm tắt được kiểm tra ở 390px.
- Đổi theme hệ thống sáng → tối, trang tóm tắt cập nhật theo FitLog.
- Mất mạng và thêm queue có chủ vào storage của profile kiểm thử: 3 + 4 = 7 km; khi server giả lập nhận buổi mới và queue rỗng, tổng vẫn 7 km, nhãn chờ đồng bộ biến mất.
- HTTP 401 đưa về đăng nhập; browser back không phục hồi trang thống kê riêng tư.
- Không có exception runtime và không có API ghi dữ liệu thống kê. POST duy nhất được cho phép là đăng nhập giả lập; không yêu cầu API nào được gửi tới máy chủ thật.

Ảnh đã xem để kiểm tra bố cục: `phase7-summary-light.png`, `phase7-summary-dark.png`, `phase7-detail-running.png`, `phase7-detail-habits.png`. Ảnh của đủ 7 màn nằm ở `phase7-detail-*.png`. Tất cả dùng dữ liệu QA minh họa, không phải ảnh dữ liệu tài khoản thật.

## Tệp thay đổi trong giai đoạn này

- `screens/statistics/viewModel.ts`: cổng xác nhận nguồn hiện tại, cờ đầy đủ cho lịch hoạt động.
- `screens/statistics/GoalsStatisticsScreen.tsx`: kiểm tra nguồn cam kết trước khi tính tiến độ.
- `screens/statistics/RunningStatisticsScreen.tsx`: khóa chọn buổi chạy không xung đột.
- `screens/statistics/statistics-screens.test.mjs`: ba kiểm thử hồi quy.
- `services/statisticsDatabase.audit.test.mjs`: đối chiếu dữ liệu hiện có theo tài khoản/kỳ, chỉ đọc.
- `test-support/statistics-browser-smoke.mjs`: kiểm thử bản web thật, fixture API, ảnh và kết quả JSON.
- `package.json`: thêm hai lệnh kiểm thử có thể chạy lại; không thêm hoặc nâng dependency trong giai đoạn 7.
- `docs/statistics/phase7-*`, báo cáo này: log và bằng chứng QA.

Không sửa domain tính toán, API ghi, luồng chạy bộ, migration, schema hoặc tệp server trong giai đoạn này. Các thay đổi chưa commit của giai đoạn trước được giữ lại.

## Chạy lại

Sử dụng Node 24 như môi trường đã kiểm tra; bài kiểm thử Node dùng `registerHooks`, script trình duyệt dùng WebSocket có sẵn. Script mặc định tìm Chrome tại đường dẫn Windows phổ biến; đặt `FITLOG_QA_BROWSER` nếu cần dùng Chromium/Edge ở đường dẫn khác.

```powershell
npm run test:statistics
node utils/runMath.test.js
npm run lint
npx --no-install tsc --noEmit
npx --no-install expo export --platform all --max-workers 2 --output-dir .expo/statistics-phase7-export
npm run test:statistics:browser
```

`FITLOG_QA_WEB_DIR` cho phép chọn thư mục bundle web khác. Browser/profile đều riêng biệt; script không mở profile trình duyệt của người dùng. Ở môi trường sandbox Windows hiện tại, bước Hermes và chạy Chrome được thực hiện ngoài sandbox sau khi được cơ chế phê duyệt cho phép.

## Giới hạn kiểm chứng

- Bản web được chạy trên Chrome thật với API giả lập; chưa kiểm thử backend thật, máy chủ production hoặc thao tác với tài khoản thật.
- Xuất bundle Android/iOS và bytecode Hermes **không phải** build/cài APK, AAB hoặc IPA. Chưa chạy ứng dụng native trên điện thoại, emulator/simulator, kiểm tra TalkBack/VoiceOver hoặc chữ phóng lớn của hệ điều hành.
- Kiểm thử browser thực hiện hành động DOM và kiểm tra bố cục, không thay cho kiểm tra cử chỉ chạm, nút Back phần cứng và hiệu năng trên thiết bị thật.
- Chưa kiểm tra Safari/Firefox. Không đưa ra kết luận đã đạt các nền tảng hoặc thiết bị chưa chạy.

## Bảo toàn cơ sở dữ liệu

Mã băm SHA-256 trước/sau khớp:

| Tệp | SHA-256 |
| --- | --- |
| `fitlog-server/db.json` | `91EFF17E311D538CD7DBA75587D9F7A04C95C074E2CD7368EDE8EBCB5A25903E` |
| `fitlog-server/db.jsonc` | `E653DC5C07B46C57E5A0809F124EEF574C620AE99E0FC66C1013EFB826C80B92` |
| `fitlog-server/auth.js` | `D4EC286DC71C8B8A428A4B642C6BECAC4770FF062691D68A701BE7D7B272A6B3` |
| `fitlog-server/build-db.js` | `FEFBADF227C47FB1D034DA5BA1C1162BCFCFDD94E7CB5EDB67E9B379C4E13897` |

Không chạy `server:reset`, `build-db`, script kiểm thử server dựng lại DB hoặc migration.
