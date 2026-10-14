import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveInside } from "@/lib/safe-path";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Hanya folder ini yang boleh dibaca lewat proxy.
const ALLOWED_ROOTS = new Set(["uploads", "geojson"]);
// Dokumen di uploads (PDF dll.) hanya untuk pengguna yang sudah login; gambar & geojson peta tetap publik.
const GAMBAR = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  // pathSegments berupa ['uploads', 'nama.pdf'] atau ['geojson', 'nama.json']
  if (!pathSegments?.length || !ALLOWED_ROOTS.has(pathSegments[0])) {
    return new NextResponse("File not found", { status: 404 });
  }

  const dokumenTerkunci =
    pathSegments[0] === "uploads" && !GAMBAR.has(path.extname(pathSegments[pathSegments.length - 1] || "").toLowerCase());
  if (dokumenTerkunci && !(await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json(
      { success: false, error: "Silakan masuk (login) terlebih dahulu untuk melihat atau mengunduh dokumen." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // Cegah path traversal ("../.env" dan sejenisnya).
  let filePath = resolveInside(path.join(process.cwd(), "public"), ...pathSegments);
  if (!filePath || !filePath.startsWith(path.resolve(process.cwd(), "public", pathSegments[0]))) {
    return new NextResponse("File not found", { status: 404 });
  }

  if (!fs.existsSync(filePath)) {
    const tmpPath = resolveInside("/tmp", ...pathSegments);
    if (tmpPath && fs.existsSync(tmpPath)) {
      filePath = tmpPath;
    } else {
      return new NextResponse("File not found", { status: 404 });
    }
  }

  if (!fs.statSync(filePath).isFile()) {
    return new NextResponse("File not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();

  let contentType = "application/octet-stream";
  if (ext === ".pdf") contentType = "application/pdf";
  else if (ext === ".json") contentType = "application/json";
  else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".svg") contentType = "image/svg+xml";

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      // dokumen terkunci jangan disimpan cache bersama (CDN) agar tidak terbagi ke pengunjung tanpa login
      ...(dokumenTerkunci ? { "Cache-Control": "private, no-store" } : {}),
      // SVG bisa berisi script; jalankan dalam sandbox agar tidak bisa mencuri sesi.
      ...(ext === ".svg" ? { "Content-Security-Policy": "script-src 'none'; sandbox" } : {}),
    },
  });
}
