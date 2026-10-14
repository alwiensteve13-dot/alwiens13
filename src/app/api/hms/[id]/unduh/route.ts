import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { pathUnduhan } from "@/lib/hms-store";
import { isSafeId } from "@/lib/safe-path";

export const dynamic = "force-dynamic";

/** Unduh berkas hasil simulasi - hanya untuk pengguna yang sudah login. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ success: false, error: "Silakan masuk (login) terlebih dahulu untuk mengunduh." }, { status: 401 });
  }
  const { id } = await params;
  const berkas = req.nextUrl.searchParams.get("berkas") || "";
  if (!isSafeId(id) || !berkas) return NextResponse.json({ success: false, error: "Permintaan tidak valid." }, { status: 400 });
  const p = pathUnduhan(id, berkas);
  if (!p || !fs.existsSync(p)) return NextResponse.json({ success: false, error: "Berkas tidak ditemukan." }, { status: 404 });
  const data = fs.readFileSync(p);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${berkas.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
