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
  const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return [];
};

const saveMockWaterUser = (user: any) => {
  const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
  const data = getMockWaterUsers();
  data.push(user);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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
    return apiSuccess(users);
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
    return apiError("Format request tidak valid");
  }

  const { name, latitude, longitude, regionId, kebutuhan } = body;

  if (!name || latitude === undefined || longitude === undefined || kebutuhan === undefined || !regionId) {
    return apiError("Data pengguna air tidak lengkap (nama, latitude, longitude, kebutuhan, regionId wajib)");
  }

  try {
    if (!prisma) throw new Error("Prisma not initialized");
    
    const newUser = await prisma.waterUser.create({
      data: {
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        kebutuhan: parseFloat(kebutuhan),
        regionId,
      }
    });
    return apiSuccess(newUser);
  } catch (error: any) {
    console.warn("Database connection failed on POST, falling back to mock file.");
    
    const newUser = {
      id: "mock-wu-" + Date.now().toString(),
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      kebutuhan: parseFloat(kebutuhan),
      regionId,
      createdAt: new Date().toISOString(),
    };
    
    saveMockWaterUser(newUser);
    return apiSuccess(newUser);
  }
}

export async function DELETE() {
  const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
  fs.writeFileSync(filePath, "[]", "utf-8");

  try {
    if (prisma) {
      await prisma.waterUser.deleteMany({});
    }
  } catch (e) {
    console.warn("Prisma delete failed or not initialized");
  }

  return apiSuccess({ message: "Semua titik pengguna air berhasil dihapus" });
}
