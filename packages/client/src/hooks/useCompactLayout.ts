import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 899px)';

function subscribe(onChange: () => void) {
    const query = window.matchMedia(QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

// Keep transient tool/join state in the parent when the viewport crosses the breakpoint.
export function useCompactLayout() {
    return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
