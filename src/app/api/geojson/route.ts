import { NextResponse } from "next/server";

const MOCK_DAS_DATA = [
  {
    id: "1",
    name: "DAS Wae Apo",
    region: "Pulau Buru",
    area: "3,250 km²",
    coordinates: [
      [-3.30, 126.90],
      [-3.15, 127.05],
      [-3.35, 127.20],
      [-3.50, 126.95],
    ],
    debit: "125.4 m³/s",
    need: "87.2 m³/s",
    status: "Surplus",
    color: "#0ea5e9"
  },
  {
    id: "2",
    name: "DAS Way Ruhu",
    region: "Kota Ambon",
    area: "145 km²",
    coordinates: [
      [-3.65, 128.18],
      [-3.62, 128.22],
      [-3.68, 128.25],
      [-3.70, 128.19],
    ],
    debit: "64.8 m³/s",
    need: "72.1 m³/s",
    status: "Defisit",
    color: "#ef4444"
  },
  {
    id: "3",
    name: "DAS Way Ela",
    region: "Kabupaten Maluku Tengah",
    area: "89 km²",
    coordinates: [
      [-3.55, 128.30],
      [-3.53, 128.35],
      [-3.58, 128.38],
      [-3.60, 128.32],
    ],
    debit: "98.3 m³/s",
    need: "55.6 m³/s",
    status: "Surplus",
    color: "#10b981"
  }
];

export async function GET() {
  try {
    const features = MOCK_DAS_DATA.map(das => ({
      type: "Feature",
      properties: {
        id: das.id,
        name: das.name,
        region: das.region,
        area: das.area,
        debit: das.debit,
        need: das.need,
        status: das.status,
        color: das.color
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            ...das.coordinates.map(coord => [coord[1], coord[0]]),
            [das.coordinates[0][1], das.coordinates[0][0]] // close the polygon
          ]
        ]
      }
    }));
    
    const geojson = {
      type: "FeatureCollection",
      features
    };

    return NextResponse.json(geojson);
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate GeoJSON" }, { status: 500 });
  }
}
