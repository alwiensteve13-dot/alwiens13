import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { bacaRingkasan, simpanPaket, hapusPaket, validasiPaket, pesanGagalTulis, type HmsPaket } from "@/lib/hms-store";
import { isSafeId } from "@/lib/safe-path";

export const dynamic = "force-dynamic";

/** Ringkasan hasil simulasi satu DAS (publik; tanpa isi berkas Excel). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeId(id)) return apiError("Id DAS tidak valid.", 400);
  const r = bacaRingkasan(id);
  if (!r) return apiError("Belum ada hasil simulasi HEC-HMS untuk DAS ini.", 404);
  return apiSuccess(r);
}

/** Simpan / ganti paket hasil simulasi (wajib login: dijaga middleware untuk POST/DELETE). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeId(id)) return apiError("Id DAS tidak valid.", 400);
  let paket: HmsPaket;
  try {
    paket = await req.json();
  } catch {
    return apiError("Berkas paket bukan JSON yang valid.", 400);
  }
  const salah = validasiPaket(paket);
  if (salah) return apiError(salah, 400);
  try {
    const r = simpanPaket(id, paket);
    return apiSuccess({ regionId: id, unduhan: r.unduhan, diimpor: r.diimpor }, 201);
  } catch (e) {
    return apiError(pesanGagalTulis(e), 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeId(id)) return apiError("Id DAS tidak valid.", 400);
  try {
    return apiSuccess({ dihapus: hapusPaket(id) });
  } catch (e) {
    return apiError(pesanGagalTulis(e), 500);
  }
}
