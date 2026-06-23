// Adaptive shell navigation, shared by the parent and kid shells. On iPhone the
// shell is a real native-stack, so screens navigate via React Navigation. On iPad
// the shell is a custom split view (persistent sidebar + detail pane) with no
// navigator — it provides this context instead. `useShellNav` / `useShellParams`
// resolve to whichever is active, so the screens are written once and work on
// both. Parent and kid never coexist, so a single context is safe.
import { createContext, useContext } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';

export interface ShellNav {
  navigate: (section: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  // The params of the active detail section (iPad split view only).
  params: Record<string, unknown> | undefined;
}

// Non-null only inside an iPad split view (parent or kid).
export const ShellNavContext = createContext<ShellNav | null>(null);

type Navigator = Pick<ShellNav, 'navigate' | 'goBack' | 'canGoBack'>;

// Navigate the shell. iPad → drives the split view; iPhone → the native-stack.
export function useShellNav(): Navigator {
  const split = useContext(ShellNavContext);
  const navigation = useNavigation<{ navigate: (s: string, p?: object) => void; goBack: () => void; canGoBack: () => boolean }>();
  if (split) return split;
  return {
    navigate: (s, p) => navigation.navigate(s, p),
    goBack: () => navigation.goBack(),
    canGoBack: () => navigation.canGoBack(),
  };
}

// Params for the current detail screen. iPad → from the split view stack;
// iPhone → from the route.
export function useShellParams(): Record<string, unknown> | undefined {
  const split = useContext(ShellNavContext);
  const route = useRoute();
  return split ? split.params : (route.params as Record<string, unknown> | undefined);
}
