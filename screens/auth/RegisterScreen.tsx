// ============================================================================
// screens/auth/RegisterScreen.tsx
// Màn hình Đăng ký tài khoản hoàn chỉnh cho FitLog:
// - Dùng safeZodResolver(registerSchema) (safeParseAsync), triệt tiêu hoàn toàn
//   lỗi "Uncaught (in promise) ZodError".
// - Các trường: Họ và tên, Email, Mật khẩu, Nhập lại mật khẩu + Bước 2 tùy chọn
//   nhập Chiều cao (cm) & Cân nặng (kg).
// - Thanh gợi ý độ mạnh mật khẩu 4 mức trực quan + biểu tượng hiện/ẩn mật khẩu.
// - Banner lỗi từ máy chủ nằm ngay phía trên nút Đăng ký kèm nút "Thử lại".
// - Sau khi đăng ký: tự đăng nhập + lưu token vào expo-secure-store để vào màn
//   "Hôm nay", hoặc quay về màn Đăng nhập kèm thông báo thành công nếu server
//   không trả token tự động.
// ============================================================================

import React, { ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';

import Input from '../../components/ui/Input';
import {
  fontSize,
  fontWeight,
  layout,
  radius,
  spacing,
  ThemeColors,
} from '../../constants/theme';
import {
  evaluatePasswordStrength,
  RegisterFormData,
  registerSchema,
  safeZodResolver,
} from '../../domain/authSchema';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../store/themeStore';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [securePassword, setSecurePassword] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [showBodyStep, setShowBodyStep] = useState(false);

  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const heightRef = useRef<ComponentRef<typeof TextInput>>(null);
  const weightRef = useRef<ComponentRef<typeof TextInput>>(null);
  const submitLockRef = useRef(false);

  const { register: registerUser, isLoading, authError, clearError } = useAuthStore();
  const { colors, isDark } = useTheme();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: safeZodResolver<RegisterFormData>(registerSchema),
    // Chỉ hiển thị lỗi sau khi rời ô (onBlur) hoặc khi bấm nút gửi; tự tắt khi sửa đúng
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      heightCm: '',
      weightKg: '',
    },
  });

  const watchedPassword = watch('password') || '';
  const strength = useMemo(
    () => evaluatePasswordStrength(watchedPassword),
    [watchedPassword]
  );

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const onSubmit = useCallback(
    async (data: RegisterFormData) => {
      if (submitLockRef.current || isLoading) return;
      submitLockRef.current = true;
      try {
        const extraProfile =
          data.heightCm || data.weightKg
            ? {
                heightCm: data.heightCm ? Number(data.heightCm) : undefined,
                weightKg: data.weightKg ? Number(data.weightKg) : undefined,
              }
            : undefined;

        const res = await registerUser(
          data.fullName.trim(),
          data.email.trim().toLowerCase(),
          data.password,
          extraProfile
        );

        // Nếu backend tạo tài khoản thành công nhưng không cấp token ngay -> quay về Login
        if (res.ok && !res.autoLoggedIn) {
          navigation.navigate('Login');
        }
      } catch {
        // Lỗi đã được chuẩn hóa và lưu vào authError trong store
      } finally {
        submitLockRef.current = false;
      }
    },
    [isLoading, navigation, registerUser]
  );

  // Kích hoạt gửi form an toàn, không bao giờ để Promise bị từ chối mà không bắt
  const triggerSafeSubmit = useCallback(async () => {
    try {
      await handleSubmit(onSubmit)();
    } catch {
      // Không bao giờ ném lỗi chưa bắt ra console
    }
  }, [handleSubmit, onSubmit]);

  const busy = isLoading || isSubmitting;
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Chọn màu cho thanh độ mạnh mật khẩu (chỉ dùng bảng màu đã thống nhất)
  const strengthActiveColor =
    strength.score >= 4
      ? colors.primary
      : strength.score >= 2
        ? colors.warning
        : colors.danger;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ================= 1. TIÊU ĐỀ & KHẨU HIỆU ================= */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="fitness" size={28} color={colors.primary} />
            </View>
            <Text style={styles.brandName}>Tạo tài khoản</Text>
            <Text style={styles.brandTagline}>
              Bắt đầu theo dõi hành trình luyện tập trên FitLog
            </Text>
          </View>

          {/* ================= 2. CÁC TRƯỜNG ĐĂNG KÝ ================= */}
          <View style={styles.formSection}>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Họ và tên"
                  placeholder="Nguyễn Văn An"
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  editable={!busy}
                  value={value}
                  onChangeText={(text) => {
                    if (authError) clearError();
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  error={errors.fullName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={emailRef}
                  label="Email"
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  editable={!busy}
                  value={value}
                  onChangeText={(text) => {
                    if (authError) clearError();
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  error={errors.email?.message}
                />
              )}
            />

            <View style={styles.passwordBlock}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    ref={passwordRef}
                    label="Mật khẩu"
                    placeholder="Tối thiểu 8 ký tự (A-Z, a-z, 0-9)"
                    secureTextEntry={securePassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    contextMenuHidden
                    autoComplete="password-new"
                    textContentType="newPassword"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    editable={!busy}
                    rightIcon={securePassword ? 'eye-outline' : 'eye-off-outline'}
                    rightIconLabel={securePassword ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
                    onRightIconPress={() => setSecurePassword((prev) => !prev)}
                    value={value}
                    onChangeText={(text) => {
                      if (authError) clearError();
                      onChange(text);
                    }}
                    onBlur={onBlur}
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    error={errors.password?.message}
                  />
                )}
              />

              {/* Thanh gợi ý độ mạnh mật khẩu đơn giản (4 vạch) */}
              {watchedPassword.length > 0 ? (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarsRow}>
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBarSegment,
                          {
                            backgroundColor:
                              strength.score >= level
                                ? strengthActiveColor
                                : colors.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.strengthMetaRow}>
                    <Text style={styles.strengthRulesText}>
                      8+ ký tự • Chữ hoa • Chữ thường • Số
                    </Text>
                    <Text
                      style={[
                        styles.strengthLabelText,
                        { color: strengthActiveColor },
                      ]}
                    >
                      {strength.label}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={confirmRef}
                  label="Nhập lại mật khẩu"
                  placeholder="Nhập lại mật khẩu phía trên"
                  secureTextEntry={secureConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  contextMenuHidden
                  returnKeyType={showBodyStep ? 'next' : 'done'}
                  blurOnSubmit={!showBodyStep}
                  editable={!busy}
                  rightIcon={secureConfirm ? 'eye-outline' : 'eye-off-outline'}
                  rightIconLabel={secureConfirm ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
                  onRightIconPress={() => setSecureConfirm((prev) => !prev)}
                  value={value}
                  onChangeText={(text) => {
                    if (authError) clearError();
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  onSubmitEditing={() => {
                    if (showBodyStep) {
                      heightRef.current?.focus();
                    } else {
                      triggerSafeSubmit();
                    }
                  }}
                  error={errors.confirmPassword?.message}
                />
              )}
            />

            {/* Bước 2 tùy chọn: Nhập chiều cao & cân nặng cho FitLog (không bắt buộc) */}
            <Pressable
              accessibilityRole="button"
              style={styles.optionalStepToggle}
              onPress={() => setShowBodyStep((prev) => !prev)}
              disabled={busy}
            >
              <Ionicons
                name={showBodyStep ? 'chevron-up-outline' : 'add-circle-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.optionalStepToggleText}>
                {showBodyStep
                  ? 'Ẩn chỉ số cơ thể (tùy chọn)'
                  : 'Thêm chiều cao & cân nặng (tùy chọn)'}
              </Text>
            </Pressable>

            {showBodyStep ? (
              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Controller
                    control={control}
                    name="heightCm"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        ref={heightRef}
                        label="Chiều cao (cm)"
                        placeholder="170"
                        keyboardType="numeric"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        editable={!busy}
                        value={value || ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        onSubmitEditing={() => weightRef.current?.focus()}
                        error={errors.heightCm?.message}
                      />
                    )}
                  />
                </View>

                <View style={styles.colHalf}>
                  <Controller
                    control={control}
                    name="weightKg"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        ref={weightRef}
                        label="Cân nặng (kg)"
                        placeholder="60"
                        keyboardType="numeric"
                        returnKeyType="done"
                        editable={!busy}
                        value={value || ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        onSubmitEditing={triggerSafeSubmit}
                        error={errors.weightKg?.message}
                      />
                    )}
                  />
                </View>
              </View>
            ) : null}

            {/* ================= 3. BANNER LỖI TỪ MÁY CHỦ NẰM NGAY PHÍA TRÊN NÚT GỬI ================= */}
            {authError ? (
              <View style={styles.serverErrorBanner} accessibilityRole="alert">
                <View style={styles.serverErrorRow}>
                  <Ionicons name="alert-circle" size={20} color={colors.danger} />
                  <Text style={styles.serverErrorText}>{authError.message}</Text>
                </View>

                {authError.retryable ? (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.retryBtn}
                    onPress={triggerSafeSubmit}
                    disabled={busy}
                  >
                    <Text style={styles.retryBtnText}>Thử lại</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* ================= 4. NÚT HÀNH ĐỘNG CHÍNH DUY NHẤT ================= */}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              style={[styles.submitBtn, busy && styles.submitBtnDisabled]}
              onPress={triggerSafeSubmit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitBtnText}>Tạo tài khoản</Text>
              )}
            </Pressable>
          </View>

          {/* ================= 5. LIÊN KẾT QUAY LẠI ĐĂNG NHẬP ================= */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Đã có tài khoản?</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.linkButton}
              onPress={() => {
                clearError();
                navigation.navigate('Login');
              }}
              disabled={busy}
            >
              <Text style={styles.linkText}>Đăng nhập</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl,
      gap: spacing.xl,
    },
    brandSection: {
      alignItems: 'center',
      gap: 6,
    },
    logoCircle: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    brandName: {
      fontSize: fontSize.headline,
      fontWeight: fontWeight.heavy,
      color: colors.text,
    },
    brandTagline: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    formSection: {
      gap: spacing.md,
    },
    passwordBlock: {
      gap: spacing.xs,
    },
    strengthContainer: {
      gap: 6,
      marginTop: 2,
    },
    strengthBarsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    strengthBarSegment: {
      flex: 1,
      height: 4,
      borderRadius: radius.pill,
    },
    strengthMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    strengthRulesText: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    strengthLabelText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
    },
    optionalStepToggle: {
      minHeight: layout.minTouchSize,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
    },
    optionalStepToggleText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
    },
    twoColRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    colHalf: {
      flex: 1,
    },
    serverErrorBanner: {
      backgroundColor: colors.dangerLight,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    serverErrorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    serverErrorText: {
      flex: 1,
      fontSize: fontSize.caption,
      fontWeight: fontWeight.medium,
      color: colors.danger,
    },
    retryBtn: {
      alignSelf: 'flex-start',
      minHeight: 38,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryBtnText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: '#FFFFFF',
    },
    submitBtn: {
      minHeight: layout.buttonHeight,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    submitBtnDisabled: {
      opacity: 0.65,
    },
    submitBtnText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.textOnPrimary,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    footerText: {
      fontSize: fontSize.body,
      color: colors.textMuted,
    },
    linkButton: {
      minHeight: layout.minTouchSize,
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    linkText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.primary,
    },
  });
