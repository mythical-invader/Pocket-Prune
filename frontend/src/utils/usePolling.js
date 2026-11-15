// usePolling.js — asks the API again every few seconds ("polling") until a stop rule says done.
//   const { data, error, refresh } = usePolling(() => getJob(id), 2000, (job) => job.status === 'COMPLETED');
// It loads once at the start, then repeats; it pauses while the browser tab is hidden (no
// wasted requests) and stops for good once `stopWhen(data)` is true (e.g. the job finished).
// Owner: Huzaifah (WP-12).
import { useEffect, useState } from 'react';

export function usePolling(fetcher, intervalMs, stopWhen = () => false) {
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null); // when the latest answer arrived (ms)
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0); // bumps on every timer round → triggers a new request
  const stopped = data !== null && stopWhen(data);

  // One request per tick.
  useEffect(() => {
    let alive = true;
    fetcher()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setFetchedAt(Date.now());
        setError(null);
      })
      .catch((err) => alive && setError(err));
    return () => {
      alive = false;
    };
    // `fetcher` is a new arrow each render; only `tick` should start a new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // The timer: runs until the stop rule is true, and only while the tab is visible.
  useEffect(() => {
    if (stopped) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [stopped, intervalMs]);

  return { data, fetchedAt, error, refresh: () => setTick((n) => n + 1) };
}
