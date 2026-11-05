# FitLog – Ứng dụng quản lý luyện tập & sức khỏe cá nhân

Ứng dụng di động giúp người dùng quản lý hồ sơ sức khỏe, lập kế hoạch tập luyện, theo dõi calo tiêu hao và ghi nhận quãng đường chạy bộ. Dữ liệu lưu cục bộ trên máy (offline-first), không cần tài khoản đám mây.

## Thiết lập cá nhân lần đầu

Sau đăng nhập, tài khoản chưa thiết lập sẽ đi qua bốn bước: nhập chỉ số và sức khỏe → khảo sát 8 câu chọn nhiều ý → xem vùng cơ được hệ thống chọn sẵn trên hình trước/sau → xem bài gợi ý và xác nhận. Mỗi câu khảo sát cần ít nhất một ý và luôn có **Không biết / Nhờ hệ thống gợi ý**; có thể chọn mục này ở cả 8 câu để tiếp tục. Mục **Nâng cao** ở bước vùng cơ mặc định thu gọn, mở ra mới có checkbox tự chọn. Hồ sơ và câu trả lời được lưu theo tài khoản trên server; các lần đăng nhập sau vào thẳng màn Hôm nay. Để sửa, chọn **Hồ sơ → Thiết lập lại chỉ số & vùng cơ**.

Xem [cách triển khai theo bài giảng và các nhánh if/else](docs/ONBOARDING.md). Phần mới không cần cài thêm thư viện.

# Xuất thành file apk
`eas build --platform android --profile preview`

# Chạy server
`npm run server`
# Chạy app
`npm expo start -c`

---

## Chức năng chính

1. **Tài khoản & hồ sơ sức khỏe:** đăng ký/đăng nhập cục bộ, nhập chiều cao, cân nặng, tự tính BMI, khai báo bệnh nền, chọn số buổi tập mỗi tuần (2–6), lưu lịch sử cân nặng.
2. **8 mục tiêu tập luyện:** giảm cân, tăng cân, duy trì thể trạng, tăng cơ, sức bền Cardio, dẻo dai, sức khỏe tổng thể, kiểm soát stress.
3. **Onboarding & cây quyết định:** khảo sát 6 bước, lọc bài tập an toàn theo bệnh nền (ví dụ: bệnh khớp thì loại bài nhảy bật, bệnh tim thì giới hạn MET ≤ 5.0) và theo mục tiêu.
4. **Lịch tập, video & tính calo:** lịch tuần/tháng, thư viện bài tập kèm video YouTube, tính calo theo công thức `MET × cân nặng (kg) × thời gian (giờ)`.
5. **Thống kê tiến độ:** biểu đồ cột/đường theo tuần và tháng, tỷ lệ hoàn thành mục tiêu, chuỗi ngày tập liên tục (streak).
6. **Đo quãng đường chạy bộ:** tích hợp bản đồ vẽ lộ trình di chuyển thời gian thực (như Strava/Google Maps) kết hợp cảm biến đếm bước chân quy đổi sải chân cá nhân hóa, hoạt động mượt mà trên Expo Go.

---

## Công nghệ sử dụng

| Mục đích | Thư viện |
| --- | --- |
| Nền tảng | React Native, Expo SDK (Managed Workflow), TypeScript |
| Điều hướng | `@react-navigation/native`, `native-stack`, `bottom-tabs` |
| Biểu mẫu & Kiểm thử | `react-hook-form`, `zod`, `@hookform/resolvers` |
| Quản lý trạng thái | `zustand` |
| Bản đồ & Web | `react-native-webview` (Leaflet & CartoDB Maps), `expo-location` |
| Giao diện & Hiệu ứng | `expo-linear-gradient`, `react-native-safe-area-context`, `@expo/vector-icons` |
| Đồ họa & Biểu đồ | `react-native-calendars`, `react-native-gifted-charts`, `react-native-svg` |
| Cảm biến & Thiết bị | `expo-sensors` (Pedometer), `expo-keep-awake`, `expo-font` |
| Cơ sở dữ liệu | `expo-sqlite`, `expo-secure-store` |

---

## Hướng dẫn cài đặt và chạy trên Expo Go

Yêu cầu: Node.js bản LTS, Git, và ứng dụng **Expo Go** trên điện thoại (hoặc Android Emulator).

```bash
git clone https://github.com/KhanhQuanHub/BaiTapThuongKy.git
cd BaiTapThuongKy
npm install
npx expo start
```

Quét mã QR bằng Expo Go (điện thoại và máy tính cùng mạng Wi-Fi), hoặc nhấn `a` để mở Android Emulator.

---

## Cấu trúc thư mục dự án

