export const LAND_COVER_PALETTE: Record<string, string> = {
  "HUTAN LAHAN KERING PRIMER": "#14532d",
  "HUTAN LAHAN KERING SEKUNDER": "#16a34a",
  "HUTAN RAWA PRIMER": "#047857",
  "HUTAN RAWA SEKUNDER": "#0d9488",
  "HUTAN MANGROVE PRIMER": "#065f46",
  "HUTAN MANGROVE SEKUNDER": "#0f766e",
  "HUTAN LAHAN TINGGI": "#15803d",
  "HUTAN LAHAN RENDAH": "#16a34a",
  "HUTAN MANGROVE": "#047857",
  "HUTAN PRIMER": "#14532d",
  "HUTAN SEKUNDER": "#22c55e",
  "HUTAN RAWA": "#065f46",
  "HUTAN TANAMAN": "#4ade80",
  "PERKEBUNAN": "#65a30d",
  "PERTANIAN LAHAN KERING": "#84cc16",
  "PERTANIAN LAHAN KERING CAMPUR": "#b45309",
  "PERTANIAN LAHAN KERING CAMPURAN": "#a3e635",
  "SAWAH": "#eab308",
  "SAWAH IRIGASI": "#facc15",
  "SAWAH TADAH HUJAN": "#ca8a04",
  "SEMAK/BELUKAR": "#854d0e",
  "SEMAK BELUKAR": "#854d0e",
  "SEMAK BELUKAR RAWA": "#713f12",
  "RUMPUT/PADANG RUMPUT": "#a3e635",
  "PADANG RUMPUT": "#86efac",
  "PEMUKIMAN": "#ef4444",
  "PERUMAHAN": "#dc2626",
  "LAHAN TERBUKA": "#d97706",
  "TANAH KOSONG": "#94a3b8",
  "BODY OF WATER": "#0284c7",
  "DANAU/WADUK": "#0369a1",
  "SUNGAI": "#38bdf8",
  "TUBUH AIR": "#0ea5e9",
  "AIR": "#0ea5e9",
  "TAMBAK": "#0284c7",
};

export const SOIL_TYPE_PALETTE: Record<string, string> = {
  "ALLUVIAL": "#8b5cf6",
  "LATOSOL": "#d97706",
  "PODSOLIK": "#c084fc",
  "ANDOSOL": "#78350f",
  "REGOSOL": "#f59e0b",
  "GRUMOSOL": "#475569",
  "ORGANOSOL": "#334155",
  "MEDITERAN": "#b45309",
  "RENDZINA": "#6b21a8",
  "GLEISOL": "#64748b",
  "FLUVENTIC HAPLUDOLLS": "#a855f7",
  "HUMIC DYSTRUDEPTS": "#ec4899",
  "LITHIC DYSTRUDEPTS": "#f43f5e",
  "LITHIC EUTRUDEPTS": "#e11d48",
  "TYPIC DYSTRUDEPTS": "#d97706",
  "TYPIC EUTRUDEPTS": "#b45309",
  "TYPIC RHODUDULTS": "#9333ea"
};

