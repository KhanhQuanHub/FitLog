# Giai đoạn 2 — Phần tính toán thống kê

Ngày hoàn thành: 05/11/2026. Phạm vi: hàm thuần và kiểm thử; chưa nối API, queue thực tế hoặc giao diện.

## File mới

| File | Nội dung |
| --- | --- |
| `domain/statistics/types.ts` | Kiểu đầu vào đọc từ JSON, kỳ thống kê và chỉ số có thông tin thiếu dữ liệu |
| `domain/statistics/statistics.ts` | Lịch ngày/tuần/tháng/năm, lọc tài khoản, loại trùng chạy, lịch/chuỗi, chạy, cân/BMI, mục tiêu và dữ liệu biểu đồ |
| `domain/statistics/statistics.test.mjs` | 46 ca kiểm thử bằng dữ liệu trong bộ nhớ, dùng Node test runner |

Không cài thư viện, không sửa package/config, helpers cũ, màn hình hoặc điều hướng. Không import Expo/React Native: các phép tính chạy độc lập trên Node và không cần mock native.

## Cách sử dụng ở giai đoạn sau

Entry point được khuyến nghị là `calculateStatistics(input)`. Hàm nhận:

- `userId`: định danh của tài khoản hiện tại, nhận số hoặc chuỗi, phải có giá trị.
- `today`: ngày địa phương hiện tại dạng `YYYY-MM-DD`, do bên gọi cung cấp; tính lại khi ngày thay đổi.
- `kind`: `day`, `week`, `month` hoặc `year`; `anchor`: ngày thuộc kỳ muốn xem.
- `workouts`, `runs`, `profiles`, `weights`, `userGoals`: các mảng dữ liệu đọc thành công.
- `exercises`, `goals`: danh mục tùy chọn; cũng hỗ trợ kết quả expand đúng khóa ngoại của API hiện có.

Kết quả có kiểu `StatisticsReport`, gồm:

| Thuộc tính | Ý nghĩa |
| --- | --- |
| `period` | Hai đầu kỳ và khóa từng cột ngày/tháng |
| `schedule` | Lịch trong kỳ, trạng thái, tổng/giá trị trung bình thời gian và calo, phân bố bài/nhóm cơ |
| `running` | Chỉ số chạy trong kỳ, pace/tốc độ/cadence có trọng số, lịch sử, buổi xa nhất, buổi gần nhất trong kỳ |
| `weight` | Cân gần nhất toàn lịch sử đến hôm nay, nguồn/ngày đo, BMI hiện tại, điểm cân và biến động trong kỳ |
| `targets` | Mục tiêu đang xác định được, tiến độ theo lịch của tuần hiện tại, cân nặng đích và chênh lệch có dấu (hiện tại trừ đích) |
| `habits` | Chuỗi buổi theo lịch toàn lịch sử đến hôm nay; ngày hoạt động/phân bố thứ trong kỳ chọn |
| `series` | Cột ngày hoặc tháng; số liệu chạy và lịch luôn là hai nhóm riêng |
| `today` | Số liệu hôm nay, độc lập với kỳ biểu đồ |
| `weekSchedule` | Số liệu lịch tuần hiện tại |
| `latestRun` | Buổi chạy hoàn thành gần nhất đến hôm nay trên toàn lịch sử đầu vào |
| `quality` | Ngày sai, hồ sơ mơ hồ và số bản chạy thiếu chủ sở hữu bị loại |

Các hàm `calculateSchedule`, `calculateRuns`, `calculateWeight`, `calculateTargets`, `calculateHabits` là phần tính nhỏ hơn: **bên gọi phải lọc quyền sở hữu trước**. `calculateStatistics` đã làm việc đó cho mọi nguồn, kể cả tài khoản admin. `deduplicateStatisticsRuns` lọc tài khoản và ưu tiên bản server so với bản pending cùng `clientId`.

Các mảng không được coi là API response tùy ý: tầng đọc giai đoạn 3 phải kiểm tra cấu trúc response, tách lỗi tải với mảng rỗng thành công. Module này không nhận lỗi mạng và không xác nhận tính đầy đủ của cache/phân trang. Không truyền `[]` thay cho lỗi rồi hiển thị tổng 0 như thể đã tải đủ.

## Quy tắc quan trọng đã thực hiện