```
FitLog/
├── App.tsx                       ✓ Bọc SafeAreaProvider, NavigationContainer & RootNavigator
├── navigation/
│   ├── RootNavigator.tsx         ✓ Luồng: Login/Register (chưa auth) ➔ MainTabs (đã auth)
│   └── MainTabs.tsx              ✓ 5 tab: Hôm nay, Lịch tập, Chạy bộ, Thống kê, Hồ sơ
├── screens/
│   ├── auth/                     ✓ LoginScreen, RegisterScreen (kiểm tra Zod + test account)
│   ├── onboarding/               # Wizard khảo sát 6 bước & kết quả gợi ý
│   ├── TodayScreen.tsx           # Màn hình kế hoạch hôm nay
│   ├── ScheduleScreen.tsx        # Lịch tập tuần/tháng
│   ├── RunScreen.tsx             ✓ 6 trạng thái chạy bộ + bản đồ lộ trình real-time
│   ├── StatsScreen.tsx           # Thống kê calo, quãng đường, chuỗi streak
│   ├── ProfileScreen.tsx         ✓ Hồ sơ hiện đại: Hero Gradient, thước đo BMI, sải chân, cài đặt
│   ├── ExerciseDetailScreen.tsx  # Chi tiết bài tập + video YouTube
│   └── GoalsScreen.tsx           # Quản lý 8 mục tiêu thể lực
├── components/
│   ├── ui/                       ✓ Button, Card, StatBox, EmptyState, ScreenHeader, Input
│   ├── run/                      ✓ StatusBadge, ConfirmStopModal, SummaryCard, RunMapView
│   ├── schedule/                 # WeeklyStrip, WorkoutItem
│   └── charts/                   # BarChartWeek, LineChartTrend
├── constants/
│   └── theme.ts                  ✓ Hệ thống bảng màu, khoảng cách, bo góc, bóng đổ chuẩn
├── utils/
│   └── format.ts                 ✓ Định dạng thời gian, quãng đường, pace, số nguyên
├── domain/                       ✓ bmi.ts (tính & phân loại BMI), met.ts, stride.ts...
├── store/                        ✓ authStore.ts (Zustand: login, register, logout)
└── types/                        # Workout, Exercise, RunLog, Profile...
```

---

## 🎨 Quy chuẩn thiết kế chung (FitLog Design System & Template)

Mọi thành viên khi phát triển màn hình mới cần tuân theo quy tắc:
1. **Không ghi cứng giá trị:** Mọi màu sắc, cỡ chữ, khoảng cách, bo góc đều lấy từ `constants/theme.ts`.
2. **Ngôn ngữ thân thiện:** Dùng tiếng Việt đời thường. Các thuật ngữ chuyên môn (*Pace, Nhịp bước, Calo, BMI*) luôn kèm giải thích phụ 1 dòng.
3. **Công thái học & Khả năng tiếp cận:** Mọi nút bấm, ô nhập có vùng chạm tối thiểu **44×44 pt** (`layout.minTouchSize`). Độ tương phản đạt chuẩn WCAG AA.
4. **Phân cấp thị giác:** Mỗi màn hình chỉ có **1 hành động chính** (Button primary kích thước lớn). Các nút phụ dùng `secondary` hoặc `ghost`.

### 📋 Mẫu Template màn hình chuẩn cho thành viên nhóm

Khi tạo màn hình mới (ví dụ `ScheduleScreen.tsx`, `StatsScreen.tsx`), hãy sử dụng khung mẫu sau:

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatBox from '../components/ui/StatBox';
import { colors, fontSize, fontWeight, layout, spacing } from '../constants/theme';

export default function TemplateScreen() {
  const handlePrimaryAction = () => {
    // Xử lý hành động chính của màn hình
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Tiêu đề màn hình chuẩn */}
        <ScreenHeader
          title="Tên màn hình"
          subtitle="Mô tả ngắn gọn mục đích của màn hình cho người mới"
        />

        {/* 2. Thẻ số liệu hoặc thông tin quan trọng */}
        <View style={styles.statsRow}>
          <StatBox
            style={styles.half}
            label="Chỉ số 1"
            value="120"
            unit="phút"
            icon="time-outline"
            tone="primary"
            hint="Tổng thời gian trong tuần"
          />
          <StatBox
            style={styles.half}
            label="Chỉ số 2"
            value="450"
            unit="kcal"
            icon="flame-outline"
            tone="accent"
            hint="Năng lượng ước tính"
          />
        </View>

        {/* 3. Khối nội dung chính */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Nội dung chính</Text>
          <Text style={styles.bodyText}>
            Các component hiển thị danh sách, biểu đồ hoặc tương tác ở đây.
          </Text>
        </Card>

        {/* 4. Nút hành động chính duy nhất dưới đáy */}
        <View style={styles.footerAction}>
          <Button
            title="Hành động chính"
            icon="checkmark-circle-outline"
            size="lg"
            onPress={handlePrimaryAction}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  card: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  bodyText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footerAction: {
    marginTop: spacing.md,
  },
});
```

---

## Tuyên bố trách nhiệm y tế

Ứng dụng chỉ là công cụ hỗ trợ tự quản lý lịch tập và tính năng lượng tiêu hao theo công thức tham chiếu. Ứng dụng **không** chẩn đoán bệnh, **không** đưa ra phác đồ điều trị và **không** thay thế lời khuyên của bác sĩ. Người có bệnh nền nên tham vấn chuyên gia y tế trước khi tập luyện cường độ cao.
