import { renderHook } from '../test-utils/renderHook';

// Drive the hook by mocking useWindowDimensions so we control `width` directly
// and assert both sides of the 768px breakpoint plus a live resize.
// useSizeClass's only react-native dependency is useWindowDimensions; mock just
// that so the test never loads RN's native TurboModule bridge under Jest.
const mockUseWindowDimensions = jest.fn();
jest.mock('react-native', () => ({
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

import { useSizeClass } from './useSizeClass';

const dims = (width: number) => ({ width, height: 1024, scale: 2, fontScale: 1 });

describe('useSizeClass', () => {
  beforeEach(() => mockUseWindowDimensions.mockReset());

  it('is compact below the 768 threshold (iPhone portrait)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(390));
    const { result } = renderHook(() => useSizeClass());
    expect(result.current).toBe('compact');
  });

  it('is regular at exactly 768 (boundary is inclusive)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(768));
    const { result } = renderHook(() => useSizeClass());
    expect(result.current).toBe('regular');
  });

  it('is compact at 767 (one below the boundary)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(767));
    const { result } = renderHook(() => useSizeClass());
    expect(result.current).toBe('compact');
  });

  it('is regular above the threshold (iPad)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(1024));
    const { result } = renderHook(() => useSizeClass());
    expect(result.current).toBe('regular');
  });

  it('recomputes when window dimensions change (rotation/resize)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(390));
    const { result, rerender } = renderHook(() => useSizeClass());
    expect(result.current).toBe('compact');

    mockUseWindowDimensions.mockReturnValue(dims(820));
    rerender();
    expect(result.current).toBe('regular');
  });
});
