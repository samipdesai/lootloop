// Self-hosted "leaked password" check (security audit L-2). Queries the open,
// keyless HaveIBeenPwned Pwned Passwords range API using k-anonymity: we send
// only the first 5 chars of the password's SHA-1 hash — never the password or
// the full hash. This is the same open database behind Supabase's Pro-only
// "leaked password protection" toggle, so we get the protection for free and
// stay off the Pro plan. See docs/compliance/security-audit.md.
//
// SHA-1 is implemented in pure JS rather than via crypto.subtle, which is
// unavailable in React Native / Hermes. This runs identically in the browser,
// Hermes, and Node with no extra dependency.

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

// UTF-8 encode a string to bytes (TextEncoder isn't guaranteed in Hermes).
function utf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate — combine with the following low surrogate.
      const lo = str.charCodeAt(++i);
      code = 0x10000 + ((code & 0x3ff) << 10) + (lo & 0x3ff);
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

// Pure-JS SHA-1 → uppercase hex (HIBP returns uppercase). Exported for tests.
// Buffers are typed arrays: their index signatures return `number` (exempt from
// noUncheckedIndexedAccess) and Int32Array assignment truncates to 32 bits for
// free, which is exactly the modular arithmetic SHA-1 needs.
export function sha1Hex(str: string): string {
  const msg = utf8Bytes(str);
  const ml = msg.length * 8;

  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  // 64-bit big-endian message length. Passwords never exceed 2^32 bits, so the
  // high word is effectively always 0, but compute it for correctness.
  const hi = Math.floor(ml / 0x100000000);
  const lo = ml >>> 0;
  msg.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  msg.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
  const bytes = Uint8Array.from(msg);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Int32Array(80);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] =
        (bytes[i + j * 4]! << 24) |
        (bytes[i + j * 4 + 1]! << 16) |
        (bytes[i + j * 4 + 2]! << 8) |
        bytes[i + j * 4 + 3]!;
    }
    for (let j = 16; j < 80; j++) {
      const n = w[j - 3]! ^ w[j - 8]! ^ w[j - 14]! ^ w[j - 16]!;
      w[j] = (n << 1) | (n >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let j = 0; j < 80; j++) {
      let f: number;
      let k: number;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]!) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = tmp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return (toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).toUpperCase();
}

// Returns true if the password appears in a known breach. Fail-OPEN: any
// hashing or network error returns false so a third-party outage can never
// block a legitimate signup — this is best-effort hardening, not a hard gate.
export async function checkPasswordPwned(password: string): Promise<boolean> {
  if (!password) return false;

  let hash: string;
  try {
    hash = sha1Hex(password);
  } catch {
    return false;
  }

  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    // "Add-Padding" pads the response so the prefix's popularity can't be
    // inferred from response size; padded entries carry a count of 0, which the
    // `count > 0` check below correctly ignores.
    const res = await fetch(HIBP_RANGE_URL + prefix, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      if (line.slice(0, idx).trim().toUpperCase() === suffix) {
        return parseInt(line.slice(idx + 1), 10) > 0;
      }
    }
    return false;
  } catch {
    return false;
  }
}
