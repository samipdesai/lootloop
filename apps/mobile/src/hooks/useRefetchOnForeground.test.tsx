import { AppState, type AppStateStatus } from 'react-native';
import { renderHook, act } from '../test-utils/renderHook';
import { useRefetchOnForeground } from './useRefetchOnForeground';

// Capture the AppState 'change' handler the hook registers so we can emit states
// by hand, and assert the subscription is torn down on unmount.
describe('useRefetchOnForeground', () => {
  let handler: ((state: AppStateStatus) => void) | undefined;
  let remove: jest.Mock;

  beforeEach(() => {
    handler = undefined;
    remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, cb: (state: AppStateStatus) => void) => {
        handler = cb;
        return { remove } as never;
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it('runs the callback when the app returns to the foreground', () => {
    const onForeground = jest.fn();
    renderHook(() => useRefetchOnForeground(onForeground));
    expect(onForeground).not.toHaveBeenCalled();

    act(() => handler!('active'));
    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it('ignores background / inactive transitions', () => {
    const onForeground = jest.fn();
    renderHook(() => useRefetchOnForeground(onForeground));

    act(() => handler!('background'));
    act(() => handler!('inactive'));
    expect(onForeground).not.toHaveBeenCalled();
  });

  it('invokes the latest callback after a rerender (ref stays fresh)', () => {
    let target = jest.fn();
    const { rerender } = renderHook(() => useRefetchOnForeground(() => target()));

    const next = jest.fn();
    target = next;
    rerender();

    act(() => handler!('active'));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('removes the AppState listener on unmount', () => {
    const { unmount } = renderHook(() => useRefetchOnForeground(jest.fn()));
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
