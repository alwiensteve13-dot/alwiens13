"use client";

/**
 * Penanda "wajib login" untuk semua unduhan/cetak di halaman publik.
 * - LoginRequiredDialog: jendela kecil saat pengunjung menekan tombol unduh/cetak.
 * - LoginRequiredCard: kartu pengganti di tempat konten unduhan (mis. dokumen PDF).
 */
import Link from "next/link";

const LOGIN_HREF = "/login?redirect=/";

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function LoginRequiredDialog({ open, onClose, pesan }: { open: boolean; onClose: () => void; pesan?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
          <LockIcon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Perlu login</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {pesan || "Unduhan dan cetak dokumen hanya untuk pengguna yang sudah login."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            Batal
          </button>
          <Link href={LOGIN_HREF} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LoginRequiredCard({ judul, pesan }: { judul?: string; pesan?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/70 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0">
          {judul && <p className="truncate text-sm font-semibold text-amber-900 dark:text-amber-100">{judul}</p>}
          <p className="text-xs text-amber-800 dark:text-amber-200">{pesan || "Hanya untuk pengguna yang sudah login."}</p>
        </div>
      </div>
      <Link href={LOGIN_HREF} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500">
        Masuk
      </Link>
    </div>
  );
}
