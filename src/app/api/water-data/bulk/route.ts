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

const saveMockWaterDataBulk = (newRecords: any[]) => {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-water.json");
    let data = getMockWaterData();
    
    if (newRecords.length > 0) {
      const regionId = newRecords[0].regionId;
      const year = new Date(newRecords[0].period).getFullYear();
      
      data = data.filter((d: any) => {
        const isSameRegion = d.regionId === regionId;
        const isSameYear = new Date(d.period).getFullYear() === year;
        return !(isSameRegion && isSameYear);
      });
    }
    
    data.push(...newRecords);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("Failed to write to mock-water.json (Vercel read-only filesystem):", e);
  }
};

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
  
  // Prepare 24 records
  const recordsToInsert = entries.map((entry: any, index: number) => {
    const month = Math.floor(index / 2) + 1;
    const cycle = (index % 2) + 1;
    
    const day = cycle === 1 ? "01" : "16";
    const monthStr = month.toString().padStart(2, "0");
    const dateStr = `${year}-${monthStr}-${day}T00:00:00.000Z`;
    
    const debit = parseNum(entry.debit);
    const need = parseNum(entry.need);
    const pemeliharaan = entry.pemeliharaan != null && String(entry.pemeliharaan).trim() !== ""
      ? parseNum(entry.pemeliharaan)
      : Number((0.095 * debit).toFixed(2));
    const neraca = entry.na != null && String(entry.na).trim() !== "" 
      ? parseNum(entry.na) 
      : Number((debit - (need + pemeliharaan)).toFixed(2));
    const status = debit >= (need + pemeliharaan) ? "Surplus" : "Defisit";
    
    return {
      regionId: String(regionId),
      period: dateStr,
      debit_air: debit,
      kebutuhan_air: need,
      pemeliharaan_sungai: pemeliharaan,
      neraca_air: neraca,
      status,
    };
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

    await prisma.waterData.createMany({
      data: recordsToInsert as any[]
    });

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
    
    return apiSuccess({ success: true, count: recordsToInsert.length, records: inserted }, 201);
  } catch (error: any) {
    console.warn("Database operation failed or mock region used for bulk water-data, using mock fallback:", error?.message || error);
    
    const mockRecords = recordsToInsert.map(r => ({
      ...r,
      id: "mock-water-bulk-" + Math.random().toString(36).substring(7)
    }));
    
    saveMockWaterDataBulk(mockRecords);
    
    return apiSuccess({ success: true, count: mockRecords.length, mocked: true, records: mockRecords }, 201);
  }
}
