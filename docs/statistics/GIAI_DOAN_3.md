# Giai đoạn 3 — Tầng đọc dữ liệu và ngoại tuyến

Ngày hoàn thành: 05/11/2026. Trạng thái: hoàn thành tầng dữ liệu; chưa thay giao diện bản nháp hoặc bắt đầu giai đoạn 4.

## 1. Thay đổi đã thực hiện

| File | Nội dung |
| --- | --- |
| `services/statisticsRepository.ts` | Repository chỉ đọc, độc lập native; trạng thái từng nguồn; bảo vệ phiên; ghép dữ liệu chạy từ mạng/RAM/cache/queue |
| `services/statisticsData.ts` | Adapter nối API và AsyncStorage hiện có; lọc tài khoản thực tế từ authStore; tạo/hủy đăng ký sự kiện |
| `services/statisticsSession.js` | Định danh và dấu vết chủ buổi chạy trong RAM; không lưu token, không thêm trường vào payload hoặc CSDL |
| `services/api.js` | Thông báo định danh thống kê khi token được khôi phục/lưu/xóa; giữ các hàm API đọc có sẵn trước giai đoạn này |
| `services/runRepository.js` | Sau khi lưu buổi mới vào queue thành công: ghi nhận chủ trong RAM. Phát sự kiện khi queue/cache thay đổi để thống kê làm mới |
| `services/statisticsRepository.test.mjs` | 33 ca kiểm thử tầng đọc, lỗi, phiên và ghép nguồn |
| `services/statisticsData.integration.test.mjs` | 14 ca tích hợp adapter, API client, authStore và luồng lưu/chờ đồng bộ hiện có bằng phụ thuộc giả lập |

Không sửa schema, seed, middleware hoặc dữ liệu server. Không cài thư viện, sửa package/config, thêm route hay thay phần tính toán giai đoạn 2.

## 2. Cách dùng ở giai đoạn màn hình

1. Tạo một instance bằng `createFitLogStatisticsData()` khi chức năng thống kê cần dùng; dùng chung cho các màn liên quan trong cùng vòng đời.
2. Đọc trạng thái bằng `getSnapshot()` và đăng ký thay đổi bằng `subscribe(listener)`.
3. Gọi `refresh()` lần đầu, khi quay lại màn và khi kéo làm mới. Sự kiện queue/cache và đổi phiên cũng làm mới sau lần tải đầu.
4. Hủy đăng ký listener và gọi `dispose()` khi kết thúc vòng đời instance. Dispose ngăn phản hồi đến trễ phục hồi dữ liệu.
5. Khi ngày/kỳ thay đổi, gọi lại hàm tính toán với ngày địa phương mới; không bắt buộc tải lại toàn bộ chỉ để đổi kỳ đã có đủ dữ liệu.

Snapshot gồm `session` và 5 nguồn riêng: `workouts`, `runs`, `profiles`, `weights`, `userGoals`.

| Trường mỗi nguồn | Cách dùng |
| --- | --- |
| `status` | `idle`, `loading`, `success` hoặc `error` |
| `data` | `null`: chưa có dữ liệu dùng được. `[]`: tập rỗng đã tải được hoặc tập lưu cũ đi kèm nhãn stale/error |
| `complete` | Đủ nguồn để tổng hợp chắc chắn hay chưa; false khi lỗi, chỉ có cache hoặc còn bản ghi chưa xác định |
| `stale` | Có dữ liệu lưu cũ/dữ liệu fallback cần ghi rõ trên giao diện |
| `updatedAt` | Lần đọc mạng thành công gần nhất trong instance; cache không có timestamp thì không tự tạo thời điểm cập nhật giả |
| `origin` | Mạng, RAM, cache, queue hoặc kết hợp |
| `error` | Thông báo lỗi đã chuẩn hóa; không đưa nguyên thông tin lỗi nội bộ lên UI |
| `issues` | Ví dụ queue hỏng, cache không đọc được, bản ghi không rõ chủ hoặc thiếu mã nhận diện |

