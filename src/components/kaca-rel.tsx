"use client";

import Link from "next/link";

/**
 * Rel navigasi kiri bertema kaca — sama dengan aplikasi Simulasi HEC-HMS & Kalibrasi.
 * Urutan: Simulasi, Parameter, Kalibrasi, Neraca Air (+ Kelola).
 * Tautan ke aplikasi HEC-HMS (localhost:5000) hanya tampil untuk pengelola yang sudah masuk,
 * karena aplikasi itu berjalan di komputer pengelola, bukan di internet.
 */
const HMS = "http://localhost:5000";

const Ikon = {
  sim: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5h16" /><path d="m5.5 15 4-4.5 3 3 6-7" />
    </svg>
  ),
  par: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h6m4 0h6M4 17h10m4 0h2" /><circle cx="12" cy="7" r="2" /><circle cx="16" cy="17" r="2" />
    </svg>
  ),
  kal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 16a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 7.5a4.5 4.5 0 0 1 .5 8.97" /><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
    </svg>
  ),
  na: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v16M8 20h8" /><path d="M5 7h14" /><path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" />
    </svg>
  ),
  kelola: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  bulan: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  ),
  matahari: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  ),
};

export default function KacaRel({
  aktif,
  masuk,
  gelap,
  onTema,
}: {
  aktif: "neraca" | "kelola";
  masuk: boolean;
  gelap?: boolean;
  onTema?: () => void;
}) {
  const luar = { target: "_blank", rel: "noopener" } as const;
  return (
    <nav className="app-nav no-print" aria-label="Navigasi utama">
      <div className="nav-links">
        {masuk && (
          <>
            <a href={`${HMS}/simulasi`} {...luar} title="Simulasi HEC-HMS di komputer ini (localhost:5000)">{Ikon.sim}<span>Simulasi</span></a>
            <a href={`${HMS}/parameter`} {...luar} title="Generator Parameter di komputer ini (localhost:5000)">{Ikon.par}<span>Parameter</span></a>
            <a href={`${HMS}/kalibrasi/admin.html`} {...luar} title="Kalibrasi Hujan Satelit di komputer ini (localhost:5000)">{Ikon.kal}<span>Kalibrasi</span></a>
          </>
        )}
        <Link href="/" aria-current={aktif === "neraca" ? "page" : undefined}>{Ikon.na}<span>Neraca Air</span></Link>
        <span className="nav-sela" aria-hidden="true" />
        <Link href="/admin" aria-current={aktif === "kelola" ? "page" : undefined} title={masuk ? "Halaman pengelola" : "Masuk sebagai pengelola"}>
          {Ikon.kelola}<span>{masuk ? "Kelola" : "Masuk"}</span>
        </Link>
      </div>
      {onTema && (
        <div className="nav-kaki">
          <button type="button" className="tombol-ikon" onClick={onTema} aria-label="Ganti tema terang/gelap" title="Ganti tema terang/gelap">
            {gelap ? Ikon.matahari : Ikon.bulan}
          </button>
        </div>
      )}
    </nav>
  );
}
