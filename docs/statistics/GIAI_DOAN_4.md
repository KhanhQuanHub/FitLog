# Giai đoạn 4 — Thành phần giao diện thống kê

Ngày hoàn thành: 05/11/2026. Phạm vi: bộ thành phần dùng chung; chưa lắp ráp 7 màn chuyên sâu, chưa thay màn tóm tắt bản nháp.

## 1. Các thành phần mới

Toàn bộ mã mới nằm trong `components/statistics/`, ngoài thư mục route.

| File | Thành phần/chức năng |
| --- | --- |
| `StatisticsPeriodPicker.tsx` | Chọn Ngày/Tuần/Tháng/Năm, kỳ trước/sau, về kỳ hiện tại; trạng thái selected/disabled |
| `StatisticsMetricCard.tsx` | Thẻ chỉ số bấm mở chi tiết, giá trị/đơn vị, nhãn kỳ và dữ liệu thiếu; tái sử dụng Card hiện có |
| `StatisticsProgress.tsx` | Vòng và thanh tiến độ; giữ % vượt cam kết, phần tô tối đa 100%; thiếu cam kết không tạo % giả |
| `StatisticsChart.tsx` | Biểu đồ cột và đường dùng react-native-svg đã có; chọn từng mốc; cuộn ngang khi nhiều mốc |
| `StatisticsActivityRow.tsx` | Hàng hoạt động, ngày, thông số, trạng thái, nhãn chờ đồng bộ và callback mở chi tiết |
| `StatisticsStatus.tsx` | Badge, trạng thái chưa tải/đang tải/trống/lỗi, nút thử lại, cảnh báo dữ liệu lưu cũ/chưa đầy đủ |
| `presentation.ts` | Định dạng số tiếng Việt, thời lượng, pace; chuyển metric thành nội dung hiển thị và tính tọa độ biểu đồ |
| `index.ts` | Điểm export các thành phần và kiểu props dùng cho giai đoạn màn hình |

Không cài dependency, không sửa package/config, store theme, API hoặc cơ sở dữ liệu. Không thêm màn hình/route ở giai đoạn này.

## 2. Sáng/tối và bố cục

- Màu lấy từ `useTheme()` và token của FitLog: nền, thẻ, chữ, viền, trạng thái và đường biểu đồ. Các component TSX mới không ghi cứng mã màu.
- Font/khoảng cách/bo góc dùng `constants/theme.ts`; không dùng bảng màu Apple Fitness thay hệ màu dự án.
- Thẻ có phần số/đơn vị được xuống dòng khi cần; không cắt giá trị số bằng ellipsis.
- Vòng tiến độ và mô tả có thể wrap khi không đủ chiều ngang.
- Các nút bấm có vùng chạm tối thiểu 44 × 44; mốc biểu đồ có vùng bấm ngang 44. Biểu đồ nhiều ngày tăng chiều rộng và cuộn ngang, không ép 31 cột vào một hàng quá nhỏ.
- Trục dọc giữ bên ngoài phần cuộn; nhãn trục ngang có thể rút gọn bằng `axisLabel`, còn nhãn đầy đủ luôn có ở vùng đọc/chọn mốc.
- Vẫn cần kiểm tra trên thiết bị thực với cỡ chữ hệ thống lớn và VoiceOver/TalkBack trong giai đoạn nghiệm thu; chưa khẳng định đã kiểm tra các môi trường đó.

## 3. Hợp đồng dữ liệu cho giai đoạn 5

### Thẻ và tiến độ

- Truyền `StatisticsMetric` từ phần tính toán giai đoạn 2; `null` nghĩa là chưa có dữ liệu dùng được.
- Số 0 hợp lệ được giữ nguyên. Metric thiếu trường không bị đổi thành 0; phần số liệu hợp lệ nhưng `complete=false` có nhãn chưa đầy đủ.
- Truyền kỳ hiển thị bằng `periodLabel`, không tự gọi API hoặc tự lấy ngày cũ thay hôm nay.
- Vòng tiến độ nhận `actual` và `target`; target thiếu/không dương hoặc số liệu chưa đủ thì không có %.
- Ví dụ 180/150 phút hiển thị 120%, vòng/thanh chỉ tô đầy một lần. Nội dung đọc màn hình vẫn mô tả % thực tế.
- `unitLabel` cho phép dùng cùng phần định dạng với các đơn vị như bước hoặc buổi mà không gắn nhầm đơn vị mặc định.

### Biểu đồ

`StatisticsChartPoint`: `key` duy nhất, `label` đầy đủ, `axisLabel` tùy chọn, `value` là số hoặc null, `complete` tùy chọn, `position` tùy chọn.

- Bên gọi chọn và lọc kỳ bằng phần tính toán giai đoạn 2; biểu đồ không tự cộng chạy với lịch.
- `position` là tọa độ thời gian, chẳng hạn số ngày từ đầu kỳ. Khi vẽ cân nặng, truyền tọa độ ngày thực để lần cân ngày 1, 2, 31 không bị chia đều khoảng cách.
- Biểu đồ đường nối các số đo đã ghi nhận; không tạo thêm số đo cho các ngày vắng. Nếu có một mốc được truyền rõ là null thì ngắt đường tại mốc đó.
- Một lần cân vẫn hiển thị một điểm. Cột bằng 0 có chiều cao 0, không dựng một cột dương cho đẹp.
- Dữ liệu toàn thiếu hoặc không hợp lệ hiển thị thông báo chưa có số liệu hợp lệ; không vẽ biểu đồ mẫu.
- Nhận callback `onSelect` để màn sau có thể hiển thị thêm chi tiết. Mỗi mốc có nhãn số liệu và trạng thái selected cho trợ năng.
- Bình thường tự đo bằng onLayout; `width` chỉ dùng khi cha biết chính xác kích thước. Không truyền chiều rộng toàn màn hình nếu biểu đồ nằm trong thẻ có padding.
- Không có chế độ dựng bước theo giờ. Số điểm/cột chỉ từ dữ liệu bên gọi đã chuẩn bị.

