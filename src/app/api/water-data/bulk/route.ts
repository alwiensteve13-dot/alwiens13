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
  const filePath = path.join(process.cwd(), "public", "mock-water.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return [];
};

const saveMockWaterDataBulk = (newRecords: any[]) => {
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
};

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch(e) {
    return apiError("Invalid request", 400);
  }
  
  const { regionId, year, entries } = body;
  
  if (!regionId || !year || !Array.isArray(entries)) {
    return apiError("Format data tidak valid (membutuhkan regionId, year, dan entries)", 400);
  }
  
  // Prepare 24 records
  const recordsToInsert = entries.map((entry: any, index: number) => {
    const month = Math.floor(index / 2) + 1;
    const cycle = (index % 2) + 1;
    
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
      : (debit - (need + pemeliharaan));
    const status = debit >= (need + pemeliharaan) ? "Surplus" : "Defisit";
    
    return {
      regionId,
      period: dateStr,
      debit_air: debit,
      kebutuhan_air: need,
      pemeliharaan_sungai: pemeliharaan,
      neraca_air: Number(neraca.toFixed(2)),
      status,
    };
  });
  
  try {
    if (!prisma) throw new Error("Prisma not initialized");

    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
    
    await prisma.waterData.deleteMany({
      where: {
        regionId,
        period: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    await prisma.waterData.createMany({
      data: recordsToInsert as any[]
    });
    
    return apiSuccess({ success: true, count: recordsToInsert.length }, 201);
  } catch (error) {
    console.warn("Database connection failed, simulate bulk creation.", error);
    
    const mockRecords = recordsToInsert.map(r => ({
      ...r,
      id: "mock-water-bulk-" + Math.random().toString(36).substring(7)
    }));
    
    saveMockWaterDataBulk(mockRecords);
    
    return apiSuccess({ success: true, count: mockRecords.length, mocked: true }, 201);
  }
}
