"use client";

/**
 * Admin > Impor HEC-HMS
 *
 * Paket .json dari aplikasi HEC-HMS DAS Analyzer (menu Simulasi > Unduh > "Paket untuk web Neraca Air")
 * disimpan sebagai hasil simulasi DAS (tampil di panel DAS halaman utama) dan - bila dipilih - debitnya
 * dipakai untuk kolom Debit/Ketersediaan air pada neraca 24 periode (15 harian) tahun tertentu.
 * Kebutuhan air yang sudah ada dipertahankan; pemeliharaan sungai & neraca dihitung ulang seperti input manual.
 */
import { useEffect, useMemo, useState } from "react";

type Seri = (number | null)[];
interface Paket {
  format: string;
  dibuat?: string;
  das: { nama: string; elemen: string; luas_km2?: number | null; jumlah_subbasin?: number };
  model?: { mulai?: string; selesai?: string; interval_menit?: number; loss?: string[]; transform?: string[]; baseflow?: string[]; et?: string };
  hujan?: { jenis?: string; mode?: string; pos?: string; metode?: string; mutu?: string; sumber?: string; namaArsip?: string; slug?: string };
  cek_hecms?: { status?: string; teks?: string } | null;
  tahun?: { tahun: number; lengkap: boolean }[];
  tahun_lengkap?: number[];
  periode15: string[];
  andalan15: Record<string, Seri>;
  debit15_tahun?: Record<string, Seri>;
  excel?: Record<string, { nama: string; b64?: string }>;
}
interface Region { id: string; name: string }
interface Rekaman { regionId?: string; region_id?: string; period: string; kebutuhan_air?: number; need?: number }

const PERIODE = [
  "Januari 1", "Januari 2", "Februari 1", "Februari 2", "Maret 1", "Maret 2", "April 1", "April 2",
  "Mei 1", "Mei 2", "Juni 1", "Juni 2", "Juli 1", "Juli 2", "Agustus 1", "Agustus 2",
  "September 1", "September 2", "Oktober 1", "Oktober 2", "November 1", "November 2", "Desember 1", "Desember 2",
];
const SUMBER: { v: string; t: string }[] = [
  { v: "q80", t: "Q80 andalan 15 harian (Weibull, semua tahun lengkap)" },
  { v: "q50", t: "Q50 15 harian (debit normal)" },
  { v: "q90", t: "Q90 15 harian" },
  { v: "q95", t: "Q95 15 harian" },
  { v: "rata", t: "Rata-rata 15 harian semua tahun lengkap" },
  { v: "tahun", t: "Debit 15 harian tahun tertentu (hasil simulasi)" },
];

const KATA_UMUM = new Set(["das", "sub", "wae", "way", "wai", "sungai", "harian", "basin", "hms", "model", "kalibrasi", "satelit"]);
const kata = (s: string) =>
  new Set(String(s || "").toLowerCase().replace(/([a-z])([0-9])/g, "$1 $2").split(/[^a-z0-9]+/).filter((k) => k && !KATA_UMUM.has(k)));

/** Cocokkan nama DAS di paket dengan DAS website: semua kata nama DAS website harus ada di nama paket; pilih yang paling spesifik. */
function cocokkanDas(namaPaket: string[], regions: Region[]): Region | undefined {
  let terbaik: Region | undefined, skor = 0;
  for (const nama of namaPaket) {
    const kp = kata(nama);
    if (!kp.size) continue;
    for (const r of regions) {
      const kr = kata(r.name);
      if (!kr.size || ![...kr].every((k) => kp.has(k))) continue;
      if (kr.size > skor) { skor = kr.size; terbaik = r; }
    }
    if (terbaik) return terbaik;
  }
  return terbaik;
}

function fmt(v: number | null | undefined, n = 3) {
  return v == null || !isFinite(v) ? "-" : v.toLocaleString("id-ID", { minimumFractionDigits: n, maximumFractionDigits: n });
}