Các nguồn trả kết quả độc lập: lịch lỗi không làm mất dữ liệu chạy, nguồn nhanh không phải đợi nguồn chậm. Khi làm mới lỗi, dữ liệu cũ của đúng phiên được giữ với trạng thái error/stale.

Trước khi gọi phần tính toán giai đoạn 2, UI phải kiểm tra trạng thái theo nguồn. Không chuyển `data=null` thành `[]` rồi hiển thị tổng 0 như đã tải đủ. Với một phần dữ liệu dùng được, có thể tính để trình bày nhưng phải giữ nhãn lỗi/chưa đầy đủ từ nguồn. Các màn phụ thuộc nhiều nguồn (mục tiêu, BMI, thói quen) phải xét đủ các nguồn liên quan.

## 3. API và bảo vệ tài khoản

- Dùng API GET hiện có cho toàn bộ workouts/runs/weightHistory/userGoals; đọc `/profiles` dạng danh sách để không lấy nhầm dòng đầu khi admin nhận nhiều người.
- Không dùng trang lịch sử 20/50 dòng hoặc cache tối đa 60 dòng làm toàn bộ số liệu năm. Có kiểm thử response 125 buổi không bị cắt.
- Lọc `userId` tại tầng thống kê cho cả user và admin, chuẩn hóa kiểu số/chuỗi.
- Snapshot gắn với userId và revision phiên. Logout/đổi phiên xóa ngay snapshot và dữ liệu RAM của thống kê.
- Phản hồi mạng hoặc storage từ phiên cũ/yêu cầu cũ bị bỏ qua. Logout rồi login cùng userId vẫn là phiên mới.
- Không cần lưu token trong module thống kê. Token tiếp tục theo cơ chế SecureStore hiện có.
- Adapter chỉ đọc dữ liệu; không gọi sync, POST, PATCH, reset hay ghi/xóa queue/cache từ một thao tác tải thống kê. Các sự kiện thêm vào luồng lưu chạy chỉ quan sát thao tác vốn có.

Đã đọc tài liệu [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) và [SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/) trước khi thêm thông báo phiên cạnh luồng token hiện có; không thay cách lưu token hoặc API native.

## 4. Quy tắc ngoại tuyến và chống trùng

- Buổi queue có userId đúng được nhận. Nếu thiếu userId, chỉ nhận khi chính phiên hiện tại đã lưu buổi mới đó thành công và có dấu vết clientId trong RAM.
- Không nhận lại chủ cho một clientId đã tồn tại sẵn trong queue cũ. Dấu vết không hợp lệ nếu đổi phiên trong khi thao tác ghi queue đang chờ.
- Payload queue và dữ liệu gửi server giữ nguyên, không được tự gắn userId hoặc trường mới vào bản lưu thật. Bản sao dùng để tính có thể gắn định danh đã xác minh.
- Buổi queue chưa rõ chủ bị loại khỏi số cá nhân và có issue `unknown-owners:N`. Không xóa queue cũ, không tự đồng bộ để suy đoán chủ.
- Khi mạng còn chờ, queue/cache tin cậy được công bố trước với status loading, complete=false. Không phải đợi timeout mạng mới thấy hoạt động đã lưu trên máy.
- Mạng thành công: bản server là nguồn chính, ghép queue hợp lệ. Không đưa cache cũ trở lại khi response mới đã đọc được, kể cả response rỗng.
- Mạng thất bại: dùng bản đã lưu trên server trong RAM, cache đúng chủ, rồi queue đúng chủ; luôn đánh dấu chưa đầy đủ/error/stale.
- Ghép theo cả `(userId, clientId)` và `(userId, id)`; hợp các bí danh bắc cầu trước khi chọn bản ưu tiên. Server thắng queue, một buổi chỉ còn một bản.
- Hai buổi khác mã cùng ngày/giờ không bị gộp bằng phỏng đoán. Bản không có cả clientId và id bị loại và báo issue.
- Có bản server cùng buổi thì bỏ nhãn `_queued`, dù queue chưa kịp xóa. Sau đồng bộ, số buổi, thời gian và calo không tăng lần nữa.
- Queue JSON/storage lỗi được báo riêng; không nuốt lỗi thành []. Có thể giữ pending từ RAM với nhãn stale trong khi chờ đọc lại.

