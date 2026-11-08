// ============================================================================
// domain/authSchema.ts
// Schema kiểm tra dữ liệu đầu vào dùng chung (Zod v4) & bộ safeZodResolver:
// - Khắc phục triệt để lỗi "Uncaught (in promise) ZodError":
//   @hookform/resolvers@3.9.1 gọi schema.parseAsync() và tìm thuộc tính error.errors
//   (đã bị xóa trên Zod v4, thay bằng error.issues), dẫn đến việc ném ngược ZodError.
// - Hàm safeZodResolver() dưới đây chỉ gọi schema.safeParseAsync(), đọc trực tiếp
//   error.issues / error.errors và KHÔNG BAO GIỜ ném ngoại lệ ra ngoài Promise.
// ============================================================================

import { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import { z } from 'zod';

// Quy tắc Email dùng chung cho cả Đăng nhập và Đăng ký:
// Cắt khoảng trắng 2 đầu, bắt buộc không rỗng, đúng định dạng email, chuyển về chữ thường
const emailFieldSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email')
  .email('Email không hợp lệ')
  .transform((val) => val.toLowerCase());

// 1. Schema màn hình Đăng nhập
export const loginSchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type LoginFormData = z.input<typeof loginSchema>;
export type LoginParsedData = z.output<typeof loginSchema>;

// 2. Schema màn hình Đăng ký (thống nhất quy tắc giữa App và Backend)
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập họ và tên')
      .min(2, 'Họ và tên cần ít nhất 2 ký tự')
      .max(60, 'Họ và tên không quá 60 ký tự'),
    email: emailFieldSchema,
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu')
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .regex(/[A-Z]/, 'Mật khẩu cần có ít nhất 1 chữ hoa')
      .regex(/[a-z]/, 'Mật khẩu cần có ít nhất 1 chữ thường')
      .regex(/[0-9]/, 'Mật khẩu cần có ít nhất 1 chữ số'),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
    // Bước 2 tùy chọn cho FitLog (chiều cao & cân nặng để tính BMI / sải chân)
    heightCm: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || (Number(val) >= 100 && Number(val) <= 240),
        'Chiều cao hợp lệ từ 100 đến 240 cm'
      ),
    weightKg: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || (Number(val) >= 25 && Number(val) <= 250),
        'Cân nặng hợp lệ từ 25 đến 250 kg'
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  });

export type RegisterFormData = z.input<typeof registerSchema>;
export type RegisterParsedData = z.output<typeof registerSchema>;

/**
 * Bộ Resolver an toàn cho react-hook-form sử dụng schema.safeParseAsync():
 * - Tuyệt đối không gọi schema.parse() để tránh ném ZodError.
 * - Tương thích cả Zod v4 (error.issues) lẫn Zod v3 (error.errors).
 * - Bọc try/catch toàn phần để không bao giờ xảy ra "Uncaught (in promise)".
 */
export function safeZodResolver<T extends FieldValues>(
  schema: z.ZodType<any, any, any>
): Resolver<T> {
  return async (values) => {
    try {
      const result = await schema.safeParseAsync(values);
      if (result.success) {
        return {
          values: result.data as T,
          errors: {},
        };
      }

      const fieldErrors: Record<string, { type: string; message: string }> = {};
      const rawError = result.error as any;
      const issues: any[] = Array.isArray(rawError?.issues)
        ? rawError.issues
        : Array.isArray(rawError?.errors)
          ? rawError.errors
          : [];

      for (const issue of issues) {
        const pathKey = Array.isArray(issue?.path) && issue.path.length > 0
          ? issue.path.join('.')
          : 'root';
        // Chỉ giữ lỗi đầu tiên của mỗi trường để thông báo ngắn gọn, rõ ràng
        if (!fieldErrors[pathKey]) {
          fieldErrors[pathKey] = {
            type: String(issue?.code || 'validation'),
            message: String(issue?.message || 'Dữ liệu không hợp lệ'),
          };
        }
      }

      return {
        values: {} as Record<string, never>,
        errors: fieldErrors as FieldErrors<T>,
      };
    } catch {
      // Dự phòng an toàn tuyệt đối: không bao giờ để Promise bị reject
      return {
        values: {} as Record<string, never>,
        errors: {
          root: {
            type: 'manual',
            message: 'Dữ liệu nhập vào chưa hợp lệ.',
          },
        } as unknown as FieldErrors<T>,
      };
    }
  };
}

/**
 * Đánh giá độ mạnh mật khẩu theo 4 tiêu chí để hiển thị thanh gợi ý trực quan.
 *
 * @param {string} password
 */
export function evaluatePasswordStrength(password: string) {
  const raw = password || '';
  const checks = {
    minLength: raw.length >= 8,
    hasUpper: /[A-Z]/.test(raw),
    hasLower: /[a-z]/.test(raw),
    hasDigit: /[0-9]/.test(raw),
  };

  const score =
    (checks.minLength ? 1 : 0) +
    (checks.hasUpper ? 1 : 0) +
    (checks.hasLower ? 1 : 0) +
    (checks.hasDigit ? 1 : 0);

  let label = 'Chưa đạt';
  if (raw.length === 0) {
    label = '';
  } else if (score <= 1) {
    label = 'Yếu';
  } else if (score === 2) {
    label = 'Trung bình';
  } else if (score === 3) {
    label = 'Khá';
  } else {
    label = 'Mạnh (Đạt chuẩn)';
  }

  return {
    score,
    label,
    checks,
  };
}
