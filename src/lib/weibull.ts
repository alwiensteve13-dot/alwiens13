/**
 * Modul Analisis Hidrologi Metode Weibull Standar Ditjen Sumber Daya Air (SDA) - Kementerian PUPR
 * Mengacu pada Kriteria Perencanaan Irigasi KP-01.
 *
 * Rumus Probabilitas Terlampaui (Weibull):
 * P = [m / (N + 1)] * 100%
 * di mana:
 *   m = Peringkat debit terurut menurun (1, 2, ..., N)
 *   N = Jumlah tahun data pengamatan historis (idealnya N = 10 - 20 tahun)
 */

export const PERIOD_NAMES = [
  "Januari 1", "Januari 2",
  "Februari 1", "Februari 2",
  "Maret 1", "Maret 2",
  "April 1", "April 2",
  "Mei 1", "Mei 2",
  "Juni 1", "Juni 2",
  "Juli 1", "Juli 2",
  "Agustus 1", "Agustus 2",
  "September 1", "September 2",
  "Oktober 1", "Oktober 2",
  "November 1", "November 2",
  "Desember 1", "Desember 2"
];

export const PERIOD_SHORT_NAMES = [
  "Jan 1", "Jan 2", "Feb 1", "Feb 2", "Mar 1", "Mar 2",
  "Apr 1", "Apr 2", "Mei 1", "Mei 2", "Jun 1", "Jun 2",
  "Jul 1", "Jul 2", "Ags 1", "Ags 2", "Sep 1", "Sep 2",
  "Okt 1", "Okt 2", "Nov 1", "Nov 2", "Des 1", "Des 2"
];

export interface RawHistoricalEntry {
  year: number;
  periodIdx: number; // 0 to 23
  debit: number;
  need?: number;
  pemeliharaan?: number;
}

export interface RankedYearItem {
  year: number;
  debit: number;
  rank: number; // m = 1..N
  P: number;    // %
}

export interface WeibullPeriodSummary {
  periodIdx: number;
  name: string;
  shortName: string;
  N: number; // Number of historical years
  years: number[];
  rankedData: RankedYearItem[];
  avgDebit: number;
  minDebit: number;
  maxDebit: number;
  Q20: number; // Basah (P = 20%)
  Q50: number; // Normal / Median (P = 50%)
  Q80: number; // Kering / Andalan Irigasi Ditjen SDA (P = 80%)
  Q90: number; // Air Baku / Kritis (P = 90%)
  need: number;
  pemeliharaan80: number;
  na80: number; // Q80 - (need + pemeliharaan80)
  status80: "Surplus" | "Defisit";
  pemeliharaan50: number;
  na50: number; // Q50 - (need + pemeliharaan50)
  status50: "Surplus" | "Defisit";
  pemeliharaan20: number;
  na20: number; // Q20 - (need + pemeliharaan20)
  status20: "Surplus" | "Defisit";
}

export interface WeibullAnalysisResult {
  totalYears: number;
  yearsList: number[];
  periodSummaries: WeibullPeriodSummary[];
  overallAvgDebit: number;
  overallQ80Avg: number;
  overallQ50Avg: number;
  overallQ20Avg: number;
  overallQ90Avg: number;
  flowDurationPoints: { rank: number; P: number; debit: number }[];
}

export interface YearClassification {
  periodIdx: number;
  name: string;
  year: number;
  debit: number;
  P: number;
  classKey: "sangatBasah" | "basah" | "normal" | "kering" | "sangatKering";
  className: string;
  badgeBg: string;
  badgeText: string;
  desc: string;
  need: number;
  pemeliharaan: number;
  na: number;
  status: "Surplus" | "Defisit";
}

/**
 * Melakukan interpolasi linier nilai debit berdasarkan probabilitas target P_target
 */
export function interpolateQuantile(ranked: RankedYearItem[], targetP: number): number {
  if (!ranked || ranked.length === 0) return 0;
  if (ranked.length === 1) return ranked[0].debit;

  // Jika targetP lebih kecil dari probabilitas titik peringkat 1 (debit terbesar)
  if (targetP <= ranked[0].P) return ranked[0].debit;
  // Jika targetP lebih besar dari probabilitas titik peringkat N (debit terkecil)
  if (targetP >= ranked[ranked.length - 1].P) return ranked[ranked.length - 1].debit;

  for (let i = 0; i < ranked.length - 1; i++) {
    const p1 = ranked[i].P;
    const p2 = ranked[i + 1].P;
    if (targetP >= p1 && targetP <= p2) {
      const q1 = ranked[i].debit;
      const q2 = ranked[i + 1].debit;
      if (Math.abs(p2 - p1) < 1e-6) return q1;
      const q = q1 + ((targetP - p1) / (p2 - p1)) * (q2 - q1);
      return Number(q.toFixed(2));
    }
  }

  return ranked[ranked.length - 1].debit;
}