export const stringToColor = (str: string, seed: number = 0): string => {
  if (!str || str === 'Tidak diketahui') return (seed === 1 || seed === 42) ? '#22c55e' : '#8b5cf6';
  const normalized = str.trim().toUpperCase();
  
  if (LAND_COVER_PALETTE[normalized]) return LAND_COVER_PALETTE[normalized];
  if (SOIL_TYPE_PALETTE[normalized]) return SOIL_TYPE_PALETTE[normalized];

  // Fuzzy matching for Land Cover keywords
  if (seed === 42 || seed === 1) {
    if (normalized.includes("HUTAN MANGROVE")) return "#047857";
    if (normalized.includes("HUTAN RAWA")) return "#065f46";
    if (normalized.includes("HUTAN PRIMER")) return "#14532d";
    if (normalized.includes("HUTAN SEKUNDER")) return "#22c55e";
    if (normalized.includes("HUTAN")) return "#16a34a";
    if (normalized.includes("PERKEBUNAN")) return "#65a30d";
    if (normalized.includes("PERTANIAN")) return "#84cc16";
    if (normalized.includes("SAWAH")) return "#eab308";
    if (normalized.includes("SEMAK")) return "#854d0e";
    if (normalized.includes("PEMUKIMAN") || normalized.includes("PERUMAHAN")) return "#ef4444";
    if (normalized.includes("AIR") || normalized.includes("DANAU") || normalized.includes("SUNGAI")) return "#0ea5e9";
    if (normalized.includes("TERBUKA") || normalized.includes("KOSONG")) return "#cbd5e1";
  }

  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs((hash * 137.508) % 360);
  const saturation = 65 + (Math.abs(hash) % 25);
  const lightness = 45 + (Math.abs(hash >> 3) % 20);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getLabelFromProperty = (featureOrProps: any, type?: string | number) => {
  if (!featureOrProps) return 'Tidak diketahui';
  const props = featureOrProps.properties || featureOrProps;

  // Case-insensitive key lookup helper
  const findProp = (...keys: string[]) => {
    for (const k of keys) {
      if (props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== '') {
        return String(props[k]).trim();
      }
    }
    // Try case-insensitive / space / underscore matching
    const objKeys = Object.keys(props);
    for (const key of keys) {
      const lowerKey = key.toLowerCase().replace(/[\s_]/g, '');
      const match = objKeys.find(k => k.toLowerCase().replace(/[\s_]/g, '') === lowerKey);
      if (match && props[match] !== undefined && props[match] !== null && String(props[match]).trim() !== '') {
        return String(props[match]).trim();
      }
    }
    return null;
  };

  // For Land Cover: prioritize NAMOBJ / NAMA OBJ / Nama Obj / nama obj
  if (type === 'landCover' || type === 1) {
    const namobjLabel = findProp('NAMOBJ', 'NAMAOBJ', 'NAMA OBJ', 'Nama Obj', 'nama obj', 'nama_obj', 'namobj', 'PL_2024', 'PL_2022', 'PL_2020', 'PL_2019', 'PL_20', 'PL', 'pl', 'TUTUPAN_LAHAN', 'Tutupan_Lahan', 'tutupan_lahan', 'TUTUPAN', 'Tutupan', 'tutupan', 'LEGENDA', 'Legenda', 'legenda', 'KETERANGAN', 'Keterangan', 'keterangan', 'LANDCOVER', 'Landcover', 'landcover', 'LandCover', 'LAND_COVER', 'Land_Cover');
    if (namobjLabel) return namobjLabel;
  }

  // Gridcode lookup map for standard KLHK land cover numeric codes
  if (props.gridcode || props.GRIDCODE || props.dn || props.DN) {
    const gc = Number(props.gridcode || props.GRIDCODE || props.dn || props.DN);
    const gridcodeMap: Record<number, string> = {
      2001: "Hutan Lahan Kering Primer",
      2002: "Hutan Lahan Kering Sekunder",
      2004: "Hutan Mangrove Primer",
      20041: "Hutan Mangrove Sekunder",
      2005: "Hutan Rawa Primer",
      20051: "Hutan Rawa Sekunder",
      2006: "Hutan Tanaman",
      2007: "Semak Belukar",
      20071: "Semak Belukar Rawa",
      2009: "Perkebunan",
      2010: "Pertanian Lahan Kering",
      2012: "Pertanian Lahan Kering Campuran",
      2014: "Sawah",
      2015: "Tambak",
      5001: "Pemukiman",
      5002: "Lahan Terbuka",
      5003: "Tubuh Air",
    };
    if (gridcodeMap[gc]) return gridcodeMap[gc];
  }

  const genericLabel = findProp(
    'NAMOBJ', 'NAMAOBJ', 'NAMA OBJ', 'Nama Obj', 'nama obj', 'nama_obj',
    'PL_2024', 'PL_2022', 'PL_2020', 'PL_2019', 'PL_20', 'PL', 'pl',
    'TUTUPAN_LAHAN', 'Tutupan_Lahan', 'tutupan_lahan', 'TUTUPAN', 'Tutupan',
    'LEGENDA', 'Legenda', 'legenda', 'KETERANGAN', 'Keterangan', 'keterangan',
    'LANDCOVER', 'Landcover', 'landcover', 'DOMSOI', 'Tanah', 'TANAH', 'tanah',
    'REMARK', 'CLASS', 'Class', 'JENIS_TANAH', 'SOIL_TYPE', 'SOIL', 'NAMA_TANAH', 'Name', 'name'
  );

  return genericLabel || 'Tidak diketahui';
};

export const getColorFromProperty = (feature: any, type?: string | number) => {
  if (!feature) return '#3b82f6';
  const props = feature.properties || feature;
  if (props?.color) return props.color;

  const label = getLabelFromProperty(props, type);
  const seed = (type === 'landCover' || type === 1) ? 42 : 1337;
  return stringToColor(label, seed);
};

// Curated collection of 60+ distinct, high-contrast, cartographic colors for DAS polygons
export const DISTINCT_POLYGON_PALETTE: string[] = [
  "#0284c7", // Sky Blue
  "#16a34a", // Green
  "#9333ea", // Purple
  "#ea580c", // Orange
  "#0d9488", // Teal
  "#e11d48", // Rose Red
  "#ca8a04", // Amber Gold
  "#4f46e5", // Indigo
  "#059669", // Emerald
  "#c026d3", // Fuchsia
  "#d97706", // Dark Amber
  "#2563eb", // Royal Blue
  "#db2777", // Pink
  "#65a30d", // Lime Green
  "#7c3aed", // Violet
  "#b45309", // Brown Orange
  "#0891b2", // Cyan
  "#be123c", // Crimson
  "#15803d", // Forest Green
  "#6366f1", // Periwinkle
  "#d946ef", // Magenta
  "#0ea5e9", // Light Sky
  "#10b981", // Mint
  "#f59e0b", // Yellow Orange
  "#8b5cf6", // Light Violet
  "#ec4899", // Deep Pink
  "#14b8a6", // Bright Teal
  "#f43f5e", // Light Rose
  "#84cc16", // Bright Lime
  "#a855f7", // Bright Purple
  "#3b82f6", // Dodger Blue
  "#ef4444", // Red
  "#38bdf8", // Baby Blue
  "#4ade80", // Light Green
  "#f97316", // Vivid Orange
  "#a21caf", // Deep Fuchsia
  "#047857", // Pine Green
  "#6d28d9", // Grape
  "#b91c1c", // Dark Red
  "#0369a1", // Ocean Blue
  "#0f766e", // Deep Teal
  "#4338ca", // Night Indigo
  "#a16207", // Ochre
  "#701a75", // Plum
  "#1e40af", // Navy Blue
  "#166534", // Dark Pine
  "#991b1b", // Maroon
  "#115e59", // Dark Cyan
  "#86198f", // Dark Magenta
  "#3730a3", // Dark Violet
  "#92400e", // Cinnamon
  "#1e3a8a", // Midnight Blue
  "#14532d", // Deep Forest
  "#831843", // Wine Red
  "#134e4a", // Deep Spruce
  "#581c87", // Deep Grape
  "#312e81", // Deep Indigo
  "#78350f", // Saddle Brown
];

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Returns a unique color not currently present in existingColors.
 * If all palette colors are in use, generates a distinct color via golden-ratio hue stepping.
 */
export function getUniquePolygonColor(existingColors: (string | undefined | null)[] = [], seed?: string): string {
  const normalizedUsed = new Set(
    existingColors
      .filter((c): c is string => typeof c === "string" && c.trim() !== "" && c.toLowerCase() !== "#64748b")
      .map((c) => c.toLowerCase())
  );

  // If a seed is provided (e.g. region name), try to hash into the palette first
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const startIndex = Math.abs(hash) % DISTINCT_POLYGON_PALETTE.length;
    for (let i = 0; i < DISTINCT_POLYGON_PALETTE.length; i++) {
      const candidate = DISTINCT_POLYGON_PALETTE[(startIndex + i) % DISTINCT_POLYGON_PALETTE.length].toLowerCase();
      if (!normalizedUsed.has(candidate)) {
        return candidate;
      }
    }
  } else {
    for (const c of DISTINCT_POLYGON_PALETTE) {
      if (!normalizedUsed.has(c.toLowerCase())) {
        return c.toLowerCase();
      }
    }
  }

  // Fallback: Golden angle stepping ensures infinite non-repeating distinct colors
  let step = normalizedUsed.size;
  while (true) {
    const hue = (step * 137.508) % 360;
    const generated = hslToHex(hue, 75, 48).toLowerCase();
    if (!normalizedUsed.has(generated)) {
      return generated;
    }
    step++;
  }
}

/**
 * Ensures all items in a list have unique, distinct, non-colliding colors.
 */
export function ensureUniqueRegionColors<T extends { color?: string; name?: string; id?: string }>(items: T[]): T[] {
  const usedColors = new Set<string>();
  return items.map((item, index) => {
    let color = (item.color || "").toLowerCase().trim();
    const isGenericOrDuplicate = !color || color === "#64748b" || color === "#ffffff" || color === "#000000" || usedColors.has(color);

    if (isGenericOrDuplicate) {
      color = getUniquePolygonColor(Array.from(usedColors), item.name || item.id || `das-${index}`);
    }
    usedColors.add(color);
    return {
      ...item,
      color,
    };
  });
}

