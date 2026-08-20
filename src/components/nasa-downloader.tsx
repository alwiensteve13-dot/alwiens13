'use client';

import React, { useState, useRef, useEffect } from 'react';

// Fungsi untuk mengekstrak centroid dari geojson
function getGeojsonCentroid(geojson: any): { lat: number, lon: number } | null {
  if (!geojson) return null;
  
  let geometries: any[] = [];
  
  // Kumpulkan semua geometry yang ada
  if (geojson.type === 'FeatureCollection' && geojson.features) {
    geometries = geojson.features.map((f: any) => f.geometry).filter(Boolean);
  } else if (geojson.type === 'Feature' && geojson.geometry) {
    geometries = [geojson.geometry];
  } else if (geojson.type === 'GeometryCollection' && geojson.geometries) {
    geometries = geojson.geometries;
  } else if (geojson.coordinates) {
    // Kemungkinan ini adalah murni object Geometry (Polygon, MultiPolygon, dll)
    geometries = [geojson];
  }

  if (geometries.length === 0) return null;

  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  let found = false;

  const processCoords = (coords: any[]) => {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      found = true;
    } else if (Array.isArray(coords)) {
      coords.forEach(processCoords);
    }
  };

  geometries.forEach((geom: any) => {
    if (geom && geom.coordinates) {
      processCoords(geom.coordinates);
    }
  });

  if (!found) return null;
  return {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2
  };
}

