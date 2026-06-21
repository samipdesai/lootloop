import { useWindowDimensions } from 'react-native';

export type SizeClass = 'compact' | 'regular';

// 768px threshold: iPhone (portrait) -> compact; iPad -> regular. Recomputes on
// rotation/resize via useWindowDimensions. Drives the adaptive nav shells and
// the auth-screen container branch (#10 / #8, spec §9).
const REGULAR_MIN_WIDTH = 768;

export function useSizeClass(): SizeClass {
  const { width } = useWindowDimensions();
  return width >= REGULAR_MIN_WIDTH ? 'regular' : 'compact';
}
