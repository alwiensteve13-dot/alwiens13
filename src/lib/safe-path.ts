import path from "path";

/**
 * Bersihkan nama file dari input pengguna: buang folder ("../", "C:\\"),
 * ganti karakter aneh dengan "_", dan batasi panjangnya.
 */
export function sanitizeFileName(name: string, maxLength = 120): string {
  const base = path.basename(String(name).replace(/\\/g, "/"));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "");
  return (cleaned || "file").slice(-maxLength);
}

/** Id wilayah hanya boleh huruf, angka, "-" dan "_" (dipakai sebagai nama file). */
export function isSafeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id);
}

/**
 * Gabungkan path lalu pastikan hasilnya tetap berada di dalam folder `baseDir`.
 * Mengembalikan null jika ada upaya keluar folder (path traversal).
 */
export function resolveInside(baseDir: string, ...segments: string[]): string | null {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}
