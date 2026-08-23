import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { encryptionEnv } from './env';
import type { IdentityHeader } from '@/lib/domain/types';

/**
 * AES-256-GCM field encryption for the identity header.
 *
 * The threat this addresses is narrow and worth stating plainly: someone gets a
 * copy of the database. Row-Level Security does nothing then — it is a
 * query-time control, and a dump is not a query. Encrypting name, email and
 * phone in the application means the dump yields ciphertext and the key is
 * somewhere else entirely.
 *
 * GCM rather than CBC because it authenticates as well as encrypts. Without an
 * auth tag an attacker with write access to the database could flip bits in the
 * ciphertext and we would decrypt the result without complaint.
 *
 * Stored format:  base64(iv).base64(authTag).base64(ciphertext)
 * Dots are safe as separators because base64 never produces one.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
/** 96 bits is the size GCM is specified and optimised for. */
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;

  const { ENCRYPTION_KEY } = encryptionEnv();
  const decoded = Buffer.from(ENCRYPTION_KEY, 'base64');

  if (decoded.length !== KEY_BYTES) {
    // The common mistake is pasting a 32-character string rather than 32
    // decoded bytes, which yields a 24-byte key and a much weaker cipher that
    // otherwise works fine. Refuse it.
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${decoded.length}. Generate one with: openssl rand -base64 32`,
    );
  }

  cachedKey = decoded;
  return decoded;
}

/** For tests: forget the cached key so a changed env is picked up. */
export function resetKeyCache(): void {
  cachedKey = null;
}

export function encrypt(plaintext: string): string {
  // A fresh IV per record. Reusing one across records under the same key is
  // the classic way to break GCM completely, so it is generated here rather
  // than configured anywhere.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decrypt(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed ciphertext.');
  }

  const [ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, 'base64');
  const authTag = Buffer.from(tagPart, 'base64');
  const ciphertext = Buffer.from(dataPart, 'base64');

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Malformed ciphertext.');
  }

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(authTag);

  // `final()` throws if the tag does not verify. That is the whole point:
  // tampered ciphertext fails rather than decrypting to something plausible.
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

// ---------------------------------------------------------------------------
// The identity header specifically
// ---------------------------------------------------------------------------

export function encryptIdentityHeader(identity: IdentityHeader): string {
  return encrypt(JSON.stringify(identity));
}

export function decryptIdentityHeader(payload: string): IdentityHeader {
  const parsed: unknown = JSON.parse(decrypt(payload));

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Malformed identity header.');
  }

  const record = parsed as Record<string, unknown>;
  return {
    fullName: typeof record.fullName === 'string' ? record.fullName : null,
    email: typeof record.email === 'string' ? record.email : null,
    phone: typeof record.phone === 'string' ? record.phone : null,
    // Headers encrypted before location and links existed have neither.
    location: typeof record.location === 'string' ? record.location : null,
    links: Array.isArray(record.links)
      ? record.links.filter((link): link is string => typeof link === 'string')
      : [],
    otherLines: Array.isArray(record.otherLines)
      ? record.otherLines.filter((line): line is string => typeof line === 'string')
      : [],
  };
}

/** Constant-time comparison, for anywhere a secret is compared. */
export function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
