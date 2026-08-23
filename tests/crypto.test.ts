/**
 * Tests for the identity-header encryption.
 *
 * The threat being tested is a database dump. Row-Level Security is a
 * query-time control and does nothing once someone has a copy of the table, so
 * these assertions are about what an attacker holding the ciphertext can learn
 * and what they can change without being noticed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { IdentityHeader } from '@/lib/domain/types';

/** A real 32-byte key, base64. Test-only, never used anywhere else. */
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

const IDENTITY: IdentityHeader = {
  fullName: 'Thabo Mokoena',
  email: 'thabo.mokoena@example.co.za',
  phone: '+27 82 555 0134',
  // The city is printed on the CV; the street address is not. Both are still
  // encrypted, because both came off the person's own document.
  location: 'Johannesburg, Gauteng',
  links: ['github.com/thabo-mokoena'],
  otherLines: ['12 Rissik Street, Braamfontein, Johannesburg 2001'],
};

// The module reads and caches the key on first use, so each test imports it
// fresh with the env already set.
async function loadCrypto() {
  return import('@/lib/infrastructure/crypto');
}

let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterEach(async () => {
  process.env.ENCRYPTION_KEY = previousKey;
  const crypto = await loadCrypto();
  crypto.resetKeyCache();
});

describe('encrypt / decrypt', () => {
  it('round-trips a string', async () => {
    const { encrypt, decrypt } = await loadCrypto();
    const plaintext = 'Thabo Mokoena';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('round-trips an identity header', async () => {
    const { encryptIdentityHeader, decryptIdentityHeader } = await loadCrypto();
    expect(decryptIdentityHeader(encryptIdentityHeader(IDENTITY))).toEqual(
      IDENTITY,
    );
  });

  it('leaks nothing readable into the ciphertext', async () => {
    const { encryptIdentityHeader } = await loadCrypto();
    const payload = encryptIdentityHeader(IDENTITY);

    expect(payload).not.toContain('Thabo');
    expect(payload).not.toContain('Mokoena');
    expect(payload).not.toContain('example.co.za');
    expect(payload).not.toContain('555');
  });

  /**
   * A fixed IV would let an attacker holding two rows learn whether the two
   * identities are the same, and worse, would break GCM's security properties
   * outright. Encrypting the same value twice must not produce the same bytes.
   */
  it('uses a fresh IV for every record', async () => {
    const { encrypt } = await loadCrypto();
    const a = encrypt('same value');
    const b = encrypt('same value');

    expect(a).not.toBe(b);
    expect(a.split('.')[0]).not.toBe(b.split('.')[0]);
    expect(decryptBoth(await loadCrypto(), a, b)).toEqual([
      'same value',
      'same value',
    ]);
  });

  function decryptBoth(
    crypto: Awaited<ReturnType<typeof loadCrypto>>,
    a: string,
    b: string,
  ) {
    return [crypto.decrypt(a), crypto.decrypt(b)];
  }
});

describe('tampering', () => {
  /**
   * The reason for GCM rather than CBC. Someone with write access to the
   * database could flip bits in the ciphertext; without an auth tag we would
   * decrypt the result and hand back a corrupted name with no complaint.
   */
  it('refuses ciphertext that has been altered', async () => {
    const { encrypt, decrypt } = await loadCrypto();
    const payload = encrypt('Thabo Mokoena');
    const [iv, tag, data] = payload.split('.');

    const bytes = Buffer.from(data, 'base64');
    bytes[0] ^= 0xff;
    const tampered = [iv, tag, bytes.toString('base64')].join('.');

    expect(() => decrypt(tampered)).toThrow();
  });

  it('refuses a swapped auth tag', async () => {
    const { encrypt, decrypt } = await loadCrypto();
    const [ivA, , dataA] = encrypt('value A').split('.');
    const [, tagB] = encrypt('value B').split('.');

    expect(() => decrypt([ivA, tagB, dataA].join('.'))).toThrow();
  });

  it('refuses a malformed payload', async () => {
    const { decrypt } = await loadCrypto();
    expect(() => decrypt('not-a-payload')).toThrow('Malformed ciphertext.');
    expect(() => decrypt('a.b')).toThrow('Malformed ciphertext.');
  });
});

describe('key validation', () => {
  /**
   * The realistic mistake is pasting a 32-*character* passphrase instead of 32
   * decoded bytes. Base64-decoding that yields 24 bytes, and Node would happily
   * refuse it, but a subtler wrong length could silently weaken things. Check
   * the decoded length explicitly.
   */
  it('rejects a key that does not decode to 32 bytes', async () => {
    const crypto = await loadCrypto();
    crypto.resetKeyCache();
    process.env.ENCRYPTION_KEY = Buffer.from('too short').toString('base64');

    expect(() => crypto.encrypt('anything')).toThrow(/must decode to 32 bytes/);

    process.env.ENCRYPTION_KEY = TEST_KEY;
    crypto.resetKeyCache();
  });
});