/**
 * Menghitung probabilitas terlampaui untuk suatu nilai debit terhadap distribusi N tahun
 */
export function calculateExceedanceProbability(ranked: RankedYearItem[], debit: number): number {
  if (!ranked || ranked.length === 0) return 50;
  if (ranked.length === 1) return ranked[0].P;

  // Jika debit lebih besar sama dengan debit maksimum
  if (debit >= ranked[0].debit) return ranked[0].P;
  // Jika debit lebih kecil sama dengan debit minimum
  if (debit <= ranked[ranked.length - 1].debit) return ranked[ranked.length - 1].P;

  for (let i = 0; i < ranked.length - 1; i++) {
    const qHigh = ranked[i].debit;
    const qLow = ranked[i + 1].debit;
    if (debit <= qHigh && debit >= qLow) {
      const pLow = ranked[i].P;
      const pHigh = ranked[i + 1].P;
      if (Math.abs(qHigh - qLow) < 1e-6) return pLow;
      const P = pLow + ((qHigh - debit) / (qHigh - qLow)) * (pHigh - pLow);
      return Number(P.toFixed(1));
    }
  }

  return ranked[ranked.length - 1].P;
}

/**
 * Mengklasifikasikan probabilitas terlampaui sesuai kriteria Ditjen SDA
 */
export function classifyProbability(P: number): {
  classKey: "sangatBasah" | "basah" | "normal" | "kering" | "sangatKering";
  className: string;
  badgeBg: string;
  badgeText: string;
  desc: string;
} {
  if (P < 20) {
    return {
      classKey: "sangatBasah",
      className: "Sangat Basah",
      badgeBg: "#dbeafe",
      badgeText: "#1e40af",
      desc: "Debit/hujan sangat tinggi (hanya terjadi < 20% waktu)"
    };
  } else if (P < 40) {
    return {
      classKey: "basah",
      className: "Basah",
      badgeBg: "#e0f2fe",
      badgeText: "#0369a1",
      desc: "Debit andalan basah (Q20% - Q40%)"
    };
  } else if (P <= 60) {
    return {
      classKey: "normal",
      className: "Normal",
      badgeBg: "#d1fae5",
      badgeText: "#065f46",
      desc: "Periode rata-rata / median (Q50%)"
    };
  } else if (P <= 80) {
    return {
      classKey: "kering",
      className: "Kering",
      badgeBg: "#fef3c7",
      badgeText: "#92400e",
      desc: "Debit andalan irigasi standar Ditjen SDA (Q80%)"
    };
  } else {
    return {
      classKey: "sangatKering",
      className: "Sangat Kering",
      badgeBg: "#fee2e2",
      badgeText: "#991b1b",
      desc: "Debit andalan air baku / kritis (Q85% - Q95%)"
    };
  }
}

/**
 * Menjalankan Analisis Metode Weibull Lengkap untuk seluruh 24 Periode dari data multi-tahun
 */
