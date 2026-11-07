// ============================================================================
// utils/errorHandler.ts
// Bộ xử lý lỗi tập trung dùng chung cho màn Đăng nhập, Đăng ký và các lời gọi API:
// - Chuyển mọi loại lỗi (ZodError, ApiError, lỗi mạng, timeout, lỗi máy chủ)
//   về thông báo tiếng Việt ngắn gọn, dễ hiểu cho người dùng.
// - Đảm bảo không bao giờ để lộ chi tiết nhạy cảm (như email có tồn tại hay không
//   khi đăng nhập sai) và không ném lỗi chưa bắt ra console.
// ============================================================================

export type NormalizedError = {
  message: string;
  retryable: boolean;
  status: number;
};

/**
 * Chuyển đổi mọi đối tượng lỗi thành thông tin chuẩn hóa { message, retryable, status }.
 *
 * @param {unknown} error Đối tượng lỗi bắt được từ try/catch
 * @param {'login' | 'register' | 'general'} [context='general'] Ngữ cảnh gọi hàm
 * @returns {NormalizedError}
 */
export function normalizeError(
  error: unknown,
  context: 'login' | 'register' | 'general' = 'general'
): NormalizedError {
  if (!error) {
    return {
      message: 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.',
      retryable: true,
      status: 0,
    };
  }

  const anyErr = error as any;

  // 1. Nếu là ZodError (Zod v4 dùng .issues, Zod v3 dùng .errors)
  const zodIssues = Array.isArray(anyErr?.issues)
    ? anyErr.issues
    : Array.isArray(anyErr?.errors)
      ? anyErr.errors
      : null;

  if (anyErr?.name === 'ZodError' || zodIssues) {
    const firstIssue = zodIssues && zodIssues.length > 0 ? zodIssues[0] : null;
    return {
      message: firstIssue?.message || 'Dữ liệu nhập vào chưa hợp lệ.',
      retryable: false,
      status: 400,
    };
  }

  const status = typeof anyErr?.status === 'number' ? anyErr.status : 0;
  const rawMessage = typeof anyErr?.message === 'string' ? anyErr.message.trim() : '';

  // 2. Sai thông tin xác thực (401)
  if (status === 401) {
    if (context === 'login') {
      // Quy tắc bảo mật: dùng chung 1 câu, không tiết lộ email có tồn tại hay không
      return {
        message: 'Email hoặc mật khẩu không đúng',
        retryable: false,
        status: 401,
      };
    }
    return {
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      retryable: false,
      status: 401,
    };
  }

  // 3. Trùng email khi đăng ký (409)
  if (status === 409 || /tồn tại|exists|duplicate/i.test(rawMessage)) {
    return {
      message: 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.',
      retryable: false,
      status: 409,
    };
  }

  // 4. Quá số lần thử sai liên tiếp (429)
  if (status === 429) {
    return {
      message:
        rawMessage || 'Bạn đã thử sai quá nhiều lần. Vui lòng đợi một lát rồi thử lại.',
      retryable: false,
      status: 429,
    };
  }

  // 5. Dữ liệu gửi lên không hợp lệ (400 / 422)
  if (status === 400 || status === 422) {
    if (context === 'login') {
      return {
        message: 'Email hoặc mật khẩu không đúng',
        retryable: false,
        status,
      };
    }
    return {
      message: rawMessage || 'Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra lại.',
      retryable: false,
      status,
    };
  }

  // 6. Hết thời gian chờ (Timeout 408 / AbortError)
  if (
    status === 408 ||
    anyErr?.name === 'AbortError' ||
    /timeout|quá hạn|hết thời gian/i.test(rawMessage)
  ) {
    return {
      message: 'Hết thời gian chờ phản hồi từ máy chủ. Vui lòng thử lại.',
      retryable: true,
      status: 408,
    };
  }

  // 7. Lỗi máy chủ (5xx)
  if (status >= 500) {
    return {
      message: 'Máy chủ đang gặp sự cố tạm thời. Vui lòng thử lại.',
      retryable: true,
      status,
    };
  }

  // 8. Mất kết nối mạng (status = 0 / Network request failed)
  if (
    status === 0 ||
    anyErr?.kind === 'NETWORK' ||
    /network|fetch|kết nối|offline/i.test(rawMessage)
  ) {
    return {
      message:
        anyErr?.name === 'ApiError' && rawMessage
          ? rawMessage
          : 'Không thể kết nối máy chủ. Vui lòng kiểm tra Wi-Fi và đảm bảo json-server đang chạy trên laptop.',
      retryable: true,
      status: 0,
    };
  }

  return {
    message: rawMessage || 'Đã xảy ra lỗi. Vui lòng thử lại.',
    retryable: Boolean(anyErr?.retryable),
    status,
  };
}

/**
 * Hàm tiện ích trả về chuỗi thông báo lỗi tiếng Việt thân thiện.
 *
 * @param {unknown} error
 * @param {'login' | 'register' | 'general'} [context='general']
 * @returns {string}
 */
export function getErrorMessage(
  error: unknown,
  context: 'login' | 'register' | 'general' = 'general'
): string {
  return normalizeError(error, context).message;
}
