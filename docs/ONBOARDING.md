# Thiết lập lần đầu và chọn vùng cơ

## Luồng sử dụng

Sau đăng nhập/đăng ký, tài khoản chưa có `trainingSetup` hợp lệ sẽ vào thiết lập:

1. Nhập tuổi, chiều cao, cân nặng, giới tính; chọn nhiều bệnh nền; chọn kinh nghiệm, số buổi và thời gian dự kiến.
2. Khảo sát **8 câu chọn nhiều ý**: mục tiêu, vùng ưu tiên, hoạt động hằng ngày, kiểu tập thích, nơi tập, dụng cụ, mức độ muốn bắt đầu và trở ngại. Mỗi câu cần ít nhất một ý. Tất cả đều có **Không biết** dành cho người chưa rõ hoặc chưa muốn trả lời cụ thể. Chọn mục này sẽ bỏ các ý cụ thể trong cùng câu; chọn một ý cụ thể sẽ bỏ Không biết. Đi lần lượt bằng nút **Câu tiếp theo** ngay dưới đáp án, quay lại bằng **Câu trước**. Thanh phía trên chỉ báo tiến độ, không bấm để nhảy câu. Chỉ câu 8 mới hiện **Xem vùng tập**, và phải đủ lựa chọn ở cả 8 câu mới dùng được. Áp dụng cả khi mở lại hồ sơ đã trả lời đủ.
3. Hệ thống chọn sẵn vùng tập trên hai hình trước/sau. Màu nổi bật là vùng ưu tiên, màu xanh nhạt hơn là nhóm hỗ trợ. Mặc định chỉ xem đề xuất; mục **Nâng cao: tùy chỉnh vùng cơ** được thu gọn. Mở mục này mới hiện checkbox, bật bấm trực tiếp trên hình, cho phép bỏ chọn hoặc khôi phục đề xuất.
4. Xem các bài gợi ý, quay lại nếu cần và xác nhận. Chỉ chuyển vào Hôm nay khi server lưu thành công.

Mở **Hồ sơ → Chỉnh sửa** để sửa. Hủy sẽ giữ hồ sơ cũ. Cũng có lối mở từ Hôm nay. Các tài khoản cũ chưa thiết lập sẽ được hỏi trong lần đăng nhập kế tiếp.

## Hiển thị gọn

Khảo sát chỉ hiện tiêu đề, đáp án ngắn và nút điều hướng bên dưới. Câu hiện tại cùng thanh tiến độ nằm trên câu hỏi, không có nút nhảy câu ở đầu trang. Checkbox chọn nhiều, Không biết và yêu cầu ít nhất một ý mỗi câu giữ nguyên. Các chỉ số tuổi/cao/nặng nằm cùng hàng khi đủ chỗ.

Danh sách bài tập mặc định hiện 4 bài. Mở một bài để xem hướng dẫn, hoặc bấm Xem thêm để hiện toàn bộ. Lý do đề xuất, ghi chú và chỉ số đầy đủ nằm trong mục Chi tiết mặc định thu gọn. Hồ sơ cũng thu gọn các câu trả lời đã lưu. Nhãn hiển thị và nút được rút ngắn; ID dữ liệu và luật đề xuất không đổi.

## Áp dụng nội dung bài giảng

