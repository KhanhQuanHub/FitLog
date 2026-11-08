import { ComponentRef, useRef, useState } from 'react';
import {
  Alert,
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
import { changePassword } from '../../services/api';
import {
  changePasswordSchema,
  ChangePasswordFormData,
  safeZodResolver,
} from '../../domain/authSchema';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../store/themeStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;
type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

export default function ChangePasswordScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const currentPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const newPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [visibleFields, setVisibleFields] = useState<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [serverError, setServerError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: safeZodResolver<ChangePasswordFormData>(changePasswordSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const toggleVisibility = (field: PasswordField) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  };

  const submit = async (data: ChangePasswordFormData) => {
    setServerError('');
    try {
      const result = await changePassword(
        data.currentPassword,
        data.newPassword,
        data.confirmPassword
      );
      Alert.alert(
        'Đổi mật khẩu thành công',
        result?.message || 'Mật khẩu của bạn đã được cập nhật.',
        [{ text: 'Về hồ sơ', onPress: () => navigation.goBack() }],
        { cancelable: false }
      );
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    }
  };

  const fields: {
    name: PasswordField;
    label: string;
    placeholder: string;
    next?: PasswordField;
    autoComplete: 'current-password' | 'new-password';
    textContentType: 'password' | 'newPassword';
  }[] = [
    {
      name: 'currentPassword',
      label: 'Mật khẩu hiện tại',
      placeholder: 'Nhập mật khẩu hiện tại',
      next: 'newPassword',
      autoComplete: 'current-password',
      textContentType: 'password',
    },
    {
      name: 'newPassword',
      label: 'Mật khẩu mới',
      placeholder: 'Tối thiểu 8 ký tự (A-Z, a-z, 0-9)',
      next: 'confirmPassword',
      autoComplete: 'new-password',
      textContentType: 'newPassword',
    },
    {
      name: 'confirmPassword',
      label: 'Xác nhận mật khẩu mới',
      placeholder: 'Nhập lại mật khẩu mới',
      autoComplete: 'new-password',
      textContentType: 'newPassword',
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại hồ sơ"
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="lock-closed-outline" size={34} color={colors.primary} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Đổi mật khẩu</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              Mật khẩu mới cần có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.
            </Text>

            <View style={styles.form}>
              {fields.map((field) => (
                <Controller
                  key={field.name}
                  control={control}
                  name={field.name}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      ref={
                        field.name === 'currentPassword'
                          ? currentPasswordRef
                          : field.name === 'newPassword'
                            ? newPasswordRef
                            : confirmPasswordRef
                      }
                      label={field.label}
                      placeholder={field.placeholder}
                      secureTextEntry={!visibleFields[field.name]}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      contextMenuHidden
                      autoComplete={field.autoComplete}
                      textContentType={field.textContentType}
                      returnKeyType={field.next ? 'next' : 'done'}
                      blurOnSubmit={!field.next}
                      editable={!isSubmitting}
                      rightIcon={visibleFields[field.name] ? 'eye-off-outline' : 'eye-outline'}
                      rightIconLabel={visibleFields[field.name] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      onRightIconPress={() => toggleVisibility(field.name)}
                      value={value}
                      onChangeText={(text) => {
                        setServerError('');
                        onChange(text);
                      }}
                      onBlur={onBlur}
                      onSubmitEditing={() => {
                        if (field.next) {
                          const nextRef = field.next === 'newPassword'
                            ? newPasswordRef
                            : confirmPasswordRef;
                          nextRef.current?.focus();
                        } else {
                          void handleSubmit(submit)();
                        }
                      }}
                      error={errors[field.name]?.message}
                    />
                  )}
                />
              ))}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                disabled={isSubmitting}
                onPress={() => {
                  void handleSubmit(submit)();
                }}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: isSubmitting ? 0.65 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {isSubmitting
                  ? <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  : <Text style={[styles.submitText, { color: colors.textOnPrimary }]}>Cập nhật mật khẩu</Text>}
              </Pressable>
            </View>

            {serverError ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.danger }]}>{serverError}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, padding: layout.screenPadding },
  backButton: {
    width: layout.minTouchSize,
    height: layout.minTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { fontSize: fontSize.headline, fontWeight: fontWeight.heavy, textAlign: 'center' },
  description: { fontSize: fontSize.body, lineHeight: 24, textAlign: 'center' },
  form: { gap: spacing.md },
  submitButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitText: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
  feedback: { fontSize: fontSize.caption, lineHeight: 21, textAlign: 'center' },
});
