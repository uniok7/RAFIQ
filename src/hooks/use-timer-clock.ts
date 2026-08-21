import { useEffect, useState } from 'react';

import { useTimerStore } from '@/src/stores/timer-store';

export function useTimerClock() {
  const phase = useTimerStore((state) => state.phase);
  const workEndsAt = useTimerStore((state) => state.workEndsAt);
  const breakEndsAt = useTimerStore((state) => state.breakEndsAt);
  const tick = useTimerStore((state) => state.tick);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (phase === 'idle' || phase === 'return') return;
    const timer = setInterval(() => { setNow(Date.now()); void tick(); }, 1000);
    return () => clearInterval(timer);
  }, [phase, tick]);

  const end = phase === 'work' ? workEndsAt : breakEndsAt;
  const remainingSeconds = end ? Math.max(0, Math.ceil((new Date(end).getTime() - now) / 1000)) : 0;
  return { phase, remainingSeconds };
}
