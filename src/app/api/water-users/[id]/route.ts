import { PrismaClient } from "@prisma/client";
import { apiSuccess, apiError } from "@/lib/api-response";
import fs from "fs";
import path from "path";

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in water-users/[id]");
}

const getMockWaterUsers = () => {
  const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return [];
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return apiError("ID pengguna air tidak diberikan");
    }

    try {
      if (!prisma) throw new Error("Prisma not initialized");
      
      await prisma.waterUser.delete({
        where: { id }
      });
      return apiSuccess({ success: true });
    } catch (dbError) {
      console.warn("Database connection failed on DELETE, falling back to mock file.", dbError);
      
      const filePath = path.join(process.cwd(), "public", "mock-water-users.json");
      if (fs.existsSync(filePath)) {
        const data = getMockWaterUsers();
        const filtered = data.filter((r: any) => r.id !== id);
        fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2));
      }
      return apiSuccess({ success: true });
    }
  } catch (error: any) {
    console.error("Failed to delete water user:", error);
    return apiError("Gagal menghapus pengguna air.", 500);
  }
}
