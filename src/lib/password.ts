import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Hash password admin dengan scrypt.
 * Format: "scrypt:<salt base64url>:<hash base64url>"
 * (pakai ":" bukan "$" karena "$" akan diekspansi oleh pembaca file .env Next.js)
 */
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Bandingkan dua string tanpa membocorkan panjang/isi lewat waktu eksekusi. */
export function safeStringEqual(a: string, b: string): boolean {
  const ha = scryptSync(a, "cmp", 32);
  const hb = scryptSync(b, "cmp", 32);
  return timingSafeEqual(ha, hb);
}
