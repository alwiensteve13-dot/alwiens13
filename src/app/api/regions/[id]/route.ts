import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in regions/[id]");
}

export const dynamic = 'force-dynamic';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    if (!prisma) throw new Error("Prisma not initialized");
    const region = await prisma.region.findUnique({
      where: { id },
      include: {
        waterData: true
      }
    });
    
    if (!region) {
      return apiError("Wilayah DAS tidak ditemukan", 404);
    }
    
    return apiSuccess(region);
  } catch (error) {
    console.warn("Database connection failed, using mock data.", error);
    const mock = MOCK_DAS_DATA.find(d => d.id === id);
    if (!mock) {
      return apiError("Wilayah DAS tidak ditemukan", 404);
    }
    return apiSuccess(mock);
  }
}
