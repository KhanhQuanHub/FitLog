import type {
  OwnedRecord, ProfileRecord, RunRecord,
  UserGoalRecord, WeightRecord, WorkoutRecord,
} from '../domain/statistics/types';

export interface StatisticsSession { userId: string | null; revision: number }
export interface StatisticsSourceError {
  kind: 'auth' | 'network' | 'timeout' | 'server' | 'data';
  message: string;
  retryable: boolean;
}
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
export interface StatisticsDataSnapshot {
  session: StatisticsSession;
  workouts: StatisticsSource<WorkoutRecord>;
  runs: StatisticsSource<RunRecord>;
  profiles: StatisticsSource<ProfileRecord>;
  weights: StatisticsSource<WeightRecord>;
  userGoals: StatisticsSource<UserGoalRecord>;
}
export interface StatisticsReaders {
  workouts: () => Promise<unknown>;
  runs: () => Promise<unknown>;
  profiles: () => Promise<unknown>;
  weights: () => Promise<unknown>;
  userGoals: () => Promise<unknown>;
  queue: () => Promise<unknown>;
  cache: () => Promise<unknown>;
}
export interface StatisticsRepositoryDependencies {
  read: StatisticsReaders;
  getSession: () => StatisticsSession;
  ownsQueuedRun: (clientId: string, session: StatisticsSession) => boolean;
  subscribeSession?: (listener: () => void) => () => void;
  subscribeRuns?: (listener: () => void) => () => void;
  now?: () => number;
}

function sameSession(a: StatisticsSession, b: StatisticsSession): boolean {
  return a.userId === b.userId && a.revision === b.revision;
}

