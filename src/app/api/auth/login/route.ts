import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getAuthSecret, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { safeStringEqual, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD_HASH?.trim();

  if (!adminEmail || !adminHash || !getAuthSecret()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Login pengelola belum dikonfigurasi. Isi ADMIN_EMAIL, ADMIN_PASSWORD_HASH, dan AUTH_SECRET di pengaturan environment.",
      },
      { status: 503 },
    );
  }

  let email = "";
  let password = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ success: false, error: "Permintaan tidak valid." }, { status: 400 });
  }

  // Selalu jalankan kedua pemeriksaan agar waktu respons tidak membocorkan email yang benar.
  const emailOk = safeStringEqual(email, adminEmail);
  const passwordOk = password.length > 0 && verifyPassword(password, adminHash);

  if (!emailOk || !passwordOk) {
    // Perlambat percobaan tebak-tebakan password.
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json(
      { success: false, error: "Email atau kata sandi salah." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(adminEmail);
  const response = NextResponse.json({ success: true, user: { email: adminEmail } });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
