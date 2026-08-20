import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const x = req.nextUrl.searchParams.get("x");
  const y = req.nextUrl.searchParams.get("y");
  const z = req.nextUrl.searchParams.get("z");
  
  if (!x || !y || !z) return new NextResponse("Missing params", { status: 400 });
  
  const googleUrl = `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;
  
  try {
     const res = await fetch(googleUrl, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
       }
     });
     
     if (!res.ok) throw new Error("Google maps returned error");
     
     const buffer = await res.arrayBuffer();
     return new NextResponse(buffer, {
        headers: {
           "Content-Type": "image/jpeg",
           "Access-Control-Allow-Origin": "*",
           "Cache-Control": "public, max-age=86400"
        }
     });
  } catch(e) {
     return new NextResponse("Error", { status: 500 });
  }
}