- **LectureNotes-Chapter3-Hook In React Native.pdf:** `useState` giữ form, bước hiện tại, loading/error; `useRef` cuộn lên đầu và ngăn gửi trùng; `useContext` chia sẻ hồ sơ qua `TrainingProvider`.
- **Chuong5_Navigation.pptx**, slide 6–8, 13, 15, 17: Native Stack, nested Tab/Stack, `useNavigation`, điều hướng có điều kiện. Khi hồ sơ được xác nhận, nhánh Onboarding được thay bằng Main; người dùng không quay lại onboarding bằng nút Back.
- **LectureNotesChapter4-APIs, Asynchronous Data.md.pdf**, trang 1–3: sử dụng tầng Fetch API hiện có, `async/await`, `GET`, `POST`/`PATCH`, `try/catch/finally` và hiển thị lỗi cùng nút thử lại.
- **Chuong6_StateManagement_Recoil.pptx**, slide 8–13: phân biệt dữ liệu gốc và dữ liệu dẫn xuất. Chỉ lưu thông tin và vùng cơ; danh sách bài tập được tính lại từ chúng. Context đủ cho phần state nhỏ này; không cần thêm Recoil. Zustand xác thực/giao diện của project được giữ để tương thích.
- **Bổ sung ngoài bài giảng:** `react-native-svg` có sẵn trong project dùng để vẽ và nhận chạm trên vùng cơ. Checkbox bên dưới cung cấp thao tác tương đương bằng bàn phím/trình đọc màn hình. Không cài thư viện mới.

## Dữ liệu và các nhánh gợi ý

`domain/training.ts` chứa danh mục nhỏ và hàm thuần `choosePlan`: 13 kết quả `if/else` gồm toàn thân, ngực-bụng-lưng, ngực-lưng, ngực-bụng, bụng-lưng, chân-mông, ngực, lưng, bụng, vai-tay, vai, tay, cổ. Tên kế hoạch dựa trên các phần cơ thể lớn; bài tập vẫn lấy theo từng nhóm chi tiết đã chọn. Tình trạng sức khỏe/tuổi được dùng để chuyển sang các biến thể nhẹ của bản demo; kinh nghiệm và thời gian điều chỉnh số hiệp/lần.

`suggestMuscles` dùng `if/else` từ câu trả lời để tạo đề xuất, luôn giữ các nhóm lớn ở thân trên, thân giữa và chân. Ví dụ ưu tiên bụng chỉ làm nổi bật bụng/bụng bên/lưng dưới và đưa các bài này lên trước; không tự loại ngực, tay, lưng và chân. Nguyên tắc giữ nhiều nhóm lớn tham khảo [CDC – Adult Activity](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html); các tổ hợp cụ thể là luật minh họa của ứng dụng, chưa được kiểm chứng là chương trình tối ưu cho từng cá nhân.

