"use client";

/**
 * Jendela "Debit andalan lengkap" (dibuka dari panel Hasil Simulasi HEC-HMS).
 * Grafik besar + tabel Q50/Q80/Q90/Q95/rata-rata (15 harian / bulanan), debit tiap tahun,
 * dan unduhan (Excel data lengkap, grafik PNG) - unduhan hanya untuk pengguna yang sudah login.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { LoginRequiredCard } from "@/components/login-required";

type Seri = (number | null)[];
export interface DataAndalan {
  das: { nama: string; elemen: string };
  tahun?: { tahun: number; lengkap: boolean }[];
  tahun_lengkap?: number[];
  periode15: string[];
  andalan15: Record<string, Seri>;
  andalan_bulanan: Record<string, Seri>;
  debit15_tahun?: Record<string, Seri>;
  debit_bulanan_tahun?: Record<string, Seri>;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const SERI_ANDALAN: { k: string; label: string; warna: string; tebal?: number; putus?: string }[] = [
  { k: "q50", label: "Q50", warna: "#0ea5e9" },
  { k: "q80", label: "Q80", warna: "#10b981", tebal: 2.5 },
  { k: "q90", label: "Q90", warna: "#f59e0b" },
  { k: "q95", label: "Q95", warna: "#ef4444" },
  { k: "rata", label: "Rata-rata", warna: "#94a3b8", putus: "4 3" },
];
const WARNA_TAHUN = "#a855f7";

function angka(v: number | null | undefined, n = 3) {
  return v == null || !isFinite(v) ? "-" : v.toLocaleString("id-ID", { minimumFractionDigits: n, maximumFractionDigits: n });
}

export default function HmsAndalanDetail({ data, dasId, onClose }: { data: DataAndalan; dasId: string; onClose: () => void }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [skala, setSkala] = useState<"15" | "bulan">("15");
  const [tampil, setTampil] = useState<Record<string, boolean>>({ q50: true, q80: true, q90: true, q95: true, rata: true });
  const [tahun, setTahun] = useState("");
  const [tab, setTab] = useState<"andalan" | "tahun">("andalan");
  const [pesan, setPesan] = useState("");
  const grafik = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = lama; };
  }, [onClose]);

  const label = skala === "15" ? data.periode15 : BULAN;
  const src = skala === "15" ? data.andalan15 : data.andalan_bulanan;
  const perTahun = skala === "15" ? data.debit15_tahun : data.debit_bulanan_tahun;
  const daftarTahun = useMemo(() => Object.keys(perTahun || {}).sort(), [perTahun]);
  const lengkap = new Set((data.tahun_lengkap || []).map(String));

  const baris = useMemo(() => label.map((p, i) => {
    const o: Record<string, string | number | null> = { periode: p };
    for (const s of SERI_ANDALAN) o[s.label] = src?.[s.k]?.[i] ?? null;
    if (tahun) o[`Tahun ${tahun}`] = perTahun?.[tahun]?.[i] ?? null;
    return o;
  }), [label, src, perTahun, tahun]);

  const unduhPng = async () => {
    if (!grafik.current) return;
    setPesan("Menyiapkan gambar grafik...");
    try {
      const { toPng } = await import("html-to-image");
      const gelap = document.documentElement.classList.contains("dark");
      const url = await toPng(grafik.current, { pixelRatio: 2, backgroundColor: gelap ? "#0f172a" : "#ffffff" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `Grafik_Debit_Andalan_${skala === "15" ? "15harian" : "bulanan"}_${data.das.nama}.png`.replace(/[^A-Za-z0-9._-]+/g, "_");
      a.click();
      setPesan("");
    } catch (e) {
      setPesan("Gagal membuat gambar: " + (e as Error).message);
    }
  };

  const tombol = (aktif: boolean) =>
    `px-2.5 py-1 text-xs font-semibold ${aktif ? "bg-cyan-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`;
  const th = "sticky top-0 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300 first:text-left first:left-0 first:z-10";
  const td = "px-3 py-1.5 text-right font-mono tabular-nums";

  // portal ke <body>: panel DAS memakai animasi transform yang membuat "fixed" ikut terpotong
  return createPortal(
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-slate-900/60 p-2 sm:p-6 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Debit andalan lengkap">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Debit andalan lengkap</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {data.das.nama} · {data.das.elemen} · Weibull P = m/(n+1) dari {(data.tahun_lengkap || []).length} tahun lengkap
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Tutup (Esc)" aria-label="Tutup">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* Kontrol */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <button className={tombol(skala === "15")} onClick={() => setSkala("15")}>15 harian</button>
              <button className={tombol(skala === "bulan")} onClick={() => setSkala("bulan")}>Bulanan</button>
            </div>
            {SERI_ANDALAN.map((s) => (
              <label key={s.k} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={tampil[s.k]} onChange={(e) => setTampil({ ...tampil, [s.k]: e.target.checked })} />
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.warna }} />{s.label}
              </label>
            ))}
            <select value={tahun} onChange={(e) => setTahun(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <option value="">+ bandingkan tahun</option>
              {daftarTahun.slice().reverse().map((t) => <option key={t} value={t}>{t}{lengkap.has(t) ? "" : " *"}</option>)}
            </select>
          </div>

          {/* Grafik */}
          <div ref={grafik} className="mt-3 rounded-xl bg-white dark:bg-slate-900 p-2">
            <p className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Debit andalan {skala === "15" ? "15 harian" : "bulanan"} - {data.das.nama} ({data.das.elemen})
            </p>
            <div className="h-[340px] w-full sm:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={baris} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                  <XAxis dataKey="periode" tick={{ fontSize: 10 }} interval={skala === "15" ? 1 : 0} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" label={{ value: "m³/s", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip formatter={(v) => (typeof v === "number" ? `${angka(v)} m³/s` : "-")} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {SERI_ANDALAN.filter((s) => tampil[s.k]).map((s) => (
                    <Line key={s.k} type="monotone" dataKey={s.label} stroke={s.warna} strokeWidth={s.tebal || 1.6}
                      strokeDasharray={s.putus} dot={s.k === "q80" ? { r: 2 } : false} connectNulls />
                  ))}
                  {tahun && <Line type="monotone" dataKey={`Tahun ${tahun}`} stroke={WARNA_TAHUN} strokeWidth={1.6} dot={false} connectNulls />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Unduhan */}
          <div className="mt-3">
            {!isLoading && !isAuthenticated ? (
              <LoginRequiredCard judul="Unduh data & grafik debit andalan" pesan="Excel data lengkap dan gambar grafik hanya untuk pengguna yang sudah login." />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/api/hms/${encodeURIComponent(dasId)}/data`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
                  ⬇ Excel data lengkap (.xlsx)
                </a>
                <button onClick={unduhPng} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  ⬇ Grafik ini (.png)
                </button>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Excel berisi: andalan 15 harian & bulanan (Q50/Q80/Q90/Q95/rata-rata), debit 15 harian & bulanan tiap tahun, kurva durasi aliran, keterangan model.
                </span>
                {pesan && <span className="text-[11px] text-amber-600">{pesan}</span>}
              </div>
            )}
          </div>

          {/* Tabel */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <button className={tombol(tab === "andalan")} onClick={() => setTab("andalan")}>Tabel debit andalan</button>
              <button className={tombol(tab === "tahun")} onClick={() => setTab("tahun")}>Debit tiap tahun</button>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Satuan m³/s · {skala === "15" ? "rata-rata tiap 15 harian (I: 1-15, II: 16-akhir bulan)" : "rata-rata bulanan"}</span>
          </div>
          <div className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            {tab === "andalan" ? (
              <table className="w-full text-xs text-slate-700 dark:text-slate-200">
                <thead><tr>
                  <th className={th}>Periode</th>
                  {SERI_ANDALAN.map((s) => <th key={s.k} className={th} style={{ color: s.warna }}>{s.label}</th>)}
                  {tahun && <th className={th} style={{ color: WARNA_TAHUN }}>Tahun {tahun}</th>}
                </tr></thead>
                <tbody>
                  {baris.map((b) => (
                    <tr key={String(b.periode)} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-1.5 font-semibold">{b.periode}</td>
                      {SERI_ANDALAN.map((s) => <td key={s.k} className={`${td} ${s.k === "q80" ? "font-bold text-emerald-700 dark:text-emerald-400" : ""}`}>{angka(b[s.label] as number | null)}</td>)}
                      {tahun && <td className={td}>{angka(b[`Tahun ${tahun}`] as number | null)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs text-slate-700 dark:text-slate-200">
                <thead><tr>
                  <th className={`${th} sticky left-0`}>Periode</th>
                  {daftarTahun.map((t) => <th key={t} className={th}>{t}{lengkap.has(t) ? "" : "*"}</th>)}
                </tr></thead>
                <tbody>
                  {label.map((p, i) => (
                    <tr key={p} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-1.5 font-semibold">{p}</td>
                      {daftarTahun.map((t) => <td key={t} className={td}>{angka(perTahun?.[t]?.[i] ?? null, 2)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Q80 = debit yang tersedia ≥ 80% waktu (debit andalan untuk neraca air). * tahun tidak lengkap - tidak dipakai menghitung debit andalan.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
