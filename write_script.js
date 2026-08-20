const fs = require('fs');

const content = "use client";

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, ZoomControl, useMap, Marker, Pane, GeoJSON, LayersControl, useMapEvents } from 'react-leaflet';
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
}

const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

function WaterUsersMarkers({ users }: { users: any[] }) {
  if (!users || users.length === 0) return null;

  return (
    <Pane name="waterUsersPane" style={{ zIndex: 500 }}>
      {users.map((user, idx) => (
        <Marker 
          key={\wu-\\}
          position={[user.latitude, user.longitude]}
          icon={customIcon}
        >
          <Tooltip sticky direction="top">
            <span className="font-semibold">{user.name}</span>
            <br />
            <span className="text-xs">Kebutuhan: {user.kebutuhan} m³/s</span>
          </Tooltip>
          <Popup className="das-popup min-w-[150px]">
            <div className="text-sm p-1">
              <h4 className="font-bold text-slate-800 dark:text-white text-base mb-1">{user.name}</h4>
              <p className="text-slate-600 dark:text-slate-300 font-medium">Kebutuhan: {user.kebutuhan} m³/s</p>
              <div className="mt-2 text-[10px] text-slate-400">
                Lat: {user.latitude} <br/> Lng: {user.longitude}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </Pane>
  );
}

function DasPolygonsRenderer({ data, selectedId, onSelectDas, polygonOpacity, hideSelected }: { data: DasData[], selectedId?: string | null, onSelectDas: (id: string | null) => void, polygonOpacity: number, hideSelected?: boolean }) {
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
    <Pane name="dasPolygonPane" style={{ zIndex: 600, pointerEvents: 'auto' }}>
      {sortedData.map((das) => {
        const isSelected = das.id === selectedId;
        
        const style = { 
          color: isSelected ? '#ef4444' : '#64748b', 
          weight: isSelected ? 3 : 2, 
          fillOpacity: isSelected ? (hideSelected ? 0 : polygonOpacity) : 0.4,
          fillColor: isSelected ? '#ef4444' : '#b45309'
        };

        const popupContent = (
          <Popup className="das-popup" autoPan={false}>
            <div className="text-sm p-1 min-w-[200px]">
              <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-2">{das.name}</h4>
              <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><span className="font-semibold text-slate-700 dark:text-slate-200">Wilayah:</span> {das.region}</p>
                <p><span className="font-semibold text-slate-700 dark:text-slate-200">Luas:</span> {das.area}</p>
                <p><span className="font-semibold text-slate-700 dark:text-slate-200">Status:</span> 
                  <span className={\ml-1 px-2 py-0.5 rounded-full text-xs font-bold \\}>
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
          <Tooltip sticky direction="top" className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-slate-800 dark:text-white font-medium px-3 py-2 rounded-lg">
            <span className="font-bold block text-sm">{das.name}</span>
            <span className="text-xs opacity-80">{das.region}</span>
            <br />
            <span className={\	ext-[10px] font-bold \\}>{das.status}</span>
          </Tooltip>
        );

        if (das.geojson) {
          return (
            <GeoJSON
              key={\geojson-\\}
              data={das.geojson}
              style={style}
              eventHandlers={{
                click: (e) => {
                  const evt = (e as any).originalEvent;
                  if (evt) {
                    try { L.DomEvent.stopPropagation(evt); } catch (err) {}
                  }
                  onSelectDas(das.id);
                }
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
              key={das.id} 
              pathOptions={style} 
              positions={das.coordinates as any}
              eventHandlers={{
                click: (e) => {
                  const evt = (e as any).originalEvent;
                  if (evt) {
                    try { L.DomEvent.stopPropagation(evt); } catch (err) {}
                  }
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

function MapClickHandler({ onSelectDas }: { onSelectDas: (id: string | null) => void }) {
  useMapEvents({
    click: () => onSelectDas(null)
  });
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
  waterUsers
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
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      <MapContainer 
        center={[-3.5, 127.8]} 
        zoom={8} 
        style={{ height: "100%", width: "100%", background: "transparent" }}
        scrollWheelZoom={true}
        className="z-0"
        zoomControl={false}
        preferCanvas={true}
      >
        <MapClickHandler onSelectDas={onSelectDas} />
        <MapUpdater searchCoord={searchCoordinate} selectedId={selectedId} data={data} />
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              crossOrigin="anonymous"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satelit Google">
            <TileLayer
              attribution="&copy; Google Maps"
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              maxZoom={20}
              crossOrigin="anonymous"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        <DasPolygonsRenderer 
          data={data} 
          selectedId={selectedId} 
          onSelectDas={onSelectDas} 
          polygonOpacity={polygonOpacity}
          hideSelected={showLandCover || showSoilType || showRiver}
        />

        {showLandCover && landCoverGeojson && (
          <Pane name="landCoverPane" style={{ zIndex: 400 }}>
            <GeoJSON 
              key={\lc-\\}
              data={landCoverGeojson} 
              style={(feature) => ({
                fillColor: feature?.properties?.color || '#22c55e',
                weight: 1,
                opacity: 0.8,
                color: 'white',
                fillOpacity: 0.7
              })}
              onEachFeature={(feature, layer) => {
                if (feature.properties) {
                  layer.bindTooltip(\
                    <div class="font-bold text-sm">\</div>
                    <div class="text-xs opacity-80">Luas: \</div>
                  \);
                }
              }}
            />
          </Pane>
        )}

        {showSoilType && soilTypeGeojson && (
          <Pane name="soilTypePane" style={{ zIndex: 400 }}>
            <GeoJSON 
              key={\st-\\}
              data={soilTypeGeojson} 
              style={(feature) => ({
                fillColor: feature?.properties?.color || '#8b5cf6',
                weight: 1,
                opacity: 0.8,
                color: 'white',
                fillOpacity: 0.7
              })}
              onEachFeature={(feature, layer) => {
                if (feature.properties) {
                  layer.bindTooltip(\
                    <div class="font-bold text-sm text-slate-800">\</div>
                    <div class="text-xs text-slate-600">Simbol: \</div>
                  \, {
                    className: 'bg-white/90 backdrop-blur border-0 shadow-lg rounded-lg p-2'
                  });
                }
              }}
            />
          </Pane>
        )}

        {showRiver && riverGeojson && (
          <Pane name="riverPane" style={{ zIndex: 410 }}>
            <GeoJSON 
              key={\v-\\}
              data={riverGeojson} 
              style={(feature) => ({
                color: '#0ea5e9',
                weight: feature?.properties?.order ? Math.min(feature.properties.order, 3) : 2,
                opacity: 0.9,
              })}
              onEachFeature={(feature, layer) => {
                if (feature.properties) {
                  layer.bindTooltip(\
                    <div class="font-bold text-sm text-slate-800">Orde Sungai: \</div>
                    <div class="text-xs text-slate-600">Panjang: \</div>
                  \, {
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
        
        <ZoomControl position="bottomleft" />
      </MapContainer>
    </div>
  );
}
;

fs.writeFileSync('C:/Users/psdaf/.gemini/antigravity/scratch/neraca-air-maluku/src/components/das-map.tsx', content);
