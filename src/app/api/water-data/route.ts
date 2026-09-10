import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in water-data");
}

// Helper to manage mock water data file
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

const saveMockWaterData = (record: any) => {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-water.json");
    const data = getMockWaterData();
    data.push(record);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("Failed to write to mock-water.json (Vercel read-only filesystem):", e);
  }
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const regionId = url.searchParams.get("regionId");
    
    if (!prisma) throw new Error("Prisma not initialized");

    const data = await prisma.waterData.findMany({
      where: regionId ? { regionId } : undefined,
      orderBy: { period: "desc" }
    });
    
    let mockData = getMockWaterData();
    if (regionId) mockData = mockData.filter((d: any) => d.regionId === regionId);

    // Merge database data with mock data (deduplicate by regionId + period, prioritize non-zero kebutuhan)
    const dataMap = new Map<string, any>();
    [...mockData, ...(data || [])].forEach((d: any) => {
      if (d && d.regionId && d.period) {
        const key = `${d.regionId}_${new Date(d.period).toISOString()}`;
        const existing = dataMap.get(key);
        if (!existing || ((d.kebutuhan_air || 0) > 0 && (existing.kebutuhan_air || 0) === 0)) {
          dataMap.set(key, d);
        }
      }
    });

    const merged = Array.from(dataMap.values());
    merged.sort((a: any, b: any) => new Date(b.period).getTime() - new Date(a.period).getTime());
    return apiSuccess(merged);
  } catch (error) {
    console.warn("Database connection failed, using mock data.", error);
    
    const url = new URL(request.url);
    const regionId = url.searchParams.get("regionId");
    let data = getMockWaterData();
    if (regionId) {
      data = data.filter((d: any) => d.regionId === regionId);
    }
    // Sort descending by period
    data.sort((a: any, b: any) => new Date(b.period).getTime() - new Date(a.period).getTime());
    
    return apiSuccess(data);
  }
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch(e) {
    return apiError("Format request JSON tidak valid", 400);
  }
  
  if (!body.regionId || !body.period || body.debit_air == null || body.kebutuhan_air == null || body.pemeliharaan_sungai == null || !body.status) {
    return apiError("Semua data wajib diisi (regionId, period, debit_air, kebutuhan_air, pemeliharaan_sungai, status)", 400);
  }

  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === "") return 0;
    const cleaned = String(val).trim().replace(/,/g, ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const debitVal = parseNum(body.debit_air);
  const needVal = parseNum(body.kebutuhan_air);
  const pemeliharaanVal = body.pemeliharaan_sungai != null && String(body.pemeliharaan_sungai).trim() !== ""
    ? parseNum(body.pemeliharaan_sungai)
    : Number((0.095 * debitVal).toFixed(2));
  const neracaVal = body.neraca_air != null && String(body.neraca_air).trim() !== ""
    ? parseNum(body.neraca_air)
    : Number((debitVal - (needVal + pemeliharaanVal)).toFixed(2));
  
  const cleanRegionId = String(body.regionId).trim();

  try {
    if (!prisma) throw new Error("Prisma not initialized");

    const regionExists = await prisma.region.findUnique({
      where: { id: cleanRegionId }
    });

    if (!regionExists) {
      throw new Error(`Region ${cleanRegionId} not found in database, using mock storage`);
    }

    const newRecord = await prisma.waterData.create({
      data: {
        regionId: cleanRegionId,
        period: new Date(body.period),
        debit_air: debitVal,
        kebutuhan_air: needVal,
        pemeliharaan_sungai: pemeliharaanVal,
        neraca_air: neracaVal,
        status: body.status,
      }
    });
    
    return apiSuccess(newRecord, 201);
  } catch (error: any) {
    console.warn("Database create failed or mock region used for water-data, using mock storage:", error?.message || error);
    
    const newRecord = {
      id: "mock-water-" + Date.now().toString(),
      regionId: cleanRegionId,
      period: new Date(body.period).toISOString(),
      debit_air: debitVal,
      kebutuhan_air: needVal,
      pemeliharaan_sungai: pemeliharaanVal,
      neraca_air: neracaVal,
      status: body.status,
    };
    saveMockWaterData(newRecord);
    
    return apiSuccess(newRecord, 201);
  }
}
