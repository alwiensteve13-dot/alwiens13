import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy gambar/tile peta untuk html2canvas.
 * Hanya boleh mengambil dari server peta yang dikenal — sebelumnya endpoint ini
 * bisa dipakai siapa pun untuk mengambil URL apa saja (open proxy / SSRF).
 */
const ALLOWED_HOSTS = [
  /^mt[0-3]\.google\.com$/,
  /^([abc]\.)?tile\.openstreetmap\.org$/,
  /^server\.arcgisonline\.com$/,
];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url parameter", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.some((re) => re.test(target.hostname))) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    const response = await fetch(target, {
      redirect: "error",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);

    const contentType = response.headers.get("Content-Type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Unsupported content", { status: 415 });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*", // allow html2canvas to read it
      }
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new NextResponse("Error fetching image", { status: 500 });
  }
}
