// ============================================================================
// screens/auth/LoginScreen.tsx
// Màn hình Đăng nhập FitLog (đã khắc phục triệt để Uncaught ZodError):
// - Sử dụng safeZodResolver(loginSchema) dùng safeParseAsync(), không bao giờ
//   ném ZodError chưa bắt ra console.
// - Lỗi từng trường hiện ngay dưới ô nhập bằng chữ đỏ tiếng Việt, viền đổi màu đỏ,
//   chỉ báo sau khi rời ô (onBlur) hoặc bấm nút Đăng nhập, tự tắt khi sửa đúng.
// - Banner lỗi từ máy chủ (sai thông tin, mất mạng, timeout, lỗi 5xx) đặt ngay
//   phía trên nút gửi kèm nút "Thử lại".
// ============================================================================

import React, { ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
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
  LoginFormData,
  loginSchema,
  safeZodResolver,
} from '../../domain/authSchema';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../store/themeStore';
import ForgotPasswordScreen from './ForgotPasswordScreen';

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [secureText, setSecureText] = useState(true);
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const submitLockRef = useRef(false);

  const {
    login,
    isLoading,
    authError,
    registrationSuccessMessage,
    clearError,
    clearRegistrationSuccess,
  } = useAuthStore();
  const { colors, isDark } = useTheme();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: safeZodResolver<LoginFormData>(loginSchema),
    // Chỉ kiểm tra khi rời ô (onBlur) hoặc khi bấm nút gửi; tự xóa lỗi ngay khi gõ sửa đúng
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Ẩn mật khẩu và che nội dung nhạy cảm khi ứng dụng chuyển sang nền / đa nhiệm
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        setSecureText(true);
        setIsAppBackgrounded(true);
      } else {
        setIsAppBackgrounded(false);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Hàm xử lý khi dữ liệu form đã hợp lệ (có try/catch/finally và khóa chống bấm lặp)
  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      if (submitLockRef.current || isLoading) {
        return;
      }
      submitLockRef.current = true;
      try {
        const normalizedEmail = data.email.trim().toLowerCase();
        await login(normalizedEmail, data.password);
      } catch {
        // Mọi lỗi đã được chuẩn hóa và lưu vào authError trong store
      } finally {
        submitLockRef.current = false;
      }
    },
    [isLoading, login]
  );

  // Hàm kích hoạt gửi form an toàn, tuyệt đối không để Promise bị từ chối mà không bắt
  const triggerSafeSubmit = useCallback(async () => {
    try {
      await handleSubmit(onSubmit)();
    } catch {
      // Không bao giờ ném lỗi chưa bắt ra console
    }
  }, [handleSubmit, onSubmit]);

  const busy = isLoading || isSubmitting;
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isAppBackgrounded) {
    return <View style={[styles.safe, styles.privacyShield]} />;
  }

  if (showForgotPassword) {
    return (
      <ForgotPasswordScreen
        navigation={{ goBack: () => setShowForgotPassword(false) } as never}
        route={{ key: 'ForgotPassword', name: 'ForgotPassword' } as never}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ================= 1. LOGO NHỎ, TÊN FITLOG & KHẨU HIỆU NGẮN ================= */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="fitness" size={28} color={colors.primary} />
            </View>
            <Text style={styles.brandName}>FitLog</Text>
            <Text style={styles.brandTagline}>
              Theo dõi luyện tập & sức khỏe mỗi ngày
            </Text>
          </View>

          {/* Thông báo khi vừa tạo tài khoản thành công */}
          {registrationSuccessMessage ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={styles.successBannerText}>{registrationSuccessMessage}</Text>
            </View>
          ) : null}

          {/* ================= 2. HAI Ô NHẬP LIỆU TRỰC TIẾP ================= */}
          <View style={styles.formSection}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
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
                    if (registrationSuccessMessage) clearRegistrationSuccess();
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={passwordInputRef}
                  label="Mật khẩu"
                  placeholder="Nhập mật khẩu"
                  secureTextEntry={secureText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  contextMenuHidden
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  editable={!busy}
                  rightIcon={secureText ? 'eye-outline' : 'eye-off-outline'}
                  rightIconLabel={secureText ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
                  onRightIconPress={() => setSecureText((prev) => !prev)}
                  value={value}
                  onChangeText={(text) => {
                    if (authError) clearError();
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  onSubmitEditing={triggerSafeSubmit}
                  error={errors.password?.message}
                />
              )}
            />

            {/* Liên kết phụ 1: Quên mật khẩu? */}
            <View style={styles.forgotRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.forgotBtn}
                onPress={() => setShowForgotPassword(true)}
                disabled={busy}
              >
                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
              </Pressable>
            </View>

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
                <Text style={styles.submitBtnText}>Đăng nhập</Text>
              )}
            </Pressable>
          </View>

          {/* ================= 5. LIÊN KẾT QUA MÀN ĐĂNG KÝ ================= */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Chưa có tài khoản?</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.registerLinkBtn}
              onPress={() => {
                clearError();
                clearRegistrationSuccess();
                navigation.navigate('Register');
              }}
              disabled={busy}
            >
              <Text style={styles.registerLinkText}>Đăng ký</Text>
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
    privacyShield: {
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
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    successBannerText: {
      flex: 1,
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
    },
    formSection: {
      gap: spacing.md,
    },
    forgotRow: {
      alignItems: 'flex-end',
      marginTop: -spacing.xs,
    },
    forgotBtn: {
      minHeight: layout.minTouchSize,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    forgotText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
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
    registerLinkBtn: {
      minHeight: layout.minTouchSize,
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    registerLinkText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.primary,
    },
  });