function id(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function clientId(row: RunRecord): string | null {
  return typeof row.clientId === 'string' && row.clientId.trim() ? row.clientId : null;
}

function emptySource<T>(): StatisticsSource<T> {
  return { status: 'idle', data: null, complete: false, stale: false, updatedAt: null, origin: null, error: null, issues: [] };
}

function emptySnapshot(session: StatisticsSession): StatisticsDataSnapshot {
  return { session: { ...session }, workouts: emptySource(), runs: emptySource(), profiles: emptySource(), weights: emptySource(), userGoals: emptySource() };
}

function sourceError(error: unknown): StatisticsSourceError {
  const detail = error && typeof error === 'object' ? error as { status?: unknown; kind?: unknown } : {};
  if (detail.status === 401 || detail.status === 403) return { kind: 'auth', message: 'Cần đăng nhập lại để tải thống kê.', retryable: false };
  if (detail.status === 408 || detail.kind === 'TIMEOUT') return { kind: 'timeout', message: 'Tải dữ liệu quá thời gian chờ. Hãy thử lại.', retryable: true };
  if (error instanceof InvalidStatisticsData) return { kind: 'data', message: 'Dữ liệu trả về không đúng định dạng.', retryable: true };
  if (typeof detail.status === 'number' && detail.status >= 500) return { kind: 'server', message: 'Máy chủ chưa tải được dữ liệu. Hãy thử lại.', retryable: true };
  return { kind: 'network', message: 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.', retryable: true };
}

class InvalidStatisticsData extends Error {}

function rows<T>(value: unknown): T[] {
  if (!Array.isArray(value) || value.some(row => row === null || typeof row !== 'object' || Array.isArray(row))) {
    throw new InvalidStatisticsData();
  }
  return value as T[];
}

// Không nuốt lỗi JSON/storage thành []: tầng trên cần biết nguồn local hỏng.
export function parseStatisticsStorage(value: string | null): unknown {
  if (value === null) return [];
  try { return JSON.parse(value); } catch { throw new InvalidStatisticsData(); }
}

function filterOwned<T extends OwnedRecord>(value: unknown, userId: string): { data: T[]; unknownOwners: number } {
  const data: T[] = [];
  let unknownOwners = 0;
  for (const row of rows<T>(value)) {
    const owner = id(row.userId);
    if (owner === null) unknownOwners += 1;
    else if (owner === userId) data.push(row);
  }
  return { data, unknownOwners };
}

/**
 * Các nhóm đã được lọc đúng chủ. Nhóm đầu tiên có độ ưu tiên cao nhất.
 * Ghép theo cả clientId và id để bản server cũ thiếu clientId không bị đếm lại.
 * Hợp các bí danh trước, sau đó chọn bản có ưu tiên cao nhất trong mỗi nhóm.
 */
export function mergeStatisticsRuns(groups: readonly (readonly RunRecord[])[]): RunRecord[] {
  const items = groups.flat();
  const parents = items.map((_, index) => index);
  const keys = new Map<string, number>();
  const included = new Set<number>();
  function root(index: number): number {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  }
  for (let index = 0; index < items.length; index += 1) {
    const row = items[index];
    const owner = id(row.userId);
    if (owner === null) continue;
    const aliases: string[] = [];
    const client = clientId(row);
    const serverId = id(row.id);
    if (client) aliases.push(JSON.stringify([owner, 'client', client]));
    if (serverId) aliases.push(JSON.stringify([owner, 'id', serverId]));
    if (aliases.length === 0) continue;
    included.add(index);
    for (const alias of aliases) {
      const previous = keys.get(alias);
      if (previous !== undefined) {
        const a = root(index);
        const b = root(previous);
        parents[Math.max(a, b)] = Math.min(a, b);
      }
      keys.set(alias, index);
    }
  }
  const result: RunRecord[] = [];
  const seen = new Set<number>();
  for (const index of included) {
    const canonical = root(index);
    if (!seen.has(canonical)) { result.push(items[canonical]); seen.add(canonical); }
  }
  return result;
}

async function validatedRead(read: () => Promise<unknown>): Promise<OwnedRecord[]> {
  return rows<OwnedRecord>(await read());
}

/** Chỉ đọc; không gọi sync, POST, PATCH hoặc ghi/xóa AsyncStorage. */
export function createStatisticsRepository(deps: StatisticsRepositoryDependencies) {
  let state = emptySnapshot(deps.getSession());
  let requestId = 0;
  let disposed = false;
  let started = false;
  const listeners = new Set<() => void>();
  const now = deps.now ?? Date.now;

  function emit() {
    for (const listener of listeners) {
      try { listener(); } catch { /* Lỗi UI không làm hỏng trạng thái dữ liệu. */ }
    }
  }

  function synchronizeSession(): boolean {
    const current = deps.getSession();
    if (sameSession(state.session, current)) return false;
    requestId += 1;
    state = emptySnapshot(current);
    emit();
    return true;
  }

  function getSnapshot(): StatisticsDataSnapshot {
    if (!disposed) synchronizeSession();
    return state;
  }

  function mergeRunSources(previous: StatisticsSource<RunRecord>, session: StatisticsSession,
    network: PromiseSettledResult<OwnedRecord[]>, queue: PromiseSettledResult<OwnedRecord[]>,
    cache: PromiseSettledResult<OwnedRecord[]>): StatisticsSource<RunRecord> {
    const issues: string[] = [];
    const pending: RunRecord[] = [];
    const cached: RunRecord[] = [];
    let server: RunRecord[] | null = null;
    let missingOwners = 0;
    let unidentifiedRuns = 0;
    if (network.status === 'fulfilled') {
      const owned = filterOwned<RunRecord>(network.value, session.userId!);
      missingOwners += owned.unknownOwners;
      server = owned.data.map(row => ({ ...row, _queued: false }));
    }
    if (queue.status === 'fulfilled') {
      for (const row of queue.value as RunRecord[]) {
        const owner = id(row.userId);
        const client = clientId(row);
        const proven = owner === null && client !== null && deps.ownsQueuedRun(client, session);
        if (owner === session.userId || proven) {
          if (!client) { unidentifiedRuns += 1; continue; }
          pending.push({ ...row, userId: session.userId, _queued: true });
        } else if (owner === null) missingOwners += 1;
      }
    } else issues.push('queue-read-failed');
    if (cache.status === 'fulfilled') {
      const owned = filterOwned<RunRecord>(cache.value, session.userId!);
      // Cache thiếu chủ không được nhận lại theo phiên RAM của queue.
      cached.push(...owned.data.map(row => ({ ...row, _queued: false })));
      if (network.status === 'rejected') missingOwners += owned.unknownOwners;
    } else if (network.status === 'rejected') issues.push('cache-read-failed');
    if (missingOwners > 0) issues.push(`unknown-owners:${missingOwners}`);
    const previousSaved = previous.data?.filter(row => row._queued !== true) ?? [];
    const previousPending = previous.data?.filter(row => row._queued === true) ?? [];
    const groups = server !== null
      ? [server, pending, queue.status === 'rejected' ? previousPending : []]
      : [previousSaved, cached, pending, queue.status === 'rejected' ? previousPending : []];
    for (const row of groups.flat()) {
      if (!clientId(row) && id(row.id) === null) unidentifiedRuns += 1;
    }
    if (unidentifiedRuns > 0) issues.push(`unidentified-runs:${unidentifiedRuns}`);
    const merged = mergeStatisticsRuns(groups);
    const hasData = server !== null || merged.length > 0 || previous.data !== null;
    const online = network.status === 'fulfilled';
    return {
      status: online ? 'success' : 'error', data: hasData ? merged : null,
      complete: online && issues.length === 0,
      stale: !online || (queue.status === 'rejected' && previousPending.length > 0),
      updatedAt: online ? now() : previous.updatedAt,
      origin: online ? (pending.length > 0 ? 'mixed' : 'network')
        : previous.data !== null ? 'memory' : cached.length > 0 ? (pending.length > 0 ? 'mixed' : 'cache') : pending.length > 0 ? 'queue' : null,
      error: network.status === 'rejected' ? sourceError(network.reason) : null, issues,
    };
  }

  async function readRuns(previous: StatisticsSource<RunRecord>, session: StatisticsSession,
    publishLocal: (source: StatisticsSource<RunRecord>) => void): Promise<StatisticsSource<RunRecord>> {
    // Gắn cả nhánh reject ngay để không tạo unhandled rejection khi storage chậm.
    let networkFinished = false;
    const network = validatedRead(deps.read.runs).then(
      value => { networkFinished = true; return { status: 'fulfilled' as const, value }; },
      reason => { networkFinished = true; return { status: 'rejected' as const, reason }; },
    );
    const [queue, cache] = await Promise.allSettled([
      validatedRead(deps.read.queue), validatedRead(deps.read.cache),
    ]);
    if (!networkFinished) {
      const local = mergeRunSources(previous, session, { status: 'rejected', reason: null }, queue, cache);
      publishLocal({ ...local, status: 'loading', error: null, complete: false });
    }
    return mergeRunSources(previous, session, await network, queue, cache);
  }

  async function refresh(): Promise<StatisticsDataSnapshot> {
    if (disposed) return state;
    synchronizeSession();
    if (state.session.userId === null) return state;
    started = true;
    const session = { ...state.session };
    const version = ++requestId;
    const previous = state;
    const sourceKeys = ['workouts', 'runs', 'profiles', 'weights', 'userGoals'] as const;
    const next = { ...state };
    for (const key of sourceKeys) {
      // Mảng dữ liệu cũ vẫn hiện được khi refresh nhưng có cờ stale/loading.
      Object.assign(next, { [key]: { ...previous[key], status: 'loading', stale: previous[key].data !== null, error: null } });
    }
    state = next;
    emit();
    function current(): boolean {
      return !disposed && version === requestId && sameSession(session, deps.getSession());
    }
    await Promise.all(sourceKeys.map(async key => {
      let result: StatisticsSource<OwnedRecord>;
      try {
        if (key === 'runs') result = await readRuns(previous.runs, session, local => {
          if (current()) { state = { ...state, runs: local }; emit(); }
        });
        else {
          const owned = filterOwned<OwnedRecord>(await deps.read[key](), session.userId!);
          result = { status: 'success', data: owned.data, complete: owned.unknownOwners === 0,
            stale: false, updatedAt: now(), origin: 'network', error: null,
            issues: owned.unknownOwners ? [`unknown-owners:${owned.unknownOwners}`] : [] };
        }
      } catch (error) {
        result = { ...previous[key], status: 'error', complete: false, stale: previous[key].data !== null,
          origin: previous[key].data !== null ? 'memory' : null, error: sourceError(error) };
      }
      if (current()) {
        state = { ...state, [key]: result };
        emit();
      }
    }));
    return getSnapshot();
  }

  const unsubscribeSession = deps.subscribeSession?.(() => {
    synchronizeSession();
    if (started && !disposed && deps.getSession().userId !== null) void refresh();
  });
  const unsubscribeRuns = deps.subscribeRuns?.(() => {
    if (started && !disposed) void refresh();
  });

  return {
    getSnapshot, refresh,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      disposed = true;
      requestId += 1;
      unsubscribeSession?.();
      unsubscribeRuns?.();
      listeners.clear();
      state = emptySnapshot({ userId: null, revision: state.session.revision + 1 });
    },
  };
}

export type StatisticsRepository = ReturnType<typeof createStatisticsRepository>;