export default function ImporHecmsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [paket, setPaket] = useState<Paket | null>(null);
  const [namaBerkas, setNamaBerkas] = useState("");
  const [pilihanManual, setPilihanManual] = useState<string | null>(null);
  const [isiNeraca, setIsiNeraca] = useState(true);
  const [sumber, setSumber] = useState("q80");
  const [tahunSumber, setTahunSumber] = useState("");
  const [tahunNeraca, setTahunNeraca] = useState(String(new Date().getFullYear()));
  const [rekamanDas, setRekamanDas] = useState<{ id: string; data: Rekaman[] }>({ id: "", data: [] });
  // DAS tujuan: pilihan manual, atau dicocokkan otomatis dari nama di paket (juga bila daftar DAS baru selesai dimuat)
  const cocok = useMemo(
    () => (paket ? cocokkanDas([paket.das.nama, paket.hujan?.namaArsip || "", paket.hujan?.slug || ""], regions) : undefined),
    [paket, regions],
  );
  const regionId = pilihanManual ?? cocok?.id ?? "";
  const rekaman = useMemo(() => (rekamanDas.id === regionId ? rekamanDas.data : []), [rekamanDas, regionId]);
  const [pesan, setPesan] = useState<{ jenis: "ok" | "err" | "info"; teks: string } | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [daftar, setDaftar] = useState<{ regionId: string; nama: string; elemen: string; diimpor?: string }[]>([]);

  const muatDaftar = () =>
    fetch("/api/hms", { cache: "no-store" }).then((r) => r.json()).then((j) => setDaftar(j?.data || [])).catch(() => setDaftar([]));

  useEffect(() => {
    fetch("/api/regions", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRegions((j?.data || []).map((x: Region) => ({ id: String(x.id), name: String(x.name) }))))
      .catch(() => setRegions([]));
    muatDaftar();
  }, []);

  // kebutuhan air yang sudah ada untuk DAS terpilih
  useEffect(() => {
    if (!regionId) return;
    fetch(`/api/water-data?regionId=${encodeURIComponent(regionId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRekamanDas({ id: regionId, data: j?.data || [] }))
      .catch(() => setRekamanDas({ id: regionId, data: [] }));
  }, [regionId]);

  const bacaBerkas = async (f: File | undefined) => {
    setPesan(null);
    if (!f) return;
    try {
      const p = JSON.parse(await f.text()) as Paket;
      if (p.format !== "hms-neraca-air" || !Array.isArray(p.periode15) || p.periode15.length !== 24)
        throw new Error('Bukan paket "Paket untuk web Neraca Air" dari menu Simulasi HEC-HMS.');
      setPaket(p);
      setNamaBerkas(f.name);
      const tl = p.tahun_lengkap || [];
      setTahunSumber(String(tl.length ? tl[tl.length - 1] : (p.tahun || []).slice(-1)[0]?.tahun || ""));
      setPilihanManual(null);
    } catch (e) {
      setPaket(null);
      setPesan({ jenis: "err", teks: (e as Error).message });
    }
  };

  const seri: Seri = useMemo(() => {
    if (!paket) return [];
    if (sumber === "tahun") return paket.debit15_tahun?.[tahunSumber] || Array(24).fill(null);
    return paket.andalan15[sumber] || Array(24).fill(null);
  }, [paket, sumber, tahunSumber]);

  const kebutuhan: (number | null)[] = useMemo(() => {
    const out: (number | null)[] = Array(24).fill(null);
    for (const d of rekaman) {
      const t = new Date(d.period);
      if (t.getUTCFullYear() !== Number(tahunNeraca)) continue;
      const i = t.getUTCMonth() * 2 + (t.getUTCDate() >= 16 ? 1 : 0);
      const k = d.kebutuhan_air ?? d.need;
      if (k != null && isFinite(Number(k))) out[i] = Number(k);
    }
    return out;
  }, [rekaman, tahunNeraca]);

  const baris = PERIODE.map((nama, i) => {
    const debit = seri[i] == null ? null : Number(Number(seri[i]).toFixed(3));
    const need = kebutuhan[i] ?? 0;
    const pem = debit == null ? null : Number((0.095 * debit).toFixed(3));
    const na = debit == null || pem == null ? null : Number((debit - (need + pem)).toFixed(3));
    return { nama, debit, need, pem, na, status: na == null ? "" : na >= 0 ? "Surplus" : "Defisit" };
  });

  const simpan = async () => {
    if (!paket || !regionId) return;
    setMenyimpan(true);
    setPesan({ jenis: "info", teks: "Menyimpan hasil simulasi..." });
    try {
      const r = await fetch(`/api/hms/${encodeURIComponent(regionId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(paket),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.error || `HTTP ${r.status}`);
      let teks = "Hasil simulasi HEC-HMS tersimpan dan tampil di panel DAS.";
      if (isiNeraca) {
        const entries = baris.map((b, i) => ({
          debit: b.debit == null ? "" : String(b.debit),
          need: kebutuhan[i] == null ? "" : String(kebutuhan[i]),
          pemeliharaan: "", na: "",
        }));
        const r2 = await fetch("/api/water-data/bulk", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionId, year: Number(tahunNeraca), entries }),
        });
        const j2 = await r2.json().catch(() => ({}));
        if (!r2.ok || j2.success === false) throw new Error("Hasil tersimpan, tetapi neraca gagal diisi: " + (j2.error || `HTTP ${r2.status}`));
        teks += ` Debit neraca ${tahunNeraca} diisi dari ${SUMBER.find((s) => s.v === sumber)?.t}${sumber === "tahun" ? " " + tahunSumber : ""}; kebutuhan air yang ada dipertahankan.`;
      }
      setPesan({ jenis: "ok", teks: teks + " Bila website dijalankan di localhost, commit & push folder data/hms dan public/mock-water.json ke GitHub agar tampil di Vercel." });
      muatDaftar();
    } catch (e) {
      setPesan({ jenis: "err", teks: (e as Error).message });
    } finally {
      setMenyimpan(false);
    }
  };

  const hapus = async (id: string, nama: string) => {
    if (!window.confirm(`Hapus hasil simulasi HEC-HMS untuk ${nama}? Data neraca air tidak ikut terhapus.`)) return;
    const r = await fetch(`/api/hms/${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setPesan(r.ok ? { jenis: "ok", teks: `Hasil simulasi ${nama} dihapus.` } : { jenis: "err", teks: j.error || `HTTP ${r.status}` });
    muatDaftar();
  };

  const kartu = "rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm";
  const input = "w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none";
  const regionNama = (id: string) => regions.find((r) => r.id === id)?.name || id;

  return (
    <div className="space-y-6 text-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-white">Impor hasil Simulasi HEC-HMS</h1>
        <p className="mt-1 text-sm text-slate-400">
          Unggah berkas <b>Paket untuk web Neraca Air (.json)</b> dari aplikasi HEC-HMS DAS Analyzer (menu Simulasi &gt; Hasil &gt; Unduh).
          Ringkasan model, debit andalan, kurva durasi aliran, dan Excel-nya tampil di panel DAS; unduhan Excel hanya untuk pengguna yang login.
        </p>
      </div>

      <div className={kartu}>
        <label className="block text-sm font-semibold text-white">1. Pilih berkas paket</label>
        <input type="file" accept=".json,application/json" className="mt-2 block text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:font-semibold file:text-white"
          onChange={(e) => bacaBerkas(e.target.files?.[0])} />
        {paket && (
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><span className="text-slate-400">Berkas:</span> {namaBerkas}</div>
            <div><span className="text-slate-400">DAS / elemen:</span> <b className="text-white">{paket.das.nama}</b> · {paket.das.elemen}{paket.das.luas_km2 ? ` · ${fmt(paket.das.luas_km2, 2)} km²` : ""}</div>
            <div><span className="text-slate-400">Periode simulasi:</span> {paket.model?.mulai} s/d {paket.model?.selesai}</div>
            <div><span className="text-slate-400">Tahun lengkap:</span> {(paket.tahun_lengkap || []).length} tahun ({(paket.tahun_lengkap || []).slice(0, 1)}-{(paket.tahun_lengkap || []).slice(-1)})</div>
            <div><span className="text-slate-400">Hujan:</span> {paket.hujan?.mode || paket.hujan?.jenis}{paket.hujan?.pos ? ` · pos ${paket.hujan.pos}` : ""}{paket.hujan?.mutu ? ` · mutu ${paket.hujan.mutu}` : ""}</div>
            <div><span className="text-slate-400">Cek HEC-HMS asli:</span> {paket.cek_hecms?.teks || "belum dijalankan"}</div>
          </div>
        )}
      </div>

      {paket && (
        <div className={kartu}>
          <label className="block text-sm font-semibold text-white">2. DAS tujuan & isi neraca air</label>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <span className="text-xs text-slate-400">DAS di website</span>
              <select className={input} value={regionId} onChange={(e) => setPilihanManual(e.target.value)}>
                <option value="">- pilih DAS -</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                {regions.length === 0 ? "Memuat daftar DAS..."
                  : pilihanManual != null ? "Dipilih manual."
                  : cocok ? `Dicocokkan otomatis dari nama paket "${paket.das.nama}" - periksa sebelum menyimpan.`
                  : `Nama "${paket.das.nama}" tidak cocok dengan DAS mana pun - pilih DAS tujuan.`}
              </p>
            </div>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={isiNeraca} onChange={(e) => setIsiNeraca(e.target.checked)} />
              Isi kolom Debit/Ketersediaan air neraca 24 periode dari hasil simulasi
            </label>
          </div>
          {isiNeraca && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <span className="text-xs text-slate-400">Debit yang dipakai</span>
                <select className={input} value={sumber} onChange={(e) => setSumber(e.target.value)}>
                  {SUMBER.map((s) => <option key={s.v} value={s.v}>{s.t}</option>)}
                </select>
              </div>
              {sumber === "tahun" ? (
                <div>
                  <span className="text-xs text-slate-400">Tahun hasil simulasi</span>
                  <select className={input} value={tahunSumber} onChange={(e) => setTahunSumber(e.target.value)}>
                    {(paket.tahun || []).slice().reverse().map((t) => (
                      <option key={t.tahun} value={String(t.tahun)}>{t.tahun}{t.lengkap ? "" : " (tidak lengkap)"}</option>
                    ))}
                  </select>
                </div>
              ) : <div />}
              <div>
                <span className="text-xs text-slate-400">Tahun neraca di website</span>
                <input className={input} type="number" min={2000} max={2100} value={tahunNeraca} onChange={(e) => setTahunNeraca(e.target.value)} />
              </div>
            </div>
          )}
          {isiNeraca && (
            <div className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 text-slate-300">
                  <tr><th className="p-2 text-left">Periode</th><th className="p-2 text-right">Debit (m³/s)</th><th className="p-2 text-right">Kebutuhan (ada)</th>
                    <th className="p-2 text-right">Pemeliharaan 9,5%</th><th className="p-2 text-right">Neraca</th><th className="p-2 text-left">Status</th></tr>
                </thead>
                <tbody>
                  {baris.map((b) => (
                    <tr key={b.nama} className="border-t border-white/5">
                      <td className="p-2">{b.nama}</td><td className="p-2 text-right font-mono text-white">{fmt(b.debit)}</td>
                      <td className="p-2 text-right font-mono">{fmt(b.need)}</td><td className="p-2 text-right font-mono">{fmt(b.pem)}</td>
                      <td className="p-2 text-right font-mono">{fmt(b.na)}</td>
                      <td className={`p-2 font-semibold ${b.status === "Defisit" ? "text-red-400" : "text-emerald-400"}`}>{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Kebutuhan air tahun {tahunNeraca} yang sudah tersimpan dipertahankan. Pemeliharaan sungai dan neraca dihitung ulang dengan rumus yang sama dengan input manual
            (pemeliharaan = 9,5% debit; neraca = debit - kebutuhan - pemeliharaan). Data neraca tahun {tahunNeraca} DAS ini akan diganti.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button disabled={!regionId || menyimpan} onClick={simpan}
              className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">
              {menyimpan ? "Menyimpan..." : "Simpan ke website"}
            </button>
            {regionId && <span className="text-xs text-slate-400">Tujuan: {regionNama(regionId)}</span>}
          </div>
        </div>
      )}

      {pesan && (
        <div className={`rounded-xl border p-4 text-sm ${pesan.jenis === "err" ? "border-red-500/40 bg-red-500/10 text-red-300" : pesan.jenis === "ok" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"}`}>
          {pesan.teks}
        </div>
      )}

      <div className={kartu}>
        <h2 className="text-sm font-semibold text-white">DAS yang sudah punya hasil Simulasi HEC-HMS</h2>
        {daftar.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Belum ada.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-slate-400"><tr><th className="py-1 text-left">DAS (website)</th><th className="text-left">Paket</th><th className="text-left">Diimpor</th><th /></tr></thead>
            <tbody>
              {daftar.map((d) => (
                <tr key={d.regionId} className="border-t border-white/5">
                  <td className="py-2">{regionNama(d.regionId)}</td><td>{d.nama} · {d.elemen}</td>
                  <td>{d.diimpor ? new Date(d.diimpor).toLocaleString("id-ID") : "-"}</td>
                  <td className="text-right"><button onClick={() => hapus(d.regionId, regionNama(d.regionId))} className="text-xs text-red-400 hover:text-red-300">hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
