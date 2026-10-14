import { apiSuccess, apiError } from "@/lib/api-response";
import { daftarPaket } from "@/lib/hms-store";

export const dynamic = "force-dynamic";

/** Daftar DAS yang punya hasil Simulasi HEC-HMS. */
export async function GET() {
  try {
    return apiSuccess(daftarPaket());
  } catch (e) {
    return apiError((e as Error).message, 500);
  }
}
