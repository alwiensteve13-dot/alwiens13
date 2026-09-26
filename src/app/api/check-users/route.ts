import { NextResponse } from "next/server";

/**
 * Dipertahankan untuk kompatibilitas. Pendaftaran akun baru dari halaman login
 * sudah dihapus, jadi endpoint ini selalu melaporkan bahwa admin sudah ada.
 */
export async function GET() {
  return NextResponse.json({ hasUsers: true });
}
