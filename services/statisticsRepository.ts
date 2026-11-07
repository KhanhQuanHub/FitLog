// ============================================================================
// Module: services/statisticsRepository.ts
// Chức năng: Quản lý việc tải, kiểm tra định dạng, lọc theo tài khoản (`userId`)
// và hợp nhất dữ liệu cho 5 nguồn thống kê của FitLog:
// 1. `workouts` (lịch tập từ API `/workouts`)
// 2. `runs` (buổi chạy từ API `/runs` + hàng đợi offline `queue` + bộ nhớ đệm `cache`)
// 3. `profiles` (hồ sơ chiều cao, cân nặng, số buổi/tuần từ API `/profiles`)
// 4. `weights` (lịch sử cân nặng từ API `/weightHistory`)
// 5. `userGoals` (mục tiêu cá nhân từ API `/userGoals`)
//
// Nguyên tắc an toàn:
// - Chỉ ĐỌC dữ liệu (GET / AsyncStorage.getItem), tuyệt đối không ghi đè CSDL.
// - Khi một nguồn bị lỗi mạng, giữ lại dữ liệu cũ trong RAM (đánh dấu `stale: true`)
//   chứ không biến thành mảng rỗng `[]` làm người dùng tưởng nhầm là 0 buổi tập.
// ============================================================================

import type {
  OwnedRecord,
  ProfileRecord,
  RunRecord,
  UserGoalRecord,
  WeightRecord,
  WorkoutRecord,
} from '../domain/statistics/types';

/** Thông tin phiên đăng nhập hiện tại của người dùng */
export interface StatisticsSession {
  userId: string | null;
  revision: number;
}

/** Thông tin lỗi đã được chuẩn hóa sang tiếng Việt thân thiện với người dùng */
export interface StatisticsSourceError {
  kind: 'auth' | 'network' | 'timeout' | 'server' | 'data';
  message: string;
  retryable: boolean;
}

/** Trạng thái của một nguồn dữ liệu thống kê (ví dụ: bảng `workouts` hoặc `runs`) */
export interface StatisticsSource<T> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: readonly T[] | null;
  complete: boolean;
  stale: boolean;
  updatedAt: number | null;
  origin: 'network' | 'memory' | 'cache' | 'queue' | 'mixed' | null;
  error: StatisticsSourceError | null;
  issues: string[];
}

/** Bản chụp (snapshot) chứa toàn bộ 5 nguồn dữ liệu thống kê tại một thời điểm */
export interface StatisticsDataSnapshot {
  session: StatisticsSession;
  workouts: StatisticsSource<WorkoutRecord>;
  runs: StatisticsSource<RunRecord>;
  profiles: StatisticsSource<ProfileRecord>;
  weights: StatisticsSource<WeightRecord>;
  userGoals: StatisticsSource<UserGoalRecord>;
}

/** Tập hợp các hàm đọc dữ liệu bất đồng bộ từ API và AsyncStorage */
export interface StatisticsReaders {
  workouts: () => Promise<unknown>;
  runs: () => Promise<unknown>;
  profiles: () => Promise<unknown>;
  weights: () => Promise<unknown>;
  userGoals: () => Promise<unknown>;
  queue: () => Promise<unknown>;
  cache: () => Promise<unknown>;
}

/** Các phụ thuộc truyền vào khi khởi tạo `createStatisticsRepository` */
export interface StatisticsRepositoryDependencies {
  read: StatisticsReaders;
  getSession: () => StatisticsSession;
  ownsQueuedRun: (clientId: string, session: StatisticsSession) => boolean;
  subscribeSession?: (listener: () => void) => () => void;
  subscribeRuns?: (listener: () => void) => () => void;
  now?: () => number;
}

// ============================================================================
// PHẦN 1: CÁC HÀM KIỂM TRA & CHUẨN HÓA DỮ LIỆU ĐẦU VÀO
// ============================================================================

/**
 * Kiểm tra hai phiên đăng nhập có giống hệt nhau cả về `userId` lẫn số `revision` không.
 *
 * @param a Phiên thứ nhất
 * @param b Phiên thứ hai
 * @returns `true` nếu cùng là một phiên đăng nhập
 */
