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
