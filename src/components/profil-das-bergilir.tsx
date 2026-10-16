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
  pengguna: number;
};

function hitungProfil(d: Das, dataAir: BarisAir[], penggunaAir: Pengguna[], tahun: string): Profil {
  const waya = d.name?.toLowerCase().includes("waya");
  const baris = dataAir.filter(x =>
    (x.regionId === d.id || (waya && x.regionId === "mock-1787820000000")) &&
    new Date(x.period).getUTCFullYear().toString() === tahun);
  const per = Array.from({ length: 12 }, () => ({ sd: 0, nd: 0, sb: 0, nb: 0 }));
  let nDefisit = 0, debitMin: number | null = null, sd = 0, sb = 0;
  for (const x of baris) {
    const m = new Date(x.period).getUTCMonth();
    const deb = Number(x.debit_air) || 0;
    const butuh = (Number(x.kebutuhan_air) || 0) + (Number(x.pemeliharaan_sungai) || 0);
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
    pengguna: penggunaAir.filter(u => u.regionId === d.id).length,
  };
}

/* Grafik batang bulanan (ketersediaan) + garis kebutuhan, gaya grafik hujan bulanan di web Kalibrasi. */
function GrafikBulanan({ p }: { p: Profil }) {
  const b = p.bulan.map(x => x.debit);
  const k = p.bulan.map(x => x.butuh);
  if (!b.some(v => v != null && v > 0) && !k.some(v => v != null && v > 0)) return null;
  const W = 320, H = 132, kiri = 30, bawah = 18, atas = 8;
  const nilai = [...b, ...k].filter((v): v is number => v != null && Number.isFinite(v));
  const maks = Math.max(...nilai, 0.001);
  const langkah = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => maks / s <= 5) || 1000;
  const puncak = Math.ceil(maks / langkah) * langkah;
  const y = (v: number) => atas + (H - atas - bawah) * (1 - v / puncak);
  const lebar = (W - kiri - 4) / 12;
  const garisGrid: number[] = [];
  for (let v = 0; v <= puncak + langkah / 1000; v += langkah) garisGrid.push(Number(v.toFixed(4)));
  return (
    <>
      <svg className="grafik-bulanan" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Ketersediaan air rata-rata bulanan dan kebutuhan air, Januari sampai Desember">
        {garisGrid.map(v => (
          <g key={v}>
            <line x1={kiri} x2={W - 2} y1={y(v)} y2={y(v)} className="g-grid" />
            <text x={kiri - 4} y={y(v) + 3} className="g-sumbu" textAnchor="end">{v.toLocaleString("id-ID")}</text>
          </g>
        ))}
        {b.map((v, i) => {
          const x = kiri + i * lebar + lebar * 0.16;
          const w = lebar * 0.68;
          return (
            <g key={i}>
              {v != null && (
                <rect x={x} y={y(v)} width={w} height={Math.max(0, y(0) - y(v))} rx={2} className="g-batang"
                  style={{ "--i": i } as CSSProperties}>
                  <title>{`${BULAN[i]}: ketersediaan ${m3s(v)} m³/s`}</title>
                </rect>
              )}
              {k[i] != null && (k[i] as number) > 0 && (
                <line x1={x - 1} x2={x + w + 1} y1={y(k[i] as number)} y2={y(k[i] as number)} className="g-r80"
                  style={{ "--i": i } as CSSProperties}>
                  <title>{`${BULAN[i]}: kebutuhan + pemeliharaan ${m3s(k[i])} m³/s`}</title>
                </line>
              )}
              <text x={x + w / 2} y={H - 5} className="g-sumbu" textAnchor="middle">{BULAN[i].charAt(0)}</text>
            </g>
          );
        })}
      </svg>
      <div className="legenda-grafik">
        <span><i className="kotak-batang" />Ketersediaan (m³/s)</span>
        {k.some(v => v != null && v > 0) && <span><i className="garis-r80" />Kebutuhan + pemeliharaan</span>}
      </div>
    </>
  );
}

function IsiProfil({ d, p, tahun, onPilih }: { d: Das; p: Profil; tahun: string; onPilih?: (id: string) => void }) {
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
      <GrafikBulanan p={p} />
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
      if (document.hidden || tahan.current) setDetak(x => x + 1);
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
          <IsiProfil d={aktif} p={profil.get(aktif.id)!} tahun={tahun} onPilih={onPilih} />
        </div>
        {dHantu && (
          <div className="rincian-hantu" aria-hidden="true" style={{ height: hantu!.tinggi }}>
            <div style={{ transform: `translateY(${-hantu!.top}px)` }}>
              <IsiProfil d={dHantu} p={profil.get(dHantu.id)!} tahun={tahun} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