function sameSession(a: StatisticsSession, b: StatisticsSession): boolean {
  return a.userId === b.userId && a.revision === b.revision;
}

/**
 * Chuẩn hóa một mã ID bất kỳ về chuỗi khác rỗng; trả về `null` nếu không hợp lệ.
 *
 * @param value Giá trị ID (số hoặc chuỗi)
 * @returns Chuỗi ID hoặc `null`
 */
function id(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Lấy mã `clientId` hợp lệ của một bản ghi buổi chạy.
 *
 * @param row Bản ghi buổi chạy
 * @returns Chuỗi `clientId` hoặc `null`
 */
function clientId(row: RunRecord): string | null {
  if (typeof row.clientId === 'string' && row.clientId.trim()) {
    return row.clientId;
  }
  return null;
}

/**
 * Tạo trạng thái mặc định ban đầu (`idle`, chưa có dữ liệu) cho một nguồn dữ liệu.
 *
 * @returns Đối tượng `StatisticsSource` rỗng
 */
function emptySource<T>(): StatisticsSource<T> {
  return {
    status: 'idle',
    data: null,
    complete: false,
    stale: false,
    updatedAt: null,
    origin: null,
    error: null,
    issues: [],
  };
}

/**
 * Tạo bản chụp (snapshot) rỗng cho tất cả 5 nguồn dữ liệu ứng với phiên `session`.
 *
 * @param session Phiên đăng nhập hiện tại
 * @returns Đối tượng `StatisticsDataSnapshot` ở trạng thái `idle`
 */
function emptySnapshot(session: StatisticsSession): StatisticsDataSnapshot {
  return {
    session: { ...session },
    workouts: emptySource(),
    runs: emptySource(),
    profiles: emptySource(),
    weights: emptySource(),
    userGoals: emptySource(),
  };
}

/** Lỗi nội bộ dùng để đánh dấu dữ liệu JSON trả về không đúng cấu trúc mảng các object */
class InvalidStatisticsData extends Error {}

/**
 * Chuyển một lỗi bất kỳ từ mạng hoặc bộ nhớ thành đối tượng `StatisticsSourceError`
 * có thông báo tiếng Việt rõ ràng, không làm lộ thông tin lỗi kỹ thuật nội bộ.
 *
 * @param error Lỗi bắt được trong `catch`
 * @returns Đối tượng lỗi `StatisticsSourceError`
 */
function sourceError(error: unknown): StatisticsSourceError {
  const detail =
    error && typeof error === 'object'
      ? (error as { status?: unknown; kind?: unknown })
      : {};

  if (detail.status === 401 || detail.status === 403) {
    return {
      kind: 'auth',
      message: 'Cần đăng nhập lại để tải thống kê.',
      retryable: false,
    };
  }
  if (detail.status === 408 || detail.kind === 'TIMEOUT') {
    return {
      kind: 'timeout',
      message: 'Tải dữ liệu quá thời gian chờ. Hãy thử lại.',
      retryable: true,
    };
  }
  if (error instanceof InvalidStatisticsData) {
    return {
      kind: 'data',
      message: 'Dữ liệu trả về không đúng định dạng.',
      retryable: true,
    };
  }
  if (typeof detail.status === 'number' && detail.status >= 500) {
    return {
      kind: 'server',
      message: 'Máy chủ chưa tải được dữ liệu. Hãy thử lại.',
      retryable: true,
    };
  }
  return {
    kind: 'network',
    message: 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.',
    retryable: true,
  };
}

/**
 * Kiểm tra dữ liệu trả về từ API hoặc bộ nhớ có phải là một mảng chứa các object hay không.
 * Nếu dữ liệu bị hỏng (ví dụ `null`, số nguyên, hoặc object lẻ), ném lỗi `InvalidStatisticsData`.
 *
 * @param value Dữ liệu thô cần kiểm tra
 * @returns Mảng các bản ghi hợp lệ
 */
function rows<T>(value: unknown): T[] {
  const isInvalidItem = (row: unknown) =>
    row === null || typeof row !== 'object' || Array.isArray(row);

  if (!Array.isArray(value) || value.some(isInvalidItem)) {
    throw new InvalidStatisticsData();
  }
  return value as T[];
}

/**
 * Giải mã chuỗi JSON đọc từ `AsyncStorage` (ví dụ hàng đợi `QUEUE` hoặc `HISTORY_CACHE`).
 * - Nếu khóa chưa tồn tại (`value === null`) -> trả về mảng rỗng `[]`.
 * - Nếu chuỗi JSON bị hỏng -> ném lỗi `InvalidStatisticsData` để giao diện báo cảnh báo.
 *
 * @param value Chuỗi JSON đọc từ AsyncStorage
 * @returns Dữ liệu sau khi `JSON.parse`
 */
export function parseStatisticsStorage(value: string | null): unknown {
  if (value === null) return [];
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidStatisticsData();
  }
}

