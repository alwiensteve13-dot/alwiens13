import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { bacaRingkasan } from "@/lib/hms-store";
import { isSafeId, sanitizeFileName } from "@/lib/safe-path";
import { buatXlsx, type Sel, type Sheet } from "@/lib/xlsx-mini";

export const dynamic = "force-dynamic";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const KOLOM: [string, string][] = [["q50", "Q50"], ["q80", "Q80"], ["q90", "Q90"], ["q95", "Q95"], ["rata", "Rata-rata"]];

/**
 * Data lengkap debit andalan hasil Simulasi HEC-HMS sebagai Excel (wajib login):
 * andalan 15 harian & bulanan (Q50/Q80/Q90/Q95/rata-rata), debit 15 harian & bulanan tiap tahun,
 * kurva durasi aliran, dan keterangan model.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ success: false, error: "Silakan masuk (login) terlebih dahulu untuk mengunduh." }, { status: 401 });
  }
  const { id } = await params;
  if (!isSafeId(id)) return NextResponse.json({ success: false, error: "Id DAS tidak valid." }, { status: 400 });
  const r = bacaRingkasan(id);
  if (!r) return NextResponse.json({ success: false, error: "Belum ada hasil simulasi HEC-HMS untuk DAS ini." }, { status: 404 });

  const satuan = "(m³/s)";
  const andalan = (label: string[], src: Record<string, (number | null)[]> | undefined, judulPeriode: string): Sel[][] => [
    [judulPeriode, ...KOLOM.map(([, t]) => `${t} ${satuan}`)],
    ...label.map((p, i) => [p, ...KOLOM.map(([k]) => src?.[k]?.[i] ?? null)]),
  ];
  const tiapTahun = (label: string[], src: Record<string, (number | null)[]> | undefined, judulPeriode: string): Sel[][] => {
    const th = Object.keys(src || {}).sort();
    return [[judulPeriode, ...th.map((t) => `${t}${(r.tahun_lengkap || []).includes(Number(t)) ? "" : " *"}`)],
      ...label.map((p, i) => [p, ...th.map((t) => src?.[t]?.[i] ?? null)])];
  };

  const m = (r.model || {}) as Record<string, unknown>;
  const h = (r.hujan || {}) as Record<string, unknown>;
  const hs = (r.hasil || {}) as Record<string, unknown>;
  const tl = r.tahun_lengkap || [];
  const gabung = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));
  const info: Sel[][] = [
    ["Keterangan", "Nilai"],
    ["DAS (model)", r.das.nama],
    ["Elemen", r.das.elemen],
    ["Luas DAS model (km²)", r.das.luas_km2 ?? null],
    ["Sub-basin / reach", `${r.das.jumlah_subbasin ?? "-"} / ${r.das.jumlah_reach ?? "-"}`],
    ["Periode simulasi", `${String(m.mulai || "").slice(0, 10)} s/d ${String(m.selesai || "").slice(0, 10)}`],
    ["Tahun lengkap", tl.length ? `${tl.length} tahun (${tl[0]}-${tl[tl.length - 1]})` : "-"],
    ["Loss / Transform / Baseflow", `${gabung(m.loss)} / ${gabung(m.transform)} / ${gabung(m.baseflow)}`],
    ["Evapotranspirasi", gabung(m.et)],
    ["Hujan", [h.mode ? `Satelit terkalibrasi (${h.mode})` : h.jenis, h.pos ? `pos ${h.pos}` : "", h.mutu ? `mutu ${h.mutu}` : ""].filter(Boolean).join(" · ")],
    ["Debit rata-rata (m³/s)", (hs.debit_rata as number) ?? null],
    ["Q80 harian (m³/s)", (hs.q80_harian as number) ?? null],
    ["Debit puncak (m³/s)", (hs.debit_puncak as number) ?? null],
    ["Waktu puncak", gabung(hs.waktu_puncak)],
    ["Cek HEC-HMS asli", r.cek_hecms ? `${r.cek_hecms.status || ""} - ${r.cek_hecms.teks || ""}` : "belum dijalankan"],
    ["Metode", "Debit andalan: peluang Weibull P = m/(n+1) dari tahun lengkap (tiap periode 15 harian ≥ 10 hari data). Q80 = debit yang tersedia ≥ 80% waktu."],
    ["Tanda *", "tahun tidak lengkap (tidak dipakai menghitung debit andalan)"],
    ["Diperbarui", r.diimpor || ""],
  ];

  const sheets: Sheet[] = [
    { nama: "Andalan 15 harian", baris: andalan(r.periode15, r.andalan15, "Periode 15 harian"), lebar: [18, 16, 16, 16, 16, 18] },
    { nama: "Andalan bulanan", baris: andalan(BULAN, r.andalan_bulanan, "Bulan"), lebar: [14, 16, 16, 16, 16, 18] },
    { nama: "Debit 15 harian per tahun", baris: tiapTahun(r.periode15, r.debit15_tahun, "Periode 15 harian"), lebar: [18] },
    { nama: "Debit bulanan per tahun", baris: tiapTahun(BULAN, r.debit_bulanan_tahun, "Bulan"), lebar: [14] },
    { nama: "Kurva durasi aliran", baris: [["Peluang terlampaui (%)", `Debit harian ${satuan}`], ...(r.fdc || []).map((f) => [f.p, f.q])], lebar: [22, 22] },
    { nama: "Keterangan", baris: info, lebar: [28, 90] },
  ];
  const buf = await buatXlsx(sheets);
  const nama = sanitizeFileName(`Debit_Andalan_${r.das.nama}_${r.das.elemen}.xlsx`);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
