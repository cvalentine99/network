/**
 * TimeWindowProvider — wraps the app and provides a single shared time window.
 * Every panel reads from this. No panel-local windows allowed.
 */
import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { TimeWindowContext, resolveTimeWindow } from '@/lib/useTimeWindow';

const DEFAULT_FROM_OFFSET = -300_000; // 5 minutes

export function TimeWindowProvider({ children }: { children: ReactNode }) {
  const [fromOffset, setFromOffset] = useState(DEFAULT_FROM_OFFSET);
  const [tick, setTick] = useState(0);

  const window = useMemo(
    () => resolveTimeWindow(fromOffset),
    // tick forces re-resolve against Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fromOffset, tick]
  );

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const value = useMemo(
    () => ({ window, fromOffset, setFromOffset, refresh }),
    [window, fromOffset, refresh]
  );

  return (
    <TimeWindowContext.Provider value={value}>
      {children}
    </TimeWindowContext.Provider>
  );
}
