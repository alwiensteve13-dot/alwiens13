import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const x = req.nextUrl.searchParams.get("x");
  const y = req.nextUrl.searchParams.get("y");
  const z = req.nextUrl.searchParams.get("z");
  const s = req.nextUrl.searchParams.get("s") || "a";
  
  if (!x || !y || !z) return new NextResponse("Missing params", { status: 400 });
  
  const osmUrl = `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  
  try {
     const res = await fetch(osmUrl, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
       }
     });
     
     if (!res.ok) throw new Error("OSM returned error");
     
     const buffer = await res.arrayBuffer();
     return new NextResponse(buffer, {
        headers: {
           "Content-Type": "image/png",
           "Access-Control-Allow-Origin": "*",
           "Cache-Control": "public, max-age=86400"
        }
     });
  } catch(e) {
     return new NextResponse("Error", { status: 500 });
  }
}