Nhiều mục tiêu/vùng được gộp lại, không chỉ lấy ý đầu tiên. Chọn đồng thời giảm cân và tăng cân vẫn hợp lệ; hệ thống giải thích rằng đang đề xuất nền tảng vận động, không tự gán một mục tiêu thay đổi cân nặng. Nếu cả 8 câu đều Không biết, vẫn có đề xuất toàn thân ở mức nhẹ và không đòi hỏi ghế/tường. Mức nhẹ, giãn cơ hoặc chưa biết kỹ thuật sẽ ưu tiên động tác nhẹ; ít thời gian giảm số lần mỗi hiệp; dụng cụ được dùng để lọc các bài cần ghế/tường. Nơi tập, hoạt động hằng ngày và trở ngại được phản ánh trong ghi chú kế hoạch. Các động tác co cơ đùi nhẹ khi nằm tham khảo [CUH – Early knee exercises](https://www.cuh.nhs.uk/patient-information/early-knee-exercises/); gợi ý trong ứng dụng không phải phác đồ phục hồi chức năng.

Khi mở Nâng cao, người dùng được tự chọn vùng, kể cả chọn ít hơn đề xuất. Thu gọn rồi mở lại giữ nguyên checkbox. Quay lại câu hỏi và giữ nguyên câu trả lời sẽ giữ tùy chỉnh; đổi một câu trả lời sẽ tạo lại vùng đề xuất và thu gọn Nâng cao. Có nút khôi phục vùng đề xuất. Không thể tiếp tục nếu bỏ chọn toàn bộ.

Sơ đồ trước/sau hiện có **17 nhóm chính**: ngực, bụng, bụng bên (cơ chéo), vai, tay trước, tay sau, cẳng tay, cầu vai, xô & lưng trên, lưng dưới, cổ, mông, đùi trước, đùi sau, đùi trong, bắp chân, cẳng chân trước. Đây là các nhóm bề mặt phục vụ chọn vùng tập, không phải toàn bộ cơ trong giải phẫu. Mỗi nhóm đều có vùng SVG bấm được và ít nhất một bài trong danh mục. Hai bên trái/phải được chọn cùng nhau.

Đường nét dùng dữ liệu vector tĩnh từ `react-native-body-highlighter`, có ghi nguồn và giữ giấy phép MIT tại [assets/body](../assets/body/README.md). Không thêm thư viện. Schema hiện là phiên bản 2; `normalizeTrainingSetup` chuyển dữ liệu 8 vùng cũ sang các nhóm mới khi đọc, giữ nguyên chỉ số và sức khỏe. Chỉ ghi phiên bản mới lên server khi người dùng xác nhận lưu.

Đây là luật minh họa cho bài học, chưa có thẩm định y khoa hoặc chứng minh tối ưu. Giao diện nêu rõ tính tham khảo. Nguyên tắc bắt đầu nhẹ và hỏi chuyên gia khi có tình trạng sức khỏe tham khảo [NIDDK](https://www.niddk.nih.gov/health-information/weight-management/tips-get-active/tips-starting-physical-activity). Bản demo giới hạn tuổi 18–100, không áp dụng phân loại người lớn cho trẻ em.

Động tác quay cổ trong tầm thoải mái tham khảo [NHS – Flexibility exercises](https://www.nhs.uk/live-well/exercise/flexibility-exercises/); việc chia 17 nhóm là cách gom vùng của ứng dụng, không phải tuyên bố rằng cơ thể chỉ có 17 cơ.

`profiles.trainingSetup` lưu phiên bản schema, các chỉ số, sức khỏe, vùng cơ và `goalAnswers: { version: 2, selections: { goals: [...], focus: [...], activity: [...], styles: [...], places: [...], equipment: [...], intensity: [...], barriers: [...] } }` theo tài khoản. Mỗi mảng có ít nhất một ID; `unknown` không được đứng cùng các ý cụ thể. Hồ sơ cũ chưa khảo sát vẫn vào màn chính. `normalizeGoalAnswers` chuyển hai câu radio cũ thành hai mảng, điền Không biết ở sáu câu mới để giữ tương thích và không mất vùng tự chọn. Chỉ ghi thay đổi khi xác nhận lưu. Khi lưu, đồng bộ các trường `heightCm`, `weightKg`, `gender`, `sessionsPerWeek`, `healthCondition`, `currentGoal` để màn Chạy bộ và Hồ sơ dùng chung. Đăng nhập lại đọc hồ sơ từ server, không dựa vào cờ “đã xem” trên thiết bị. `getMyProfile` luôn lọc theo ID của token, kể cả tài khoản admin.

## Kiểm tra

- `node --test tests/training.test.mjs` (Node 24+): 255 tổ hợp vùng gộp cũ, nhóm mới/cặp nhóm/preset và sức khỏe; đường SVG và 13 nhánh. Khảo sát được kiểm tra mọi tổ hợp nhiều mục tiêu/vùng (kể cả Không biết), câu trống, lựa chọn trùng/sai, quy tắc Không biết, toàn bộ Không biết, lọc dụng cụ, mức nhẹ, ít thời gian, chuyển đổi radio cũ và giữ tùy chỉnh khi chỉ đổi thứ tự chọn.
- `npx tsc --noEmit`, `npm run lint`.
- Kiểm tra giao diện: chọn nhiều ý mỗi câu; Không biết xóa ý cụ thể và ngược lại; bỏ ý cuối bị chặn; 8/8 Không biết vẫn hoàn tất; quay lại giữ câu trả lời; đổi thứ tự giữ tùy chỉnh; đổi một ý tạo lại đề xuất; lưu/đăng nhập lại đủ các mảng; chuyển hồ sơ radio cũ; Nâng cao mặc định ẩn; lỗi lưu/thử lại; giao diện sáng/tối và màn hình hẹp.