export default function NasaDownloader({ selectedDas }: { selectedDas: any }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State untuk rentang waktu
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animasi progress bar (hanya visual karena API tidak memberikan progres nyata)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(5);
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 90) {
            clearInterval(interval);
            return 90;
          }
          return p + Math.random() * 5; // increment acak
        });
      }, 800);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const fetchNasaData = async (lat: number, lon: number, dasName: string) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Format tanggal menjadi YYYYMMDD untuk API NASA
      const formattedStart = startDate.replace(/-/g, '');
      const formattedEnd = endDate.replace(/-/g, '');

      if (!formattedStart || !formattedEnd) {
        throw new Error("Mohon pilih tanggal mulai dan tanggal akhir");
      }

      let errorMsg = '';
      let csvText = '';
      let isSuccess = false;
      
      const nasaUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=RE&longitude=${lon}&latitude=${lat}&start=${formattedStart}&end=${formattedEnd}&format=CSV`;

      // Try browser direct fetch first to avoid Server IP Rate limits
      try {
        const directRes = await fetch(nasaUrl);
        if (directRes.ok) {
          csvText = await directRes.text();
          isSuccess = true;
        } else {
          errorMsg = `NASA API (Direct) Error: ${directRes.statusText}`;
        }
      } catch (directErr: any) {
        console.warn("Direct fetch failed, falling back to proxy...", directErr);
      }

      // Fallback to proxy if direct fetch fails (e.g., due to CORS or adblocker)
      if (!isSuccess) {
        const res = await fetch('/api/nasa-rainfall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            lat, 
            lon, 
            startDate: formattedStart, 
            endDate: formattedEnd 
          })
        });

        if (res.ok) {
          csvText = await res.text();
          isSuccess = true;
        } else {
          let errorData;
          try {
            errorData = await res.json();
          } catch(e) {}
          
          errorMsg = errorData?.error || 'Gagal mengunduh data NASA';
          if (errorData?.details) {
            let detailsStr = errorData.details;
            try {
              const parsedDetails = JSON.parse(errorData.details);
              if (parsedDetails.messages) {
                detailsStr = parsedDetails.messages.join(', ');
              }
            } catch(e) {}
            errorMsg = `${errorMsg}. Detail: ${detailsStr}`;
          }
        }
      }

      setProgress(95);

      if (!isSuccess) {
        throw new Error(errorMsg || "Semua metode pengunduhan gagal.");
      }

      // Download file
      const blob = new Blob([csvText], { type: 'text/csv' });
      setProgress(100);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hujan_NASA_${formattedStart}_${formattedEnd}_${dasName.replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setTimeout(() => setIsLoading(false), 500); // biarkan bar penuh sejenak
    }
  };

  const handleDownloadCurrentDas = async () => {
    if (!selectedDas) return;
    
    let centroid = null;
    
    if (selectedDas.geojson) {
      centroid = getGeojsonCentroid(selectedDas.geojson);
    } else if (selectedDas.geojsonUrl) {
      try {
        const res = await fetch(selectedDas.geojsonUrl);
        const geojson = await res.json();
        centroid = getGeojsonCentroid(geojson);
      } catch (e) {
        console.error("Failed to load geojson for centroid", e);
      }
    }
    
    if (!centroid && selectedDas.coordinates && selectedDas.coordinates.length > 0) {
      const firstCoord = selectedDas.coordinates[0];
      if (Array.isArray(firstCoord)) {
        centroid = { lat: firstCoord[0], lon: firstCoord[1] };
      } else {
        centroid = { lat: selectedDas.coordinates[0], lon: selectedDas.coordinates[1] };
      }
    }
    
    if (centroid) {
      await fetchNasaData(centroid.lat, centroid.lon, selectedDas.name);
    } else {
      setErrorMsg("Titik koordinat DAS tidak ditemukan");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const fileName = file.name.toLowerCase();
    const dasName = file.name.replace(/\.(geojson|zip)$/i, '');

    try {
      let geojson: any = null;

      if (fileName.endsWith('.zip')) {
        // Ekstrak shapefile (zip) menggunakan dynamic import
        const shpModule = await import('shpjs');
        const shp = shpModule.default || shpModule;
        const arrayBuffer = await file.arrayBuffer();
        geojson = await shp(arrayBuffer);
      } else if (fileName.endsWith('.shp')) {
        const shpModule = await import('shpjs');
        const shp = shpModule.default || shpModule;
        const arrayBuffer = await file.arrayBuffer();
        const geometries = shp.parseShp(arrayBuffer);
        geojson = {
          type: "FeatureCollection",
          features: geometries.map((geom: any) => ({
             type: "Feature",
             geometry: geom,
             properties: {}
          }))
        };
      } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        // Ekstrak geojson
        const text = await file.text();
        geojson = JSON.parse(text);
      } else {
        throw new Error("Format tidak didukung. Gunakan .zip, .shp, .json, atau .geojson");
      }

      // shpjs bisa mengembalikan Array dari FeatureCollection jika ada banyak layer
      const targetGeojson = Array.isArray(geojson) ? geojson[0] : geojson;
      
      const centroid = getGeojsonCentroid(targetGeojson);
      
      if (centroid) {
        await fetchNasaData(centroid.lat, centroid.lon, dasName);
      } else {
        setErrorMsg("Gagal mengekstrak koordinat dari berkas");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses berkas");
    }
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="transition-colors duration-300">
      <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
        <span>Data Iklim NASA POWER</span>
      </h4>
      
      {errorMsg && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      {/* Pemilihan Rentang Waktu */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Mulai Dari</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Sampai Dengan</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          />
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {selectedDas && (
          <button 
            onClick={handleDownloadCurrentDas}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 dark:bg-indigo-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-md disabled:opacity-70 relative overflow-hidden"
          >
            {/* Progress Bar Background */}
            {isLoading && (
              <div 
                className="absolute left-0 top-0 bottom-0 bg-indigo-500/50 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            )}
            
            <div className="relative z-10 flex items-center justify-center gap-2">
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {isLoading ? `Mengambil Data (${Math.round(progress)}%)...` : 'Unduh Data Hujan (Profil DAS Ini)'}
            </div>
          </button>
        )}
        
        <label 
          className={`flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm relative overflow-hidden cursor-pointer ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".geojson,.zip,.shp,.json"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="hidden" 
          />
          {/* Progress Bar Background for File Upload */}
          {isLoading && (
            <div 
              className="absolute left-0 top-0 bottom-0 bg-slate-200 dark:bg-slate-700 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          )}
          <div className="relative z-10 flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Unggah (GeoJSON / .zip Shapefile) & Unduh
          </div>
        </label>
      </div>
    </div>
  );
}
