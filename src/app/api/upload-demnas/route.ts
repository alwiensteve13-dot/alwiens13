import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import fs from "fs";
import { apiSuccess, apiError } from "@/lib/api-response";
import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma failed to initialize in upload-demnas");
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let demnasUrl = "";
    let demnasName = "";
    let demnasSize = "";
    let regionId = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      regionId = (formData.get("regionId") as string | null) || "";
      const demnasTitle = formData.get("demnasName") as string | null;

      if (!file || !regionId) {
        return apiError("File DEMNAS dan regionId wajib diisi", 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `demnas-${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const uploadDir = path.join(process.cwd(), "public/uploads");

      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (e) {}

      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);
      demnasUrl = `/uploads/${filename}`;

      // Calculate readable size
      const bytes = buffer.length;
      demnasSize = bytes > 1024 * 1024 
        ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` 
        : `${(bytes / 1024).toFixed(1)} KB`;

      demnasName = demnasTitle || file.name;
    } else {
      // JSON body link input
      const body = await request.json();
      regionId = body.regionId || "";
      demnasUrl = body.demnasUrl || "";
      demnasName = body.demnasName || "Data DEMNAS Master";
      demnasSize = body.demnasSize || "Tautan Eksternal";

      if (!regionId || !demnasUrl) {
        return apiError("regionId dan demnasUrl wajib diisi", 400);
      }
    }

    const newItem = {
      id: "dem-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      name: demnasName,
      url: demnasUrl,
      size: demnasSize,
      createdAt: new Date().toISOString()
    };

    // Update Mock JSON
    const mockFilePath = path.join(process.cwd(), "public", "mock-regions.json");
    if (fs.existsSync(mockFilePath)) {
      const mockData = JSON.parse(fs.readFileSync(mockFilePath, "utf-8"));
      const index = mockData.findIndex((r: any) => r.id === regionId);
      if (index !== -1) {
        mockData[index].demnasUrl = demnasUrl;
        mockData[index].demnasName = demnasName;
        mockData[index].demnasSize = demnasSize;
        
        if (!Array.isArray(mockData[index].demnasList)) {
          mockData[index].demnasList = [];
        }
        // Avoid exact URL duplicates
        const existingIdx = mockData[index].demnasList.findIndex((item: any) => item.url === demnasUrl);
        if (existingIdx !== -1) {
          mockData[index].demnasList[existingIdx] = newItem;
        } else {
          mockData[index].demnasList.unshift(newItem);
        }

        fs.writeFileSync(mockFilePath, JSON.stringify(mockData, null, 2));
      }
    }

    // Update Prisma if available
    try {
      if (prisma) {
        await prisma.region.update({
          where: { id: regionId },
          data: { demnasUrl, demnasName, demnasSize } as any,
        });
      }
    } catch (dbError) {
      console.warn("Prisma update failed, fallback to mock file.");
    }

    return apiSuccess({ demnasUrl, demnasName, demnasSize, newItem });
  } catch (error: any) {
    return apiError("Gagal memproses unggah DEMNAS: " + error.message, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const regionId = url.searchParams.get("regionId");
    const itemId = url.searchParams.get("itemId");

    if (!regionId) return apiError("regionId wajib", 400);

    const mockFilePath = path.join(process.cwd(), "public", "mock-regions.json");
    if (fs.existsSync(mockFilePath)) {
      const mockData = JSON.parse(fs.readFileSync(mockFilePath, "utf-8"));
      const index = mockData.findIndex((r: any) => r.id === regionId);
      if (index !== -1) {
        if (itemId && Array.isArray(mockData[index].demnasList)) {
          mockData[index].demnasList = mockData[index].demnasList.filter((it: any) => it.id !== itemId);
          if (mockData[index].demnasList.length > 0) {
            mockData[index].demnasUrl = mockData[index].demnasList[0].url;
            mockData[index].demnasName = mockData[index].demnasList[0].name;
            mockData[index].demnasSize = mockData[index].demnasList[0].size;
          } else {
            delete mockData[index].demnasUrl;
            delete mockData[index].demnasName;
            delete mockData[index].demnasSize;
            delete mockData[index].demnasList;
          }
        } else {
          delete mockData[index].demnasUrl;
          delete mockData[index].demnasName;
          delete mockData[index].demnasSize;
          delete mockData[index].demnasList;
        }
        fs.writeFileSync(mockFilePath, JSON.stringify(mockData, null, 2));
      }
    }

    try {
      if (prisma) {
        await prisma.region.update({
          where: { id: regionId },
          data: { demnasUrl: null, demnasName: null, demnasSize: null } as any,
        });
      }
    } catch (e) {}

    return apiSuccess({ message: "Data DEMNAS berhasil dihapus" });
  } catch (e: any) {
    return apiError("Gagal menghapus DEMNAS: " + e.message, 500);
  }
}
