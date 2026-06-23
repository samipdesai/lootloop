/* eslint-env jest */
// Minimal renderHook on top of react-test-renderer (already the project's test
// renderer — see __tests__/App.test.tsx). We don't use @testing-library/react-
// native: its current line ships a new async renderHook that returns a Promise
// under RN 0.86 / React 19, which doesn't fit these synchronous hook tests.
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { ReactNode } from 'react';

export { act };

interface RenderHookResult<T> {
  result: { current: T };
  rerender: () => void;
  unmount: () => void;
}

export function renderHook<T>(
  callback: () => T,
  options: { wrapper?: (props: { children: ReactNode }) => React.ReactElement } = {},
): RenderHookResult<T> {
  const result: { current: T } = { current: undefined as unknown as T };
  const Wrapper = options.wrapper;

  function Probe() {
    result.current = callback();
    return null;
  }

  const element = () => (Wrapper ? <Wrapper>{<Probe />}</Wrapper> : <Probe />);

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(element());
  });

  return {
    result,
    rerender: () => {
      act(() => {
        renderer.update(element());
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

// Poll an assertion until it passes or times out — mirrors testing-library's
// waitFor for the async (effect-driven) state transitions in the session stores.
export async function waitFor(
  assertion: () => void,
  { timeout = 1000, interval = 10 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (err) {
      if (Date.now() - start >= timeout) throw err;
      // Flush microtasks + pending effects between polls.
      await act(async () => {
        await new Promise<void>((r) => setTimeout(() => r(), interval));
      });
    }
  }
}
