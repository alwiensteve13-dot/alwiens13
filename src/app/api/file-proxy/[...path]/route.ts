import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  
  // pathSegments will be ['uploads', 'filename.pdf'] or ['geojson', 'filename.json']
  const filePath = path.join(process.cwd(), "public", ...pathSegments);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("File not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  
  const filename = pathSegments[pathSegments.length - 1];
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
      "Content-Disposition": `inline; filename="${filename}"`
    },
  });
}
