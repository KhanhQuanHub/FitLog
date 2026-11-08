import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Input from '../../components/ui/Input';
import { requestPasswordReset } from '../../services/api';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../store/themeStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Vui lòng nhập email hợp lệ.');
      setMessage('');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await requestPasswordReset(cleanEmail);
      setMessage(result?.message || 'Nếu email đã đăng ký, mật khẩu mới sẽ được gửi đến hộp thư của bạn.');
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại đăng nhập"
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="lock-closed-outline" size={34} color={colors.primary} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Quên mật khẩu?</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              Nhập email đã đăng ký. Mật khẩu tạm thời sẽ được gửi đến hộp thư nếu tài khoản tồn tại.
            </Text>

            <View style={styles.form}>
              <Input
                label="Email"
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="email"
                textContentType="emailAddress"
                leftIcon="mail-outline"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError('');
                  setMessage('');
                }}
                editable={!isSubmitting}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                disabled={isSubmitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: colors.primary, opacity: isSubmitting ? 0.65 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.submitText, { color: colors.textOnPrimary }]}>
                  {isSubmitting ? 'Đang gửi...' : 'Gửi mật khẩu mới'}
                </Text>
              </Pressable>
            </View>

            {message ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.primary }]}>{message}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.danger }]}>{error}</Text> : null}
            <Text style={[styles.helper, { color: colors.textMuted }]}>
              Nếu chưa nhận được email, hãy kiểm tra cả thư mục Spam.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: layout.screenPadding,
  },
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
    paddingBottom: spacing.xxl,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: fontSize.headline,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.body,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  form: { gap: spacing.md },
  submitButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  feedback: {
    fontSize: fontSize.caption,
    lineHeight: 21,
    textAlign: 'center',
  },
  helper: {
    fontSize: fontSize.caption,
    lineHeight: 21,
    textAlign: 'center',
  },
});
