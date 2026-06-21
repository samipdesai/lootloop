/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// Native screens module isn't linked under Jest; no-op enableScreens.
jest.mock('react-native-screens', () => ({ enableScreens: jest.fn() }));

// Mock at the Supabase boundary (CLAUDE.md: don't unit-test Supabase calls).
// App -> SessionProvider -> src/lib/supabase would otherwise construct a real
// client (and require env + AsyncStorage native module).
jest.mock('../src/lib/supabase', () => {
  const unsubscribe = jest.fn();
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe } } })),
      },
      from: jest.fn(),
    },
  };
});

import App from '../App';

test('renders the root navigator (logged-out -> auth stack)', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
