import * as XLSX from "xlsx";
import { PERIOD_NAMES, PERIOD_SHORT_NAMES, RawHistoricalEntry } from "./weibull";

export interface ParsedExcelResult {
  records: RawHistoricalEntry[];
  needs: number[];
  detectedYears: number[];
  errors: string[];
}

/**
 * Menghasilkan Berkas Excel Template 20 Tahun (.xlsx) Siap Pakai
 */
export function generate20YearExcelTemplate(regionName: string = "DAS"): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Header 24 Periode
  const headers = ["Tahun", ...PERIOD_SHORT_NAMES];

  // Buat 20 tahun data contoh realistis (2004 s/d 2023)
  const rows: any[][] = [headers];

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 20;

  for (let y = startYear; y < currentYear; y++) {
    // Pola musiman simulasi (puncak basah sekitar Mei-Juli untuk wilayah Maluku)
    const yearRow: (number | string)[] = [y];
    for (let p = 0; p < 24; p++) {
      const month = Math.floor(p / 2); // 0 = Jan, 4 = Mei, 6 = Jul
      // Musim hujan Maluku umumnya Mei - Agustus
      const seasonalFactor = Math.sin(((month - 1) / 12) * Math.PI * 2);
      const baseDebit = 6.5 + seasonalFactor * 3.5;
      // Sedikit variasi antar-tahun
      const yearFactor = Math.sin((y * 13) % 7);
      const debit = Math.max(1.2, Number((baseDebit + yearFactor * 1.8).toFixed(2)));
      yearRow.push(debit);
    }
    rows.push(yearRow);
  }

  // Tambahkan baris Kebutuhan Air (24 Periode)
  const needRow: (string | number)[] = ["Kebutuhan Air (m3/s)"];
  for (let p = 0; p < 24; p++) {
    // Kebutuhan irigasi/air baku rata-rata
    const needVal = Number((1.2 + Math.sin(p / 4) * 0.4).toFixed(2));
    needRow.push(needVal);
  }
  rows.push(needRow);

  // Buat Worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set lebar kolom agar rapi
  const colWidths = [{ wch: 22 }];
  for (let i = 0; i < 24; i++) {
    colWidths.push({ wch: 10 });
  }
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Data Debit 20 Tahun");

  // Halaman Petunjuk Pengisian
  const guideRows = [
    ["PETUNJUK PENGISIAN TEMPLATE DEBIT 20 TAHUN - METODE WEIBULL DITJEN SDA"],
    [""],
    ["1. Sheet 'Data Debit 20 Tahun' berisi matriks data debit historis (m3/s) per periode setengah bulanan (24 periode/tahun)."],
    ["2. Kolom A adalah Tahun (misal 2004 s/d 2023 atau rentang tahun data yang Anda miliki, minimal 10 - 20 tahun)."],
    ["3. Kolom B s/d Y adalah debit rata-rata setengah bulanan dari Jan 1 sampai Des 2."],
    ["4. Baris terakhir 'Kebutuhan Air (m3/s)' dapat diisi dengan estimasi kebutuhan air pada masing-masing 24 periode."],
    ["5. Jika menggunakan koma sebagai desimal (misal 5,42), sistem akan otomatis mengonversi menjadi desimal titik."],
    ["6. Setelah diisi, simpan file ini dan unggah melalui menu 'Kelola Data Debit 20 Tahun' di Panel Pengelola."]
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "Petunjuk");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

/**
 * Parsing berkas Excel (.xlsx / .csv) yang diunggah pengguna
 */
export function parseMultiYearExcel(dataBuffer: ArrayBuffer | Uint8Array): ParsedExcelResult {
  const errors: string[] = [];
  const records: RawHistoricalEntry[] = [];
  const needs: number[] = Array(24).fill(0);
  const detectedYearsSet = new Set<number>();

  try {
    const workbook = XLSX.read(dataBuffer, { type: "array" });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { records: [], needs, detectedYears: [], errors: ["File Excel kosong atau tidak terbaca."] };
    }

    // Ambil sheet pertama atau sheet yang bernama mengandung "debit" / "data"
    let targetSheetName = workbook.SheetNames[0];
    for (const name of workbook.SheetNames) {
      if (name.toLowerCase().includes("debit") || name.toLowerCase().includes("data")) {
        targetSheetName = name;
        break;
      }
    }

    const sheet = workbook.Sheets[targetSheetName];
    const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rawJson || rawJson.length < 2) {
      return { records: [], needs, detectedYears: [], errors: ["Sheet tidak memiliki data yang cukup."] };
    }

    // Temukan baris header yang berisi "Tahun" atau "Year"
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rawJson.length, 10); r++) {
      const row = rawJson[r];
      const firstCell = String(row[0] || "").trim().toLowerCase();
      if (firstCell.includes("tahun") || firstCell.includes("year") || firstCell === "thn") {
        headerRowIdx = r;
        break;
      }
    }

    // Jika tidak ditemukan tulisan "Tahun", coba baris ke-0 jika baris ke-1 berisi angka tahun
    if (headerRowIdx === -1) {
      const potentialYear = parseInt(String(rawJson[1]?.[0] || "").trim(), 10);
      if (potentialYear >= 1970 && potentialYear <= 2100) {
        headerRowIdx = 0;
      }
    }

    if (headerRowIdx === -1) {
      return {
        records: [],
        needs,
        detectedYears: [],
        errors: ["Kolom 'Tahun' tidak ditemukan pada baris header file Excel. Pastikan sel A1 atau header berisi 'Tahun'."]
      };
    }

    // Loop setiap baris data setelah header
    for (let r = headerRowIdx + 1; r < rawJson.length; r++) {
      const row = rawJson[r];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || "").trim().toLowerCase();
      if (!firstCell) continue;

      // Cek apakah ini baris Kebutuhan Air
      if (firstCell.includes("kebutuhan") || firstCell.includes("need")) {
        for (let p = 0; p < 24; p++) {
          const rawVal = String(row[p + 1] || "").replace(",", ".");
          const parsed = parseFloat(rawVal);
          if (!isNaN(parsed)) {
            needs[p] = Number(parsed.toFixed(2));
          }
        }
        continue;
      }

      // Cek apakah firstCell adalah Tahun
      const year = parseInt(firstCell, 10);
      if (isNaN(year) || year < 1970 || year > 2100) {
        // Baris teks non-data (misal catatan di bawah tabel), abaikan
        continue;
      }

      detectedYearsSet.add(year);

      // Ambil nilai 24 kolom periode (kolom 1 s/d 24)
      for (let p = 0; p < 24; p++) {
        const rawVal = String(row[p + 1] || "").replace(",", ".");
        const debit = parseFloat(rawVal);
        const validDebit = !isNaN(debit) ? Number(debit.toFixed(2)) : 0;

        records.push({
          year,
          periodIdx: p,
          debit: validDebit
        });
      }
    }

    // Pasangkan nilai kebutuhan ke records jika ada
    records.forEach(rec => {
      rec.need = needs[rec.periodIdx] || 0;
      rec.pemeliharaan = Number((0.095 * rec.debit).toFixed(2));
    });

    const detectedYears = Array.from(detectedYearsSet).sort((a, b) => a - b);

    if (detectedYears.length === 0) {
      errors.push("Tidak ada baris data tahun yang valid ditemukan dalam berkas.");
    }

    return {
      records,
      needs,
      detectedYears,
      errors
    };
  } catch (err: any) {
    return {
      records: [],
      needs,
      detectedYears: [],
      errors: ["Gagal memproses file: " + (err.message || String(err))]
    };
  }
}