/**
 * Lọc danh sách bản ghi theo đúng mã người dùng `userId` và đếm số bản ghi bị thiếu `userId`.
 *
 * @param value Dữ liệu thô đọc từ nguồn
 * @param userId Mã người dùng đang đăng nhập
 * @returns Mảng `data` của người dùng và số lượng bản ghi không rõ chủ `unknownOwners`
 */
function filterOwned<T extends OwnedRecord>(
  value: unknown,
  userId: string
): { data: T[]; unknownOwners: number } {
  const data: T[] = [];
  let unknownOwners = 0;

  for (const row of rows<T>(value)) {
    const owner = id(row.userId);
    if (owner === null) {
      unknownOwners += 1;
    } else if (owner === userId) {
      data.push(row);
    }
  }

  return { data, unknownOwners };
}

// ============================================================================
// PHẦN 2: CÁC HÀM HỢP NHẤT & LỌC TRÙNG DỮ LIỆU CHẠY BỘ (RUNS)
// ============================================================================

/**
 * Hợp nhất các danh sách buổi chạy từ nhiều nguồn (ví dụ: `[server, pending, cached]`)
 * và khử trùng lặp sao cho mỗi buổi chạy thực tế chỉ xuất hiện 1 lần.
 *
 * Quy tắc dễ hiểu:
 * - Nhóm đứng trước trong mảng `groups` có độ ưu tiên cao hơn (Server ưu tiên hơn Queue).
 * - Hai bản ghi của cùng một `userId` được coi là cùng một buổi chạy nếu trùng `clientId`
 *   HOẶC trùng `id` trên server.
 * - Nếu có một bản ghi trung gian chứa cả `id` và `clientId`, nó sẽ nối 2 bản ghi rời
 *   lại thành một nhóm và giữ lại bản ghi xuất hiện sớm nhất (ưu tiên cao nhất).
 *
 * @param groups Danh sách các mảng buổi chạy theo thứ tự ưu tiên giảm dần
 * @returns Mảng buổi chạy đã gộp và loại bỏ bản trùng
 */
export function mergeStatisticsRuns(
  groups: readonly (readonly RunRecord[])[]
): RunRecord[] {
  interface MergedRunGroup {
    /** Bản ghi có độ ưu tiên cao nhất đại diện cho buổi chạy này */
    record: RunRecord;
    /** Mã người dùng sở hữu buổi chạy */
    owner: string;
    /** Tập hợp các clientId thuộc cùng buổi chạy này */
    clientIds: Set<string>;
    /** Tập hợp các id server thuộc cùng buổi chạy này */
    serverIds: Set<string>;
  }

  const mergedGroups: MergedRunGroup[] = [];

  for (const row of groups.flat()) {
    const owner = id(row.userId);
    if (owner === null) continue;

    const cId = clientId(row);
    const sId = id(row.id);
    // Bỏ qua bản ghi không có cả clientId lẫn id vì không thể định danh
    if (!cId && !sId) continue;

    // Tìm tất cả các nhóm đã tạo của cùng người dùng có trùng clientId hoặc trùng id
    const matchingIndexes: number[] = [];
    for (let i = 0; i < mergedGroups.length; i += 1) {
      const group = mergedGroups[i];
      if (group.owner !== owner) continue;

      const sameClient = cId !== null && group.clientIds.has(cId);
      const sameServerId = sId !== null && group.serverIds.has(sId);
      if (sameClient || sameServerId) {
        matchingIndexes.push(i);
      }
    }

    if (matchingIndexes.length === 0) {
      // Chưa từng gặp buổi chạy này -> tạo nhóm mới với `row` là bản ghi ưu tiên cao nhất
      const newGroup: MergedRunGroup = {
        record: row,
        owner,
        clientIds: new Set(cId ? [cId] : []),
        serverIds: new Set(sId ? [sId] : []),
      };
      mergedGroups.push(newGroup);
    } else {
      // Đã tồn tại ít nhất 1 nhóm khớp -> giữ lại nhóm đầu tiên (có độ ưu tiên cao nhất)
      const primaryIndex = matchingIndexes[0];
      const primaryGroup = mergedGroups[primaryIndex];
      if (cId) primaryGroup.clientIds.add(cId);
      if (sId) primaryGroup.serverIds.add(sId);

      // Nếu bản ghi này bắc cầu nối 2 nhóm rời nhau, gộp các nhóm sau vào nhóm đầu tiên
      for (let k = matchingIndexes.length - 1; k >= 1; k -= 1) {
        const secondaryIndex = matchingIndexes[k];
        const secondaryGroup = mergedGroups[secondaryIndex];
        for (const item of secondaryGroup.clientIds) primaryGroup.clientIds.add(item);
        for (const item of secondaryGroup.serverIds) primaryGroup.serverIds.add(item);
        mergedGroups.splice(secondaryIndex, 1);
      }
    }
  }

  return mergedGroups.map((group) => group.record);
}

