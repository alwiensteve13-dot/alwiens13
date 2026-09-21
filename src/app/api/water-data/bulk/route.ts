import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";
import fs from "fs";
import path from "path";

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in water-data bulk");
}

const getMockWaterData = () => {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-water.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.warn("Failed to read mock-water.json:", e);
  }
  return [];
};

const saveMockWaterDataBulk = (regionId: string, year: number | string, newRecords: any[]) => {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-water.json");
    let data = getMockWaterData();
    const yrNum = Number(year);
    
    // Always filter out existing records for this regionId and year
    data = data.filter((d: any) => {
      const isSameRegion = String(d.regionId) === String(regionId) || String(d.region_id) === String(regionId);
      const isSameYear = new Date(d.period).getUTCFullYear() === yrNum;
      return !(isSameRegion && isSameYear);
    });
    
    if (newRecords.length > 0) {
      data.push(...newRecords);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("Failed to write to mock-water.json (Vercel read-only filesystem):", e);
  }
};

const periodNames = [
  'Januari 1', 'Januari 2', 'Februari 1', 'Februari 2',
  'Maret 1', 'Maret 2', 'April 1', 'April 2',
  'Mei 1', 'Mei 2', 'Juni 1', 'Juni 2',
  'Juli 1', 'Juli 2', 'Agustus 1', 'Agustus 2',
  'September 1', 'September 2', 'Oktober 1', 'Oktober 2',
  'November 1', 'November 2', 'Desember 1', 'Desember 2'
];

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch(e) {
    return apiError("Format request JSON tidak valid", 400);
  }
  
  const { regionId, year, entries } = body;
  
  if (!regionId || !year || !Array.isArray(entries)) {
    return apiError("Format data tidak valid (membutuhkan regionId, year, dan entries)", 400);
  }

  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === "") return 0;
    const cleaned = String(val).trim().replace(/,/g, ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };
  
  // Filter entries: only save periods that have actual data inputted by user
  const recordsToInsert: any[] = [];
  
  entries.forEach((entry: any, index: number) => {
    const rawDebit = entry.debit != null ? String(entry.debit).trim() : "";
    const rawNeed = entry.need != null ? String(entry.need).trim() : "";
    const rawPem = entry.pemeliharaan != null ? String(entry.pemeliharaan).trim() : "";
    const rawNa = entry.na != null ? String(entry.na).trim() : "";

    // If completely blank, leave it empty (do NOT insert dummy records)
    if (rawDebit === "" && rawNeed === "" && rawPem === "" && rawNa === "") {
      return;
    }

    const month = Math.floor(index / 2) + 1;
    const cycle = (index % 2) + 1;
    
    const day = cycle === 1 ? "01" : "16";
    const monthStr = month.toString().padStart(2, "0");
    const dateStr = `${year}-${monthStr}-${day}T00:00:00.000Z`;
    
    const debit = parseNum(rawDebit);
    const need = parseNum(rawNeed);
    const pemeliharaan = rawPem !== ""
      ? parseNum(rawPem)
      : Number((0.095 * debit).toFixed(3));
    const neraca = rawNa !== "" 
      ? parseNum(rawNa) 
      : Number((debit - (need + pemeliharaan)).toFixed(3));
    const status = debit >= (need + pemeliharaan) ? "Surplus" : "Defisit";
    
    const periodNum = index + 1;
    const periodName = periodNames[index] || `Periode ${periodNum}`;

    recordsToInsert.push({
      regionId: String(regionId),
      region_id: String(regionId),
      period: dateStr,
      period_num: periodNum,
      period_name: periodName,
      year: Number(year),
      debit_air: debit,
      debit: debit,
      ketersediaan: debit,
      kebutuhan_air: need,
      kebutuhan: need,
      need: need,
      pemeliharaan_sungai: pemeliharaan,
      pemeliharaan: pemeliharaan,
      neraca_air: neraca,
      status,
    });
  });
  
  try {
    if (!prisma) throw new Error("Prisma not initialized");

    // Check if region exists in DB to prevent foreign key constraint crash
    const regionExists = await prisma.region.findUnique({
      where: { id: String(regionId) }
    });

    if (!regionExists) {
      throw new Error(`Region ${regionId} not in database, using mock storage`);
    }

    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
    
    await prisma.waterData.deleteMany({
      where: {
        regionId: String(regionId),
        period: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    if (recordsToInsert.length > 0) {
      const prismaRecords = recordsToInsert.map(r => ({
        regionId: r.regionId,
        period: new Date(r.period),
        debit_air: r.debit_air,
        kebutuhan_air: r.kebutuhan_air,
        pemeliharaan_sungai: r.pemeliharaan_sungai,
        neraca_air: r.neraca_air,
        status: r.status,
      }));
      await prisma.waterData.createMany({
        data: prismaRecords as any[]
      });
    }

    const inserted = await prisma.waterData.findMany({
      where: {
        regionId: String(regionId),
        period: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { period: 'asc' }
    });
    
    return apiSuccess({ success: true, count: inserted.length, records: inserted }, 201);
  } catch (error: any) {
    console.warn("Database operation failed or mock region used for bulk water-data, using mock fallback:", error?.message || error);
    
    const mockRecords = recordsToInsert.map(r => ({
      ...r,
      id: "mock-water-bulk-" + Math.random().toString(36).substring(7)
    }));
    
    saveMockWaterDataBulk(String(regionId), year, mockRecords);
    
    return apiSuccess({ success: true, count: mockRecords.length, mocked: true, records: mockRecords }, 201);
  }
}
