// useLoad.js — loads data from the API when a page opens, with a retry.
//   const { data, error, reload, setData } = useLoad(getCatalog);
// `data` is null while loading; `error` is { code, message, hint } if it failed.
// Pass a function imported from services/api.js (not an inline arrow) so it never changes.
// Owner: Huzaifah.
import { useEffect, useState } from 'react';

export function useLoad(fetcher) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true; // ignore the answer if the page closed meanwhile
    fetcher()
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err));
    return () => {
      active = false;
    };
  }, [fetcher, attempt]);

  function reload() {
    setError(null);
    setData(null);
    setAttempt((n) => n + 1);
  }

  return { data, error, reload, setData, setError };
}