### Định dạng

- Số dùng định dạng vi-VN: 12.345 bước, 3,25 km.
- `seconds` là giây, hiển thị giờ:phút:giây; trục dọc biểu đồ thời lượng có ghi rõ quy đổi sang phút.
- `pace` nhận giây/km và hiển thị phút:giây/km; không dùng nhầm helper phút/km của phần chạy hiện có.
- Giá trị âm/NaN/Infinity/thiếu hiển thị dấu gạch, không ép thành 0.

### Trạng thái nguồn

- `StatisticsSourceContent` chặn children khi data=null, phân biệt chưa tải/đang tải/lỗi/trống.
- Nếu có dữ liệu cũ thì giữ children, kèm cảnh báo stale/lỗi và thử lại khi phù hợp. Không thay lỗi tải bằng kết luận chưa có hoạt động.
- `StatisticsSourceNotice` hiển thị số buổi chờ đồng bộ, thời điểm cập nhật server và giải thích issue bằng tiếng Việt. Không hiển thị mã kỹ thuật như `unknown-owners:1` cho người dùng.
- Với lỗi xác thực không cho thử lại một cách mù quáng; việc đăng nhập lại thuộc luồng auth hiện có.
- UI màn hình ở giai đoạn 5 phải giữ cờ chất lượng nguồn từ giai đoạn 3, không chỉ lấy metric.value rồi bỏ nhãn thiếu.

## 4. Kiểm thử và kết quả

| Kiểm tra | Kết quả |
| --- | --- |
| Bộ kiểm thử giai đoạn 4 | 25/25 đạt: 12 định dạng/tọa độ và 13 thành phần/tương tác/xuất preview |
| Chạy cùng 93 ca tính toán và tầng dữ liệu trước đó | **118/118 đạt** |
| `npm run lint` với CI=1 | Đạt |
| `npx --no-install tsc --noEmit` | Đạt |
| Đối chiếu SHA-256 database và file server | Khớp giai đoạn 1, không thay đổi |

Lệnh kiểm thử đầy đủ:

```powershell
$env:FITLOG_STATS_PREVIEW='1'
node --test components/statistics/presentation.test.mjs components/statistics/statistics-ui.test.mjs domain/statistics/statistics.test.mjs services/statisticsRepository.test.mjs services/statisticsData.integration.test.mjs
```

Test UI render component React Native thật qua React Native Web/SVG web trong JSDOM, dùng theme store thật. Chỉ giả lập storage/haptics và ResizeObserver (JSDOM không đo layout; các test chart truyền width rõ ràng). TSX được chuyển bằng Babel đã có trong dự án; không cài test runner mới.

Đã kiểm tra callback bấm thẻ, chọn tab, nút bị khóa, chọn mốc, cập nhật palette khi theme đổi, đơn vị, % vượt mục tiêu, nhãn thiếu dữ liệu, giữ dữ liệu cũ, không biến lỗi thành 0 và badge chờ đồng bộ. Test phát hiện và đã sửa việc React Native Web không tự chuyển đủ accessibilityState/accessibilityValue sang ARIA; các thành phần mới có thuộc tính phù hợp cho cả native và web.

Log: `phase4-tests.txt`, `phase4-lint.txt`, `phase4-typecheck.txt`. Node có cảnh báo MODULE_TYPELESS_PACKAGE_JSON của cấu hình dự án hiện tại; không đổi cấu hình module để bỏ cảnh báo.

## 5. Bản xem trước và giới hạn xác minh

- `phase4-light.html` và `phase4-dark.html` được xuất từ các thành phần thật, gallery rộng 320 px, dùng dữ liệu minh họa ghi rõ trên đầu trang. Không kết nối CSDL/API.
- Đây là HTML tĩnh phục vụ xem bố cục; các callback React không hoạt động trong file tĩnh. Tương tác được kiểm tra riêng trong test UI, không nên coi HTML tĩnh là một màn ứng dụng đã hoàn chỉnh.
- Đã thử chụp Chrome/Edge headless, nhưng không tạo được ảnh; Edge lỗi khởi động trong môi trường hiện tại. Trình duyệt tích hợp cũng không kết nối được localhost của server preview. Vì vậy **chưa xác minh trực quan bằng screenshot**, không tuyên bố đã kiểm tra pixel hoặc toàn bộ overflow bằng trình duyệt.
- Đã dừng server preview sau khi thử. Không chạy/reset database để kiểm tra giao diện.
- Chưa kiểm tra trên Android/iOS thật, chưa build/export ứng dụng; việc tích hợp với 7 màn chuyên sâu và kiểm tra native tiếp tục ở các giai đoạn sau.

## 6. Tài liệu kỹ thuật đã đối chiếu

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) và [chỉ mục Expo](https://docs.expo.dev/llms.txt).
- [react-native-svg cho SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/svg/).
- [React Native Pressable](https://reactnative.dev/docs/pressable), [View](https://reactnative.dev/docs/view), [Accessibility](https://reactnative.dev/docs/accessibility), cùng kiểu dữ liệu và mã nguồn của phiên bản đã cài trong dự án. Các URL `/docs/0.88/...` không đọc được qua công cụ nên đã dùng trang chính thức hiện tại và kiểm tra TypeScript với bản cài đặt.
