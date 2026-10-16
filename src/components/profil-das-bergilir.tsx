"use client";

/*
 * Panel kanan beranda: profil SATU DAS yang berganti otomatis tiap 3 detik,
 * dengan gerak yang sama dengan panel kanan web Kalibrasi Hujan Satelit
 * (isi lama memudar naik, isi baru masuk bertahap, batang grafik tumbuh).
 * Berhenti sementara saat penunjuk berada di atas panel, saat tab tidak
 * terlihat, atau bila pengguna memilih "kurangi gerak" di sistemnya.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import area from "@turf/area";

type Das = {
  id: string;
  name: string;
  region: string;
  area?: string;
  debit: string;
  need: string;
  status: string;
  color: string;
  geojson?: Parameters<typeof area>[0];
};

type BarisAir = { regionId?: string; period: string; debit_air?: number; kebutuhan_air?: number; pemeliharaan_sungai?: number };
type Pengguna = { regionId?: string };

type Props = {
  daftar: Das[];
  dataAir: BarisAir[];
  penggunaAir: Pengguna[];
  tahun: string;
  onPilih: (id: string) => void;
};

const JEDA = 3000;          // lama tiap DAS tampil (ms)
const JEDA_MANUAL = 15000;  // setelah ‹ › ditekan, beri waktu baca lebih lama sekali
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const angka = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "–" : v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const m3s = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  return angka(v, a > 0 && a < 0.01 ? 4 : a < 10 ? 2 : 1);
};
const kurangiGerak = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function luasKm2(d: Das): string {
  if (d.area && d.area !== "-") return d.area;
  if (d.geojson) {
    try { return `${angka(area(d.geojson) / 1e6, 2)} km²`; } catch { /* abaikan */ }
  }
  return "–";
}

type Profil = {
  bulan: { debit: number | null; butuh: number | null }[];
  nPeriode: number;
  nDefisit: number;
  debitMin: number | null;
  debitRata: number | null;
  butuhRata: number | null;
  kebRata: number | null;
  pemRata: number | null;
  pengguna: number;
};

function hitungProfil(d: Das, dataAir: BarisAir[], penggunaAir: Pengguna[], tahun: string): Profil {
  const waya = d.name?.toLowerCase().includes("waya");
  const baris = dataAir.filter(x =>
    (x.regionId === d.id || (waya && x.regionId === "mock-1787820000000")) &&
    new Date(x.period).getUTCFullYear().toString() === tahun);
  const per = Array.from({ length: 12 }, () => ({ sd: 0, nd: 0, sb: 0, nb: 0 }));
  let nDefisit = 0, debitMin: number | null = null, sd = 0, sb = 0, sk = 0, sp = 0;
  for (const x of baris) {
    const m = new Date(x.period).getUTCMonth();
    const deb = Number(x.debit_air) || 0;
    const keb = Number(x.kebutuhan_air) || 0, pem = Number(x.pemeliharaan_sungai) || 0;
    const butuh = keb + pem;
    sk += keb; sp += pem;
    per[m].sd += deb; per[m].nd++;
    per[m].sb += butuh; per[m].nb++;
    sd += deb; sb += butuh;
    if (deb < butuh) nDefisit++;
    if (debitMin == null || deb < debitMin) debitMin = deb;
  }
  return {
    bulan: per.map(p => ({ debit: p.nd ? p.sd / p.nd : null, butuh: p.nb ? p.sb / p.nb : null })),
    nPeriode: baris.length,
    nDefisit,
    debitMin,
    debitRata: baris.length ? sd / baris.length : null,
    butuhRata: baris.length ? sb / baris.length : null,
    kebRata: baris.length ? sk / baris.length : null,
    pemRata: baris.length ? sp / baris.length : null,
    pengguna: penggunaAir.filter(u => u.regionId === d.id).length,
  };
}

/* Kartu statistik neraca (desain "stat-card" Uiverse.io oleh code-town3, disesuaikan):
   donat pembagian ketersediaan air + legenda + grafik garis bulanan dengan tooltip.
   Menu titik tiga memilih seri grafik garis. */
