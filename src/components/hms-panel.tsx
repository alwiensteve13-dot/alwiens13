"use client";

/**
 * Panel "Hasil Simulasi HEC-HMS" pada ringkasan DAS (halaman utama).
 * Data dari /api/hms/<id> (diimpor admin lewat menu Impor HEC-HMS).
 * Ringkasan & grafik publik; unduhan Excel hanya untuk pengguna yang sudah login.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { useAuth } from "@/lib/auth-context";

type Seri = (number | null)[];
interface Ringkasan {
  dibuat?: string;
  diimpor?: string;
  das: { nama: string; elemen: string; luas_km2?: number | null; jumlah_subbasin?: number; jumlah_reach?: number };
  model?: { loss?: string[]; transform?: string[]; baseflow?: string[]; canopy?: string[]; surface?: string[]; et?: string; mulai?: string; selesai?: string; interval_menit?: number };
  hasil?: { debit_puncak?: number | null; waktu_puncak?: string; volume_mm?: number | null; debit_rata?: number | null; q80_harian?: number | null };
  hujan?: {
    jenis?: string; sumber?: string; mode?: string; seri?: string; pos?: string; jarakPos?: number; metode?: string; mutu?: string; mutuKelas?: string;
    awal?: string; akhir?: string; pilihanPos?: string; thiessen?: { pos: string; bobot: number; jarakKm?: number }[] | null;
  };
  cek_hecms?: { status?: string; teks?: string; versi?: string } | null;
  tahun?: { tahun: number; lengkap: boolean; debit_rata?: number | null }[];
  tahun_lengkap?: number[];
  periode15: string[];
  andalan15: Record<string, Seri>;
  andalan_bulanan: Record<string, Seri>;
  debit15_tahun?: Record<string, Seri>;
  debit_bulanan_tahun?: Record<string, Seri>;
  fdc?: { p: number; q: number | null }[];
  unduhan?: { kunci: string; nama: string; berkas: string; ukuran: number }[];
  excel?: Record<string, { nama: string; tahun?: number; berkas?: string }>;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const WARNA = { q50: "#0ea5e9", q80: "#10b981", q90: "#f59e0b", rata: "#94a3b8", tahun: "#a855f7" };

function angka(v: number | null | undefined, n = 3) {
  return v == null || !isFinite(v) ? "-" : v.toLocaleString("id-ID", { minimumFractionDigits: n, maximumFractionDigits: n });
}
function ukuran(b: number) {
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}
function gabung(a?: string[]) {
  return a && a.length ? a.join(", ") : "-";
}

export default function HmsPanel({ dasId }: { dasId: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [skala, setSkala] = useState<"15" | "bulan">("15");
  const [tahunBanding, setTahunBanding] = useState("");
  const [fdcLog, setFdcLog] = useState(true);

  useEffect(() => {
    // komponen dipasang ulang per DAS (key), jadi state tidak perlu dikosongkan di sini
    let batal = false;
    fetch(`/api/hms/${encodeURIComponent(dasId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!batal) setData(j?.data || null); })
      .catch(() => { if (!batal) setData(null); });
    return () => { batal = true; };
  }, [dasId]);

  const andalan = useMemo(() => {
    if (!data) return [];
    const src = skala === "15" ? data.andalan15 : data.andalan_bulanan;
    const label = skala === "15" ? data.periode15 : BULAN;
    const banding = tahunBanding ? (skala === "15" ? data.debit15_tahun : data.debit_bulanan_tahun)?.[tahunBanding] : undefined;
    return label.map((p, i) => ({
      periode: p,
      Q50: src?.q50?.[i] ?? null,
      Q80: src?.q80?.[i] ?? null,
      Q90: src?.q90?.[i] ?? null,
      "Rata-rata": src?.rata?.[i] ?? null,
      ...(banding ? { [`Tahun ${tahunBanding}`]: banding[i] ?? null } : {}),
    }));
  }, [data, skala, tahunBanding]);

  if (!data) return null;

  // skala log tidak bisa menampilkan debit 0
  const fdc = (data.fdc || []).map((f) => ({ p: f.p, q: fdcLog && !(Number(f.q) > 0) ? null : f.q }));

  const h = data.hujan || {};
  const m = data.model || {};
  const tl = data.tahun_lengkap || [];
  const q80fdc = data.fdc?.find((f) => f.p === 80)?.q ?? data.hasil?.q80_harian ?? null;
  const cek = data.cek_hecms;
  const cekOk = cek?.status ? /^(identik|sangat dekat)$/i.test(cek.status) : false;
  const kartu = "rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3";
  const lbl = "text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
  const nil = "text-sm font-bold text-slate-900 dark:text-white";

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-6" id="hms-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="font-bold text-base text-slate-900 dark:text-white">Hasil Simulasi HEC-HMS</h4>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          {cek ? (
            <span className={`rounded-full px-2 py-0.5 ${cekOk ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"}`}
              title={cek.teks || ""}>
              Dicek HEC-HMS asli{cek.versi ? ` ${cek.versi}` : ""}: {cek.status}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-600 dark:text-slate-300">
            {data.das.nama} · {data.das.elemen}
          </span>
        </div>
      </div>

      {/* Ringkasan model */}
      <div className="grid grid-cols-2 gap-2">
        <div className={kartu}><p className={lbl}>Luas DAS model</p><p className={nil}>{angka(data.das.luas_km2, 2)} km²</p></div>
        <div className={kartu}><p className={lbl}>Sub-basin / reach</p><p className={nil}>{data.das.jumlah_subbasin ?? "-"} / {data.das.jumlah_reach ?? "-"}</p></div>
        <div className={kartu}><p className={lbl}>Debit rata-rata</p><p className={nil}>{angka(data.hasil?.debit_rata)} m³/s</p></div>
        <div className={kartu}><p className={lbl}>Q80 harian (andalan)</p><p className={`${nil} text-emerald-600 dark:text-emerald-400`}>{angka(data.hasil?.q80_harian)} m³/s</p></div>
        <div className={`${kartu} col-span-2`}>
          <p className={lbl}>Debit puncak</p>
          <p className={nil}>{angka(data.hasil?.debit_puncak)} m³/s <span className="font-medium text-slate-500 dark:text-slate-400">({data.hasil?.waktu_puncak || "-"})</span></p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Periode</dt>
        <dd>{(m.mulai || "").slice(0, 10)} s/d {(m.selesai || "").slice(0, 10)} · {tl.length} tahun lengkap{tl.length ? ` (${tl[0]}–${tl[tl.length - 1]})` : ""}</dd>
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Loss</dt><dd>{gabung(m.loss)}</dd>
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Transform</dt><dd>{gabung(m.transform)}</dd>
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Baseflow</dt><dd>{gabung(m.baseflow)}</dd>
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Evapotranspirasi</dt><dd>{m.et || "-"}</dd>
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Hujan</dt>
        <dd>
          {h.mode ? `Satelit terkalibrasi (${h.mode})` : h.jenis || "-"}
          {h.pos ? ` · pos ${h.pos}` : ""}
          {h.metode ? ` · ${h.metode}` : ""}
          {h.mutu ? ` · mutu ${h.mutu}` : ""}
        </dd>
        {h.thiessen && h.thiessen.length > 0 && (
          <>
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Bobot Thiessen</dt>
            <dd>{h.thiessen.map((t) => `${t.pos} ${(t.bobot * 100).toFixed(1)}%`).join(" · ")}</dd>
          </>
        )}
      </dl>

      {/* Grafik debit andalan */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-bold text-slate-900 dark:text-white">Debit andalan (Weibull)</h5>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-semibold">
            {(["15", "bulan"] as const).map((k) => (
              <button key={k} onClick={() => setSkala(k)}
                className={`px-2.5 py-1 ${skala === k ? "bg-cyan-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                {k === "15" ? "15 harian" : "Bulanan"}
              </button>
            ))}
          </div>
          <select value={tahunBanding} onChange={(e) => setTahunBanding(e.target.value)} title="Bandingkan dengan debit simulasi tahun tertentu"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <option value="">+ tahun</option>
            {(data.tahun || []).slice().reverse().map((t) => (
              <option key={t.tahun} value={String(t.tahun)}>{t.tahun}{t.lengkap ? "" : " *"}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={andalan} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
            <XAxis dataKey="periode" tick={{ fontSize: 9 }} interval={skala === "15" ? 3 : 1} stroke="#94a3b8"
              tickFormatter={(v) => String(v).replace(/\s+I+$/, "")} />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Tooltip formatter={(v) => (typeof v === "number" ? `${angka(v)} m³/s` : "-")} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Q50" stroke={WARNA.q50} strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="Q80" stroke={WARNA.q80} strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
            <Line type="monotone" dataKey="Q90" stroke={WARNA.q90} strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="Rata-rata" stroke={WARNA.rata} strokeDasharray="4 3" dot={false} connectNulls />
            {tahunBanding && <Line type="monotone" dataKey={`Tahun ${tahunBanding}`} stroke={WARNA.tahun} strokeWidth={1.5} dot={false} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
        Peluang Weibull P = m/(n+1) dari {tl.length} tahun lengkap; Q80 = debit yang tersedia ≥ 80% waktu.
        {tahunBanding && !(data.tahun || []).find((t) => String(t.tahun) === tahunBanding)?.lengkap ? " * tahun tidak lengkap." : ""}
      </p>

      {/* Kurva durasi aliran */}
      {fdc.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between gap-2">
            <h5 className="text-sm font-bold text-slate-900 dark:text-white">Kurva durasi aliran <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">harian</span></h5>
            <div className="flex shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-semibold">
              {[true, false].map((k) => (
                <button key={String(k)} onClick={() => setFdcLog(k)}
                  className={`px-2 py-1 ${fdcLog === k ? "bg-cyan-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                  {k ? "Log" : "Linear"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fdc} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                <XAxis dataKey="p" type="number" domain={[0, 100]} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} tick={{ fontSize: 10 }}
                  stroke="#94a3b8" unit="%" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" scale={fdcLog ? "log" : "auto"} domain={fdcLog ? ["auto", "auto"] : [0, "auto"]}
                  allowDataOverflow={false} tickFormatter={(v) => (Number(v) < 1 ? String(Number(Number(v).toPrecision(2))) : String(Math.round(Number(v))))} />
                <Tooltip labelFormatter={(p) => `Terlampaui ${p}% waktu`} formatter={(v) => (typeof v === "number" ? `${angka(v)} m³/s` : "-")} />
                <ReferenceLine x={80} stroke={WARNA.q80} strokeDasharray="4 3"
                  label={{ value: `Q80 ${angka(q80fdc, 2)}`, position: "insideTopRight", fontSize: 10, fill: WARNA.q80 }} />
                <Line type="monotone" dataKey="q" name="Debit" stroke="#0284c7" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Unduhan */}
      {data.unduhan && data.unduhan.length > 0 && (
        <div className="mt-5">
          <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Unduhan Excel</h5>
          {!isLoading && !isAuthenticated && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200/70 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
              <span>Unduhan hanya untuk pengguna yang sudah login.</span>
              <Link href="/login?redirect=/" className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 font-bold text-white hover:bg-amber-500">Masuk</Link>
            </div>
          )}
          <ul className="space-y-1.5">
            {data.unduhan.map((u) => {
              const judul = u.kunci === "weibull" ? "Ketersediaan air - Weibull (semua tahun)"
                : u.kunci === "harian15" ? `Ketersediaan air 15 harian${data.excel?.harian15?.tahun ? ` tahun ${data.excel.harian15.tahun}` : ""}` : u.nama;
              const isi = (
                <>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{judul}</span>
                    <span className="truncate text-[10px] opacity-70">{u.nama} · {ukuran(u.ukuran)}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold">{isAuthenticated ? "Unduh .xlsx" : "🔒 Login"}</span>
                </>
              );
              const cls = "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs transition";
              return (
                <li key={u.berkas}>
                  {isAuthenticated ? (
                    <a href={`/api/hms/${encodeURIComponent(dasId)}/unduh?berkas=${encodeURIComponent(u.berkas)}`} download={u.nama}
                      className={`${cls} border-emerald-200/70 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60`}>
                      {isi}
                    </a>
                  ) : (
                    <Link href="/login?redirect=/" title="Masuk untuk mengunduh"
                      className={`${cls} border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800`}>
                      {isi}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
        Sumber: HEC-HMS DAS Analyzer (simulasi kontinu){data.diimpor ? ` · diperbarui ${new Date(data.diimpor).toLocaleDateString("id-ID")}` : ""}.
      </p>
    </div>
  );
}
