"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, ZoomControl, useMap, Marker, CircleMarker, Pane, GeoJSON, LayersControl, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export interface DasData {
  id: string;
  name: string;
  region: string;
  area: string;
  coordinates: number[][];
  debit?: string;
  need?: string;
  status: string;
  color: string;
  geojson?: any;
  pdfUrl?: string;
  landCoverUrl?: string;
  soilTypeUrl?: string;
  riverUrl?: string;
  demnasUrl?: string;
  demnasName?: string;
  demnasSize?: string;
  demnasList?: any[];
}

import { getColorFromProperty, getLabelFromProperty, stringToColor } from '@/lib/color-utils';
export { getColorFromProperty, getLabelFromProperty, stringToColor };

function SearchPinMarker({ coord }: { coord: [number, number] | null }) {
  const icon = useMemo(() => {
    if (typeof window === 'undefined') return undefined as any;
    return L.divIcon({
      className: 'custom-search-pin',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 28px; height: 28px; background: #ef4444; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
            <svg style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  }, []);

  if (!coord || !icon) return null;

  return (
    <Pane name="searchPinPane" style={{ zIndex: 650 }}>
      <Marker position={coord} icon={icon}>
        <Tooltip sticky direction="top" permanent className="border-0 shadow-xl bg-slate-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs">
          📍 Pin Lokasi ({coord[0].toFixed(4)}, {coord[1].toFixed(4)})
        </Tooltip>
        <Popup className="das-popup">
          <div className="text-sm font-semibold p-1">
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">📍 Lokasi Terpilih</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">Latitude: {coord[0]}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">Longitude: {coord[1]}</p>
          </div>
        </Popup>
      </Marker>
    </Pane>
  );
}

export interface PlottedPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  createdAt: string;
}

function PlottedPointsMarkers({ 
  points, 
  onDelete 
}: { 
  points: PlottedPoint[]; 
  onDelete: (id: string) => void;
}) {
  if (!points || points.length === 0) return null;

  return (
    <Pane name="plottedPointsPane" style={{ zIndex: 750 }}>
      {points.map((pt) => {
        const pinIcon = L.divIcon({
          className: 'custom-plotted-pin',
          html: `
            <div style="position: relative; width: 24px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));">
              <svg style="width: 24px; height: 30px;" viewBox="0 0 24 32">
                <path fill="${pt.color}" stroke="#ffffff" stroke-width="2" d="M12 2C6.48 2 2 6.48 2 12C2 19 12 30 12 30C12 30 22 19 22 12C22 6.48 17.52 2 12 2Z"/>
                <circle cx="12" cy="12" r="4" fill="#ffffff"/>
              </svg>
            </div>
          `,
          iconSize: [24, 30],
          iconAnchor: [12, 30],
          popupAnchor: [0, -30],
          tooltipAnchor: [0, -30]
        });

        return (
          <Marker key={`pt-${pt.id}`} position={[pt.lat, pt.lng]} icon={pinIcon}>
            <Tooltip sticky direction="top" className="bg-slate-900/90 text-white font-semibold text-xs rounded-lg px-2.5 py-1 border-0 shadow-lg">
              <span className="font-bold" style={{ color: pt.color }}>📍 {pt.label || 'Titik Plotted'}</span>
              <br />
              <span className="text-[11px] font-mono">{pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}</span>
            </Tooltip>
            <Popup className="das-popup min-w-[200px]">
              <div className="text-sm p-1.5 space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shrink-0 border border-white shadow-xs" style={{ backgroundColor: pt.color }}></span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{pt.label || 'Titik Plotted'}</h4>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Garis Lintang:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{pt.lat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Garis Bujur:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{pt.lng}</span>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => onDelete(pt.id)}
                    className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-md font-medium transition-all border border-red-200 dark:border-red-800/40 flex items-center gap-1 cursor-pointer"
                  >
                    <span>🗑️</span> Hapus Titik
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </Pane>
  );
}

function MapClickPicker({ 
  isPickMode, 
  onPick 
}: { 
  isPickMode: boolean; 
  onPick: (lat: number, lng: number) => void; 
}) {
  const map = useMap();
  useEffect(() => {
    if (isPickMode) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [isPickMode, map]);

  useMapEvents({
    click(e) {
      if (isPickMode) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

function MapFlyToTarget({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 14, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

function sanitizeCoord(lat: any, lng: any): [number, number] | null {
  let parsedLat = typeof lat === 'number' ? lat : parseFloat(String(lat).trim());
  let parsedLng = typeof lng === 'number' ? lng : parseFloat(String(lng).trim());

  if (isNaN(parsedLat) || isNaN(parsedLng)) return null;

  // Auto-correct missing decimal in longitude (e.g. 1281341539 -> 128.1341539)
  if (Math.abs(parsedLng) > 180) {
    while (Math.abs(parsedLng) > 180) {
      parsedLng /= 10;
    }
  }

  // Auto-correct missing decimal in latitude (e.g. -2981300 -> -2.981300)
  if (Math.abs(parsedLat) > 90) {
    while (Math.abs(parsedLat) > 90) {
      parsedLat /= 10;
    }
  }

  return [parsedLat, parsedLng];
}

function WaterUsersMarkers({ users }: { users: any[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); };
  }, [map]);

  // Nano micro water drop dimensions:
  // Zoom < 8: 5px width x 7px height
  // Zoom 8-10: 7px width x 10px height
  // Zoom > 10: 9px width x 12px height
  const [w, h] = zoom < 8 ? [5, 7] : zoom < 10 ? [7, 10] : [9, 12];

  const icon = useMemo(() => {
    if (typeof window === 'undefined') return undefined as any;

    return L.divIcon({
      className: 'custom-water-drop-user-pin',
      html: `
        <div style="width: ${w}px; height: ${h}px; display: flex; align-items: center; justify-content: center; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(2, 132, 199, 0.45));">
          <svg style="width: 100%; height: 100%;" viewBox="0 0 24 32">
            <path fill="#0284c7" stroke="#ffffff" stroke-width="1.5" d="M12 2C12 2 4 13 4 19A8 8 0 0 0 20 19C20 13 12 2 12 2Z"/>
            <path fill="#38bdf8" opacity="0.7" d="M12 5C12 5 7 13 7 17A5 5 0 0 0 14 20C12 18 11 15 12 5Z"/>
          </svg>
        </div>
      `,
      iconSize: [w, h],
      iconAnchor: [Math.round(w / 2), h],
      popupAnchor: [0, -h],
      tooltipAnchor: [0, -h]
    });
  }, [w, h]);

  if (!users || users.length === 0 || !icon) return null;

  return (
    <Pane name="waterUsersPane" style={{ zIndex: 700 }}>
      {users.map((user, idx) => {
        const coords = sanitizeCoord(user.latitude, user.longitude);
        if (!coords) return null;

        return (
          <Marker 
            key={`wu-${user.id || idx}`}
            position={coords}
            icon={icon}
          >
            <Tooltip sticky direction="top" className="bg-slate-900/90 text-white font-semibold text-xs rounded-lg px-2.5 py-1 border-0 shadow-lg">
              <span className="font-bold text-sky-400">💧 {user.name}</span>
              <br />
              <span className="text-[11px]">Kebutuhan: {user.kebutuhan} m³/s</span>
            </Tooltip>
            <Popup className="das-popup min-w-[180px]">
              <div className="text-sm p-1.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-4 h-4 text-sky-500 shrink-0 fill-current" viewBox="0 0 24 32">
                    <path d="M12 2C12 2 4 13 4 19A8 8 0 0 0 20 19C20 13 12 2 12 2Z"/>
                  </svg>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{user.name}</h4>
                </div>
                <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800/40 mb-2">
                  <p className="text-xs font-semibold text-sky-900 dark:text-sky-300">
                    Kebutuhan Air: <span className="font-bold text-sm text-sky-600 dark:text-sky-400">{user.kebutuhan} m³/s</span>
                  </p>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 space-y-0.5">
                  <div>Latitude: <span className="font-mono text-slate-700 dark:text-slate-300">{coords[0]}</span></div>
                  <div>Longitude: <span className="font-mono text-slate-700 dark:text-slate-300">{coords[1]}</span></div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </Pane>
  );
}

function DasPolygonsRenderer({ data, selectedId, onSelectDas, polygonOpacity, hideSelected }: { data: DasData[], selectedId?: string | null, onSelectDas: (id: string) => void, polygonOpacity: number, hideSelected?: boolean }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); };
  }, [map]);

  const sortedData = useMemo(() => {
    if (!selectedId) return data;
    return [...data].sort((a, b) => {
      if (a.id === selectedId) return 1;
      if (b.id === selectedId) return -1;
      return 0;
    });
  }, [data, selectedId]);

  return (
    <Pane name="dasPolygonPane" style={{ zIndex: 350, pointerEvents: 'auto' }}>
      {sortedData.map((das) => {
        const isSelected = das.id === selectedId;

        // When thematic layer (Tutupan Lahan / Jenis Tanah / Sungai) is checked, hide ALL DAS polygons temporarily
        if (hideSelected) {
          return null;
        }

        // When a polygon is selected, temporarily hide all other polygons
        if (selectedId && !isSelected) {
          return null;
        }

        const baseColor = das.color || '#3b82f6';
        const isThematicActive = hideSelected;
        const style = { 
          color: isSelected ? '#ef4444' : baseColor, 
          weight: isSelected ? 4 : 2, 
          fillOpacity: isThematicActive ? 0 : polygonOpacity,
          fillColor: isSelected ? '#ef4444' : baseColor,
          className: 'cursor-pointer'
        };

        const popupContent = (
          <Popup className="das-popup" autoPan={false}>
            <div className="text-sm p-1 min-w-[200px]">
              <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-2">{das.name}</h4>
              <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><span className="font-semibold text-slate-700 dark:text-slate-200">Wilayah:</span> {das.region}</p>
                <p><span className="font-semibold text-slate-700 dark:text-slate-200">Luas:</span> {das.area}</p>
                <p><span className="font-semibold text-slate-700 dark:text-slate-200">Status:</span> 
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${das.status === 'Surplus' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {das.status}
                  </span>
                </p>
                {das.debit && <p><span className="font-semibold text-slate-700 dark:text-slate-200">Debit:</span> {das.debit}</p>}
                {das.need && <p><span className="font-semibold text-slate-700 dark:text-slate-200">Kebutuhan:</span> {das.need}</p>}
              </div>
            </div>
          </Popup>
        );

        const tooltipContent = (
          <Tooltip sticky direction="top" className="border-0 shadow-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm text-slate-800 dark:text-white font-medium px-3 py-2 rounded-xl z-[650]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: baseColor }} />
              <span className="font-bold block text-sm">{das.name}</span>
            </div>
            <span className="text-xs opacity-80 block">{das.region}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-bold inline-block px-2 py-0.5 rounded-full ${das.status === 'Surplus' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
                {das.status} {das.debit ? `• ${das.debit}` : ''}
              </span>
              {das.demnasUrl && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  🏔️ DEM
                </span>
              )}
            </div>
          </Tooltip>
        );

        if (das.geojson) {
          return (
            <GeoJSON
              key={`geojson-${das.id}-${isSelected}`}
              data={das.geojson}
              style={style}
              onEachFeature={(_feature, layer) => {
                layer.on('click', () => {
                  onSelectDas(das.id);
                });
              }}
            >
              {tooltipContent}
              {popupContent}
            </GeoJSON>
          );
        }

        if (das.coordinates && das.coordinates.length > 0) {
          return (
            <Polygon 
              key={`poly-${das.id}-${isSelected}`} 
              pathOptions={style} 
              positions={das.coordinates as any}
              eventHandlers={{
                click: () => {
                  onSelectDas(das.id);
                }
              }}
            >
              {tooltipContent}
              {popupContent}
            </Polygon>
          );
        }

        return null;
      })}
    </Pane>
  );
}

function MapUpdater({ searchCoord, selectedId, data }: { searchCoord: [number, number] | null, selectedId?: string | null, data: DasData[] }) {
  const map = useMap();
  useEffect(() => {
    if (searchCoord) {
      map.flyTo(searchCoord, 11, { duration: 1.5 });
      return;
    }

    if (selectedId && data) {
      const selectedDas = data.find(d => d.id === selectedId);
      if (selectedDas) {
        if (selectedDas.geojson) {
          try {
            const layer = L.geoJSON(selectedDas.geojson as any);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
              map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
            }
          } catch (e) {}
        } else if (selectedDas.coordinates && selectedDas.coordinates.length > 0) {
          try {
            const bounds = L.latLngBounds(selectedDas.coordinates as any);
            if (bounds.isValid()) {
              map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
            }
          } catch(e) {}
        }
      }
    }
  }, [searchCoord, selectedId, data, map]);
  return null;
}

function MapClickHandler({ polygonClickedRef, onDeselect }: { polygonClickedRef: React.RefObject<boolean>, onDeselect: () => void }) {
  useMapEvents({
    click: () => {
      if (polygonClickedRef.current) {
        return;
      }
      onDeselect();
    }
  });
  return null;
}

function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 300);
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);
  return null;
}

export default function DasMap({ 
  data, 
  searchCoordinate, 
  selectedId, 
  onSelectDas,
  polygonOpacity = 0.4,
  landCoverGeojson,
  soilTypeGeojson,
  riverGeojson,
  showLandCover,
  showSoilType,
  showRiver,
  waterUsers,
  isFullscreen
}: { 
  data: DasData[]; 
  searchCoordinate: [number, number] | null; 
  selectedId?: string | null;
  onSelectDas: (id: string | null) => void;
  polygonOpacity?: number;
  landCoverGeojson?: any | null;
  soilTypeGeojson?: any | null;
  riverGeojson?: any | null;
  showLandCover?: boolean;
  showSoilType?: boolean;
  showRiver?: boolean;
  waterUsers?: any[];
  isFullscreen?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [currentOpacity, setCurrentOpacity] = useState(polygonOpacity || 0.4);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [showLegendModal, setShowLegendModal] = useState(false);
  const [showDemnasModal, setShowDemnasModal] = useState(false);

  // Plot Titik Koordinat Manual States
  const [plottedPoints, setPlottedPoints] = useState<PlottedPoint[]>([]);
  const [showPlotModal, setShowPlotModal] = useState(false);
  const [isPickMode, setIsPickMode] = useState(false);
  const [plotInputLat, setPlotInputLat] = useState('');
  const [plotInputLng, setPlotInputLng] = useState('');
  const [plotInputLabel, setPlotInputLabel] = useState('');
  const [plotInputColor, setPlotInputColor] = useState('#ef4444');
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  const polygonClickedRef = useRef(false);

  const handleAddPlotPoint = (overrideLat?: number, overrideLng?: number) => {
    let latNum = overrideLat !== undefined ? overrideLat : parseFloat(plotInputLat);
    let lngNum = overrideLng !== undefined ? overrideLng : parseFloat(plotInputLng);

    // Smart split if user pasted comma-separated string e.g. "-3.695, 128.181"
    if (isNaN(latNum) && plotInputLat.includes(',')) {
      const parts = plotInputLat.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        latNum = parseFloat(parts[0]);
        lngNum = parseFloat(parts[1]);
      }
    }

    const sanitized = sanitizeCoord(latNum, lngNum);
    if (!sanitized) {
      alert("Koordinat tidak valid! Silakan masukkan latitude (-90 s/d 90) & longitude (-180 s/d 180).");
      return;
    }

    const newPoint: PlottedPoint = {
      id: `plot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      lat: sanitized[0],
      lng: sanitized[1],
      label: plotInputLabel.trim() || `Titik ${plottedPoints.length + 1}`,
      color: plotInputColor,
      createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setPlottedPoints(prev => [newPoint, ...prev]);
    setFlyTarget(sanitized);
    setIsPickMode(false);
    
    // Reset inputs
    setPlotInputLat('');
    setPlotInputLng('');
    setPlotInputLabel('');
  };

  const handleDeletePlotPoint = (id: string) => {
    setPlottedPoints(prev => prev.filter(p => p.id !== id));
  };

  const handleClearAllPlotPoints = () => {
    if (confirm("Apakah Anda yakin ingin menghapus semua titik plot manual?")) {
      setPlottedPoints([]);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (polygonOpacity !== undefined) {
      setCurrentOpacity(polygonOpacity);
    }
  }, [polygonOpacity]);

  const handlePolygonSelect = useCallback((id: string) => {
    polygonClickedRef.current = true;
    onSelectDas(id);
    setTimeout(() => {
      polygonClickedRef.current = false;
    }, 300);
  }, [onSelectDas]);

  const dynamicLandCoverLegend = useMemo(() => {
    if (!landCoverGeojson || !landCoverGeojson.features) return [];
    const itemMap = new Map<string, { color: string; count: number }>();
    landCoverGeojson.features.forEach((f: any) => {
      const label = getLabelFromProperty(f, 'landCover');
      if (label) {
        const color = getColorFromProperty(f, 'landCover');
        const existing = itemMap.get(label);
        if (existing) {
          existing.count += 1;
        } else {
          itemMap.set(label, { color, count: 1 });
        }
      }
    });
    return Array.from(itemMap.entries()).map(([label, { color, count }]) => ({ label, color, count }));
  }, [landCoverGeojson]);

  const handleMapDeselect = useCallback(() => {
    onSelectDas(null);
  }, [onSelectDas]);

  if (!mounted) return (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center">
      <div className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-2">
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Memuat Peta...
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* Floating Polygon Layer & DEMNAS Download Menu (Top Center) */}
      {selectedId && (() => {
        const activeDas = data.find(d => d.id === selectedId);
        if (!activeDas) return null;
        return (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto animate-in fade-in slide-in-from-top-3 max-w-xl w-[92%] sm:w-auto">
            <div className="bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-xl border border-teal-500/40 p-2 sm:p-2.5 rounded-2xl shadow-2xl text-white flex flex-col sm:flex-row items-center gap-2.5">
              <div className="flex items-center gap-2 pr-2 border-b sm:border-b-0 sm:border-r border-slate-700/80 pb-1 sm:pb-0 shrink-0">
                <span className="w-3 h-3 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: activeDas.color }} />
                <div>
                  <h4 className="font-extrabold text-xs text-white truncate max-w-[140px] sm:max-w-[180px]">
                    {activeDas.name}
                  </h4>
                  <div className="text-[9.5px] text-teal-400 font-mono font-semibold flex items-center gap-1">
                    <span>✂️ Poligon Terpilih</span>
                  </div>
                </div>
              </div>

              {/* Layer Download Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">

                {/* 3. Land Cover Layer Download */}
                {activeDas.landCoverUrl && (
                  <a
                    href={activeDas.landCoverUrl}
                    download={`Tutupan_Lahan_${activeDas.name.replace(/\s+/g, '_')}.json`}
                    className="px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 font-medium text-[10.5px] rounded-lg transition flex items-center gap-1 no-underline"
                    title="Unduh Layer Tutupan Lahan"
                  >
                    <span>🌳</span>
                    <span>Tutupan Lahan</span>
                  </a>
                )}

                {/* 4. Soil Type Layer Download */}
                {activeDas.soilTypeUrl && (
                  <a
                    href={activeDas.soilTypeUrl}
                    download={`Jenis_Tanah_${activeDas.name.replace(/\s+/g, '_')}.json`}
                    className="px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-purple-300 font-medium text-[10.5px] rounded-lg transition flex items-center gap-1 no-underline"
                    title="Unduh Layer Jenis Tanah"
                  >
                    <span>🪨</span>
                    <span>Tanah</span>
                  </a>
                )}

                {/* 5. River Layer Download */}
                {activeDas.riverUrl && (
                  <a
                    href={activeDas.riverUrl}
                    download={`Jaringan_Sungai_${activeDas.name.replace(/\s+/g, '_')}.json`}
                    className="px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-sky-300 font-medium text-[10.5px] rounded-lg transition flex items-center gap-1 no-underline"
                    title="Unduh Layer Jaringan Sungai"
                  >
                    <span>🌊</span>
                    <span>Sungai</span>
                  </a>
                )}

                {/* Close Selection Button */}
                <button
                  onClick={handleMapDeselect}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs ml-1 cursor-pointer"
                  title="Tutup Menu Poligon"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Map Controls Overlay (Top Right) */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5 pointer-events-none">
        {/* Control Buttons Bar */}
        <div className="flex items-center gap-1 pointer-events-auto bg-white/75 dark:bg-slate-900/75 backdrop-blur-md hover:bg-white/90 dark:hover:bg-slate-900/90 p-1 rounded-xl border border-white/60 dark:border-slate-800/80 shadow-lg transition-all">
          {/* Plot Manual Button */}
          <button
            onClick={() => {
              setShowPlotModal(!showPlotModal);
              if (showOpacitySlider) setShowOpacitySlider(false);
              if (showLegendModal) setShowLegendModal(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              showPlotModal 
                ? 'bg-rose-600 text-white shadow-xs' 
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Plot Titik Koordinat Manual"
          >
            <span>📍</span>
            <span>Plot Titik</span>
            {plottedPoints.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                {plottedPoints.length}
              </span>
            )}
          </button>

          <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Opacity Control Button */}
          <button
            onClick={() => {
              setShowOpacitySlider(!showOpacitySlider);
              if (showLegendModal) setShowLegendModal(false);
              if (showPlotModal) setShowPlotModal(false);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              showOpacitySlider 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Atur Transparansi Polygon DAS"
          >
            <svg className="w-3.5 h-3.5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l9 9-9 9M12 3L3 12l9 9" />
            </svg>
            <span>Transparansi ({Math.round(currentOpacity * 100)}%)</span>
          </button>

          <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Legend Toggle Button */}
          <button
            onClick={() => {
              setShowLegendModal(!showLegendModal);
              if (showOpacitySlider) setShowOpacitySlider(false);
              if (showPlotModal) setShowPlotModal(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              showLegendModal 
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs' 
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Tampilkan Legenda Peta"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span>Legenda</span>
          </button>

          <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* DEMNAS Download Button */}
          <button
            onClick={() => {
              setShowDemnasModal(!showDemnasModal);
              if (showLegendModal) setShowLegendModal(false);
              if (showOpacitySlider) setShowOpacitySlider(false);
              if (showPlotModal) setShowPlotModal(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              showDemnasModal 
                ? 'bg-teal-600 text-white shadow-xs' 
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Unduh Data DEMNAS (Digital Elevation Model)"
          >
            <span>🏔️</span>
            <span>DEMNAS</span>
          </button>
        </div>

        {/* Plot Koordinat Panel Overlay */}
        {showPlotModal && (
          <div className="w-80 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-800/80 shadow-2xl pointer-events-auto transition-all animate-in fade-in slide-in-from-top-2 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-rose-500">📍</span> Plot Titik Koordinat
              </h4>
              <button 
                onClick={() => setShowPlotModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1.5 py-0.5 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switch / Pick mode banner */}
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setIsPickMode(!isPickMode)}
                className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isPickMode
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{isPickMode ? '🎯 Klik Peta untuk Ambil Titik...' : '🎯 Ambil dari Klik Peta'}</span>
              </button>
              {isPickMode && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 text-center font-medium">
                  Klik lokasi mana saja di peta untuk mengisi koordinat otomatis.
                </p>
              )}
            </div>

            {/* Form Input Koordinat */}
            <form onSubmit={(e) => { e.preventDefault(); handleAddPlotPoint(); }} className="space-y-2.5">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Garis Lintang (Latitude) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: -3.69542 atau -3.69, 128.18"
                  value={plotInputLat}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlotInputLat(val);
                    if (val.includes(',')) {
                      const parts = val.split(',').map(s => s.trim());
                      if (parts.length >= 2) {
                        setPlotInputLat(parts[0]);
                        setPlotInputLng(parts[1]);
                      }
                    }
                  }}
                  className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Garis Bujur (Longitude) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 128.18143"
                  value={plotInputLng}
                  onChange={(e) => setPlotInputLng(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Nama Titik / Deskripsi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Stasiun Pantau AWLR"
                  value={plotInputLabel}
                  onChange={(e) => setPlotInputLabel(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Warna Pin
                </label>
                <div className="flex items-center gap-1.5">
                  {[
                    { color: '#ef4444', name: 'Merah' },
                    { color: '#0284c7', name: 'Biru' },
                    { color: '#10b981', name: 'Hijau' },
                    { color: '#f59e0b', name: 'Kuning' },
                    { color: '#8b5cf6', name: 'Ungu' },
                    { color: '#ec4899', name: 'Pink' }
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => setPlotInputColor(item.color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                        plotInputColor === item.color
                          ? 'border-slate-900 dark:border-white scale-110 shadow-sm'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: item.color }}
                      title={item.name}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📍</span>
                <span>Plot ke Peta & Zoom</span>
              </button>
            </form>

            {/* List of Plotted Points */}
            {plottedPoints.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Daftar Titik Terplot ({plottedPoints.length})</span>
                  <button
                    onClick={handleClearAllPlotPoints}
                    className="text-[10px] text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {plottedPoints.map((pt) => (
                    <div
                      key={pt.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pt.color }} />
                        <div className="truncate">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{pt.label}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setFlyTarget([pt.lat, pt.lng])}
                          className="p-1 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 rounded cursor-pointer"
                          title="Zoom ke Titik"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleDeletePlotPoint(pt.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                          title="Hapus Titik"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Opacity Slider Panel */}
        {showOpacitySlider && (
          <div className="w-52 p-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/60 dark:border-slate-800/80 shadow-xl pointer-events-auto transition-all animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              <span>Transparansi DAS</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{Math.round(currentOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={currentOpacity}
              onChange={(e) => setCurrentOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
              <span>5%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Floating Map Legend Panel */}
        {showLegendModal && (
          <div className="w-60 p-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/60 dark:border-slate-800/80 shadow-xl pointer-events-auto max-h-[45vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">
              <h4 className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                <span>🗺️</span> Legenda Peta
              </h4>
              <button 
                onClick={() => setShowLegendModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              {/* Status Wilayah DAS */}
              <div className="space-y-1">
                <div className="font-semibold text-slate-500 dark:text-slate-400 text-[10px]">Batas & Status Wilayah</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 text-[10.5px]">DAS Status Surplus Air</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 text-[10.5px]">DAS Status Defisit Air</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded border-2 border-red-500 bg-red-500/20 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 text-[10.5px]">DAS Terpilih</span>
                </div>
              </div>

              {/* Pin Point Markers & Features */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <div className="font-semibold text-slate-500 dark:text-slate-400 text-[10px]">Fitur Peta</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white shadow-2xs shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 text-[10.5px]">📍 Pin Point Pencarian</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow-2xs shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 text-[10.5px]">Titik Pengguna Air</span>
                </div>
                {showRiver && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-1 bg-sky-500 rounded shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 text-[10.5px]">Jaringan Sungai</span>
                  </div>
                )}
              </div>

              {/* Tematik Layers */}
              {(showLandCover || showSoilType) && (
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-500 dark:text-slate-400 text-[10px]">Layer Tematik Aktif</div>
                  {showLandCover && (
                    <div className="space-y-1 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                      <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold text-[10px]">
                        <span className="flex items-center gap-1">🌳 Tutupan Lahan</span>
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold">{dynamicLandCoverLegend.length} Jenis</span>
                      </div>
                      {dynamicLandCoverLegend.length > 0 ? (
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                          {dynamicLandCoverLegend.map((item, idx) => (
                            <div key={`lc-item-${idx}`} className="flex items-center justify-between gap-1.5 p-0.5 px-1 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[10px]">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="w-2.5 h-2.5 rounded shrink-0 border border-white/60 shadow-2xs" style={{ backgroundColor: item.color }} />
                                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate" title={item.label}>{item.label}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 font-mono shrink-0">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-400 italic">Memuat data...</div>
                      )}
                    </div>
                  )}
                  {showSoilType && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-purple-600 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium text-[10.5px]">Layer Jenis Tanah</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEMNAS Downloader Panel Overlay */}
        {showDemnasModal && (
          <div className="w-80 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-800/80 shadow-2xl pointer-events-auto transition-all animate-in fade-in slide-in-from-top-2 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-teal-500">🏔️</span> Download Data DEMNAS
              </h4>
              <button 
                onClick={() => setShowDemnasModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1.5 py-0.5 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-3">
              Digital Elevation Model Nasional (DEMNAS) resolusi tinggi untuk pemetaan elevasi & analisis hidro-orografi DAS Maluku.
            </p>

            <div className="space-y-2">
              {data.map((das) => (
                <div
                  key={`demnas-item-${das.id}`}
                  className={`p-2.5 rounded-xl border transition-all ${
                    selectedId === das.id
                      ? 'bg-teal-500/10 border-teal-500/40 shadow-xs'
                      : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: das.color }} />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {das.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
                        {das.region}
                      </div>
                    </div>

                    {das.demnasUrl ? (
                      <a
                        href={das.demnasUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[10.5px] font-bold transition flex items-center gap-1 shadow-xs shrink-0"
                      >
                        <span>⬇️</span>
                        <span>Unduh ({das.demnasSize || 'DEMNAS'})</span>
                      </a>
                    ) : (
                      <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-semibold px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 shrink-0">
                        Belum Ada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MapContainer 
        center={[-3.5, 127.8]} 
        zoom={8} 
        style={{ height: "100%", width: "100%", background: "transparent" }}
        scrollWheelZoom={true}
        className="z-0"
        zoomControl={false}
        preferCanvas={false}
      >
        <MapResizeHandler />
        <MapClickHandler polygonClickedRef={polygonClickedRef} onDeselect={handleMapDeselect} />
        <MapUpdater searchCoord={searchCoordinate} selectedId={selectedId} data={data} />
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satelit Google">
            <TileLayer
              attribution="&copy; Google Maps"
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        <DasPolygonsRenderer 
          data={data} 
          selectedId={selectedId} 
          onSelectDas={handlePolygonSelect} 
          polygonOpacity={currentOpacity}
          hideSelected={showLandCover || showSoilType || showRiver}
        />

        <SearchPinMarker coord={searchCoordinate} />

        {showLandCover && landCoverGeojson && (
          <Pane name="landCoverPane" style={{ zIndex: 400 }}>
            <GeoJSON 
              key={`lc-${selectedId}-${currentOpacity}`}
              data={landCoverGeojson} 
              style={(feature) => ({
                fillColor: getColorFromProperty(feature, 'landCover'),
                weight: 0.8,
                opacity: 0.9,
                color: 'white',
                fillOpacity: currentOpacity
              })}
              onEachFeature={(feature, layer) => {
                const label = getLabelFromProperty(feature, 'landCover');
                const color = getColorFromProperty(feature, 'landCover');
                
                layer.on({
                  mouseover: (e) => {
                    const l = e.target;
                    l.setStyle({ weight: 2.5, color: '#ffffff', fillOpacity: Math.min(currentOpacity + 0.2, 1) });
                    if (l.bringToFront) l.bringToFront();
                  },
                  mouseout: (e) => {
                    const l = e.target;
                    l.setStyle({ weight: 0.8, color: 'white', fillOpacity: currentOpacity });
                  }
                });

                layer.bindTooltip(`
                  <div class="p-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="w-3.5 h-3.5 rounded-md shrink-0 border border-white/60 shadow-sm" style="background-color: ${color}"></span>
                      <span class="font-bold text-sm text-slate-900">${label}</span>
                    </div>
                    <div class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                      🌳 Klasifikasi Tutupan Lahan
                    </div>
                  </div>
                `, { className: 'bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-xl p-2 z-[650]' });
              }}
            />
          </Pane>
        )}

        {showSoilType && soilTypeGeojson && (
          <Pane name="soilTypePane" style={{ zIndex: 400 }}>
            <GeoJSON 
              key={`st-${selectedId}-${currentOpacity}`}
              data={soilTypeGeojson} 
              style={(feature) => ({
                fillColor: getColorFromProperty(feature, 'soilType'),
                weight: 1,
                opacity: 0.9,
                color: 'white',
                fillOpacity: currentOpacity
              })}
              onEachFeature={(feature, layer) => {
                const label = getLabelFromProperty(feature, 'soilType');
                const symbol = feature?.properties?.SU_SYM90 || feature?.properties?.SYMBOL || '-';
                
                layer.on({
                  mouseover: (e) => {
                    const l = e.target;
                    l.setStyle({ weight: 2.5, color: '#ffffff', fillOpacity: Math.min(currentOpacity + 0.2, 1) });
                    if (l.bringToFront) l.bringToFront();
                  },
                  mouseout: (e) => {
                    const l = e.target;
                    l.setStyle({ weight: 1, color: 'white', fillOpacity: currentOpacity });
                  }
                });

                layer.bindTooltip(`
                  <div class="font-bold text-sm text-slate-900">${label}</div>
                  <div class="text-xs text-slate-600">Jenis Tanah (Simbol: ${symbol})</div>
                `, { className: 'bg-white/95 backdrop-blur border border-slate-200 shadow-xl rounded-xl p-2.5' });
              }}
            />
          </Pane>
        )}

        {showRiver && riverGeojson && (
          <Pane name="riverPane" style={{ zIndex: 410 }}>
            <GeoJSON 
              key={`rv-${selectedId}`}
              data={riverGeojson} 
              style={(feature) => ({
                color: '#0ea5e9',
                weight: feature?.properties?.order ? Math.min(feature.properties.order, 3) : 2,
                opacity: 0.9,
              })}
              onEachFeature={(feature, layer) => {
                if (feature.properties) {
                  layer.bindTooltip(`
                    <div class="font-bold text-sm text-slate-800">Orde Sungai: ${feature.properties.order || '-'}</div>
                    <div class="text-xs text-slate-600">Panjang: ${Number(feature.properties.Shape_Leng || 0).toFixed(2)}</div>
                  `, {
                    className: 'bg-white/90 backdrop-blur border-0 shadow-lg rounded-lg p-2'
                  });
                }
              }}
            />
          </Pane>
        )}

        {waterUsers && waterUsers.length > 0 && (
          <WaterUsersMarkers users={waterUsers} />
        )}

        <MapFlyToTarget target={flyTarget} />
        <MapClickPicker 
          isPickMode={isPickMode} 
          onPick={(lat, lng) => {
            setPlotInputLat(lat.toFixed(6));
            setPlotInputLng(lng.toFixed(6));
            setIsPickMode(false);
          }} 
        />
        <PlottedPointsMarkers points={plottedPoints} onDelete={handleDeletePlotPoint} />
        
        <ZoomControl position="bottomleft" />
      </MapContainer>
    </div>
  );
}