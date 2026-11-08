// ============================================================================
// utils/lanDiscovery.js
// Các hàm thuần JavaScript phục vụ tự động dò tìm FitLog Server trong mạng LAN:
// - Xác thực đúng FitLog Server (tránh nhận nhầm web server khác mở cùng cổng).
// - Đua song song (race) danh sách ứng viên và hủy ngay các kết nối thừa khi tìm thấy.
// - Sắp xếp thứ tự ưu tiên quét dải /24 để tìm ra IP máy tính nhanh nhất.
// - Nâng cấp từ tên miền mDNS (.local) sang IPv4 trực tiếp để giảm độ trễ các lần gọi sau.
// ============================================================================

export const DEFAULT_SERVER_PORT = 3000;
export const MDNS_SERVER_HOSTNAME = 'fitlog-server.local';

/**
 * Kiểm tra chuỗi có phải địa chỉ IPv4 nội bộ (RFC 1918: 10.x, 172.16-31.x, 192.168.x) hay không.
 *
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateIpv4(ip) {
  if (typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/**
 * Kiểm tra nhanh một địa chỉ baseUrl có đúng là FitLog Server đang sống hay không.
 * Dùng GET /goals?_limit=1 (công khai, không cần token, tương thích cả bản server cũ & mới)
 * để tránh nhận nhầm các web server khác tình cờ mở cổng 3000 trong cùng Wi-Fi.
 *
 * @param {string} baseUrl
 * @param {number} timeoutMs
 * @param {AbortSignal} [parentSignal]
 * @returns {Promise<string | null>} Trả về baseUrl chuẩn hóa nếu hợp lệ, ngược lại trả null
 */
export async function probeFitLogServer(baseUrl, timeoutMs, parentSignal) {
  if (!baseUrl || typeof baseUrl !== 'string') return null;
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) return null;

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();

  if (parentSignal) {
    if (parentSignal.aborted) return null;
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${normalized}/goals?_limit=1`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && (data.length === 0 || typeof data[0]?.id !== 'undefined')) {
      return normalized;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/**
 * Đua song song một nhóm URL ứng viên: trả về ngay URL đầu tiên phản hồi hợp lệ
 * và hủy tức thì các kết nối còn lại để tiết kiệm tài nguyên.
 *
 * @param {string[]} urls
 * @param {number} timeoutMs
 * @returns {Promise<string | null>}
 */
export function raceServerCandidates(urls, timeoutMs) {
  const uniqueUrls = Array.from(
    new Set((urls || []).map((u) => (typeof u === 'string' ? u.trim() : '')).filter(Boolean))
  );
  if (uniqueUrls.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    const batchController = new AbortController();
    let remaining = uniqueUrls.length;
    let settled = false;

    for (const candidate of uniqueUrls) {
      probeFitLogServer(candidate, timeoutMs, batchController.signal).then((matched) => {
        if (settled) return;
        if (matched) {
          settled = true;
          batchController.abort();
          resolve(matched);
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          settled = true;
          resolve(null);
        }
      });
    }
  });
}

/**
 * Sắp xếp thứ tự ưu tiên các địa chỉ IP trong dải /24 để tìm thấy nhanh nhất:
 * Ưu tiên các dải DHCP phổ biến (.1-.60, .100-.145, .200-.254) trước.
 *
 * @param {string} prefix3 Ví dụ "10.88.237" hoặc "192.168.1"
 * @param {number} selfLastOctet Octet cuối của chính điện thoại để bỏ qua
 * @param {number} [port=DEFAULT_SERVER_PORT]
 * @returns {string[]}
 */
export function buildPrioritizedSubnetUrls(prefix3, selfLastOctet, port = DEFAULT_SERVER_PORT) {
  const priorityOctets = [];
  const secondaryOctets = [];

  for (let i = 1; i <= 254; i += 1) {
    if (i === selfLastOctet) continue;
    if ((i >= 1 && i <= 60) || (i >= 100 && i <= 145) || i >= 200) {
      priorityOctets.push(i);
    } else {
      secondaryOctets.push(i);
    }
  }

  return [...priorityOctets, ...secondaryOctets].map((octet) => `http://${prefix3}.${octet}:${port}`);
}

/**
 * Nếu tìm thấy máy chủ qua tên miền mDNS (.local), thử hỏi /__fitlog_ping để đổi sang
 * địa chỉ IPv4 cụ thể (giúp các request API tiếp theo kết nối thẳng bằng TCP nhanh hơn,
 * không phải phân giải lại mDNS ở mỗi lần gọi).
 *
 * @param {string} matchedUrl
 * @param {number} [port=DEFAULT_SERVER_PORT]
 * @param {number} [timeoutMs=550]
 * @returns {Promise<string>}
 */
export async function promoteMdnsToConcreteIp(
  matchedUrl,
  port = DEFAULT_SERVER_PORT,
  timeoutMs = 550
) {
  if (!matchedUrl || !matchedUrl.includes('.local')) {
    return matchedUrl;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${matchedUrl}/__fitlog_ping`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return matchedUrl;
    const info = await res.json();
    if (info?.app !== 'fitlog-server' || !Array.isArray(info.ips) || info.ips.length === 0) {
      return matchedUrl;
    }

    const ipCandidates = info.ips
      .filter((ip) => typeof ip === 'string' && ip.trim() !== '')
      .map((ip) => `http://${ip.trim()}:${port}`);

    const directWinner = await raceServerCandidates(ipCandidates, timeoutMs);
    return directWinner || matchedUrl;
  } catch {
    return matchedUrl;
  } finally {
    clearTimeout(timer);
  }
}