export function analyzeWeibullMultiYear(
  records: RawHistoricalEntry[],
  defaultNeeds?: number[]
): WeibullAnalysisResult {
  const periodBuckets: { [periodIdx: number]: RawHistoricalEntry[] } = {};
  for (let i = 0; i < 24; i++) {
    periodBuckets[i] = [];
  }

  const yearsSet = new Set<number>();

  records.forEach(r => {
    if (r.periodIdx >= 0 && r.periodIdx < 24 && !isNaN(r.debit)) {
      periodBuckets[r.periodIdx].push(r);
      yearsSet.add(r.year);
    }
  });

  const yearsList = Array.from(yearsSet).sort((a, b) => a - b);
  const totalYears = yearsList.length;

  const periodSummaries: WeibullPeriodSummary[] = [];

  for (let idx = 0; idx < 24; idx++) {
    const bucket = periodBuckets[idx];
    const N = bucket.length;

    // Urutkan menurun: Q(1) >= Q(2) >= ... >= Q(N)
    const sorted = [...bucket].sort((a, b) => b.debit - a.debit);

    const rankedData: RankedYearItem[] = sorted.map((item, i) => {
      const rank = i + 1;
      // Weibull Formula: P = [m / (N + 1)] * 100%
      const P = Number(((rank / (N + 1)) * 100).toFixed(1));
      return {
        year: item.year,
        debit: item.debit,
        rank,
        P
      };
    });

    const sumDebit = bucket.reduce((sum, item) => sum + item.debit, 0);
    const avgDebit = N > 0 ? Number((sumDebit / N).toFixed(2)) : 0;
    const minDebit = sorted.length > 0 ? sorted[sorted.length - 1].debit : 0;
    const maxDebit = sorted.length > 0 ? sorted[0].debit : 0;

    // Kebutuhan air
    let need = 0;
    if (defaultNeeds && defaultNeeds[idx] !== undefined) {
      need = defaultNeeds[idx];
    } else {
      const needBucket = bucket.filter(b => b.need !== undefined && b.need > 0);
      if (needBucket.length > 0) {
        need = needBucket[needBucket.length - 1].need || 0;
      }
    }

    const Q20 = interpolateQuantile(rankedData, 20);
    const Q50 = interpolateQuantile(rankedData, 50);
    const Q80 = interpolateQuantile(rankedData, 80);
    const Q90 = interpolateQuantile(rankedData, 90);

    const pemeliharaan80 = Number((0.095 * Q80).toFixed(2));
    const na80 = Number((Q80 - (need + pemeliharaan80)).toFixed(2));
    const status80 = na80 >= 0 ? "Surplus" : "Defisit";

    const pemeliharaan50 = Number((0.095 * Q50).toFixed(2));
    const na50 = Number((Q50 - (need + pemeliharaan50)).toFixed(2));
    const status50 = na50 >= 0 ? "Surplus" : "Defisit";

    const pemeliharaan20 = Number((0.095 * Q20).toFixed(2));
    const na20 = Number((Q20 - (need + pemeliharaan20)).toFixed(2));
    const status20 = na20 >= 0 ? "Surplus" : "Defisit";

    periodSummaries.push({
      periodIdx: idx,
      name: PERIOD_NAMES[idx],
      shortName: PERIOD_SHORT_NAMES[idx],
      N,
      years: bucket.map(b => b.year),
      rankedData,
      avgDebit,
      minDebit,
      maxDebit,
      Q20,
      Q50,
      Q80,
      Q90,
      need,
      pemeliharaan80,
      na80,
      status80,
      pemeliharaan50,
      na50,
      status50,
      pemeliharaan20,
      na20,
      status20
    });
  }

  // Flow Duration Curve lintas seluruh rekaman data (N x 24 pengamatan)
  const allDebits = records.map(r => r.debit).filter(d => !isNaN(d)).sort((a, b) => b - a);
  const totalObs = allDebits.length;
  const flowDurationPoints = allDebits.map((debit, idx) => {
    const rank = idx + 1;
    const P = Number(((rank / (totalObs + 1)) * 100).toFixed(1));
    return { rank, P, debit };
  });

  const overallAvgDebit = Number((periodSummaries.reduce((s, p) => s + p.avgDebit, 0) / 24).toFixed(2));
  const overallQ80Avg = Number((periodSummaries.reduce((s, p) => s + p.Q80, 0) / 24).toFixed(2));
  const overallQ50Avg = Number((periodSummaries.reduce((s, p) => s + p.Q50, 0) / 24).toFixed(2));
  const overallQ20Avg = Number((periodSummaries.reduce((s, p) => s + p.Q20, 0) / 24).toFixed(2));
  const overallQ90Avg = Number((periodSummaries.reduce((s, p) => s + p.Q90, 0) / 24).toFixed(2));

  return {
    totalYears,
    yearsList,
    periodSummaries,
    overallAvgDebit,
    overallQ80Avg,
    overallQ50Avg,
    overallQ20Avg,
    overallQ90Avg,
    flowDurationPoints
  };
}

/**
 * Mengevaluasi suatu tahun tertentu terhadap analisis multi-tahun Weibull
 */
export function classifySpecificYear(
  targetYear: number,
  records: RawHistoricalEntry[],
  weibullResult: WeibullAnalysisResult
): YearClassification[] {
  const yearRecords = records.filter(r => r.year === targetYear);
  const byPeriod: { [idx: number]: RawHistoricalEntry } = {};
  yearRecords.forEach(r => {
    byPeriod[r.periodIdx] = r;
  });

  return weibullResult.periodSummaries.map((summary, idx) => {
    const rec = byPeriod[idx];
    const debit = rec ? rec.debit : 0;
    const need = rec && rec.need !== undefined ? rec.need : summary.need;
    const pemeliharaan = rec && rec.pemeliharaan !== undefined && rec.pemeliharaan !== null
      ? rec.pemeliharaan
      : Number((0.095 * debit).toFixed(2));
    const na = Number((debit - (need + pemeliharaan)).toFixed(2));
    const status = na >= 0 ? "Surplus" : "Defisit";

    // Hitung probabilitas empiris terhadap N tahun pada periode ini
    const P = calculateExceedanceProbability(summary.rankedData, debit);
    const cls = classifyProbability(P);

    return {
      periodIdx: idx,
      name: summary.name,
      year: targetYear,
      debit,
      P,
      classKey: cls.classKey,
      className: cls.className,
      badgeBg: cls.badgeBg,
      badgeText: cls.badgeText,
      desc: cls.desc,
      need,
      pemeliharaan,
      na,
      status
    };
  });
}
