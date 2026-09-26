import Link from "next/link";

/**
 * Reset sandi lewat tautan email dinonaktifkan (fitur lama Better Auth tidak
 * pernah benar-benar mengirim email). Sandi pengelola diatur oleh administrator
 * server lewat variabel environment ADMIN_PASSWORD_HASH.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight text-white">Atur Ulang Sandi</h1>
        <p className="mt-3 text-sm text-slate-400">
          Kata sandi pengelola diatur oleh administrator server. Hubungi pengelola teknis untuk
          mengganti sandi.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-cyan-500 transition hover:text-cyan-400"
        >
          ← Kembali ke halaman masuk
        </Link>
      </div>
    </div>
  );
}
