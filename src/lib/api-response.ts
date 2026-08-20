import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

export function apiError(message: string, status = 400, details?: any) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status }
  );
}
