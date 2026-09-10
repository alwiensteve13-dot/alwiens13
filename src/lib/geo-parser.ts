import JSZip from "jszip";
import area from "@turf/area";

/**
 * Parses KML text into a standardized GeoJSON FeatureCollection
 */
export function parseKmlToGeoJson(kmlText: string, defaultName = "Poligon"): any {
  const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
  const placemarks = kmlText.match(placemarkRegex) || [kmlText];
  const features: any[] = [];

  for (const pm of placemarks) {
    // Placemark name
    const nameMatch = pm.match(/<name>([\s\S]*?)<\/name>/i);
    const name = nameMatch ? nameMatch[1].trim() : defaultName;

    // Check for SimpleData
    const simpleDataMatches = pm.matchAll(/<SimpleData\s+name="([^"]+)">([\s\S]*?)<\/SimpleData>/gi);
    const properties: Record<string, any> = { name, NAMA_DAS: name };
    for (const match of simpleDataMatches) {
      properties[match[1]] = match[2].trim();
    }

    // Outer boundary coordinates
    const coordMatches = pm.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi);
    const rings: number[][][] = [];

    for (const cMatch of coordMatches) {
      const rawCoords = cMatch[1].trim().split(/\s+/);
      const ring: number[][] = [];
      for (const c of rawCoords) {
        const parts = c.split(",");
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lng) && !isNaN(lat)) {
            ring.push([lng, lat]);
          }
        }
      }

      if (ring.length >= 3) {
        // Ensure ring is closed
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]]);
        }
        rings.push(ring);
      }
    }

    if (rings.length > 0) {
      features.push({
        type: "Feature",
        properties,
        geometry: {
          type: "Polygon",
          coordinates: rings,
        },
      });
    }
  }

  // If no placemark matched but coordinates exist in document
  if (features.length === 0) {
    const fallbackCoordMatch = kmlText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if (fallbackCoordMatch) {
      const rawCoords = fallbackCoordMatch[1].trim().split(/\s+/);
      const ring: number[][] = [];
      for (const c of rawCoords) {
        const parts = c.split(",");
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lng) && !isNaN(lat)) {
            ring.push([lng, lat]);
          }
        }
      }
      if (ring.length >= 3) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]]);
        }
        features.push({
          type: "Feature",
          properties: { name: defaultName },
          geometry: {
            type: "Polygon",
            coordinates: [ring],
          },
        });
      }
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Extracts Leaflet-compatible [lat, lng][] array from GeoJSON
 */
export function extractLeafletCoordinates(geojson: any, sampleStep = 1): [number, number][] {
  if (!geojson) return [];
  try {
    let coords: number[][] = [];
    if (geojson.type === "FeatureCollection" && geojson.features?.length > 0) {
      const geom = geojson.features[0]?.geometry;
      if (geom?.type === "Polygon") {
        coords = geom.coordinates?.[0] || [];
      } else if (geom?.type === "MultiPolygon") {
        coords = geom.coordinates?.[0]?.[0] || [];
      }
    } else if (geojson.type === "Feature") {
      const geom = geojson.geometry;
      if (geom?.type === "Polygon") {
        coords = geom.coordinates?.[0] || [];
      } else if (geom?.type === "MultiPolygon") {
        coords = geom.coordinates?.[0]?.[0] || [];
      }
    } else if (geojson.type === "Polygon") {
      coords = geojson.coordinates?.[0] || [];
    }

    if (!Array.isArray(coords) || coords.length === 0) return [];

    const result: [number, number][] = [];
    for (let i = 0; i < coords.length; i += sampleStep) {
      const pt = coords[i];
      if (Array.isArray(pt) && pt.length >= 2) {
        // GeoJSON is [lng, lat], Leaflet is [lat, lng]
        const lng = Number(pt[0]);
        const lat = Number(pt[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          result.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
        }
      }
    }
    return result;
  } catch (e) {
    console.warn("Failed to extract Leaflet coordinates:", e);
    return [];
  }
}

/**
 * Universal file parser for .kmz, .kml, .zip (shapefile), .shp, and .geojson/.json
 */
export async function parseGeospatialFile(file: File): Promise<{
  geojson: any;
  leafletCoordinates: [number, number][];
  areaKm2: number;
}> {
  const fileName = file.name.toLowerCase();
  let geojson: any = null;

  if (fileName.endsWith(".kmz")) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const kmlEntries = Object.keys(zip.files).filter((k) => k.toLowerCase().endsWith(".kml"));
    if (kmlEntries.length === 0) {
      throw new Error("File KMZ tidak memuat berkas .kml di dalamnya.");
    }
    const kmlText = await zip.file(kmlEntries[0])!.async("text");
    geojson = parseKmlToGeoJson(kmlText, file.name.replace(/\.[^/.]+$/, ""));
  } else if (fileName.endsWith(".kml")) {
    const text = await file.text();
    geojson = parseKmlToGeoJson(text, file.name.replace(/\.[^/.]+$/, ""));
  } else if (fileName.endsWith(".zip")) {
    const shpModule = await import("shpjs");
    const shp = shpModule.default || shpModule;
    geojson = await shp(await file.arrayBuffer());
  } else if (fileName.endsWith(".shp")) {
    const shpModule = await import("shpjs");
    const shp = shpModule.default || shpModule;
    const arrayBuffer = await file.arrayBuffer();
    const geometries = shp.parseShp(arrayBuffer);
    geojson = {
      type: "FeatureCollection",
      features: geometries.map((geom: any) => ({
        type: "Feature",
        geometry: geom,
        properties: {},
      })),
    };
  } else {
    // GeoJSON or JSON
    const text = await file.text();
    geojson = JSON.parse(text);
  }

  if (!geojson || (!geojson.type && !geojson.features && !geojson.geometry)) {
    throw new Error("Format berkas poligon tidak valid.");
  }

  // Calculate area
  let areaKm2 = 0;
  try {
    const sqm = area(geojson as any);
    areaKm2 = Number((sqm / 1_000_000).toFixed(2));
  } catch (e) {}

  const leafletCoordinates = extractLeafletCoordinates(geojson);

  return {
    geojson,
    leafletCoordinates,
    areaKm2,
  };
}