export type Seri = "ketersediaan" | "kebutuhan" | "neraca";
const SERI: { id: Seri; label: string; kelas: string; warna: string }[] = [
  { id: "ketersediaan", label: "Ketersediaan", kelas: "sales", warna: "#3d8bff" },
  { id: "kebutuhan", label: "Kebutuhan", kelas: "product", warna: "#ff6a3d" },
  { id: "neraca", label: "Neraca", kelas: "income", warna: "#1ecb6b" },
];

function StatNeraca({ p, tahun, seri, onSeri, menuBuka, onMenu }: {
  p: Profil; tahun: string; seri: Seri; onSeri?: (s: Seri) => void; menuBuka?: boolean; onMenu?: (b: boolean) => void;
}) {
  const deb = p.debitRata ?? 0, keb = p.kebRata ?? 0, pem = p.pemRata ?? 0;
  const ada = p.nPeriode > 0 && deb + keb + pem > 0;
  // Donat: bagian ketersediaan yang dipakai kebutuhan, pemeliharaan sungai, dan sisanya.
  const total = Math.max(deb, keb + pem) || 1;
  const bagian = [
    { kelas: "product", nilai: keb / total },
    { kelas: "income", nilai: pem / total },
    { kelas: "sales", nilai: Math.max(0, deb - keb - pem) / total },
  ];
  const R = 60, C = 2 * Math.PI * R, CELAH = 0.025 * C;
  let jalan = 0;
  const segmen = bagian.map((b, i) => {
    const pj = b.nilai * C;
    const tampil = pj > CELAH * 1.2 ? pj - CELAH : pj > 0 ? Math.max(pj * 0.5, 0.5) : 0;
    const el = tampil > 0 ? (
      <circle key={b.kelas} className={`donut-segment ${b.kelas}`} cx="85" cy="85" r={R}
        strokeDasharray={`${tampil} ${C}`} strokeDashoffset={-jalan} style={{ "--i": i, "--pj": tampil } as CSSProperties} />
    ) : null;
    jalan += pj;
    return el;
  });
  const pakai = deb > 0 ? (keb + pem) / deb : null;
  const selisih = p.debitRata != null && p.butuhRata != null ? p.debitRata - p.butuhRata : null;

  // Grafik garis bulanan untuk seri terpilih
  const nilai = p.bulan.map(b => seri === "ketersediaan" ? b.debit
    : seri === "kebutuhan" ? b.butuh
    : b.debit != null && b.butuh != null ? b.debit - b.butuh : null);
  const sah = nilai.filter((v): v is number => v != null && Number.isFinite(v));
  const W = 360, H = 120, kiri = 12, kanan = 12, atas = 14, bawah = 24;
  const lo = Math.min(0, ...sah), hi = Math.max(...sah, lo + 1e-6);
  const xs = (i: number) => kiri + (W - kiri - kanan) * (i / 11);
  const ys = (v: number) => atas + (H - atas - bawah) * (1 - (v - lo) / (hi - lo || 1));
  const titik = nilai.map((v, i) => (v == null ? null : { x: xs(i), y: ys(v), v, i })).filter(Boolean) as { x: number; y: number; v: number; i: number }[];
  const jalur = titik.map((t, k) => `${k ? "L" : "M"}${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(" ");
  const panjang = titik.reduce((a, t, k) => k ? a + Math.hypot(t.x - titik[k - 1].x, t.y - titik[k - 1].y) : 0, 0);
  const s0 = SERI.find(x => x.id === seri)!;

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <h2 className="stat-card-title">Neraca {tahun}</h2>
        {onSeri && (
          <div className="menu-wrapper">
            <button type="button" className="menu-dots" aria-label="Pilih grafik" aria-expanded={!!menuBuka}
              onClick={() => onMenu?.(!menuBuka)}><span /><span /><span /></button>
            <div className={`menu-select${menuBuka ? " buka" : ""}`} role="menu">
              {SERI.map(x => (
                <div key={x.id} role="menuitemradio" aria-checked={seri === x.id} tabIndex={0}
                  className={seri === x.id ? "pilih" : ""}
                  onClick={() => { onSeri(x.id); onMenu?.(false); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSeri(x.id); onMenu?.(false); } }}>
                  {x.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {ada ? (
        <>
          <div className="stat-card-chart">
            <svg className="donut" viewBox="0 0 170 170" role="img"
              aria-label={`Pemakaian ketersediaan air ${pakai != null ? Math.round(pakai * 100) + "%" : ""}`}>
              <circle className="donut-bg" cx="85" cy="85" r={R} />
              <g transform="rotate(-90 85 85)">{segmen}</g>
              <text x="85" y="88" textAnchor="middle" className="donut-text-main">
                {pakai == null ? "–" : pakai > 9.99 ? ">999%" : `${Math.round(pakai * 100)}%`}
              </text>
              <text x="85" y="112" textAnchor="middle" className="donut-text-sub">terpakai</text>
            </svg>
          </div>

          <div className="stat-card-legend">
            <div className="legend-item">
              <span>Ketersediaan rata-rata</span>
              <span>
                <span className="legend-value">{m3s(p.debitRata)}</span>
                {selisih != null && (
                  <span className={`legend-change${selisih < 0 ? " turun" : ""}`}>{selisih >= 0 ? "+" : ""}{m3s(selisih)}</span>
                )}
              </span>
            </div>
            <div className="legend-item"><span><span className="legend-dot product" />Kebutuhan air</span><span>{m3s(keb)} m³/s</span></div>
            <div className="legend-item"><span><span className="legend-dot income" />Pemeliharaan sungai</span><span>{m3s(pem)} m³/s</span></div>
            <div className="legend-item"><span><span className="legend-dot sales" />Sisa (surplus)</span><span>{m3s(Math.max(0, deb - keb - pem))} m³/s</span></div>
          </div>

          {titik.length > 1 && (<>
            <div className="seri-label"><i style={{ background: s0.warna }} />{seri === "kebutuhan" ? "Kebutuhan + pemeliharaan" : seri === "neraca" ? "Neraca (surplus/defisit)" : "Ketersediaan"} bulanan, m³/s</div>
            <svg className="linechart" viewBox={`0 0 ${W} ${H}`} role="img"
              aria-label={`${s0.label} bulanan ${tahun}, Januari sampai Desember`}
              style={{ "--warna-seri": s0.warna, "--panjang": panjang } as CSSProperties}>
              {lo < 0 && <line x1={kiri} x2={W - kanan} y1={ys(0)} y2={ys(0)} className="garis-nol" />}
              <path d={jalur} className="garis-seri" />
              <g className="x-labels">
                {BULAN.map((b, i) => <text key={b} x={xs(i)} y={H - 4} textAnchor="middle">{b.charAt(0)}</text>)}
              </g>
              {titik.map(t => {
                const teks = `${BULAN[t.i]}: ${m3s(t.v)} m³/s`;
                const lb = teks.length * 7.4 + 18;
                const tx = Math.min(Math.max(t.x - lb / 2, 2), W - lb - 2);
                const ty = t.y - 40 < 0 ? t.y + 12 : t.y - 40;
                return (
                  <g key={t.i} className="dot-group" style={{ "--i": t.i } as CSSProperties}>
                    <circle cx={t.x} cy={t.y} r="12" className="dot-area" />
                    <circle cx={t.x} cy={t.y} r="4.5" className="dot" />
                    <g className="tooltip">
                      <rect x={tx} y={ty} width={lb} height="28" rx="8" />
                      <text x={tx + lb / 2} y={ty + 19} textAnchor="middle">{teks}</text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </>)}
        </>
      ) : (
        <p className="stat-kosong">Data neraca tahun {tahun} belum diunggah untuk DAS ini.</p>
      )}
    </div>
  );
}

function IsiProfil({ d, p, tahun, onPilih, seri, onSeri, menuBuka, onMenu }: {
  d: Das; p: Profil; tahun: string; onPilih?: (id: string) => void;
  seri: Seri; onSeri?: (s: Seri) => void; menuBuka?: boolean; onMenu?: (b: boolean) => void;
}) {
  const kelas = d.status === "Surplus" ? "baik" : d.status === "Defisit" ? "lemah" : "lama";
  const selisih = p.debitRata != null && p.butuhRata != null ? p.debitRata - p.butuhRata : null;
  const kartu: [string, string, string][] = [
    ["Ketersediaan", m3s(p.debitRata), "m³/s · rata-rata"],
    ["Kebutuhan", m3s(p.butuhRata), "m³/s · termasuk pemeliharaan"],
    ["Periode defisit", p.nPeriode ? `${p.nDefisit}` : "–", p.nPeriode ? `dari ${p.nPeriode} periode 15 harian` : "belum ada data"],
    ["Debit minimum", m3s(p.debitMin), "m³/s · periode terendah"],
  ];
  const info: [string, string][] = [
    ["Wilayah", d.region || "–"],
    ["Luas DAS", luasKm2(d)],
    ["Tahun neraca", tahun],
    ["Pengguna air terdaftar", `${p.pengguna}`],
  ];
  return (
    <div className="isi">
      <div className="rincian-kepala">
        <span className="titik besar" style={{ background: d.color }} />
        <h3>{d.name}</h3>
      </div>
      <div className={`mutu-das ${kelas}`}>
        <span className={`lencana-mutu ${kelas}`}>{d.status === "Belum ada data" ? "Belum ada data neraca" : `Neraca ${d.status}`}</span>
        <p>
          {p.nPeriode
            ? <>Ketersediaan rata-rata {m3s(p.debitRata)} m³/s dibanding kebutuhan + pemeliharaan {m3s(p.butuhRata)} m³/s
                {selisih != null && <> · selisih <b>{selisih >= 0 ? "+" : ""}{m3s(selisih)}</b> m³/s</>}</>
            : <>Data neraca tahun {tahun} untuk DAS ini belum diunggah.</>}
        </p>
      </div>
      <h4>Ringkasan neraca {tahun}</h4>
      <div className="kartu-ringkas">
        {kartu.map(([j, n, s]) => (
          <div key={j}><span>{j}</span><b>{n}</b><small>{s}</small></div>
        ))}
      </div>
      <StatNeraca p={p} tahun={tahun} seri={seri} onSeri={onSeri} menuBuka={menuBuka} onMenu={onMenu} />
      <h4>Keterangan</h4>
      <table className="info">
        <tbody>
          {info.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
        </tbody>
      </table>
      {onPilih && (
        <div className="tombol-baris">
          <button type="button" className="tombol-buka" onClick={() => onPilih(d.id)}>Buka rincian DAS</button>
        </div>
      )}
    </div>
  );
}

export default function ProfilDasBergilir({ daftar, dataAir, penggunaAir, tahun, onPilih }: Props) {
  const urut = useMemo(
    () => daftar.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "id")),
    [daftar]);
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [hantu, setHantu] = useState<{ id: string; top: number; tinggi: number } | null>(null);
  const [jalan, setJalan] = useState(true);
  const [seri, setSeri] = useState<Seri>("ketersediaan");
  const [menuBuka, setMenuBuka] = useState(false);
  const menuRef = useRef(false);
  const bukaMenu = useCallback((b: boolean) => { menuRef.current = b; setMenuBuka(b); }, []);
  const panelRef = useRef<HTMLDivElement>(null);
  const tahan = useRef(false);
  const tunda = useRef(false);

  const aktif = urut.find(d => d.id === aktifId) || urut[0];
  const profil = useMemo(() => new Map(urut.map(d => [d.id, hitungProfil(d, dataAir, penggunaAir, tahun)])),
    [urut, dataAir, penggunaAir, tahun]);

  const ganti = useCallback((id: string) => {
    if (!aktif || id === aktif.id) return;
    const panel = panelRef.current;
    if (panel && !kurangiGerak()) setHantu({ id: aktif.id, top: panel.scrollTop, tinggi: panel.clientHeight });
    setAktifId(id);
    if (panel) panel.scrollTop = 0;
  }, [aktif]);

  const lompat = useCallback((arah: number, manual = false) => {
    if (!urut.length || !aktif) return;
    const i = urut.findIndex(d => d.id === aktif.id);
    const j = ((i < 0 ? 0 : i) + arah + urut.length) % urut.length;
    if (manual) tunda.current = true;
    ganti(urut[j].id);
  }, [urut, aktif, ganti]);

  // Menu grafik tertutup bila klik di luar menu.
  useEffect(() => {
    if (!menuBuka) return;
    const tutup = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.(".menu-wrapper")) bukaMenu(false);
    };
    document.addEventListener("pointerdown", tutup);
    return () => document.removeEventListener("pointerdown", tutup);
  }, [menuBuka, bukaMenu]);

  // Salinan lama ("hantu") memudar dalam 0,24 detik lalu dilepas.
  useEffect(() => {
    if (!hantu) return;
    const t = setTimeout(() => setHantu(null), 320);
    return () => clearTimeout(t);
  }, [hantu]);

  // Pergantian otomatis tiap 3 detik. Saat ditahan (penunjuk di atas panel / tab tersembunyi)
  // jadwal diulang tanpa berganti.
  const [detak, setDetak] = useState(0);
  useEffect(() => {
    if (!jalan || kurangiGerak() || urut.length < 2) return;
    const tunggu = tunda.current ? JEDA_MANUAL : JEDA;
    tunda.current = false;
    const t = setTimeout(() => {
      if (document.hidden || tahan.current || menuRef.current) setDetak(x => x + 1);
      else lompat(1);
    }, tunggu);
    return () => clearTimeout(t);
  }, [jalan, urut.length, aktif?.id, lompat, detak]);

  if (!aktif) {
    return <div className="profil-bergilir"><p className="kosong">Belum ada DAS.</p></div>;
  }
  const dHantu = hantu && urut.find(d => d.id === hantu.id);

  return (
    <div className="profil-bergilir"
      onPointerEnter={() => { tahan.current = true; }}
      onPointerLeave={() => { tahan.current = false; }}>
      <div className="ringkas-bar">
        <span>{urut.length} DAS · neraca {tahun}</span>
        <span className="kendali-gilir">
          <button type="button" onClick={() => lompat(-1, true)} aria-label="DAS sebelumnya" title="DAS sebelumnya">‹</button>
          <button type="button" onClick={() => setJalan(j => !j)} aria-pressed={!jalan}
            aria-label={jalan ? "Hentikan pergantian otomatis" : "Lanjutkan pergantian otomatis"}
            title={jalan ? "Hentikan pergantian otomatis" : "Lanjutkan pergantian otomatis"}>
            {jalan
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>}
          </button>
          <button type="button" onClick={() => lompat(1, true)} aria-label="DAS berikutnya" title="DAS berikutnya">›</button>
        </span>
      </div>
      <section ref={panelRef} className="rincian ada" aria-live="off" aria-label="Profil DAS">
        <div key={aktif.id} className="ganti-das" style={{ "--warna-das": aktif.color } as CSSProperties}>
          <IsiProfil d={aktif} p={profil.get(aktif.id)!} tahun={tahun} onPilih={onPilih}
            seri={seri} onSeri={setSeri} menuBuka={menuBuka} onMenu={bukaMenu} />
        </div>
        {dHantu && (
          <div className="rincian-hantu" aria-hidden="true" style={{ height: hantu!.tinggi }}>
            <div style={{ transform: `translateY(${-hantu!.top}px)` }}>
              <IsiProfil d={dHantu} p={profil.get(dHantu.id)!} tahun={tahun} seri={seri} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
