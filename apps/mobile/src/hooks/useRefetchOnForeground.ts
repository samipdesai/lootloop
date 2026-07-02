// Runs `onForeground` whenever the app returns to the foreground (AppState
// 'active'). Data screens use this so a load that failed during a transient
// backend blip self-heals when the user reopens the app — no manual
// sign-out / pull-to-refresh needed. The callback is read from a ref so callers
// can pass an inline function without re-subscribing on every render.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function useRefetchOnForeground(onForeground: () => void) {
  const cb = useRef(onForeground);
  cb.current = onForeground;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') cb.current();
    });
    return () => sub.remove();
  }, []);
}
