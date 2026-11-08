import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Input from '../../components/ui/Input';
import { fontSize, fontWeight, layout, radius, spacing } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../store/themeStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();

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
              Nhập email bạn đã dùng để đăng ký. Hướng dẫn đặt lại mật khẩu sẽ được gửi đến email này.
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
              />
              <View style={[styles.submitButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.submitText, { color: colors.textOnPrimary }]}>Gửi hướng dẫn</Text>
              </View>
            </View>

            <Text style={[styles.helper, { color: colors.textMuted }]}>
              Giao diện đặt lại mật khẩu đang được hoàn thiện.
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
  helper: {
    fontSize: fontSize.caption,
    lineHeight: 21,
    textAlign: 'center',
  },
});
