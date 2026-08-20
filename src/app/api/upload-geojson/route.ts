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
    
    // Ensure directory exists
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Ignore if exists
    }
    
    let filename = `${regionId}.json`;
    if (type === "landcover") {
      filename = `landcover-${regionId}.json`;
    } else if (type === "soiltype") {
      filename = `soiltype-${regionId}.json`;
    } else if (type === "river") {
      filename = `river-${regionId}.json`;
    }

    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, JSON.stringify(geojson, null, 2));

    // Update mock-regions.json if needed
    if (type === "landcover" || type === "soiltype" || type === "river") {
      try {
        const mockPath = path.join(process.cwd(), "public", "mock-regions.json");
        const fs = require('fs');
        if (fs.existsSync(mockPath)) {
          const mockData = JSON.parse(fs.readFileSync(mockPath, "utf-8"));
          const regionIdx = mockData.findIndex((r: any) => r.id === regionId);
          if (regionIdx >= 0) {
            if (type === "landcover") mockData[regionIdx].landCoverUrl = `/geojson/${filename}`;
            if (type === "soiltype") mockData[regionIdx].soilTypeUrl = `/geojson/${filename}`;
            if (type === "river") mockData[regionIdx].riverUrl = `/geojson/${filename}`;
            fs.writeFileSync(mockPath, JSON.stringify(mockData, null, 2));
          }
        }
      } catch (e) {
        console.error("Failed to update mock-regions.json", e);
      }
    }

    return NextResponse.json({ success: true, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
