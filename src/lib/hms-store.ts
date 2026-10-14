/**
 * Penyimpanan hasil Simulasi HEC-HMS (dari aplikasi HEC-HMS DAS Analyzer) per DAS.
 *
 * data/hms/<regionId>/ringkasan.json  - ringkasan publik (tanpa isi Excel)
 * data/hms/<regionId>/<nama>.xlsx     - berkas unduhan (hanya lewat API yang memeriksa login)
 *
 * Folder data/ tidak disajikan sebagai berkas statis, jadi Excel tidak bisa diunduh tanpa login.
 * Seperti data lain di situs ini, simpan dilakukan di localhost lalu di-commit & push ke GitHub;
 * di Vercel sistem berkasnya hanya-baca.
 */
import fs from "fs";
import path from "path";
import { isSafeId, resolveInside, sanitizeFileName } from "@/lib/safe-path";

export const HMS_DIR = path.join(process.cwd(), "data", "hms");

export interface HmsExcel { nama: string; b64?: string; tahun?: number; berkas?: string }
export interface HmsPaket {
  format: string;
  versi: number;
  dibuat?: string;
  das: { nama: string; elemen: string; luas_km2?: number | null; jumlah_subbasin?: number; jumlah_reach?: number };
  model?: Record<string, unknown>;
  hasil?: Record<string, unknown>;
  hujan?: Record<string, unknown>;
  cek_hecms?: { status?: string; teks?: string; versi?: string } | null;
  tahun?: { tahun: number; lengkap: boolean; debit_rata?: number | null }[];
  tahun_lengkap?: number[];
  periode15: string[];
  andalan15: Record<string, (number | null)[]>;
  andalan_bulanan: Record<string, (number | null)[]>;
  debit15_tahun?: Record<string, (number | null)[]>;
  debit_bulanan_tahun?: Record<string, (number | null)[]>;
  fdc?: { p: number; q: number | null }[];
  excel?: Record<string, HmsExcel>;
  diimpor?: string;
  unduhan?: { kunci: string; nama: string; berkas: string; ukuran: number }[];
}

export function validasiPaket(p: unknown): string | null {
  const x = p as HmsPaket;
  if (!x || typeof x !== "object") return "Isi paket bukan JSON objek.";
  if (x.format !== "hms-neraca-air") return 'Bukan paket hasil Simulasi HEC-HMS (format "hms-neraca-air").';
  if (!x.das || !x.das.nama) return "Paket tidak berisi identitas DAS.";
  if (!Array.isArray(x.periode15) || x.periode15.length !== 24) return "Paket tidak berisi 24 periode 15 harian.";
  if (!x.andalan15 || !Array.isArray(x.andalan15.q80)) return "Paket tidak berisi debit andalan 15 harian.";
  return null;
}

function folder(regionId: string): string {
  if (!isSafeId(regionId)) throw new Error("regionId tidak valid.");
  const f = resolveInside(HMS_DIR, regionId);
  if (!f) throw new Error("regionId tidak valid.");
  return f;
}

/** Simpan paket: Excel ditulis sebagai berkas, ringkasan tanpa base64. */
export function simpanPaket(regionId: string, paket: HmsPaket): HmsPaket {
  const dir = folder(regionId);
  const sementara = dir + ".baru-" + Date.now();
  fs.mkdirSync(sementara, { recursive: true });
  try {
    const unduhan: HmsPaket["unduhan"] = [];
    const excel: Record<string, HmsExcel> = {};
    for (const [kunci, e] of Object.entries(paket.excel || {})) {
      if (!e || !e.b64) continue;
      const nama = sanitizeFileName(e.nama || `${kunci}.xlsx`).replace(/(\.xlsx)?$/i, ".xlsx");
      const buf = Buffer.from(e.b64, "base64");
      fs.writeFileSync(path.join(sementara, nama), buf);
      unduhan.push({ kunci, nama, berkas: nama, ukuran: buf.length });
      excel[kunci] = { nama, tahun: e.tahun, berkas: nama };
    }
    const ringkas: HmsPaket = { ...paket, excel, unduhan, diimpor: new Date().toISOString() };
    fs.writeFileSync(path.join(sementara, "ringkasan.json"), JSON.stringify(ringkas, null, 1));
    // ganti folder lama setelah semua berkas baru tertulis
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(sementara, dir);
    return ringkas;
  } catch (e) {
    fs.rmSync(sementara, { recursive: true, force: true });
    throw e;
  }
}

export function bacaRingkasan(regionId: string): HmsPaket | null {
  try {
    const p = path.join(folder(regionId), "ringkasan.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export function hapusPaket(regionId: string): boolean {
  const dir = folder(regionId);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

export function daftarPaket(): { regionId: string; nama: string; elemen: string; dibuat?: string; diimpor?: string }[] {
  if (!fs.existsSync(HMS_DIR)) return [];
  const out = [];
  for (const id of fs.readdirSync(HMS_DIR)) {
    if (!isSafeId(id)) continue;
    const r = bacaRingkasan(id);
    if (r) out.push({ regionId: id, nama: r.das.nama, elemen: r.das.elemen, dibuat: r.dibuat, diimpor: r.diimpor });
  }
  return out;
}

/** Path berkas unduhan (hanya berkas yang terdaftar di ringkasan). */
export function pathUnduhan(regionId: string, berkas: string): string | null {
  const r = bacaRingkasan(regionId);
  if (!r || !r.unduhan || !r.unduhan.some((u) => u.berkas === berkas)) return null;
  return resolveInside(folder(regionId), berkas);
}

export function pesanGagalTulis(e: unknown): string {
  const kode = (e as { code?: string })?.code;
  if (kode === "EROFS" || kode === "EACCES" || kode === "EPERM")
    return "Server ini tidak bisa menulis berkas (mis. Vercel hanya-baca). Impor dari website di localhost (jalankan-neraca-air.bat), lalu commit & push folder data/hms ke GitHub.";
  return (e as Error)?.message || String(e);
}