## 5. Kiểm thử đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `node --test services/statisticsRepository.test.mjs services/statisticsData.integration.test.mjs domain/statistics/statistics.test.mjs` | **93/93 đạt**: 33 tầng dữ liệu + 14 tích hợp + 46 tính toán giai đoạn 2 |
| `node utils/runMath.test.js` | **9/9 đạt**, bộ tính toán chạy có sẵn |
| `npm run lint` (CI=1) | **Đạt**, không có chẩn đoán lint |
| `npx --no-install tsc --noEmit` | **Đạt**, không có lỗi kiểu |
| `git diff --check` | **Đạt** |

Các tình huống quan trọng: mất mạng, API 401/403/408/5xx, response sai, JSON hỏng, khác tài khoản, logout, refresh đồng thời, API/storage đến trễ, queue mới thiếu userId nhưng có chủ phiên, queue cũ chưa rõ chủ, cache thiếu chủ, mạng chậm nhưng local có sẵn, trùng server/queue/cache và nhận diện bắc cầu.

Đã chạy chính các hàm `finishAndSaveRun()` và `syncQueuedRuns()` với dịch vụ giả lập trong RAM: offline → queued → sync thành công giữ nguyên tổng; server giả lập đã lưu nhưng mất phản hồi vẫn chỉ tính một buổi. Cũng kiểm tra đổi người khi ghi queue đang chờ không gán buổi của phiên cũ cho người mới.

Log: `phase3-tests.txt`, `phase3-runMath.txt`, `phase3-lint.txt`, `phase3-typecheck.txt`. Node vẫn có cảnh báo MODULE_TYPELESS_PACKAGE_JSON do cấu hình module hiện tại; không đổi type module toàn dự án chỉ để bỏ cảnh báo.

Đối chiếu SHA-256 cuối giai đoạn khớp các giá trị trong báo cáo giai đoạn 1 cho cả `fitlog-server/db.json`, `db.jsonc`, `auth.js`, `build-db.js`. Cơ sở dữ liệu và các file server đó không thay đổi.

## 6. Giới hạn còn lại

- Dấu vết chủ queue chỉ ở RAM; mất sau khởi động lại/logout. Queue cũ thiếu userId tiếp tục chưa thể thống kê chính xác theo tài khoản cho đến khi có bản server xác định chủ. Không sửa CSDL để vượt giới hạn này.
- Cache lịch sử chạy có thể thiếu và không có ngày cập nhật; không trình bày thành toàn bộ lịch sử. Dữ liệu các bảng khác chỉ giữ trong RAM của instance, chưa tạo cache bền vững mới.
- Đây là kiểm thử tự động với native storage và fetch được giả lập. Có chạy mã API client, adapter, authStore và run repository thật, nhưng chưa kiểm tra mạng HTTP thật, thiết bị hoặc đồng bộ với server thật. Không chạy script test server dựng lại db.json.
- Tính idempotent của server trong ca mất phản hồi là giả định theo logic hiện có, không phải một lần kiểm chứng server thật trong giai đoạn này.
- Chỉ phát hiện lỗi/giữ trạng thái ở tầng dữ liệu; các nhãn lỗi, chờ đồng bộ và nút thử lại sẽ được hiển thị trong giai đoạn giao diện.
- Chạy và lịch tập vẫn là hai nguồn thống kê riêng theo đặc tả đã chốt; không tạo tổng buổi/calo/thời gian chung giữa hai bảng.
