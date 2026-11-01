// ============================================================================
// screens/ProfileScreen.tsx
// Màn hình Hồ sơ cá nhân tối giản theo chuẩn iOS Settings / Material 3:
// - Chỉ giữ: Avatar, Tên, 3 chỉ số chính (Streak, Cân nặng, BMI) và danh sách
//   cài đặt dạng hàng đơn giản.
// - Chiều cao, sải chân, mục tiêu, lịch tập, bệnh nền được gom vào màn con
//   "Chỉnh sửa hồ sơ".
// - Chế độ Sáng / Tối / Tự động gộp thành một hàng chọn duy nhất.
// - Bỏ toàn bộ đoạn mô tả dài và thẻ trùng lặp; chữ >= 14sp, vùng chạm >= 44px.
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import {
  fontSize,
  fontWeight,
  layout,
  radius,
  spacing,
  ThemeColors,
  ThemeMode,
} from '../constants/theme';
import { calculateBmi } from '../domain/bmi';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { saveMyProfile } from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';

const THEME_MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Sáng' },
  { mode: 'dark', label: 'Tối' },
  { mode: 'system', label: 'Tự động' },
];

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // State lưu thông tin hồ sơ (khởi tạo từ authStore, giữ nguyên cấu trúc dữ liệu)
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName ?? 'Nguyễn Khánh Quân',
    email: user?.email ?? 'quan@figlog.vn',
    gender: user?.gender ?? 'Nam',
    height: user?.height ?? 175,
    weight: user?.weight ?? 60,
    healthCondition: user?.healthCondition ?? 'Không có',
    workoutsPerWeek: user?.workoutsPerWeek ?? 4,
    currentGoal: user?.currentGoal ?? 'Giảm cân & Sức bền',
  });

  // State tạm trong màn con "Chỉnh sửa hồ sơ"
  const [draftHeight, setDraftHeight] = useState(String(profileData.height));
  const [draftWeight, setDraftWeight] = useState(String(profileData.weight));
  const [draftWorkouts, setDraftWorkouts] = useState(String(profileData.workoutsPerWeek));
  const [draftGoal, setDraftGoal] = useState(profileData.currentGoal);
  const [draftHealth, setDraftHealth] = useState(profileData.healthCondition);

  // Tính BMI bằng hàm thuần hiện có
  const bmiInfo = calculateBmi(profileData.weight, profileData.height, colors);

  // Sải chân ước tính theo chiều cao (cm)
  const strideFactor = profileData.gender === 'Nữ' ? 0.413 : 0.415;
  const strideCm = Math.round(profileData.height * strideFactor * 10) / 10;

  // Chữ cái đầu tên cho Avatar
  const nameParts = profileData.fullName.trim().split(' ');
  const initial =
    nameParts.length > 0
      ? nameParts[nameParts.length - 1].charAt(0).toUpperCase()
      : 'F';

  // Mở màn con "Chỉnh sửa hồ sơ"
  const handleOpenEditModal = () => {
    setDraftHeight(String(profileData.height));
    setDraftWeight(String(profileData.weight));
    setDraftWorkouts(String(profileData.workoutsPerWeek));
    setDraftGoal(profileData.currentGoal);
    setDraftHealth(profileData.healthCondition);
    setEditModalVisible(true);
  };

  // Lưu thay đổi từ màn con "Chỉnh sửa hồ sơ"
  const handleSaveProfile = async () => {
    const nextHeight = Math.min(230, Math.max(120, Number(draftHeight) || profileData.height));
    const nextWeight = Math.min(200, Math.max(30, Number(draftWeight) || profileData.weight));
    const nextWorkouts = Math.min(7, Math.max(1, Number(draftWorkouts) || profileData.workoutsPerWeek));

    const updated = {
      ...profileData,
      height: nextHeight,
      weight: nextWeight,
      workoutsPerWeek: nextWorkouts,
      currentGoal: draftGoal.trim() || profileData.currentGoal,
      healthCondition: draftHealth.trim() || 'Không có',
    };

    setIsSavingProfile(true);
    try {
      const bmi = calculateBmi(updated.weight, updated.height, colors).bmi;
      await saveMyProfile({
        gender: updated.gender === 'Nữ' ? 'female' : 'male',
        heightCm: updated.height,
        weightKg: updated.weight,
        bmi,
        healthCondition: updated.healthCondition,
        sessionsPerWeek: updated.workoutsPerWeek,
        currentGoal: updated.currentGoal,
      });

      setProfileData(updated);
      if (user) {
        useAuthStore.setState({
          user: {
            ...user,
            height: updated.height,
            weight: updated.weight,
            workoutsPerWeek: updated.workoutsPerWeek,
            currentGoal: updated.currentGoal,
            healthCondition: updated.healthCondition,
          },
        });
      }
      setEditModalVisible(false);
    } catch (error: unknown) {
      Alert.alert('Chưa lưu được hồ sơ', getErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn muốn đăng xuất khỏi tài khoản này?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
      ],
      { cancelable: true }
    );
  };

  const showMedicalDisclaimer = () => {
    Alert.alert(
      'Thông tin y tế',
      'FitLog hỗ trợ theo dõi vận động cá nhân theo công thức tham chiếu, không thay thế chẩn đoán hoặc tư vấn y khoa.'
    );
  };

  const isBmiNormal = bmiInfo.bmi >= 18.5 && bmiInfo.bmi < 25;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= 1. HEADER HỒ SƠ TỐI GIẢN ================= */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.userName} numberOfLines={1}>
              {profileData.fullName}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {profileData.email}
            </Text>
          </View>
        </View>

        {/* ================= 2. BA CHỈ SỐ CHÍNH (STREAK, CÂN NẶNG, BMI) ================= */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>5 ngày</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData.weight} kg</Text>
            <Text style={styles.statLabel}>Cân nặng</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: isBmiNormal ? colors.primary : colors.warning },
              ]}
            >
              {bmiInfo.bmi}
            </Text>
            <Text style={styles.statLabel}>BMI ({bmiInfo.label})</Text>
          </View>
        </View>

        {/* ================= 3. HÀNH ĐỘNG CHÍNH DUY NHẤT ================= */}
        <Pressable
          accessibilityRole="button"
          style={styles.primaryActionBtn}
          onPress={handleOpenEditModal}
        >
          <Ionicons name="create-outline" size={20} color={colors.textOnPrimary} />
          <Text style={styles.primaryActionText}>Chỉnh sửa hồ sơ</Text>
        </Pressable>

        {/* ================= 4. DANH SÁCH CÀI ĐẶT DẠNG HÀNG (KIỂU iOS SETTINGS) ================= */}
        <View style={styles.settingsGroup}>
          {/* Hàng 1: Thông số cơ thể & mục tiêu (mở màn Chỉnh sửa hồ sơ) */}
          <Pressable
            accessibilityRole="button"
            style={styles.settingRow}
            onPress={handleOpenEditModal}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="body-outline" size={22} color={colors.primary} />
              <Text style={styles.rowTitle}>Chỉ số & Mục tiêu</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValueText}>
                {profileData.height} cm • {strideCm} cm
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Pressable>

          <View style={styles.rowDivider} />

          {/* Hàng 2: Giao diện Sáng / Tối / Tự động gộp trong 1 hàng duy nhất */}
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Ionicons name="contrast-outline" size={22} color={colors.primary} />
              <Text style={styles.rowTitle}>Giao diện</Text>
            </View>

            <View style={styles.segmentedControl}>
              {THEME_MODES.map((item) => {
                const selected = themeMode === item.mode;
                return (
                  <Pressable
                    key={item.mode}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.segmentItem,
                      selected && styles.segmentItemActive,
                    ]}
                    onPress={() => setThemeMode(item.mode)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selected && styles.segmentTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* Hàng 3: Nhắc nhở tập luyện */}
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={22} color={colors.primary} />
              <Text style={styles.rowTitle}>Nhắc tập (06:30)</Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Hàng 4: Thông tin y tế */}
          <Pressable
            accessibilityRole="button"
            style={styles.settingRow}
            onPress={showMedicalDisclaimer}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.textMuted} />
              <Text style={styles.rowTitle}>Tuyên bố y tế</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={styles.rowDivider} />

          {/* Hàng 5: Đăng xuất */}
          <Pressable
            accessibilityRole="button"
            style={styles.settingRow}
            onPress={handleLogoutPress}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
              <Text style={[styles.rowTitle, { color: colors.danger }]}>Đăng xuất</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* ================= MÀN CON / MODAL CHỈNH SỬA HỒ SƠ ================= */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh sửa hồ sơ</Text>
              <Pressable
                style={styles.closeIconBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputRowTwoCols}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Chiều cao (cm)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={draftHeight}
                    onChangeText={setDraftHeight}
                    placeholder="175"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Cân nặng (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={draftWeight}
                    onChangeText={setDraftWeight}
                    placeholder="60"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Sải chân tự động tính từ chiều cao */}
              <View style={styles.readonlyInfoRow}>
                <Text style={styles.readonlyLabel}>Sải chân ước tính</Text>
                <Text style={styles.readonlyValue}>
                  {Math.round((Number(draftHeight) || profileData.height) * strideFactor * 10) / 10} cm
                </Text>
              </View>

              <Text style={styles.inputLabel}>Số buổi tập / tuần</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={draftWorkouts}
                onChangeText={setDraftWorkouts}
                placeholder="4"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Mục tiêu tập luyện</Text>
              <TextInput
                style={styles.textInput}
                value={draftGoal}
                onChangeText={setDraftGoal}
                placeholder="Giảm cân & Sức bền"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Tình trạng bệnh nền</Text>
              <TextInput
                style={styles.textInput}
                value={draftHealth}
                onChangeText={setDraftHealth}
                placeholder="Không có"
                placeholderTextColor={colors.textMuted}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSavingProfile }}
                disabled={isSavingProfile}
                style={[styles.saveModalBtn, isSavingProfile && styles.saveModalBtnDisabled]}
                onPress={handleSaveProfile}
              >
                <Text style={styles.saveModalBtnText}>
                  {isSavingProfile ? 'Đang lưu...' : 'Lưu hồ sơ'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: layout.screenPadding,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
    avatarCircle: {
      width: 60,
      height: 60,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 24,
      fontWeight: fontWeight.bold,
      color: colors.primary,
    },
    profileMeta: {
      flex: 1,
      gap: 2,
    },
    userName: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    userEmail: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      fontSize: fontSize.subtitle,
      fontWeight: fontWeight.bold,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    primaryActionBtn: {
      minHeight: layout.buttonHeight,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    primaryActionText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.textOnPrimary,
    },
    settingsGroup: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    settingRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flexShrink: 1,
    },
    rowTitle: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.medium,
      color: colors.text,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    rowValueText: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: spacing.lg + 22 + spacing.md,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentItem: {
      minHeight: 36,
      paddingHorizontal: 10,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.medium,
      color: colors.textMuted,
    },
    segmentTextActive: {
      color: colors.textOnPrimary,
      fontWeight: fontWeight.bold,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: layout.screenPadding,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      maxHeight: '88%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    modalTitle: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    closeIconBtn: {
      width: layout.minTouchSize,
      height: layout.minTouchSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputRowTwoCols: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    inputCol: {
      flex: 1,
    },
    inputLabel: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: spacing.sm,
    },
    textInput: {
      minHeight: layout.minTouchSize,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      fontSize: fontSize.body,
      color: colors.text,
    },
    readonlyInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    readonlyLabel: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    readonlyValue: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.primary,
    },
    saveModalBtn: {
      minHeight: layout.buttonHeight,
      backgroundColor: colors.primary,
    },
    saveModalBtnDisabled: {
      opacity: 0.6,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xl,
    },
    saveModalBtnText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
