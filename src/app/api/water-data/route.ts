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
  const filePath = path.join(process.cwd(), "public", "mock-water.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return [];
};

const saveMockWaterData = (record: any) => {
  const filePath = path.join(process.cwd(), "public", "mock-water.json");
  const data = getMockWaterData();
  data.push(record);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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
    
    return apiSuccess(data);
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
    return apiError("Invalid request", 400);
  }
  
  if (!body.regionId || !body.period || body.debit_air == null || body.kebutuhan_air == null || body.pemeliharaan_sungai == null || !body.status) {
    return apiError("Semua data wajib diisi (regionId, period, debit_air, kebutuhan_air, pemeliharaan_sungai, status)", 400);
  }
  
  try {
    if (!prisma) throw new Error("Prisma not initialized");

    const newRecord = await prisma.waterData.create({
      data: {
        regionId: body.regionId,
        period: new Date(body.period),
        debit_air: parseFloat(body.debit_air),
        kebutuhan_air: parseFloat(body.kebutuhan_air),
        pemeliharaan_sungai: parseFloat(body.pemeliharaan_sungai),
        status: body.status,
      }
    });
    
    return apiSuccess(newRecord, 201);
  } catch (error) {
    console.warn("Database connection failed, simulate creation.", error);
    
    const debitVal = parseFloat(body.debit_air) || 0;
    const needVal = parseFloat(body.kebutuhan_air) || 0;
    const pemeliharaanVal = body.pemeliharaan_sungai != null && body.pemeliharaan_sungai !== ""
      ? parseFloat(body.pemeliharaan_sungai)
      : Number((0.095 * debitVal).toFixed(2));
    const neracaVal = body.neraca_air != null && body.neraca_air !== ""
      ? parseFloat(body.neraca_air)
      : (debitVal - (needVal + pemeliharaanVal));

    const newRecord = {
      id: "mock-water-" + Date.now().toString(),
      regionId: body.regionId,
      period: new Date(body.period).toISOString(),
      debit_air: debitVal,
      kebutuhan_air: needVal,
      pemeliharaan_sungai: pemeliharaanVal,
      neraca_air: Number(neracaVal.toFixed(2)),
      status: body.status,
    };
    saveMockWaterData(newRecord);
    
    return apiSuccess(newRecord, 201);
  }
}
