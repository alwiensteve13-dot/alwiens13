"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, ReferenceLine } from 'recharts';


const NasaDownloader = dynamic(() => import('../components/nasa-downloader'), { ssr: false });
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import area from "@turf/area";
import { point, polygon } from "@turf/helpers";

const REGION_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f97316", // Orange
  "#eab308", // Yellow
  "#14b8a6", // Teal
  "#10b981", // Green
  "#6366f1", // Indigo
  "#f43f5e", // Rose
  "#84cc16", // Lime
  "#0ea5e9", // Sky
  "#a855f7", // Fuchsia
];

const DasMap = dynamic(() => import("@/components/das-map"), { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 font-medium">Memuat Peta Interaktif...</div> });
import { getColorFromProperty, getLabelFromProperty } from "@/lib/color-utils";

import initialRegionsData from "../../public/mock-regions.json";
import initialWaterData from "../../public/mock-water.json";

export default function Home() {
  const [regions, setRegions] = useState<any[]>(initialRegionsData);
  const [selectedDasId, setSelectedDasId] = useState<string | null>(null);
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [waterDataMap, setWaterDataMap] = useState<Record<string, any>>({});
  const [allWaterData, setAllWaterData] = useState<any[]>(initialWaterData);
  const [chartYear, setChartYear] = useState<string>(new Date().getFullYear().toString());
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [geojsons, setGeojsons] = useState<Record<string, any>>({});
  const [waterUsers, setWaterUsers] = useState<any[]>([]);
  
  // Combobox Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCoordinate, setSearchCoordinate] = useState<[number, number] | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Auto-scroll & Manual Scroll Refs for DAS List
  const dasListRef = useRef<HTMLDivElement>(null);
  const isUserInteractingRef = useRef(false);

  useEffect(() => {
    const container = dasListRef.current;
    if (!container) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const scrollStep = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      if (!isUserInteractingRef.current && container) {
        container.scrollTop += (delta * 0.025); // Ultra smooth ~25px/s slow scroll
        if (container.scrollTop >= container.scrollHeight - container.clientHeight - 2) {
          container.scrollTop = 0;
        }
      }

      animationFrameId = requestAnimationFrame(scrollStep);
    };

    animationFrameId = requestAnimationFrame(scrollStep);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [selectedDasId]);

  useEffect(() => {
    // Fetch regions to get base data and pdfUrls
    fetch('/api/regions')
      .then(res => res.json())
      .then(async data => {
         const urls: Record<string, string> = {};
         let fetchedRegions = (data && Array.isArray(data.data) && data.data.length > 0)
           ? data.data
           : initialRegionsData;

         // Merge custom DAS regions created in Admin
         try {
           if (typeof window !== "undefined") {
             const stored = localStorage.getItem("custom_das_regions");
             if (stored) {
               const custom = JSON.parse(stored);
               const map = new Map<string, any>();
               [...custom, ...fetchedRegions].forEach((r: any) => {
                 if (r && r.id && !map.has(r.id)) map.set(r.id, r);
               });
               fetchedRegions = Array.from(map.values());
             }
           }
         } catch (e) {}

         setRegions(fetchedRegions);
         fetchedRegions.forEach((r: any) => {
           if (r.pdfUrl) urls[r.id] = r.pdfUrl;
         });
         setPdfUrls(urls);

         // Batch fetch custom GeoJSON polygons in parallel and update state once
         const loadedGeojsons: Record<string, any> = {};
         await Promise.all(
           fetchedRegions.map((r: any) =>
             fetch(`/geojson/${r.id}.json?t=${new Date().getTime()}`)
               .then(res => res.ok ? res.json() : null)
               .then(geojson => { if (geojson) loadedGeojsons[r.id] = geojson; })
               .catch(() => {})
           )
         );
         setGeojsons(loadedGeojsons);
      })
      .catch(err => {
         console.warn("Failed to fetch /api/regions, falling back to initialRegionsData:", err);
         setRegions(initialRegionsData);
      });
      
    // Fetch latest water data
    fetch('/api/water-data')
      .then(res => res.json())
      .then(data => {
         const wd: Record<string, any> = {};
         const fetchedWater = (data && Array.isArray(data.data) && data.data.length > 0)
           ? data.data
           : initialWaterData;

         setAllWaterData(fetchedWater);
         fetchedWater.forEach((w: any) => {
           if (!wd[w.regionId]) {
              wd[w.regionId] = w;
           }
         });
         setWaterDataMap(wd);
      })
      .catch(err => {
         console.warn("Failed to fetch /api/water-data, falling back to initialWaterData:", err);
         setAllWaterData(initialWaterData);
      });

    // Fetch water users
    fetch('/api/water-users')
      .then(res => res.json())
      .then(data => {
         if (data.data) {
           setWaterUsers(data.data);
         }
      })
      .catch(console.error);
  }, []);

  const dynamicDasData = useMemo(() => {
    return regions.map((r, index) => {
      let dasData = {
        id: r.id,
        name: r.name,
        region: r.description || r.region || "Wilayah",
        area: r.area || "-",
        coordinates: r.coordinates || [],
        debit: "-",
        need: "-",
        status: "Belum ada data",
        color: r.color || REGION_COLORS[index % REGION_COLORS.length],
        geojson: geojsons[r.id],
        landCoverUrl: r.landCoverUrl,
        soilTypeUrl: r.soilTypeUrl,
        riverUrl: r.riverUrl,
        demnasUrl: r.demnasUrl,
        demnasName: r.demnasName,
        demnasSize: r.demnasSize,
        demnasList: r.demnasList
      };
      
      const regionData = allWaterData.filter(d => d.regionId === r.id && new Date(d.period).getUTCFullYear().toString() === chartYear);
      
      if (regionData.length > 0) {
        const totalDebit = regionData.reduce((acc, curr) => acc + (curr.debit_air || 0), 0);
        const totalNeed = regionData.reduce((acc, curr) => acc + (curr.kebutuhan_air || 0), 0);
        const totalPemeliharaan = regionData.reduce((acc, curr) => acc + (curr.pemeliharaan_sungai || 0), 0);
        const avgDebit = totalDebit / regionData.length;
        const avgNeed = totalNeed / regionData.length;
        
        const status = totalDebit >= (totalNeed + totalPemeliharaan) ? "Surplus" : "Defisit";
        
        dasData = {
          ...dasData,
          debit: `${avgDebit.toFixed(2)} m³/s`,
          need: `${avgNeed.toFixed(2)} m³/s`,
          status,
        };
      }
      return dasData;
    });
  }, [regions, allWaterData, geojsons, chartYear]);

  // Duplicate data for infinite marquee scroll
  const marqueeData = useMemo(() => [...dynamicDasData, ...dynamicDasData, ...dynamicDasData], [dynamicDasData]);

  const selectedDas = useMemo(() => dynamicDasData.find(d => d.id === selectedDasId), [dynamicDasData, selectedDasId]);
  const currentPdfUrl = selectedDas ? pdfUrls[selectedDas.id] : null;

  const selectedDasAreaKm2 = useMemo(() => {
    if (selectedDas && selectedDas.geojson) {
      try {
        const sqm = area(selectedDas.geojson as any);
        return (sqm / 1000000).toFixed(2);
      } catch (err) {
        return null;
      }
    }
    return null;
  }, [selectedDas]);

  const [landCoverGeojson, setLandCoverGeojson] = useState<any>(null);
  const [soilTypeGeojson, setSoilTypeGeojson] = useState<any>(null);
  const [riverGeojson, setRiverGeojson] = useState<any>(null);

  useEffect(() => {
    setLandCoverGeojson(null);
    setSoilTypeGeojson(null);
    setRiverGeojson(null);
    if (selectedDas) {
      const lcUrl = selectedDas.landCoverUrl || `/geojson/landcover-${selectedDas.id}.json`;
      const stUrl = selectedDas.soilTypeUrl || `/geojson/soiltype-${selectedDas.id}.json`;
      const rvUrl = selectedDas.riverUrl || `/geojson/river-${selectedDas.id}.json`;

      fetch(lcUrl)
        .then(r => r.ok ? r.json() : fetch('/geojson/landcover-2.json').then(res => res.json()))
        .then(setLandCoverGeojson)
        .catch(() => {
          fetch('/geojson/landcover-2.json').then(res => res.json()).then(setLandCoverGeojson).catch(console.error);
        });

      fetch(stUrl)
        .then(r => r.ok ? r.json() : fetch('/geojson/soiltype-2.json').then(res => res.json()))
        .then(setSoilTypeGeojson)
        .catch(() => {
          fetch('/geojson/soiltype-2.json').then(res => res.json()).then(setSoilTypeGeojson).catch(console.error);
        });

      fetch(rvUrl)
        .then(r => r.ok ? r.json() : fetch('/geojson/river-2.json').then(res => res.json()))
        .then(setRiverGeojson)
        .catch(() => {
          fetch('/geojson/river-2.json').then(res => res.json()).then(setRiverGeojson).catch(console.error);
        });
    }
  }, [selectedDas]);

  const landCoverLegendItems = useMemo(() => {
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

  const soilTypeLegendItems = useMemo(() => {
    if (!soilTypeGeojson || !soilTypeGeojson.features) return [];
    const itemMap = new Map<string, string>();
    soilTypeGeojson.features.forEach((f: any) => {
      const label = getLabelFromProperty(f, 'soilType');
      if (label && label !== 'Tidak diketahui' && !itemMap.has(label)) {
        itemMap.set(label, getColorFromProperty(f, 'soilType'));
      }
    });
    return Array.from(itemMap.entries()).map(([label, color]) => ({ label, color }));
  }, [soilTypeGeojson]);

  const riverSummary = useMemo(() => {
    if (!riverGeojson || !riverGeojson.features) return null;
    let totalLength = 0;
    riverGeojson.features.forEach((f: any) => {
      const props = f.properties || {};
      const len = props.reach_len || props.Shape_Leng || props.Shape_Length || props.Panjang || props.panjang || props.LENGTH;
      if (len) totalLength += Number(len);
    });
    if (totalLength > 0) {
      // Assuming 'reach_len' or typical length properties are in meters if they are > 100
      if (totalLength > 100) {
        return `Total Panjang: ${(totalLength / 1000).toFixed(2)} km`;
      }
      return `Total Panjang: ${totalLength.toFixed(3)} derajat`;
    }
    return `Total Panjang: (Data numerik tidak tersedia)`;
  }, [riverGeojson]);

  // Dark mode state
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

  // Layer visibility state
  const [showLandCover, setShowLandCover] = useState(false);
  const [showSoilType, setShowSoilType] = useState(false);
  const [showRiver, setShowRiver] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNasaPanel, setShowNasaPanel] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const chartData = useMemo(() => {
    if (!selectedDasId || !chartYear) return [];
    
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    const bins: any[] = [];
    
    for (let m = 0; m < 12; m++) {
      bins.push({ name: `${months[m]} 1`, monthIdx: m, cycle: 1, debit: 0, need: 0, pemeliharaan: 0, na: 0, hasData: false });
      bins.push({ name: `${months[m]} 2`, monthIdx: m, cycle: 2, debit: 0, need: 0, pemeliharaan: 0, na: 0, hasData: false });
    }
    
    const regionData = allWaterData.filter(d => {
      const date = new Date(d.period);
      return d.regionId === selectedDasId && date.getUTCFullYear().toString() === chartYear;
    });
    
    let sumDebit = 0;
    let countData = 0;

    regionData.forEach(d => {
      const date = new Date(d.period);
      const monthIdx = date.getUTCMonth();
      const cycle = date.getUTCDate() < 15 ? 1 : 2;
      const binIdx = (monthIdx * 2) + (cycle - 1);
      
      if (bins[binIdx]) {
        const debitVal = d.debit_air || 0;
        const needVal = d.kebutuhan_air || 0;
        const pemeliharaanVal = (d.pemeliharaan_sungai !== undefined && d.pemeliharaan_sungai !== null)
          ? d.pemeliharaan_sungai
          : Number((0.095 * debitVal).toFixed(2));

        const naVal = debitVal - (needVal + pemeliharaanVal);

        bins[binIdx].debit = debitVal;
        bins[binIdx].need = needVal;
        bins[binIdx].pemeliharaan = pemeliharaanVal;
        bins[binIdx].na = Number(naVal.toFixed(2));
        bins[binIdx].hasData = true;

        sumDebit += debitVal;
        countData += 1;
      }
    });

    const avgDebit = countData > 0 ? Number((sumDebit / countData).toFixed(2)) : 0;
    bins.forEach(bin => {
      bin.avgDebit = avgDebit;
      if (bin.hasData && avgDebit > 0) {
        bin.season = bin.debit >= avgDebit ? "Basah" : "Kering";
      } else {
        bin.season = "-";
      }
    });
    
    return bins;
  }, [selectedDasId, chartYear, allWaterData]);

  // Update search query when selectedDasId changes (e.g. clicked on map)
  useEffect(() => {
    if (selectedDasId && selectedDas) {
       setSearchQuery(`${selectedDas.name} (${selectedDas.region})`);
    } else if (!selectedDasId) {
       // Reset thematic layer checkboxes when deselecting DAS (clicking outside)
       setShowLandCover(false);
       setShowSoilType(false);
       setShowRiver(false);
    }
  }, [selectedDasId, selectedDas]);

  const handlePrintPublicChart = async (containerId: string) => {
    if (!selectedDas) return;
    const regionName = selectedDas.name;
    const regionDesc = selectedDas.region || "Maluku";
    
    let chartImgHtml = '';
    const chartContainer = document.getElementById(containerId);
    if (chartContainer) {
      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(chartContainer, { backgroundColor: '#0f172a', quality: 0.95 });
        chartImgHtml = `
          <div style="margin-bottom: 6px; text-align: center; page-break-inside: avoid;">
            <img src="${dataUrl}" style="width: 100%; max-height: 260px; object-fit: contain; border-radius: 6px; border: 1px solid #cbd5e1;" />
          </div>
        `;
      } catch (err) {
        console.warn("Failed to capture public chart image:", err);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let rowsHtml = '';
    let totalDebit = 0, totalNeed = 0, totalPemeliharaan = 0, totalNA = 0;
    const wetPeriodsList: string[] = [];
    const dryPeriodsList: string[] = [];

    // Precalculate totals & average
    chartData.forEach((bin: any) => {
      totalDebit += (bin.debit || 0);
      totalNeed += (bin.need || 0);
      totalPemeliharaan += (bin.pemeliharaan || 0);
      totalNA += (bin.na !== undefined ? bin.na : ((bin.debit || 0) - ((bin.need || 0) + (bin.pemeliharaan || 0))));
    });
    
    const avgDebit = totalDebit / 24;
    const avgNeed = totalNeed / 24;
    const avgPemeliharaan = totalPemeliharaan / 24;
    const avgNA = totalNA / 24;
    const overallStatus = avgDebit >= (avgNeed + avgPemeliharaan) ? "Surplus" : "Defisit";
    
    chartData.forEach((bin: any, idx: number) => {
      const debitNum = bin.debit || 0;
      const needNum = bin.need || 0;
      const pemeliharaanNum = bin.pemeliharaan || 0;
      const naNum = bin.na !== undefined ? bin.na : (debitNum - (needNum + pemeliharaanNum));
      const status = debitNum >= (needNum + pemeliharaanNum) ? "Surplus" : "Defisit";
      const isWet = avgDebit > 0 && debitNum >= avgDebit;

      if (avgDebit > 0) {
        if (isWet) wetPeriodsList.push(bin.name);
        else dryPeriodsList.push(bin.name);
      }
      
      const statusBg = status === "Surplus" ? "#d1fae5" : "#fee2e2";
      const statusColor = status === "Surplus" ? "#065f46" : "#991b1b";
      const seasonLabel = isWet 
        ? '<span style="color: #0284c7; font-weight: bold; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">💧 Basah</span>' 
        : '<span style="color: #d97706; font-weight: bold; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">☀️ Kering</span>';
      
      rowsHtml += `
        <tr>
          <td style="text-align: center; padding: 3px 5px; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding: 3px 5px; border: 1px solid #cbd5e1; font-weight: bold;">${bin.name}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1;">${debitNum.toFixed(2)}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1;">${needNum.toFixed(2)}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1;">${pemeliharaanNum.toFixed(2)}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1; font-weight: bold; color: ${naNum >= 0 ? '#047857' : '#dc2626'};">${naNum.toFixed(2)}</td>
          <td style="text-align: center; padding: 3px 5px; border: 1px solid #cbd5e1; background-color: ${statusBg}; color: ${statusColor}; font-weight: bold;">${status}</td>
          <td style="text-align: center; padding: 3px 5px; border: 1px solid #cbd5e1;">${seasonLabel}</td>
        </tr>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Grafik Bulanan Neraca Air - ${regionName} (${chartYear})</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 8px 12px; color: #0f172a; font-size: 10px; }
          h2 { text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 2px 0; text-transform: uppercase; color: #0f172a; }
          .subtitle { text-align: center; font-size: 10.5px; color: #475569; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { background-color: #f1f5f9; padding: 4px 6px; border: 1px solid #cbd5e1; font-size: 9.5px; text-transform: uppercase; color: #334155; }
          td { font-size: 9.5px; }
          tfoot tr td { font-weight: bold; background-color: #f8fafc; }
          .season-box { margin-top: 8px; padding: 8px 12px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 9.5px; line-height: 1.5; }
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
          }
        </style>
      </head>
      <body>
        <h2>Grafik Bulanan Neraca Air (24 Periode)</h2>
        <div class="subtitle">Wilayah DAS: <strong>${regionName}</strong> (${regionDesc}) | Tahun: <strong>${chartYear}</strong></div>

        ${chartImgHtml}

        <table>
          <thead>
            <tr>
              <th style="width: 25px;">No</th>
              <th>Periode</th>
              <th style="text-align: right;">Ketersediaan (m³/s)</th>
              <th style="text-align: right;">Kebutuhan (m³/s)</th>
              <th style="text-align: right;">Pemeliharaan (m³/s)</th>
              <th style="text-align: right;">Neraca Air (m³/s)</th>
              <th style="text-align: center;">Status Neraca</th>
              <th style="text-align: center;">Klasifikasi Musim</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align: center; padding: 4px 6px; border: 1px solid #cbd5e1;">RATA-RATA TAHUNAN</td>
              <td style="text-align: right; padding: 4px 6px; border: 1px solid #cbd5e1;">${avgDebit.toFixed(2)}</td>
              <td style="text-align: right; padding: 4px 6px; border: 1px solid #cbd5e1;">${avgNeed.toFixed(2)}</td>
              <td style="text-align: right; padding: 4px 6px; border: 1px solid #cbd5e1;">${avgPemeliharaan.toFixed(2)}</td>
              <td style="text-align: right; padding: 4px 6px; border: 1px solid #cbd5e1; color: ${avgNA >= 0 ? '#047857' : '#dc2626'};">${avgNA.toFixed(2)}</td>
              <td style="text-align: center; padding: 4px 6px; border: 1px solid #cbd5e1;">${overallStatus}</td>
              <td style="text-align: center; padding: 4px 6px; border: 1px solid #cbd5e1; font-size: 8.5px; color: #64748b;">(Batas: ${avgDebit.toFixed(2)} m³/s)</td>
            </tr>
          </tfoot>
        </table>

        <div class="season-box">
          <div style="font-weight: bold; margin-bottom: 3px; color: #1e293b;">Analisis Hidrologi Periode Basah & Kering (Batas Rata-rata Tahunan = ${avgDebit.toFixed(2)} m³/s):</div>
          <div>• <strong style="color: #0284c7;">💧 Periode Basah (Debit ≥ Rerata):</strong> ${wetPeriodsList.length > 0 ? wetPeriodsList.join(", ") : "Tidak ada periode basah teridentifikasi"}</div>
          <div>• <strong style="color: #d97706;">☀️ Periode Kering (Debit &lt; Rerata):</strong> ${dryPeriodsList.length > 0 ? dryPeriodsList.join(", ") : "Tidak ada periode kering teridentifikasi"}</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredDas = useMemo(() => {
    if (searchCoordinate) {
      // If searching by coordinate, don't filter the list so the dropdown still shows all, 
      // or we can filter it to just the selected one.
      return dynamicDasData;
    }
    if (!searchQuery || (selectedDas && searchQuery === `${selectedDas.name} (${selectedDas.region})`)) {
       return dynamicDasData;
    }
    const q = searchQuery.toLowerCase();
    return dynamicDasData.filter(d => 
       d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q)
    );
  }, [searchQuery, dynamicDasData, selectedDas, searchCoordinate]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setIsDropdownOpen(true);

    const coordMatch = val.match(/^\s*(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSearchCoordinate([lat, lng]);
        
        const pt = point([lng, lat]);
        let foundId = null;
        
        for (const das of dynamicDasData) {
          if (das.geojson) {
            try {
              if (booleanPointInPolygon(pt, das.geojson as any)) {
                foundId = das.id;
                break;
              }
            } catch (err) {}
          } else if (das.coordinates && das.coordinates.length >= 3) {
            try {
              const ring = das.coordinates.map((c: any) => [c[1], c[0]]);
              ring.push(ring[0]);
              const poly = polygon([ring]);
              if (booleanPointInPolygon(pt, poly)) {
                foundId = das.id;
                break;
              }
            } catch (err) {}
          }
        }
        
        if (foundId) {
          setSelectedDasId(foundId);
        }
        return;
      }
    }
    
    setSearchCoordinate(null);
  };

  const chartSummary = useMemo(() => {
    const surplus: string[] = [];
    const defisit: string[] = [];
    const wetPeriods: string[] = [];
    const dryPeriods: string[] = [];

    const dataBins = chartData.filter(b => b.hasData);
    const avgDebit = dataBins.length > 0 ? dataBins[0].avgDebit || 0 : 0;
    
    let maxDebit = 0;
    let maxPeriod = '';
    let minDebit = dataBins.length > 0 ? Infinity : 0;
    let minPeriod = '';

    chartData.forEach(bin => {
      if (bin.hasData) {
        if (bin.debit >= (bin.need + bin.pemeliharaan)) {
          surplus.push(bin.name);
        } else {
          defisit.push(bin.name);
        }

        if (avgDebit > 0) {
          if (bin.debit >= avgDebit) {
            wetPeriods.push(bin.name);
          } else {
            dryPeriods.push(bin.name);
          }
        }

        if (bin.debit > maxDebit) {
          maxDebit = bin.debit;
          maxPeriod = bin.name;
        }
        if (bin.debit < minDebit) {
          minDebit = bin.debit;
          minPeriod = bin.name;
        }
      }
    });

    if (minDebit === Infinity) minDebit = 0;
    
    return { 
      surplus, 
      defisit, 
      avgDebit, 
      wetPeriods, 
      dryPeriods, 
      maxDebit, 
      maxPeriod, 
      minDebit, 
      minPeriod,
      hasData: dataBins.length > 0
    };
  }, [chartData]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-cyan-200 dark:selection:bg-cyan-900 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg transition-colors duration-300 no-print">
        <div className={`mx-auto flex h-16 items-center justify-between transition-all duration-300 ${isFullscreen ? 'w-full px-0' : 'w-full px-4 sm:px-6 lg:px-8'}`}>
          <div className={`flex items-center gap-2 ${isFullscreen ? 'ml-4' : ''}`}>
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden shrink-0">
              <img src="/logo-pu.svg" alt="Logo PUPR" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white hidden sm:block">Neraca Air PSDA Balai Wilayah Sungai Maluku</span>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:hidden">BWS Maluku</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors focus:outline-none"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors focus:outline-none"
              title="Layar Penuh"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10l-5 5m0 0l5 5m-5-5h10m5-10l-5 5m0 0l-5-5m5 5V3" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
            <Link href="/admin" className={`rounded-full bg-slate-900 dark:bg-cyan-600 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-slate-900/50 dark:focus:ring-cyan-500/50 ${isFullscreen ? 'px-4 mr-4' : 'px-4'}`}>
              Masuk Pengelola
            </Link>
          </div>
        </div>
      </header>

      <main className={`mx-auto transition-all duration-300 ${isFullscreen ? 'w-full px-0 py-0' : 'w-full px-4 py-8 sm:px-6 lg:px-8'}`}>
        


        <div className={`grid transition-all duration-300 ${isFullscreen ? 'gap-0 grid-cols-1 md:grid-cols-5' : 'gap-8 lg:grid-cols-4'}`}>
          {/* Map Column */}
          <div className={`relative transition-all duration-300 z-0 ${isFullscreen ? 'md:col-span-4 h-[calc(100dvh-64px)]' : 'lg:col-span-3 h-[600px] md:h-[700px] lg:h-[800px]'}`}>
            <DasMap 
              onSelectDas={setSelectedDasId} 
              selectedId={selectedDasId} 
              data={dynamicDasData} 
              searchCoordinate={searchCoordinate} 
              waterUsers={waterUsers} 
              isFullscreen={isFullscreen} 
              showLandCover={showLandCover} 
              showSoilType={showSoilType} 
              showRiver={showRiver}
              landCoverGeojson={landCoverGeojson}
              soilTypeGeojson={soilTypeGeojson}
              riverGeojson={riverGeojson}
            />
            
            {/* Float NASA Downloader */}
            <div className="absolute bottom-24 left-2 z-[1000] flex flex-col items-start gap-2 pointer-events-none">
              {showNasaPanel && (
                <div className="mb-2 w-[340px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[70vh] overflow-y-auto pointer-events-auto">
                   <div className="p-4">
                     <NasaDownloader selectedDas={selectedDas} />
                   </div>
                </div>
              )}
              <button 
                 onClick={() => setShowNasaPanel(!showNasaPanel)} 
                 className={`p-1.5 rounded-lg shadow-sm border pointer-events-auto transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${showNasaPanel ? 'bg-indigo-600/80 border-indigo-500/80 text-white backdrop-blur-md' : 'bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm border-white/30 dark:border-slate-700/30 text-indigo-800 dark:text-indigo-300 hover:bg-white/50 dark:hover:bg-slate-800/50'}`} 
                 title="Data Iklim NASA POWER"
              >
                 <svg className="w-4 h-4 drop-shadow-sm opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                 </svg>
              </button>
            </div>
          </div>

          {/* Details Column */}
          <div className={`flex flex-col gap-6 transition-all duration-300 z-10 no-print ${isFullscreen ? 'md:col-span-1 border-l border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 p-4 overflow-y-auto h-[calc(100dvh-64px)]' : 'lg:col-span-1 h-[600px] md:h-[700px] lg:h-[800px]'}`}>
            {/* Search/Select */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm relative z-20 transition-colors duration-300">
              <div className="mb-2 flex items-end justify-between">
                <label htmlFor="das-search" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Cari Wilayah DAS</label>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 text-right">
                  Total DAS: <span className="text-slate-700 dark:text-slate-300 font-bold">{regions.length}</span> &nbsp;|&nbsp; 
                  Poligon Aktif: <span className="text-cyan-600 dark:text-cyan-400 font-bold">{dynamicDasData.filter(d => d.geojson).length}</span>
                </div>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-slate-400 dark:text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="das-search"
                  type="text"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-3 pl-10 pr-4 text-sm text-slate-700 dark:text-slate-200 focus:border-cyan-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="Ketik nama DAS, wilayah, atau koordinat (Lat, Lng)..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  autoComplete="off"
                />
                
                {isDropdownOpen && filteredDas.length > 0 && (
                  <ul className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl ring-1 ring-black ring-opacity-5 transition-colors duration-300">
                    {filteredDas.map(d => (
                      <li
                        key={d.id}
                        className="cursor-pointer px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-slate-700 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevents input blur before click fires
                          setSelectedDasId(d.id);
                          setSearchQuery(`${d.name} (${d.region})`);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{d.region}</div>
                      </li>
                    ))}
                  </ul>
                )}
                
                {isDropdownOpen && filteredDas.length === 0 && (
                  <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-xl text-center text-sm text-slate-500 dark:text-slate-400">
                    Tidak ditemukan hasil untuk "{searchQuery}"
                  </div>
                )}
              </div>
            </div>

            {/* Details Card */}
            {selectedDas ? (
              <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 min-h-0 relative">
                <div className="h-2 w-full shrink-0" style={{ backgroundColor: selectedDas.color }} />
                <div className="p-6 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedDas.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedDas.region}
                        {selectedDasAreaKm2 && ` • Luas DAS: ${selectedDasAreaKm2} km²`}
                      </p>
                    </div>
                    <button 
                      onClick={() => setSelectedDasId(null)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shadow-sm"
                      title="Tutup Ringkasan"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 transition-colors duration-300">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Debit Air</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedDas.debit}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 transition-colors duration-300">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Kebutuhan</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedDas.need}</p>
                    </div>
                  </div>

                  {/* Chart Section */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-slate-900 dark:text-white">Grafik Neraca Air</h4>
                        <select 
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                          value={chartYear}
                          onChange={(e) => setChartYear(e.target.value)}
                        >
                          {Array.from({length: 8}, (_, i) => 2023 + i).map(year => (
                            <option key={year} value={year.toString()}>{year}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePrintPublicChart('public-chart-container')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/80 transition"
                          title="Cetak Grafik Neraca Air 24 Periode (PDF 1 Halaman)"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          <span>Cetak Grafik</span>
                        </button>
                        <button
                          onClick={() => setIsChartModalOpen(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition"
                          title="Perbesar Grafik Layar Penuh"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          <span>Perbesar</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="w-full h-[320px] mt-2" id="public-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 45 }} barGap={0.5}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                          <ReferenceLine y={0} stroke={isDark ? "#475569" : "#94a3b8"} strokeWidth={1.5} />
                          {chartSummary.avgDebit > 0 && (
                            <ReferenceLine 
                              y={chartSummary.avgDebit} 
                              stroke="#0284c7" 
                              strokeDasharray="4 4" 
                              strokeWidth={1.5}
                              label={{
                                value: `Rerata (${chartSummary.avgDebit} m³/s)`,
                                position: 'top',
                                fill: isDark ? '#38bdf8' : '#0369a1',
                                fontSize: 9,
                                fontWeight: 700
                              }}
                            />
                          )}
                          <XAxis 
                            dataKey="name" 
                            tick={{fill: isDark ? "#94a3b8" : "#64748b", fontSize: 9, fontWeight: 500}} 
                            angle={-45} 
                            textAnchor="end"
                            interval={0}
                            tickMargin={4}
                          />
                          <YAxis tick={{fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10}} />
                          <Tooltip 
                            cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0]?.payload;
                                if (!data) return null;
                                const avgDebit = chartSummary.avgDebit || 0;
                                const isWet = avgDebit > 0 && data.debit >= avgDebit;
                                return (
                                  <div className="p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-xs space-y-1.5 min-w-[200px]">
                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-1 gap-2">
                                      <span className="font-bold text-slate-800 dark:text-slate-100">{label}</span>
                                      {data.hasData && avgDebit > 0 && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          isWet 
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' 
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                        }`}>
                                          {isWet ? '💧 Periode Basah' : '☀️ Periode Kering'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#0ea5e9]"></span>Ketersediaan:</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{data.debit} m³/s</span>
                                      </div>
                                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#ef4444]"></span>Kebutuhan:</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{data.need} m³/s</span>
                                      </div>
                                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#f59e0b]"></span>Pemeliharaan:</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{data.pemeliharaan} m³/s</span>
                                      </div>
                                      <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1">
                                        <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#10b981]"></span>Neraca Air:</span>
                                        <span className={`font-bold ${data.na >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                          {data.na} m³/s ({data.debit >= (data.need + data.pemeliharaan) ? 'Surplus' : 'Defisit'})
                                        </span>
                                      </div>
                                      {avgDebit > 0 && (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800 flex justify-between">
                                          <span>Batas Rerata Tahunan:</span>
                                          <span className="font-medium text-slate-600 dark:text-slate-300">{avgDebit} m³/s</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend verticalAlign="bottom" align="center" wrapperStyle={{paddingTop: '15px', fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b'}} />
                          <Bar dataKey="debit" fill="#0ea5e9" radius={[2, 2, 0, 0]} name="Ketersediaan" />
                          <Bar dataKey="need" fill="#ef4444" radius={[2, 2, 0, 0]} name="Kebutuhan" />
                          <Bar dataKey="na" fill="#10b981" radius={[2, 2, 0, 0]} name="Neraca Air (NA)" />
                          <Bar dataKey="pemeliharaan" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Pemeliharaan" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart Summary Notes & Wet/Dry Season Analysis */}
                    <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs transition-colors duration-300 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                        <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>📊</span> Analisis Periode & Neraca Air ({chartYear})
                        </p>
                        {chartSummary.avgDebit > 0 && (
                          <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100/80 dark:bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                            Rerata: {chartSummary.avgDebit} m³/s
                          </span>
                        )}
                      </div>

                      {/* Periode Basah & Kering Badges */}
                      {chartSummary.avgDebit > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/50">
                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold text-xs mb-1">
                              <span>💧</span>
                              <span>Periode Basah (Q ≥ {chartSummary.avgDebit} m³/s)</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                              {chartSummary.wetPeriods.length > 0 ? chartSummary.wetPeriods.join(", ") : "Tidak terdeteksi periode basah"}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50">
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-xs mb-1">
                              <span>☀️</span>
                              <span>Periode Kering (Q &lt; {chartSummary.avgDebit} m³/s)</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                              {chartSummary.dryPeriods.length > 0 ? chartSummary.dryPeriods.join(", ") : "Tidak terdeteksi periode kering"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Peak & Extremes */}
                      {chartSummary.maxDebit > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span>Puncak Debit (Maks): <strong className="text-blue-600 dark:text-blue-400">{chartSummary.maxDebit} m³/s</strong> ({chartSummary.maxPeriod})</span>
                          <span>Debit Terendah (Min): <strong className="text-amber-600 dark:text-amber-400">{chartSummary.minDebit} m³/s</strong> ({chartSummary.minPeriod})</span>
                        </div>
                      )}

                      {/* Deficit / Surplus Note */}
                      <div className="pt-1">
                        {chartSummary.defisit.length > 0 ? (
                          <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p>Defisit neraca air terjadi pada: <span className="font-bold">{chartSummary.defisit.join(", ")}</span>.</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p>Seluruh bulan pada tahun {chartYear} terpantau <strong>Surplus</strong>.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Layer Toggles */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Lapisan Peta Tambahan</h4>
                    <div className="flex flex-col gap-3">
                      {/* Tutupan Lahan Toggle */}
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-colors group-hover:border-emerald-500">
                            <input type="checkbox" className="peer absolute opacity-0 w-full h-full cursor-pointer" checked={showLandCover} onChange={(e) => setShowLandCover(e.target.checked)} />
                            <svg className="w-3.5 h-3.5 text-emerald-500 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Tampilkan Tutupan Lahan</span>
                        </label>
                        {showLandCover && landCoverLegendItems.length > 0 && (
                          <div className="ml-8 mt-2 space-y-2 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 transition-all">
                            <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-200 font-bold text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="text-sm">🌳</span> Jenis Tutupan Lahan (Atribut NAMA OBJ)
                              </span>
                              <span className="bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-black">
                                {landCoverLegendItems.length} Jenis
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                              {landCoverLegendItems.map((item, idx) => (
                                <div 
                                  key={`lc-lg-${idx}`} 
                                  className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs shadow-xs hover:border-emerald-400 dark:hover:border-emerald-600 transition"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-3.5 h-3.5 rounded-md shrink-0 border border-white/60 shadow-2xs" style={{ backgroundColor: item.color }} />
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.label}>{item.label}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md shrink-0">
                                    {item.count} poligon
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Jenis Tanah Toggle */}
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-colors group-hover:border-amber-500">
                            <input type="checkbox" className="peer absolute opacity-0 w-full h-full cursor-pointer" checked={showSoilType} onChange={(e) => setShowSoilType(e.target.checked)} />
                            <svg className="w-3.5 h-3.5 text-amber-500 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Tampilkan Jenis Tanah</span>
                        </label>
                        {showSoilType && soilTypeLegendItems.length > 0 && (
                          <div className="ml-8 mt-1.5 flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                            {soilTypeLegendItems.map((item, idx) => (
                              <div key={`st-lg-${idx}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 shadow-2xs">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* River Toggle */}
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-colors group-hover:border-sky-500">
                            <input type="checkbox" className="peer absolute opacity-0 w-full h-full cursor-pointer" checked={showRiver} onChange={(e) => setShowRiver(e.target.checked)} />
                            <svg className="w-3.5 h-3.5 text-sky-500 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Tampilkan Jaringan Sungai</span>
                        </label>
                        {showRiver && (
                          <div className="ml-8 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {riverSummary || "Jaringan sungai aktif"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>





                  {currentPdfUrl && (
                    <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors duration-300">
                      <h4 className="font-bold text-slate-900 dark:text-white mb-3">Dokumen PDF Terlampir</h4>
                      <div className="w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-4 bg-slate-100 dark:bg-slate-800">
                        <iframe src={currentPdfUrl} className="w-full h-full" title="PDF Viewer" />
                      </div>
                      <div className="flex flex-col gap-3">
                        <a 
                          href={currentPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:hover:bg-cyan-500 shadow-md shadow-slate-900/10 dark:shadow-cyan-900/20"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Lihat Dokumen PDF
                        </a>
                        <button 
                          onClick={() => window.print()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Cetak Ringkasan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative min-h-0 transition-colors duration-300">
                <div className="p-6 h-full flex flex-col overflow-hidden">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Daftar Wilayah DAS</h3>
                  <div className="relative flex-1 overflow-hidden group">
                    <div className="flex flex-col gap-3 animate-marquee-vertical group-hover:[animation-play-state:paused]">
                      {[...dynamicDasData, ...dynamicDasData].map((d, index) => (
                        <div 
                          key={`${d.id}-${index}`} 
                          className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between group/item"
                          onClick={() => setSelectedDasId(d.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover/item:text-cyan-600 dark:group-hover/item:text-cyan-400 transition-colors">{d.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{d.region}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${d.status === 'Surplus' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'}`}>
                              {d.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen Chart Modal */}
      {isChartModalOpen && selectedDas && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📊</span> Grafik Neraca Air - {selectedDas.name} ({selectedDas.region})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tampilan Layar Penuh 24 Periode Setengah Bulanan</p>
              </div>

              <div className="flex items-center gap-3">
                <select 
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs"
                  value={chartYear}
                  onChange={(e) => setChartYear(e.target.value)}
                >
                  {Array.from({length: 8}, (_, i) => 2023 + i).map(year => (
                    <option key={year} value={year.toString()}>Tahun {year}</option>
                  ))}
                </select>

                <button
                  onClick={() => handlePrintPublicChart('modal-chart-container')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
                  title="Cetak Grafik Neraca Air 24 Periode (PDF 1 Halaman)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Cetak Grafik</span>
                </button>

                <button
                  onClick={() => setIsChartModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                  title="Tutup Modal"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="h-[440px] w-full" id="modal-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 65 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <ReferenceLine y={0} stroke={isDark ? "#475569" : "#94a3b8"} strokeWidth={1.5} />
                    {chartSummary.avgDebit > 0 && (
                      <ReferenceLine 
                        y={chartSummary.avgDebit} 
                        stroke="#0284c7" 
                        strokeDasharray="4 4" 
                        strokeWidth={2}
                        label={{
                          value: `Batas Rerata Tahunan (${chartSummary.avgDebit} m³/s)`,
                          position: 'top',
                          fill: isDark ? '#38bdf8' : '#0369a1',
                          fontSize: 11,
                          fontWeight: 700
                        }}
                      />
                    )}
                    <XAxis 
                      dataKey="name" 
                      tick={{fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11, fontWeight: 600}} 
                      angle={-45} 
                      textAnchor="end"
                      interval={0}
                      tickMargin={8}
                    />
                    <YAxis tick={{fill: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 500}} />
                    <Tooltip 
                      cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0]?.payload;
                          if (!data) return null;
                          const avgDebit = chartSummary.avgDebit || 0;
                          const isWet = avgDebit > 0 && data.debit >= avgDebit;
                          return (
                            <div className="p-3.5 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-xs space-y-2 min-w-[220px]">
                              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-1 gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{label}</span>
                                {data.hasData && avgDebit > 0 && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    isWet 
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' 
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                  }`}>
                                    {isWet ? '💧 Periode Basah' : '☀️ Periode Kering'}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#0ea5e9]"></span>Ketersediaan:</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{data.debit} m³/s</span>
                                </div>
                                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#ef4444]"></span>Kebutuhan:</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{data.need} m³/s</span>
                                </div>
                                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#f59e0b]"></span>Pemeliharaan:</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{data.pemeliharaan} m³/s</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5">
                                  <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#10b981]"></span>Neraca Air:</span>
                                  <span className={`font-bold ${data.na >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {data.na} m³/s ({data.debit >= (data.need + data.pemeliharaan) ? 'Surplus' : 'Defisit'})
                                  </span>
                                </div>
                                {avgDebit > 0 && (
                                  <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800 flex justify-between">
                                    <span>Batas Rerata Tahunan:</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{avgDebit} m³/s</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{paddingTop: '25px', fontSize: '13px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b'}} />
                    <Bar dataKey="debit" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={12} name="Ketersediaan (Debit)" />
                    <Bar dataKey="need" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} name="Kebutuhan Air" />
                    <Bar dataKey="na" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} name="Neraca Air (NA)" />
                    <Bar dataKey="pemeliharaan" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={12} name="Pemeliharaan Sungai" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Modal Wet/Dry Season Breakdown Cards */}
              {chartSummary.avgDebit > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold text-xs">
                        <span>💧</span> Periode Basah (Q ≥ {chartSummary.avgDebit} m³/s)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200/80 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {chartSummary.wetPeriods.length} Periode
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {chartSummary.wetPeriods.length > 0 ? chartSummary.wetPeriods.join(", ") : "Tidak ada"}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-xs">
                        <span>☀️</span> Periode Kering (Q &lt; {chartSummary.avgDebit} m³/s)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                        {chartSummary.dryPeriods.length} Periode
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {chartSummary.dryPeriods.length > 0 ? chartSummary.dryPeriods.join(", ") : "Tidak ada"}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">Statistik Ekstrem Debit:</div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Debit Maksimum:</span>
                      <strong className="text-blue-600 dark:text-blue-400">{chartSummary.maxDebit} m³/s ({chartSummary.maxPeriod})</strong>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Debit Minimum:</span>
                      <strong className="text-amber-600 dark:text-amber-400">{chartSummary.minDebit} m³/s ({chartSummary.minPeriod})</strong>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-1">
                      <span>Rerata Tahunan:</span>
                      <strong className="text-cyan-600 dark:text-cyan-400">{chartSummary.avgDebit} m³/s</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                DAS Terpilih: <span className="font-bold text-slate-900 dark:text-white">{selectedDas.name}</span> ({selectedDas.region}) • Tahun {chartYear}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintPublicChart('modal-chart-container')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
                  title="Cetak Grafik Neraca Air 24 Periode (PDF 1 Halaman)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>🖨️ Cetak Grafik PDF</span>
                </button>
                <button
                  onClick={() => setIsChartModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}