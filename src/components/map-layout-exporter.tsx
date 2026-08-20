"use client";

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, GeoJSON, LayersControl, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getColorFromProperty, getLabelFromProperty } from './das-map';

export default function MapLayoutComposer({
  selectedDas,
  selectedDasData,
  showLandCover,
  showSoilType,
  showRiver,
  landCoverGeojson,
  soilTypeGeojson,
  riverGeojson,
  allDasData
}: {
  selectedDas: any;
  selectedDasData: any;
  showLandCover: boolean;
  showSoilType: boolean;
  showRiver: boolean;
  landCoverGeojson: any;
  soilTypeGeojson: any;
  riverGeojson: any;
  allDasData: any[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Default coordinate for Maluku
  const centerCoord: [number, number] = selectedDasData?.coordinates ? 
    [selectedDasData.coordinates[0][0], selectedDasData.coordinates[0][1]] : 
    [-3.5, 127.8];
  
  // Helper to extract unique classes and their colors from GeoJSON
  const getUniqueClasses = (geojson: any, seedOffset: number) => {
    if (!geojson || !geojson.features) return [];
    const uniqueClasses = new Map<string, string>();
    geojson.features.forEach((feature: any) => {
      if (feature.properties) {
        const label = getLabelFromProperty(feature.properties);
        if (label && !uniqueClasses.has(label)) {
          uniqueClasses.set(label, getColorFromProperty(feature.properties, seedOffset));
        }
      }
    });
    return Array.from(uniqueClasses.entries()).map(([label, color]) => ({ label, color })).sort((a, b) => a.label.localeCompare(b.label));
  };

  const landCoverClasses = showLandCover ? getUniqueClasses(landCoverGeojson, 1) : [];
  const soilTypeClasses = showSoilType ? getUniqueClasses(soilTypeGeojson, 2) : [];

  const handlePrint = () => {
    window.print();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[999999] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto print:bg-white print:overflow-hidden no-print-bg">
      {/* TOP TOOLBAR (Hidden during print) */}
          <div className="w-full bg-white dark:bg-slate-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-50 no-print border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Print Composer</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Atur posisi peta Anda sebelum dicetak</p>
              </div>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={handlePrint}
                 className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
               >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                 </svg>
                 Cetak Layout
               </button>
               <button 
                 onClick={() => setIsOpen(false)}
                 className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg font-medium transition-colors"
               >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                 Tutup
               </button>
            </div>
          </div>

          {/* PAPER AREA */}
          <div className="p-8 w-full max-w-6xl mx-auto flex-grow flex items-center justify-center print:p-0 print:max-w-none print:items-start no-print-bg">
        
        {/* A4 LANDSCAPE PAPER */}
        <div className="bg-white shadow-2xl print:shadow-none w-[297mm] h-[210mm] relative overflow-hidden flex flex-col mx-auto" id="print-section">
          
          {/* OUTER FRAME */}
          <div className="absolute inset-2 border-[4px] border-slate-900 pointer-events-none z-50"></div>
          
          {/* CONTENT SPLIT */}
          <div className="flex h-full w-full p-3 pt-3 pb-3 gap-2">
            
            {/* LEFT: MAP (75%) */}
            <div className="w-[75%] h-full border-[3px] border-slate-900 relative">
               <MapContainer 
                  center={centerCoord} 
                  zoom={9} 
                  style={{ height: "100%", width: "100%", backgroundColor: "#f8fafc" }} 
                  zoomControl={false}
                  attributionControl={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Leaflet native layer control for dynamic map interaction */}
                  <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Citra OSM">
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Citra Satelit">
                          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                        </LayersControl.BaseLayer>

                        {/* RENDER ALL DAS POLYGONS AS BACKGROUND */}
                        {allDasData.map((das) => {
                          const isSelected = das.id === selectedDasData?.id;
                          const style = { 
                            color: isSelected ? '#ef4444' : '#64748b', 
                            weight: isSelected ? 3 : 1, 
                            fillOpacity: isSelected ? (showLandCover || showSoilType || showRiver ? 0 : 0.4) : 0.1 
                          };

                          if (das.geojson) {
                            return (
                              <GeoJSON 
                                key={`geojson-${das.id}`}
                                data={das.geojson}
                                style={style}
                              />
                            );
                          }

                          return (
                            <Polygon 
                              key={`poly-${das.id}`}
                              positions={das.coordinates || []} 
                              pathOptions={style}
                            />
                          );
                        })}

                        {/* OVERLAYS */}
                        {landCoverGeojson && showLandCover && (
                          <LayersControl.Overlay checked name="Tutupan Lahan">
                            <GeoJSON 
                              data={landCoverGeojson} 
                              style={(feature: any) => ({
                                fillColor: getColorFromProperty(feature?.properties, 1),
                                weight: 1,
                                opacity: 0.8,
                                color: 'white',
                                fillOpacity: 0.6
                              })}
                            />
                          </LayersControl.Overlay>
                        )}

                        {soilTypeGeojson && showSoilType && (
                          <LayersControl.Overlay checked name="Jenis Tanah">
                            <GeoJSON 
                              data={soilTypeGeojson} 
                              style={(feature: any) => ({
                                fillColor: getColorFromProperty(feature?.properties, 2),
                                weight: 1,
                                opacity: 0.8,
                                color: 'white',
                                fillOpacity: 0.6
                              })}
                            />
                          </LayersControl.Overlay>
                        )}

                        {riverGeojson && showRiver && (
                          <LayersControl.Overlay checked name="Jaringan Sungai">
                            <GeoJSON 
                              data={riverGeojson} 
                              style={{ color: '#0ea5e9', weight: 2 }}
                            />
                          </LayersControl.Overlay>
                        )}
                  </LayersControl>
               </MapContainer>
               
               {/* NORTH ARROW & SCALE BAR */}
               <div className="absolute top-4 left-4 z-[999] bg-white/90 p-2 border-2 border-slate-900 rounded shadow-md flex flex-col items-center">
                  <div className="font-black text-lg leading-none">U</div>
                  <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[16px] border-transparent border-b-slate-900 mt-1"></div>
               </div>
            </div>

            {/* RIGHT: LAYOUT PANEL (25%) */}
            <div className="w-[25%] h-full flex flex-col border-[3px] border-slate-900 bg-white">
               
               {/* 1. KOP PETA */}
               <div className="p-3 border-b-[3px] border-slate-900 flex flex-col items-center justify-center gap-2">
                  <div className="w-full flex items-center px-2">
                     <img src="/logo-pu.svg" alt="Logo PU" className="w-12 h-auto object-contain shrink-0" />
                     <div className="flex-1 text-center px-2">
                       <h1 className="font-black text-sm uppercase tracking-wider text-slate-900 leading-tight">
                          Kementerian Pekerjaan Umum
                       </h1>
                       <h2 className="font-bold text-[10px] uppercase text-slate-700 mt-1">
                          Direktorat Jenderal Sumber Daya Air
                       </h2>
                     </div>
                     <div className="w-12 shrink-0"></div> {/* Spacer to keep the text perfectly centered relative to the left logo */}
                  </div>
               </div>

               {/* 2. TITLE */}
               <div className="p-4 border-b-[3px] border-slate-900 flex flex-col justify-center items-center h-[120px] bg-slate-50">
                  <h2 className="font-black text-xl text-center leading-tight uppercase tracking-widest text-slate-900">
                     PETA DAERAH ALIRAN SUNGAI
                  </h2>
                  <h3 className="font-bold text-lg text-center mt-2 uppercase text-slate-700">
                     {selectedDasData?.name || "Wilayah Maluku"}
                  </h3>
               </div>

               {/* 3. LEGEND */}
               <div className="p-3 flex-grow border-b-[3px] border-slate-900 flex flex-col overflow-y-auto print:overflow-hidden scrollbar-thin scrollbar-thumb-slate-300">
                  <h4 className="font-black text-sm mb-3 border-b-2 border-slate-900 pb-1 text-center tracking-[0.2em] shrink-0">LEGENDA</h4>
                  
                  <div className="flex flex-col gap-3">
                     <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 shrink-0 border-2 border-slate-700 ${selectedDasData?.id ? 'bg-red-500/40 border-red-700' : 'bg-slate-400/40'}`}></div>
                        <span className="text-xs font-bold uppercase">Batas DAS</span>
                     </div>
                     
                     {showRiver && (
                       <div className="flex items-center gap-3">
                          <div className="w-6 h-1.5 shrink-0 bg-sky-500"></div>
                          <span className="text-xs font-bold uppercase">Jaringan Sungai</span>
                       </div>
                     )}

                     {showLandCover && landCoverClasses.length > 0 ? (
                        <div className="flex flex-col gap-1.5 mt-1">
                           <span className="text-xs font-bold uppercase text-slate-900">Tutupan Lahan (KLHK)</span>
                           <div className="grid grid-cols-1 gap-1 pl-2">
                             {landCoverClasses.map(c => (
                               <div key={c.label} className="flex items-center gap-2">
                                  <div className="w-4 h-4 shrink-0 border border-slate-400" style={{ backgroundColor: c.color, opacity: 0.6 }}></div>
                                  <span className="text-[9px] font-semibold text-slate-700 leading-tight">{c.label}</span>
                               </div>
                             ))}
                           </div>
                        </div>
                     ) : showLandCover && (
                       <div className="flex items-center gap-3">
                          <div className="w-6 h-6 shrink-0 border border-slate-400 bg-emerald-500/60"></div>
                          <span className="text-xs font-bold uppercase">Tutupan Lahan (KLHK)</span>
                       </div>
                     )}

                     {showSoilType && soilTypeClasses.length > 0 ? (
                        <div className="flex flex-col gap-1.5 mt-1">
                           <span className="text-xs font-bold uppercase text-slate-900">Jenis Tanah (USDA)</span>
                           <div className="grid grid-cols-1 gap-1 pl-2">
                             {soilTypeClasses.map(c => (
                               <div key={c.label} className="flex items-center gap-2">
                                  <div className="w-4 h-4 shrink-0 border border-slate-400" style={{ backgroundColor: c.color, opacity: 0.6 }}></div>
                                  <span className="text-[9px] font-semibold text-slate-700 leading-tight">{c.label}</span>
                               </div>
                             ))}
                           </div>
                        </div>
                     ) : showSoilType && (
                       <div className="flex items-center gap-3">
                          <div className="w-6 h-6 shrink-0 border border-slate-400 bg-amber-600/60"></div>
                          <span className="text-xs font-bold uppercase">Jenis Tanah (USDA)</span>
                       </div>
                     )}
                     
                     <div className="flex items-center gap-3 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" className="w-6 h-6 shrink-0">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3" fill="white"></circle>
                        </svg>
                              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold">5</div>
                              <div className="absolute top-2 right-0 text-[9px] font-bold">10 KM</div>
                           </div>
                        </div>
                     </div>

                     {/* 4. FOOTER INFO */}
                     <div className="p-3 text-[9px] text-slate-800 font-medium leading-relaxed bg-white">
                        <div className="grid grid-cols-1 gap-1.5">
                           <div><span className="font-bold">Sistem Proyeksi:</span> Geografis (Latitude/Longitude)</div>
                           <div><span className="font-bold">Sistem Koordinat Horizontal:</span> WGS 1984</div>
                           <div><span className="font-bold">Sumber Data:</span>
                              <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                                 <li>Peta Rupa Bumi Indonesia (BIG)</li>
                                 <li>Data Spasial Kementerian PUPR</li>
                                 <li>Citra Satelit Google / OSM</li>
                              </ul>
                           </div>
                        </div>
                     </div>
                     <div className="bg-slate-900 text-white p-2 text-center text-[8px] tracking-widest font-bold uppercase">
                        Sistem Informasi Neraca Air Maluku
                     </div>
                  </div>

               </div>
           </div>
        </div>
      </div>
  );

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`p-1.5 rounded-lg shadow-sm border pointer-events-auto transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500/50 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm border-white/30 dark:border-slate-700/30 text-indigo-800 dark:text-indigo-300 hover:bg-white/50 dark:hover:bg-slate-800/50 no-print`}
        title="Buka Print Composer (Penyusun Layout)"
      >
        <svg className="w-4 h-4 drop-shadow-sm opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      </button>
      
      {isOpen && mounted && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </>
  );
}