/**
 * Gọi hàm đọc dữ liệu bất đồng bộ và kiểm tra kết quả phải là mảng các object.
 *
 * @param read Hàm đọc dữ liệu
 * @returns Mảng các bản ghi hợp lệ
 */
async function validatedRead(read: () => Promise<unknown>): Promise<OwnedRecord[]> {
  const raw = await read();
  return rows<OwnedRecord>(raw);
}

/**
 * Xác định nguồn gốc dữ liệu chạy bộ (`origin`) một cách tường minh.
 *
 * @param online Đã tải thành công từ mạng hay chưa
 * @param hasPending Có buổi chạy đang chờ trong hàng đợi offline không
 * @param hasPrevious Có dữ liệu từ lần tải trước trong bộ nhớ RAM không
 * @param hasCached Có dữ liệu từ bộ nhớ đệm lịch sử trên máy không
 * @returns Nhãn nguồn gốc dữ liệu
 */
function resolveRunsOrigin(
  online: boolean,
  hasPending: boolean,
  hasPrevious: boolean,
  hasCached: boolean
): StatisticsSource<RunRecord>['origin'] {
  if (online) {
    return hasPending ? 'mixed' : 'network';
  }
  if (hasPrevious) {
    return 'memory';
  }
  if (hasCached) {
    return hasPending ? 'mixed' : 'cache';
  }
  if (hasPending) {
    return 'queue';
  }
  return null;
}

/**
 * Trích xuất danh sách các buổi chạy đang chờ đồng bộ (`_queued: true`) từ kết quả đọc `queue`.
 *
 * @param queueResult Kết quả đọc `AsyncStorage` của hàng đợi `QUEUE`
 * @param session Phiên đăng nhập hiện tại
 * @param ownsQueuedRun Hàm kiểm tra buổi chạy không có `userId` có thuộc phiên RAM hiện tại không
 * @returns Danh sách `pending`, số bản ghi thiếu chủ `missingOwners`, số bản ghi thiếu mã `unidentifiedRuns` và cờ lỗi đọc `readFailed`
 */
function extractQueuedRuns(
  queueResult: PromiseSettledResult<OwnedRecord[]>,
  session: StatisticsSession,
  ownsQueuedRun: (clientId: string, session: StatisticsSession) => boolean
) {
  const pending: RunRecord[] = [];
  let missingOwners = 0;
  let unidentifiedRuns = 0;

  if (queueResult.status !== 'fulfilled') {
    return { pending, missingOwners, unidentifiedRuns, readFailed: true };
  }

  for (const row of queueResult.value as RunRecord[]) {
    const owner = id(row.userId);
    const client = clientId(row);
    // Nếu bản ghi trong queue chưa có userId nhưng được tạo trong chính phiên đăng nhập hiện tại
    const provenByCurrentSession =
      owner === null && client !== null && ownsQueuedRun(client, session);

    if (owner === session.userId || provenByCurrentSession) {
      if (!client) {
        unidentifiedRuns += 1;
        continue;
      }
      pending.push({ ...row, userId: session.userId, _queued: true });
    } else if (owner === null) {
      missingOwners += 1;
    }
  }

  return { pending, missingOwners, unidentifiedRuns, readFailed: false };
}

