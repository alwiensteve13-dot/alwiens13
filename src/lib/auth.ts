/**
 * Konfigurasi Better Auth lama sudah tidak dipakai.
 * Autentikasi pengelola sekarang ada di:
 *   - src/lib/session.ts   (token sesi bertanda tangan)
 *   - src/lib/password.ts  (hash & verifikasi sandi)
 *   - src/app/api/auth/{login,logout,session}/route.ts
 */
export {};
