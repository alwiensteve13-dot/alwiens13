import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize");
}

const MOCK_DAS_DATA = [
  {
    id: "1",
    name: "DAS Wae Apo",
    region: "Pulau Buru",
    area: "3,250 km²",
    coordinates: [
      [-3.30, 126.90],
      [-3.15, 127.05],
      [-3.35, 127.20],
      [-3.50, 126.95],
    ],
    debit: "125.4 m³/s",
    need: "87.2 m³/s",
    status: "Surplus",
    color: "#0ea5e9"
  },
  {
    id: "2",
    name: "DAS Way Ruhu",
    region: "Kota Ambon",
    area: "145 km²",
    coordinates: [
      [-3.65, 128.18],
      [-3.62, 128.22],
      [-3.68, 128.25],
      [-3.70, 128.19],
    ],
    debit: "64.8 m³/s",
    need: "72.1 m³/s",
    status: "Defisit",
    color: "#ef4444"
  },
  {
    id: "3",
    name: "DAS Way Ela",
    region: "Kabupaten Maluku Tengah",
    area: "89 km²",
    coordinates: [
      [-3.55, 128.30],
      [-3.53, 128.35],
      [-3.58, 128.38],
      [-3.60, 128.32],
    ],
    debit: "98.3 m³/s",
    need: "55.6 m³/s",
    status: "Surplus",
    color: "#10b981"
  }
];

// Helper to manage mock data file
const getMockRegions = () => {
  const filePath = path.join(process.cwd(), "public", "mock-regions.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return MOCK_DAS_DATA;
};

const saveMockRegion = (region: any) => {
  const filePath = path.join(process.cwd(), "public", "mock-regions.json");
  const data = getMockRegions();
  data.push(region);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

export async function GET() {
  try {
    if (!prisma) throw new Error("Prisma not initialized");
    const regions = await prisma.region.findMany({
      include: {
        waterData: true
      }
    });
    return apiSuccess(regions);
  } catch (error) {
    console.warn("Database connection failed, using file mock data.");
    return apiSuccess(getMockRegions());
  }
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return apiError("Format request tidak valid");
  }

  const { name, description } = body;

  if (!name) {
    return apiError("Nama DAS wajib diisi");
  }

  try {
    if (!prisma) throw new Error("Prisma not initialized");
    
    // Try to create in DB
    const newRegion = await prisma.region.create({
      data: {
        name,
        description: description || "",
      }
    });
    return apiSuccess(newRegion);
  } catch (error: any) {
    console.warn("Database connection failed on POST, falling back to mock file.");
    
    const newRegion = {
      id: "mock-" + Date.now().toString(),
      name,
      region: description || "Wilayah Baru",
      area: "-",
      coordinates: [],
      color: "#64748b",
      status: "Belum ada data"
    };
    
    saveMockRegion(newRegion);
    return apiSuccess(newRegion);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return apiError("ID DAS tidak diberikan");
    }

    try {
      if (!prisma) throw new Error("Prisma not initialized");
      
      // Try to delete in DB (Cascades are handled if set, otherwise might fail if waterData exists, but let's try)
      // Note: We might need to delete WaterData first if no cascade
      await prisma.waterData.deleteMany({ where: { regionId: id } });
      await prisma.region.delete({
        where: { id }
      });
      return apiSuccess({ success: true });
    } catch (dbError) {
      console.warn("Database connection failed on DELETE, falling back to mock file.", dbError);
      
      // Fallback: delete from mock JSON
      const filePath = path.join(process.cwd(), "public", "mock-regions.json");
      if (fs.existsSync(filePath)) {
        const data = getMockRegions();
        const filtered = data.filter((r: any) => r.id !== id);
        fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2));
      }
      return apiSuccess({ success: true });
    }
  } catch (error: any) {
    console.error("Failed to delete region:", error);
    return apiError("Gagal menghapus DAS.", 500);
  }
}