/**
 * Đọc một nguồn dữ liệu bảng thông thường (`workouts`, `profiles`, `weights`, `userGoals`)
 * từ API và lọc theo `userId`. Nếu lỗi mạng thì giữ lại dữ liệu cũ trong `previousSource`.
 *
 * @param readFn Hàm gọi API của bảng đó
 * @param previousSource Trạng thái trước đó của nguồn dữ liệu
 * @param userId Mã người dùng đang đăng nhập
 * @param now Hàm lấy timestamp hiện tại
 * @returns Trạng thái `StatisticsSource` mới của bảng
 */
async function loadStandardTableSource(
  readFn: () => Promise<unknown>,
  previousSource: StatisticsSource<OwnedRecord>,
  userId: string,
  now: () => number
): Promise<StatisticsSource<OwnedRecord>> {
  try {
    const rawData = await readFn();
    const owned = filterOwned<OwnedRecord>(rawData, userId);
    return {
      status: 'success',
      data: owned.data,
      complete: owned.unknownOwners === 0,
      stale: false,
      updatedAt: now(),
      origin: 'network',
      error: null,
      issues: owned.unknownOwners > 0 ? [`unknown-owners:${owned.unknownOwners}`] : [],
    };
  } catch (error) {
    const hasOldData = previousSource.data !== null;
    return {
      ...previousSource,
      status: 'error',
      complete: false,
      stale: hasOldData,
      origin: hasOldData ? 'memory' : null,
      error: sourceError(error),
    };
  }
}

// ============================================================================
// PHẦN 3: KHỞI TẠO REPOSITORY QUẢN LÝ TRẠNG THÁI 5 NGUỒN DỮ LIỆU
// ============================================================================

/**
 * Khởi tạo bộ quản lý dữ liệu thống kê (`StatisticsRepository`).
 * Chỉ thực hiện các thao tác đọc (GET / AsyncStorage.getItem), không sửa đổi CSDL.
 *
 * @param deps Các hàm đọc dữ liệu và quản lý phiên truyền từ bên ngoài
 * @returns Đối tượng repository với các hàm `getSnapshot`, `refresh`, `subscribe`, `dispose`
 */
