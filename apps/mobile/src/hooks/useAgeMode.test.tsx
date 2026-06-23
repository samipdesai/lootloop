import { renderHook } from '../test-utils/renderHook';

// useAgeMode reads age_mode off the kid session profile; mock the store so we
// can vary the profile without standing up a real KidSessionProvider.
const mockUseKidSession = jest.fn();
jest.mock('../stores/kidSession', () => ({
  useKidSession: () => mockUseKidSession(),
}));

import { useAgeMode } from './useAgeMode';

const profile = (age_mode: string) => ({
  id: 'k1',
  family_id: 'f1',
  display_name: 'Kid',
  avatar_url: null,
  age_mode,
});

describe('useAgeMode', () => {
  beforeEach(() => mockUseKidSession.mockReset());

  it("defaults to 'detailed' when there is no kid session profile", () => {
    mockUseKidSession.mockReturnValue({ profile: null });
    const { result } = renderHook(() => useAgeMode());
    expect(result.current).toBe('detailed');
  });

  it("returns the profile's age_mode when a kid is signed in", () => {
    mockUseKidSession.mockReturnValue({ profile: profile('simple') });
    const { result } = renderHook(() => useAgeMode());
    expect(result.current).toBe('simple');
  });

  it('passes through each band verbatim', () => {
    for (const mode of ['simple', 'detailed', 'teen'] as const) {
      mockUseKidSession.mockReturnValue({ profile: profile(mode) });
      const { result } = renderHook(() => useAgeMode());
      expect(result.current).toBe(mode);
    }
  });
});
