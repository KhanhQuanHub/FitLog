import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { createFitLogStatisticsData } from '../../services/statisticsData';
import type { StatisticsRepository } from '../../services/statisticsRepository';
import { localDateString } from '../../utils/dateLocal';

const systemNow = () => new Date();
const noopSubscribe = () => () => {};
const noSnapshot = () => null;
const StatisticsContext = createContext<{ repository: StatisticsRepository | null; today: string } | null>(null);

export function StatisticsDataProvider({ children, createRepository = createFitLogStatisticsData, now = systemNow }: {
  children: ReactNode; createRepository?: () => StatisticsRepository; now?: () => Date;
}) {
  const [repository, setRepository] = useState<StatisticsRepository | null>(null);
  const [today, setToday] = useState(() => localDateString(now()));
  useEffect(() => {
    // Tạo trong effect: StrictMode không để lại subscription của render bị bỏ.
    const instance = createRepository();
    setRepository(instance);
    void instance.refresh();
    return () => instance.dispose();
  }, [createRepository]);
  useEffect(() => {
    const updateDay = () => setToday(localDateString(now()));
    const timer = setInterval(updateDay, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { updateDay(); void repository?.refresh(); }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [now, repository]);
  return <StatisticsContext.Provider value={{ repository, today }}>{children}</StatisticsContext.Provider>;
}

export function useHasStatisticsProvider() { return useContext(StatisticsContext) !== null; }

export function useStatisticsData() {
  const context = useContext(StatisticsContext);
  if (!context) throw new Error('Màn thống kê cần StatisticsDataProvider');
  const { repository, today } = context;
  const snapshot = useSyncExternalStore(repository?.subscribe ?? noopSubscribe, repository?.getSnapshot ?? noSnapshot, noSnapshot);
  const refresh = useCallback(() => { void repository?.refresh(); }, [repository]);
  return { snapshot, today, refresh };
}
