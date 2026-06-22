// Adaptive parent navigation. On iPhone the parent shell is a real native-stack
// (ParentStackNav), so screens navigate via React Navigation. On iPad the shell
// is a custom split view (persistent sidebar + detail pane) with no navigator —
// it provides this context instead. `useParentNav` / `useParentParams` resolve to
// whichever is active, so the parent screens are written once and work on both.
import { createContext, useContext } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';

export interface ParentNav {
  navigate: (section: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  // The params of the active detail section (iPad split view only).
  params: Record<string, unknown> | undefined;
}

// Non-null only inside the iPad ParentSplitView.
export const ParentSplitNavContext = createContext<ParentNav | null>(null);

type Navigator = Pick<ParentNav, 'navigate' | 'goBack' | 'canGoBack'>;

// Navigate the parent shell. iPad → drives the split view; iPhone → the stack.
export function useParentNav(): Navigator {
  const split = useContext(ParentSplitNavContext);
  const navigation = useNavigation<{ navigate: (s: string, p?: object) => void; goBack: () => void; canGoBack: () => boolean }>();
  if (split) return split;
  return {
    navigate: (s, p) => navigation.navigate(s, p),
    goBack: () => navigation.goBack(),
    canGoBack: () => navigation.canGoBack(),
  };
}

// Params for the current parent detail screen. iPad → from the split view stack;
// iPhone → from the route.
export function useParentParams(): Record<string, unknown> | undefined {
  const split = useContext(ParentSplitNavContext);
  const route = useRoute();
  return split ? split.params : (route.params as Record<string, unknown> | undefined);
}