- Không có tổng gộp buổi, thời gian hoặc calo giữa lịch và chạy.
- Tổng từ trường số hợp lệ, không ép chuỗi số/null thành giá trị thật. Các metric có `value`, `missingCount`, `complete`.
- Tập rỗng đã tải thành công: tổng 0. Toàn bộ trường cần tính đều thiếu: value null. Có một phần hợp lệ: giữ phần tổng đã biết và `complete=false`.
- Trung bình chỉ trên số đo hợp lệ và giữ cờ thiếu. Không dùng trung bình chưa đầy đủ làm kết quả chắc chắn.
- Không làm tròn thời gian mỗi buổi trước khi cộng. Đơn vị: lịch là phút; chạy là giây; pace là giây/km.
- Pace/tốc độ chỉ dùng cùng tập buổi có thời gian và quãng đường dương. Nhịp bước dùng tập buổi có bước hợp lệ và thời gian dương. Có số lượng buổi bị loại khỏi từng phép tính.
- Chỉ nhận buổi chạy có startedAt/endedAt hợp lệ, có múi giờ và kết thúc không trước bắt đầu; đếm riêng bản ghi chưa đủ điều kiện hoàn thành.
- Giữ nguyên `runs.date` khi phân ngày, kể cả buổi qua nửa đêm. Thời điểm dùng sắp xếp buổi chạy mới nhất theo thời gian thực.
- Ngày nghỉ không ngắt chuỗi; còn chờ không tăng/ngắt; missed ngắt chuỗi. Buổi trạng thái không xác định ngắt phần chuỗi có thể khẳng định và đánh dấu `streakComplete=false`.
- `currentStreak`, `longestStreak` luôn xét toàn lịch sử đầu vào đến hôm nay, không cắt ở biên kỳ biểu đồ. Buổi tương lai không tăng thực tế.
- Phút và số buổi mục tiêu chỉ từ lịch done trong tuần hiện tại. Thiếu phút thực tế thì chưa xuất % hoàn thành phút. Thiếu/mơ hồ mục tiêu thì không tự lấy dòng đầu. Không bịa cam kết.
- Đúng một hồ sơ được dùng; nhiều hồ sơ thì báo mơ hồ. Cân từ lịch sử ưu tiên hồ sơ; không dựa vào số mặc định authStore. BMI thiếu số đo trả null, không kết luận bình thường.
- Cân cùng ngày chọn id lớn nhất làm điểm hiển thị ổn định; cần hai ngày đo trong kỳ để thể hiện biến động. Không nội suy ngày trống.
- Cột Ngày là tổng một ngày, không có cột giờ giả. Cân nặng là điểm đo, không thêm cân 0 cho ngày thiếu.
- Hàm không thay đổi input; đã kiểm thử với dữ liệu đóng băng sâu.

## Giới hạn giữ nguyên

- Không thể phân biệt tập bù chỉ từ trạng thái lịch hiện tại. Kiểm thử chứng minh chạy tự do không nối chuỗi và buổi missed còn được giữ nguyên sẽ ngắt chuỗi; không chứng minh việc người khác sửa missed thành done vẫn bảo toàn lịch sử.
- Queue thiếu userId không được tính như dữ liệu của người đang đăng nhập. Việc xác định chủ từ phiên chạy, cache và trạng thái tải thuộc giai đoạn 3; giai đoạn này chỉ có hàm thuần lọc/loại trùng.
- Mốc thời gian hiện tại chỉ là ngày (`today`); không phân biệt bản ghi chưa tới giờ trong cùng ngày nếu đã bị đánh dấu done. CSDL không có thời điểm hoàn thành lịch để xác minh thêm.
- Dữ liệu trạng thái chưa rõ, bản ghi chạy chưa hoàn thành và nguồn tải thiếu phải được giao diện trình bày cùng thông tin chất lượng; không chỉ lấy `value` rồi bỏ nhãn thiếu.
- Kiểm thử chạy trực tiếp TypeScript bằng Node v24.12.0 có sẵn. Nếu dùng Node cũ không hỗ trợ chạy TypeScript thì cần bước biên dịch hoặc runner phù hợp; chưa thêm dependency chỉ để chạy test.

## Kết quả kiểm tra

| Lệnh/thao tác | Kết quả |
| --- | --- |
| `node --test domain/statistics/statistics.test.mjs` | 46/46 đạt |
| `node utils/runMath.test.js` | 9/9 đạt, bộ tính toán chạy có sẵn |
| `npm run lint` với CI=1 | Đạt |
| `npx --no-install tsc --noEmit` | Đạt |
| Đối chiếu chỉ đọc db.json với tổng đã khảo sát của userId 1 và 2 | Khớp thời gian, buổi, calo, bước và quãng đường của từng nguồn; hôm nay không có hoạt động |

46 ca gồm ngày sai, tháng nhuận, tuần giao năm, lịch qua DST, chuyển kỳ, dữ liệu rỗng, tài khoản khác/thiếu chủ, số âm/NaN/Infinity/null/chuỗi, chỉ số trọng số, missing metrics, queue/server trùng, chạy qua nửa đêm, giờ sai, cân/BMI/mục tiêu, chuỗi lịch, biểu đồ và không sửa input.

Log lần kiểm tra cuối: `phase2-tests.txt`, `phase2-lint.txt`, `phase2-typecheck.txt`. Node có cảnh báo MODULE_TYPELESS_PACKAGE_JSON khi chạy module ES trong dự án chưa khai báo type module; đây không phải lỗi kiểm thử. Không đổi type module toàn dự án vì có thể ảnh hưởng phần server CommonJS.

Không chạy reset/build-db hoặc test server có ghi dữ liệu. Không kiểm tra UI, thiết bị, HTTP hoặc đồng bộ thật trong giai đoạn 2. Tính năng trên màn hình vẫn là bản nháp cho đến các giai đoạn kết nối và giao diện.