export function createStatisticsRepository(deps: StatisticsRepositoryDependencies) {
  let state = emptySnapshot(deps.getSession());
  let requestId = 0;
  let disposed = false;
  let started = false;
  const listeners = new Set<() => void>();
  const now = deps.now ?? Date.now;

  /**
   * Thông báo cho toàn bộ các component đang lắng nghe biết `state` vừa cập nhật.
   */
  function emit() {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Bỏ qua nếu một listener trên UI gặp lỗi để không làm hỏng dữ liệu chung
      }
    }
  }

  /**
   * Kiểm tra xem phiên đăng nhập hiện tại có thay đổi so với `state.session` không.
   * Nếu người dùng vừa đăng xuất hoặc đổi tài khoản, xóa ngay dữ liệu cũ trong `state`.
   *
   * @returns `true` nếu phiên vừa thay đổi
   */
  function synchronizeSession(): boolean {
    const current = deps.getSession();
    if (sameSession(state.session, current)) {
      return false;
    }
    requestId += 1;
    state = emptySnapshot(current);
    emit();
    return true;
  }

  /**
   * Lấy bản chụp dữ liệu thống kê hiện tại.
   *
   * @returns Đối tượng `StatisticsDataSnapshot`
   */
  function getSnapshot(): StatisticsDataSnapshot {
    if (!disposed) {
      synchronizeSession();
    }
    return state;
  }

  /**
   * Kết hợp dữ liệu buổi chạy từ 3 nguồn: Mạng (`network`), Hàng đợi (`queue`) và Bộ nhớ đệm (`cache`).
   *
   * @param previous Trạng thái nguồn `runs` trước đó
   * @param session Phiên đăng nhập đang xét
   * @param network Kết quả đọc API `/runs`
   * @param queue Kết quả đọc `AsyncStorage` hàng đợi chờ đồng bộ
   * @param cache Kết quả đọc `AsyncStorage` bộ nhớ đệm lịch sử
   * @returns Trạng thái mới của nguồn dữ liệu `runs`
   */
  function mergeRunSources(
    previous: StatisticsSource<RunRecord>,
    session: StatisticsSession,
    network: PromiseSettledResult<OwnedRecord[]>,
    queue: PromiseSettledResult<OwnedRecord[]>,
    cache: PromiseSettledResult<OwnedRecord[]>
  ): StatisticsSource<RunRecord> {
    const issues: string[] = [];
    let server: RunRecord[] | null = null;
    let missingOwners = 0;

    // Bước 1: Đọc dữ liệu từ Server (nếu tải mạng thành công)
    if (network.status === 'fulfilled') {
      const owned = filterOwned<RunRecord>(network.value, session.userId!);
      missingOwners += owned.unknownOwners;
      server = owned.data.map((row) => ({ ...row, _queued: false }));
    }

    // Bước 2: Đọc dữ liệu từ Hàng đợi offline (Queue)
    const queueExtracted = extractQueuedRuns(queue, session, deps.ownsQueuedRun);
    const pending = queueExtracted.pending;
    missingOwners += queueExtracted.missingOwners;
    let unidentifiedRuns = queueExtracted.unidentifiedRuns;
    if (queueExtracted.readFailed) {
      issues.push('queue-read-failed');
    }

    // Bước 3: Đọc dữ liệu từ Bộ nhớ đệm lịch sử (Cache) khi mất mạng
    const cached: RunRecord[] = [];
    if (cache.status === 'fulfilled') {
      const owned = filterOwned<RunRecord>(cache.value, session.userId!);
      cached.push(...owned.data.map((row) => ({ ...row, _queued: false })));
      if (network.status === 'rejected') {
        missingOwners += owned.unknownOwners;
      }
    } else if (network.status === 'rejected') {
      issues.push('cache-read-failed');
    }

    if (missingOwners > 0) {
      issues.push(`unknown-owners:${missingOwners}`);
    }

    // Bước 4: Xếp thứ tự ưu tiên để gộp các bản ghi chạy bộ
    const previousSaved = previous.data?.filter((row) => row._queued !== true) ?? [];
    const previousPending = previous.data?.filter((row) => row._queued === true) ?? [];
    const fallbackPending = queue.status === 'rejected' ? previousPending : [];

    const groups =
      server !== null
        ? [server, pending, fallbackPending]
        : [previousSaved, cached, pending, fallbackPending];

    for (const row of groups.flat()) {
      if (!clientId(row) && id(row.id) === null) {
        unidentifiedRuns += 1;
      }
    }
    if (unidentifiedRuns > 0) {
      issues.push(`unidentified-runs:${unidentifiedRuns}`);
    }

    const merged = mergeStatisticsRuns(groups);
    const hasData = server !== null || merged.length > 0 || previous.data !== null;
    const online = network.status === 'fulfilled';

    return {
      status: online ? 'success' : 'error',
      data: hasData ? merged : null,
      complete: online && issues.length === 0,
      stale: !online || (queue.status === 'rejected' && previousPending.length > 0),
      updatedAt: online ? now() : previous.updatedAt,
      origin: resolveRunsOrigin(
        online,
        pending.length > 0,
        previous.data !== null,
        cached.length > 0
      ),
      error: network.status === 'rejected' ? sourceError(network.reason) : null,
      issues,
    };
  }

  /**
   * Đọc dữ liệu buổi chạy: đọc `queue` và `cache` trên máy trước để hiển thị ngay
   * nếu mạng chậm, sau đó cập nhật bản đầy đủ khi API `/runs` trả về.
   *
   * @param previous Trạng thái nguồn `runs` trước đó
   * @param session Phiên đăng nhập hiện tại
   * @param publishLocal Hàm callback cập nhật tạm dữ liệu local lên màn hình trong lúc chờ mạng
   * @returns Trạng thái nguồn `runs` cuối cùng sau khi mạng kết thúc
   */
  async function readRuns(
    previous: StatisticsSource<RunRecord>,
    session: StatisticsSession,
    publishLocal: (source: StatisticsSource<RunRecord>) => void
  ): Promise<StatisticsSource<RunRecord>> {
    let networkFinished = false;

    const networkPromise: Promise<PromiseSettledResult<OwnedRecord[]>> = validatedRead(
      deps.read.runs
    ).then(
      (value) => {
        networkFinished = true;
        return { status: 'fulfilled' as const, value };
      },
      (reason) => {
        networkFinished = true;
        return { status: 'rejected' as const, reason };
      }
    );

    const [queue, cache] = await Promise.allSettled([
      validatedRead(deps.read.queue),
      validatedRead(deps.read.cache),
    ]);

    if (!networkFinished) {
      const localPreview = mergeRunSources(
        previous,
        session,
        { status: 'rejected', reason: null },
        queue,
        cache
      );
      publishLocal({
        ...localPreview,
        status: 'loading',
        error: null,
        complete: false,
      });
    }

    const networkResult = await networkPromise;
    return mergeRunSources(previous, session, networkResult, queue, cache);
  }

  /**
   * Làm mới toàn bộ 5 nguồn dữ liệu thống kê một cách độc lập (nguồn nào xong trước hiện trước).
   *
   * @returns Bản chụp `StatisticsDataSnapshot` sau khi tất cả các nguồn đã hoàn tất
   */
  async function refresh(): Promise<StatisticsDataSnapshot> {
    if (disposed) return state;
    synchronizeSession();
    if (state.session.userId === null) {
      emit();
      return state;
    }

    started = true;
    const session = { ...state.session };
    const version = ++requestId;
    const previous = state;
    const sourceKeys = ['workouts', 'runs', 'profiles', 'weights', 'userGoals'] as const;

    // Chuyển trạng thái cả 5 nguồn sang 'loading', vẫn giữ mảng data cũ (nếu có) kèm cờ stale
    const next = { ...state };
    for (const key of sourceKeys) {
      Object.assign(next, {
        [key]: {
          ...previous[key],
          status: 'loading',
          stale: previous[key].data !== null,
          error: null,
        },
      });
    }
    state = next;
    emit();

    /** Kiểm tra xem yêu cầu tải `version` này có còn là yêu cầu mới nhất của phiên hiện tại không */
    function isCurrentRequest(): boolean {
      return !disposed && version === requestId && sameSession(session, deps.getSession());
    }

    await Promise.all(
      sourceKeys.map(async (key) => {
        let result: StatisticsSource<OwnedRecord>;
        if (key === 'runs') {
          result = await readRuns(previous.runs, session, (localRuns) => {
            if (isCurrentRequest()) {
              state = { ...state, runs: localRuns };
              emit();
            }
          });
        } else {
          result = await loadStandardTableSource(
            deps.read[key],
            previous[key],
            session.userId!,
            now
          );
        }

        if (isCurrentRequest()) {
          state = { ...state, [key]: result };
          emit();
        }
      })
    );

    return getSnapshot();
  }

  // Tự động đồng bộ lại khi người dùng đổi tài khoản hoặc khi có buổi chạy mới
  const unsubscribeSession = deps.subscribeSession?.(() => {
    synchronizeSession();
    if (started && !disposed && deps.getSession().userId !== null) {
      void refresh();
    }
  });

  const unsubscribeRuns = deps.subscribeRuns?.(() => {
    if (started && !disposed) {
      void refresh();
    }
  });

  return {
    getSnapshot,
    refresh,
    /**
     * Đăng ký lắng nghe mỗi khi trạng thái dữ liệu thống kê thay đổi.
     * @param listener Hàm callback không tham số
     * @returns Hàm hủy đăng ký
     */
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * Dọn dẹp toàn bộ bộ lắng nghe và hủy các yêu cầu mạng đang chờ khi đóng màn thống kê.
     */
    dispose() {
      disposed = true;
      requestId += 1;
      unsubscribeSession?.();
      unsubscribeRuns?.();
      listeners.clear();
      state = emptySnapshot({
        userId: null,
        revision: state.session.revision + 1,
      });
    },
  };
}

export type StatisticsRepository = ReturnType<typeof createStatisticsRepository>;
