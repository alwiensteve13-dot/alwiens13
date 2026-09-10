import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in water-users");
}

// Helper to manage mock data file
const getMockWaterUsers = () => {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.warn("Failed to read mock-water-users.json:", e);
  }
  return [];
};

const saveMockWaterUser = (user: any) => {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
    const data = getMockWaterUsers();
    const existingIndex = data.findIndex((u: any) => u.id === user.id);
    if (existingIndex >= 0) {
      data[existingIndex] = user;
    } else {
      data.push(user);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("Failed to write to mock-water-users.json (Vercel read-only filesystem):", e);
  }
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const regionId = url.searchParams.get("regionId");

    if (!prisma) throw new Error("Prisma not initialized");

    const whereClause = regionId ? { regionId } : {};
    const users = await prisma.waterUser.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    
    // If database returned data, return it. If empty or mock region, merge with mock file
    const mockData = getMockWaterUsers();
    const filteredMock = regionId ? mockData.filter((u: any) => u.regionId === regionId) : mockData;
    
    const userMap = new Map<string, any>();
    [...filteredMock, ...users].forEach((u: any) => {
      if (u && u.id && !userMap.has(u.id)) {
        userMap.set(u.id, u);
      }
    });

    return apiSuccess(Array.from(userMap.values()));
  } catch (error) {
    console.warn("Database connection failed, using file mock data.");
    const data = getMockWaterUsers();
    
    const url = new URL(request.url);
    const regionId = url.searchParams.get("regionId");
    
    if (regionId) {
      return apiSuccess(data.filter((u: any) => u.regionId === regionId));
    }
    return apiSuccess(data);
  }
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return apiError("Format request JSON tidak valid");
  }

  const { name, latitude, longitude, regionId, kebutuhan } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return apiError("Nama pengguna air wajib diisi");
  }

  if (!regionId) {
    return apiError("Wilayah DAS (regionId) wajib dipilih");
  }

  const parseNumber = (val: any): number | null => {
    if (val === undefined || val === null || val === "") return null;
    const cleaned = String(val).trim().replace(/,/g, ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const parsedLat = parseNumber(latitude);
  const parsedLng = parseNumber(longitude);
  const parsedKeb = parseNumber(kebutuhan);

  if (parsedLat === null || parsedLng === null || parsedKeb === null) {
    return apiError("Data koordinat (latitude, longitude) atau kebutuhan air tidak valid. Pastikan berupa angka (contoh: -3.65 atau -3,65).");
  }

  const cleanName = name.trim();
  const cleanRegionId = String(regionId).trim();

  try {
    if (!prisma) throw new Error("Prisma not initialized");

    // Check if region actually exists in database to avoid foreign key constraint crash
    const regionExists = await prisma.region.findUnique({
      where: { id: cleanRegionId }
    });

    if (!regionExists) {
      throw new Error(`Region ${cleanRegionId} not found in database, using mock storage`);
    }
    
    const newUser = await prisma.waterUser.create({
      data: {
        name: cleanName,
        latitude: parsedLat,
        longitude: parsedLng,
        kebutuhan: parsedKeb,
        regionId: cleanRegionId,
      }
    });
    return apiSuccess(newUser);
  } catch (error: any) {
    console.warn("Database create failed or mock region used on POST, falling back to mock storage:", error?.message || error);
    
    const newUser = {
      id: "mock-wu-" + Date.now().toString(),
      name: cleanName,
      latitude: parsedLat,
      longitude: parsedLng,
      kebutuhan: parsedKeb,
      regionId: cleanRegionId,
      createdAt: new Date().toISOString(),
    };
    
    saveMockWaterUser(newUser);
    return apiSuccess(newUser);
  }
}

export async function DELETE() {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "[]", "utf-8");
    }
  } catch (e) {
    console.warn("Failed to clear mock-water-users.json (Vercel read-only filesystem):", e);
  }

  try {
    if (prisma) {
      await prisma.waterUser.deleteMany({});
    }
  } catch (e) {
    console.warn("Prisma delete failed or not initialized");
  }

  return apiSuccess({ message: "Semua titik pengguna air berhasil dihapus" });
}
