// Unit tests for the self-hosted leaked-password check (security audit L-2).
// The HIBP boundary is mocked via global.fetch — these verify the k-anonymity
// contract (only a 5-char prefix leaves the device), correct suffix matching,
// padded-entry handling, and the fail-open behavior on any error.
import { sha1Hex, checkPasswordPwned, signUpParent, mapAuthError, type LootLoopClient } from './index';

// Known-good SHA-1 (uppercase) of "password" — anchors the pure-JS impl.
const PASSWORD_SHA1 = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('sha1Hex', () => {
  test('matches known SHA-1 vectors', () => {
    expect(sha1Hex('')).toBe('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709');
    expect(sha1Hex('abc')).toBe('A9993E364706816ABA3E25717850C26C9CD0D89D');
    expect(sha1Hex('password')).toBe(PASSWORD_SHA1);
  });

  test('handles multi-byte UTF-8 (accents + emoji / surrogate pairs)', () => {
    // SHA-1 over the UTF-8 bytes — exercises 2-byte, 3-byte, and 4-byte paths.
    expect(sha1Hex('café🔒')).toBe('7CB515968AF1075536E002116F074CEE30DBF443');
  });
});

describe('checkPasswordPwned', () => {
  function mockRange(bodyLines: string[], ok = true) {
    return jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok,
      text: () => Promise.resolve(bodyLines.join('\r\n')),
    } as never);
  }

  test('sends only the 5-char hash prefix (k-anonymity)', async () => {
    const fetchMock = mockRange([]);
    await checkPasswordPwned('password');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    expect(url).not.toContain(PASSWORD_SHA1.slice(5));
  });

  test('returns true when the suffix is present with a non-zero count', async () => {
    const suffix = PASSWORD_SHA1.slice(5);
    mockRange([`${suffix}:12345`, '0018A45C4D1DEF81644B54AB7F969B88D65:1']);
    await expect(checkPasswordPwned('password')).resolves.toBe(true);
  });

  test('returns false when the suffix is absent', async () => {
    mockRange(['0018A45C4D1DEF81644B54AB7F969B88D65:1']);
    await expect(checkPasswordPwned('password')).resolves.toBe(false);
  });

  test('treats padded entries (count 0) as not breached', async () => {
    const suffix = PASSWORD_SHA1.slice(5);
    mockRange([`${suffix}:0`]);
    await expect(checkPasswordPwned('password')).resolves.toBe(false);
  });

  test('fails open on a non-OK response', async () => {
    mockRange([], false);
    await expect(checkPasswordPwned('password')).resolves.toBe(false);
  });

  test('fails open on a network error', async () => {
    jest.spyOn(global, 'fetch' as never).mockRejectedValue(new Error('offline') as never);
    await expect(checkPasswordPwned('password')).resolves.toBe(false);
  });
});

describe('signUpParent', () => {
  function mockClient() {
    const signUp = jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const client = { auth: { signUp } } as unknown as LootLoopClient;
    return { client, signUp };
  }

  test('blocks a breached password before reaching Supabase', async () => {
    const suffix = PASSWORD_SHA1.slice(5);
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`${suffix}:999`),
    } as never);
    const { client, signUp } = mockClient();

    const { data, error } = await signUpParent(client, 'a@b.com', 'password');

    expect(signUp).not.toHaveBeenCalled();
    expect(data.user).toBeNull();
    expect(error && 'code' in error ? error.code : '').toBe('pwned_password');
    expect(mapAuthError(error)).toMatch(/known data breach/i);
  });

  test('proceeds to Supabase when the password is clean', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('0018A45C4D1DEF81644B54AB7F969B88D65:1'),
    } as never);
    const { client, signUp } = mockClient();

    await signUpParent(client, 'a@b.com', 'a-very-unique-passphrase-9173', 'https://x/cb');

    expect(signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'a-very-unique-passphrase-9173',
      options: { emailRedirectTo: 'https://x/cb' },
    });
  });
});
