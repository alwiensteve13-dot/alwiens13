import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { regionId, geojson, type } = body;

    if (!regionId || !geojson) {
      return NextResponse.json(
        { error: "regionId and geojson are required." },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public/geojson");
    const tmpDir = path.join("/tmp", "geojson");
    
    let filename = `${regionId}.json`;
    if (type === "landcover") {
      filename = `landcover-${regionId}.json`;
    } else if (type === "soiltype") {
      filename = `soiltype-${regionId}.json`;
    } else if (type === "river") {
      filename = `river-${regionId}.json`;
    }

    let fileUrl = `/geojson/${filename}`;

    try {
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), JSON.stringify(geojson, null, 2));
    } catch (e) {
      try {
        await mkdir(tmpDir, { recursive: true });
        await writeFile(path.join(tmpDir, filename), JSON.stringify(geojson, null, 2));
        fileUrl = `/api/file-proxy/geojson/${filename}`;
      } catch (tmpErr) {
        console.warn("Failed to write geojson to tmp directory:", tmpErr);
      }
    }

    // Update mock-regions.json if needed
    if (type === "landcover" || type === "soiltype" || type === "river") {
      try {
        const mockPath = path.join(process.cwd(), "public", "mock-regions.json");
        const fs = require('fs');
        if (fs.existsSync(mockPath)) {
          const mockData = JSON.parse(fs.readFileSync(mockPath, "utf-8"));
          const regionIdx = mockData.findIndex((r: any) => r.id === regionId);
          if (regionIdx >= 0) {
            if (type === "landcover") mockData[regionIdx].landCoverUrl = fileUrl;
            if (type === "soiltype") mockData[regionIdx].soilTypeUrl = fileUrl;
            if (type === "river") mockData[regionIdx].riverUrl = fileUrl;
            fs.writeFileSync(mockPath, JSON.stringify(mockData, null, 2));
          }
        }
      } catch (e) {
        // Ignore read-only filesystem write errors on Vercel
      }
    }

    return NextResponse.json({ success: true, filename, fileUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
