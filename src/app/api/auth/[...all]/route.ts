import { NextResponse } from "next/server";

/**
 * Endpoint Better Auth lama sengaja dinonaktifkan.
 * Sebelumnya endpoint ini mengizinkan siapa pun mendaftar akun baru (sign-up).
 * Login pengelola sekarang lewat /api/auth/login, /api/auth/logout, /api/auth/session.
 */
function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
