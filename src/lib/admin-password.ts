import 'server-only';

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import type { AdminUserAuthRecord } from '@/types/admin-users';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

function sha512(data: Buffer | string): Buffer {
  return createHash('sha512').update(data).digest();
}

function utf16le(value: string): Buffer {
  return Buffer.from(value, 'utf16le');
}

function legacyHashCandidates(password: string, username?: string): Buffer[] {
  const user = username?.trim() ?? '';
  const pwd = password;
  const pwdUpper = password.toUpperCase();
  const pwdLower = password.toLowerCase();

  const candidates: Buffer[] = [
    sha512(Buffer.from(pwd, 'utf8')),
    sha512(utf16le(pwd)),
    sha512(Buffer.from(pwdUpper, 'utf8')),
    sha512(Buffer.from(pwdLower, 'utf8')),
    sha512(utf16le(pwdUpper)),
    sha512(utf16le(pwdLower)),
  ];

  if (user) {
    candidates.push(
      sha512(Buffer.from(`${user}${pwd}`, 'utf8')),
      sha512(Buffer.from(`${pwd}${user}`, 'utf8')),
      sha512(Buffer.concat([Buffer.from(user, 'utf8'), Buffer.from(pwd, 'utf8')])),
      sha512(Buffer.concat([Buffer.from(pwd, 'utf8'), Buffer.from(user, 'utf8')])),
      sha512(utf16le(`${user}${pwd}`)),
      sha512(utf16le(`${pwd}${user}`)),
      sha512(Buffer.concat([utf16le(user), utf16le(pwd)])),
      sha512(Buffer.concat([utf16le(pwd), utf16le(user)]))
    );
  }

  return candidates;
}

function matchesLegacyHash(password: string, storedHex: string, username?: string): boolean {
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHex, 'hex');
  } catch {
    return false;
  }
  if (stored.length !== 64) return false;

  return legacyHashCandidates(password, username).some((candidate) => {
    if (candidate.length !== stored.length) return false;
    return timingSafeEqual(candidate, stored);
  });
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`;
}

export async function verifyAdminPassword(
  password: string,
  user: Pick<AdminUserAuthRecord, 'passwordHash' | 'legacyPasswordHash' | 'legacyUsername'>
): Promise<boolean> {
  const trimmed = password.trim();
  if (!trimmed) return false;

  if (user.passwordHash?.startsWith('scrypt:')) {
    const [, saltB64, keyB64] = user.passwordHash.split(':');
    if (saltB64 && keyB64) {
      const salt = Buffer.from(saltB64, 'base64');
      const expected = Buffer.from(keyB64, 'base64');
      const actual = (await scryptAsync(trimmed, salt, expected.length)) as Buffer;
      if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
        return true;
      }
    }
  }

  if (user.legacyPasswordHash) {
    return matchesLegacyHash(trimmed, user.legacyPasswordHash, user.legacyUsername);
  }

  return false;
}
