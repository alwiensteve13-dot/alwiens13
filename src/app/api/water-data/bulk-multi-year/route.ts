import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";
import fs from "fs";
import path from "path";

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in bulk-multi-year");
}

const getMockWaterData = () => {
  const filePath = path.join(process.cwd(), "public", "mock-water.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return [];
};

const saveMockWaterDataBulkMultiYear = (regionId: string, newRecords: any[]) => {
  const filePath = path.join(process.cwd(), "public", "mock-water.json");
  let data = getMockWaterData();

  if (newRecords.length > 0) {
    const yearsToReplace = new Set(newRecords.map(r => new Date(r.period).getUTCFullYear()));

    // Hapus data lama untuk regionId dan tahun-tahun yang diunggah
    data = data.filter((d: any) => {
      const isSameRegion = d.regionId === regionId;
      const recYear = new Date(d.period).getUTCFullYear();
      return !(isSameRegion && yearsToReplace.has(recYear));
    });
  }

  data.push(...newRecords);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return apiError("Format JSON tidak valid", 400);
  }

  const { regionId, records } = body;

  if (!regionId || !Array.isArray(records) || records.length === 0) {
    return apiError("Format data tidak valid (wajib menyertakan regionId dan array records)", 400);
  }

  const yearsSet = new Set<number>();

  const recordsToInsert = records.map((entry: any, index: number) => {
    const year = parseInt(entry.year, 10);
    const periodIdx = parseInt(entry.periodIdx, 10);
    yearsSet.add(year);

    const month = Math.floor(periodIdx / 2) + 1;
    const cycle = (periodIdx % 2) + 1;
    const day = cycle === 1 ? "01" : "16";
    const monthStr = month.toString().padStart(2, "0");
    const dateStr = `${year}-${monthStr}-${day}T00:00:00.000Z`;

    const debit = parseFloat(entry.debit) || 0;
    const need = parseFloat(entry.need) || 0;
    const pemeliharaan = entry.pemeliharaan != null && entry.pemeliharaan !== ""
      ? parseFloat(entry.pemeliharaan)
      : Number((0.095 * debit).toFixed(2));
    const neraca = entry.na != null && entry.na !== ""
      ? parseFloat(entry.na)
      : Number((debit - (need + pemeliharaan)).toFixed(2));
    const status = debit >= (need + pemeliharaan) ? "Surplus" : "Defisit";

    return {
      id: `mock-multi-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      regionId,
      period: dateStr,
      debit_air: debit,
      kebutuhan_air: need,
      pemeliharaan_sungai: pemeliharaan,
      neraca_air: neraca,
      status,
    };
  });

  const yearsList = Array.from(yearsSet).sort((a, b) => a - b);

  try {
    if (!prisma) throw new Error("Prisma not initialized");

    const minYear = Math.min(...yearsList);
    const maxYear = Math.max(...yearsList);

    const startDate = new Date(`${minYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${maxYear}-12-31T23:59:59.999Z`);

    await prisma.waterData.deleteMany({
      where: {
        regionId,
        period: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const prismaRecords = recordsToInsert.map(r => ({
      regionId: r.regionId,
      period: new Date(r.period),
      debit_air: r.debit_air,
      kebutuhan_air: r.kebutuhan_air,
      pemeliharaan_sungai: r.pemeliharaan_sungai,
      neraca_air: r.neraca_air,
      status: r.status as any,
    }));

    // Insert dalam batch agar aman di PostgreSQL
    const chunkSize = 100;
    for (let i = 0; i < prismaRecords.length; i += chunkSize) {
      await prisma.waterData.createMany({
        data: prismaRecords.slice(i, i + chunkSize)
      });
    }

    // Selalu sinkronkan juga ke mock-water.json untuk fallback
    saveMockWaterDataBulkMultiYear(regionId, recordsToInsert);

    return apiSuccess({
      message: `Berhasil menyimpan ${recordsToInsert.length} rekaman data untuk ${yearsList.length} tahun (${yearsList[0]} - ${yearsList[yearsList.length - 1]}).`,
      totalRecords: recordsToInsert.length,
      years: yearsList
    }, 201);
  } catch (error) {
    console.warn("Database connection failed or Prisma unavailable, using mock JSON storage:", error);
    saveMockWaterDataBulkMultiYear(regionId, recordsToInsert);

    return apiSuccess({
      message: `Berhasil menyimpan ke mock data: ${recordsToInsert.length} rekaman data untuk ${yearsList.length} tahun (${yearsList[0]} - ${yearsList[yearsList.length - 1]}).`,
      totalRecords: recordsToInsert.length,
      years: yearsList
    }, 201);
  }
}
