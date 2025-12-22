import { useEffect, useState } from 'react';

export function useMediaQuery(query: string, defaultValue = false): boolean {
  const getInitial = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return defaultValue;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return;

    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Ensure state is in sync (query could change)
    setMatches(mql.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    // Safari < 14
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(onChange);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
