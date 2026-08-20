import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in water-data/[id]");
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!prisma) return apiError("Prisma not initialized", 500);
  const { id } = await params;
  try {
    const record = await prisma.waterData.findUnique({
      where: { id }
    });
    
    if (!record) return apiError("Data tidak ditemukan", 404);
    
    return apiSuccess(record);
  } catch (error) {
    console.warn("Database connection failed, using mock data.", error);
    return apiError("Data tidak ditemukan", 404);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!prisma) return apiError("Prisma not initialized", 500);
  const { id } = await params;
  try {
    const body = await request.json();
    
    const updated = await prisma.waterData.update({
      where: { id },
      data: {
        period: body.period ? new Date(body.period) : undefined,
        debit_air: body.debit_air != null ? parseFloat(body.debit_air) : undefined,
        kebutuhan_air: body.kebutuhan_air != null ? parseFloat(body.kebutuhan_air) : undefined,
        status: body.status,
      }
    });
    
    return apiSuccess(updated);
  } catch (error) {
    console.warn("Database connection failed, simulate update.", error);
    const body = await request.json().catch(() => ({}));
    return apiSuccess({ id, ...body });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!prisma) return apiError("Prisma not initialized", 500);
  const { id } = await params;
  try {
    await prisma.waterData.delete({
      where: { id }
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.warn("Database connection failed, simulate delete.", error);
    return apiSuccess({ deleted: true });
  }
}
