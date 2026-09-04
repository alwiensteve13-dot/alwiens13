"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Region {
  id: string;
  name: string;
  description: string;
  pdfUrl?: string;
  demnasUrl?: string;
  demnasName?: string;
  demnasSize?: string;
}

interface WaterData {
  id: string;
  regionId: string;
  period: string;
  debit_air: number;
  kebutuhan_air: number;
  pemeliharaan_sungai: number;
  neraca_air?: number;
  status: string;
}

interface RegionWithData extends Region {
  latestData?: WaterData;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [regions, setRegions] = useState<RegionWithData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [formData, setFormData] = useState({
    periodMonth: new Date().toISOString().substring(0, 7), // YYYY-MM
    periodCycle: "1", // 1 or 2
    debit_air: "",
    kebutuhan_air: "",
    pemeliharaan_sungai: "",
    neraca_air: "",
  });
  
  // Add Region Modal state
  const [isAddRegionModalOpen, setIsAddRegionModalOpen] = useState(false);
  const [newRegionData, setNewRegionData] = useState({ name: "", description: "" });

  // Chart state
  const [chartSelectedRegion, setChartSelectedRegion] = useState<string>("");
  const [chartYear, setChartYear] = useState<string>(new Date().getFullYear().toString());
  const [allWaterData, setAllWaterData] = useState<WaterData[]>([]);

  // Bulk Edit state
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState(Array(24).fill({ debit: "", need: "", pemeliharaan: "", na: "" }));
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Water Users state
  const [isWaterUsersModalOpen, setIsWaterUsersModalOpen] = useState(false);
  const [waterUsers, setWaterUsers] = useState<any[]>([]);
  const [newWaterUser, setNewWaterUser] = useState({ name: "", latitude: "", longitude: "", kebutuhan: "" });

  const fetchData = async () => {
    try {
      const [regionsRes, waterDataRes] = await Promise.all([
        fetch("/api/regions").then(r => r.json()),
        fetch("/api/water-data").then(r => r.json())
      ]);

      const regionsData: Region[] = regionsRes.data || [];
      const waterData: WaterData[] = waterDataRes.data || [];
      setAllWaterData(waterData);

      // Merge custom regions created locally so they persist on Vercel
      let customRegions: Region[] = [];
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("custom_das_regions");
          if (stored) customRegions = JSON.parse(stored);
        }
      } catch (e) {}

      const allMap = new Map<string, Region>();
      [...customRegions, ...regionsData].forEach(r => {
        if (r && r.id && !allMap.has(r.id)) {
          allMap.set(r.id, r);
        }
      });
      const mergedList = Array.from(allMap.values());

      const combined = mergedList.map(region => {
        const latest = waterData.find(d => d.regionId === region.id);
        return { ...region, latestData: latest };
      });
      
      setRegions(combined);
      if (combined.length > 0 && !chartSelectedRegion) {
        setChartSelectedRegion(combined[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openInputModal = (region: Region) => {
    setSelectedRegion(region);
    setFormData({
      periodMonth: new Date().toISOString().substring(0, 7),
      periodCycle: "1",
      debit_air: "",
      kebutuhan_air: "",
      pemeliharaan_sungai: "",
      neraca_air: "",
    });
    setIsModalOpen(true);
  };

  const openWaterUsersModal = async (region: Region) => {
    setSelectedRegion(region);
    setIsWaterUsersModalOpen(true);
    setNewWaterUser({ name: "", latitude: "", longitude: "", kebutuhan: "" });
    try {
      const res = await fetch(`/api/water-users?regionId=${region.id}`);
      const data = await res.json();
      setWaterUsers(data.data || []);
    } catch (error) {
      console.error("Failed to fetch water users", error);
    }
  };

  const handleAddWaterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegion) return;
    try {
      const res = await fetch("/api/water-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newWaterUser,
          regionId: selectedRegion.id
        }),
      });
      if (res.ok) {
        setNewWaterUser({ name: "", latitude: "", longitude: "", kebutuhan: "" });
        const resList = await fetch(`/api/water-users?regionId=${selectedRegion.id}`);
        const dataList = await resList.json();
        setWaterUsers(dataList.data || []);
      } else {
        const errorData = await res.json();
        alert("Gagal menambahkan pengguna air: " + errorData.error);
      }
    } catch (error) {
      alert("Terjadi kesalahan sistem.");
    }
  };

  const handleDeleteWaterUser = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data pengguna air ini?")) return;
    try {
      const res = await fetch(`/api/water-users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWaterUsers(waterUsers.filter(w => w.id !== id));
      } else {
        const errorData = await res.json();
        alert("Gagal menghapus pengguna air: " + errorData.error);
      }
    } catch (error) {
      alert("Terjadi kesalahan sistem.");
    }
  };

  const handleUploadShapefile = async (event: any, file: File | undefined, regionId: string, type: string) => {
    if (!file) return;
    try {
      let geojson = null;
      if (file.name.endsWith(".zip")) {
        const shpModule = await import("shpjs");
        const shp = shpModule.default || shpModule;
        geojson = await shp(await file.arrayBuffer());
      } else if (file.name.endsWith(".shp")) {
        const shpModule = await import("shpjs");
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
      } else {
        const text = await file.text();
        geojson = JSON.parse(text);
      }

      const formData = new FormData();
      formData.append("regionId", regionId);
      formData.append("type", type);
      formData.append("file", file);
      formData.append("geojson", JSON.stringify(geojson));
      
      const res = await fetch("/api/upload-geojson", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert(`File ${type} berhasil diunggah!`);
      } else {
        alert("Gagal unggah: " + (data.error || "Gagal memproses berkas"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Terjadi kesalahan saat memproses file: " + err.message);
    }
    event.target.value = '';
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegion) return;

    const debit = parseFloat(formData.debit_air) || 0;
    const kebutuhan = parseFloat(formData.kebutuhan_air) || 0;
    const pemeliharaan = parseFloat(formData.pemeliharaan_sungai) || 0;
    const neraca = formData.neraca_air !== "" 
      ? parseFloat(formData.neraca_air) 
      : (debit - (kebutuhan + pemeliharaan));

    const status = debit >= (kebutuhan + pemeliharaan) ? "Surplus" : "Defisit";

    // Format period to a valid date based on cycle
    const day = formData.periodCycle === "1" ? "01" : "16";
    const periodDate = new Date(`${formData.periodMonth}-${day}`).toISOString();

    try {
      const res = await fetch("/api/water-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: selectedRegion.id,
          period: periodDate,
          debit_air: debit,
          kebutuhan_air: kebutuhan,
          pemeliharaan_sungai: pemeliharaan,
          neraca_air: neraca,
          status,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData(); // Refresh data
        alert("Data berhasil disimpan!");
      } else {
        const errorData = await res.json();
        alert("Gagal menyimpan data: " + errorData.error);
      }
    } catch (error) {
      alert("Terjadi kesalahan sistem saat menyimpan data.");
    }
  };

  const handleAddRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRegionData),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.data) {
        const newReg = data.data;
        setIsAddRegionModalOpen(false);
        setNewRegionData({ name: "", description: "" });
        
        // Save to localStorage for Vercel persistence
        try {
          if (typeof window !== "undefined") {
            const stored = localStorage.getItem("custom_das_regions");
            const existing = stored ? JSON.parse(stored) : [];
            const filtered = existing.filter((r: any) => r.id !== newReg.id);
            localStorage.setItem("custom_das_regions", JSON.stringify([newReg, ...filtered]));
          }
        } catch (e) {}

        setRegions(prev => [newReg, ...prev]);
        if (!chartSelectedRegion) setChartSelectedRegion(newReg.id);
        alert(`DAS "${newReg.name}" berhasil ditambahkan! Anda sekarang dapat mengunggah poligon untuk DAS ini pada daftar di bawah.`);
      } else {
        alert("Gagal menambahkan DAS: " + (data.error || "Terjadi kesalahan pada server."));
      }
    } catch (error: any) {
      console.error(error);
      alert("Terjadi kesalahan sistem saat menyimpan DAS: " + (error?.message || "Koneksi terputus"));
    }
  };

  const handleDeleteRegion = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus DAS ${name}? Data neraca air dan poligon yang terkait mungkin ikut terhapus.`)) return;

    try {
      const res = await fetch(`/api/regions?id=${id}`, {
        method: "DELETE",
      });

      // Remove from localStorage if custom
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("custom_das_regions");
          if (stored) {
            const existing = JSON.parse(stored);
            const filtered = existing.filter((r: any) => r.id !== id);
            localStorage.setItem("custom_das_regions", JSON.stringify(filtered));
          }
        }
      } catch (e) {}

      setRegions(prev => prev.filter(r => r.id !== id));
      alert("DAS berhasil dihapus!");
      fetchData();
    } catch (error) {
      alert("Terjadi kesalahan sistem saat menghapus DAS.");
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chartSelectedRegion) return;
    
    setIsSavingBulk(true);
    try {
      const res = await fetch("/api/water-data/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: chartSelectedRegion,
          year: chartYear,
          entries: bulkFormData
        }),
      });

      if (res.ok) {
        setIsBulkEditModalOpen(false);
        fetchData();
        alert("Data tahunan berhasil disimpan!");
      } else {
        const errorData = await res.json();
        alert("Gagal menyimpan data tahunan: " + errorData.error);
      }
    } catch (error) {
      alert("Terjadi kesalahan sistem saat menyimpan data tahunan.");
    } finally {
      setIsSavingBulk(false);
    }
  };

  // Generate Chart Data (24 bins)
  const chartData = useMemo(() => {
    if (!chartSelectedRegion || !chartYear) return [];
    
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    const bins: any[] = [];
    
    // Initialize 24 bins
    for (let m = 0; m < 12; m++) {
      bins.push({ name: `${months[m]} 1`, monthIdx: m, cycle: 1, debit: 0, need: 0, pemeliharaan: 0, na: 0, hasData: false });
      bins.push({ name: `${months[m]} 2`, monthIdx: m, cycle: 2, debit: 0, need: 0, pemeliharaan: 0, na: 0, hasData: false });
    }
    
    // Filter data for the region and year
    const regionData = allWaterData.filter(d => {
      const date = new Date(d.period);
      return d.regionId === chartSelectedRegion && date.getUTCFullYear().toString() === chartYear;
    });
    
    let sumDebit = 0;
    let countData = 0;

    // Assign data to bins
    regionData.forEach(d => {
      const date = new Date(d.period);
      const monthIdx = date.getUTCMonth();
      const day = date.getUTCDate();
      const cycle = day < 15 ? 1 : 2; // day 1 is cycle 1, day 16 is cycle 2
      
      const binIdx = (monthIdx * 2) + (cycle - 1);
      if (bins[binIdx]) {
        if (!bins[binIdx].hasData) {
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
  }, [chartSelectedRegion, chartYear, allWaterData]);

  const openBulkEditModal = () => {
    // Populate form with existing chartData
    const newForm = chartData.map(bin => ({
      debit: bin.hasData ? bin.debit.toString() : "",
      need: bin.hasData ? bin.need.toString() : "",
      pemeliharaan: bin.hasData ? bin.pemeliharaan.toString() : "",
      na: bin.hasData ? bin.na.toString() : ""
    }));
    setBulkFormData(newForm);
    setIsBulkEditModalOpen(true);
  };

  const handleBulkChange = (index: number, field: "debit" | "need" | "pemeliharaan" | "na", value: string) => {
    const updated = [...bulkFormData];
    const current = { ...updated[index], [field]: value };
    if (field === "debit") {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        current.pemeliharaan = (num * 0.095).toFixed(2);
      }
    }
    updated[index] = current;
    setBulkFormData(updated);
  };

  const handleExportCSV = () => {
    const selectedRegionObj = regions.find(r => r.id === chartSelectedRegion);
    const regionName = selectedRegionObj?.name || "DAS";
    const filename = `Data_Grafik_Neraca_Air_${regionName.replace(/\s+/g, '_')}_Tahun_${chartYear}.csv`;
    
    let csv = "No,Periode,Ketersediaan (m3/s),Kebutuhan (m3/s),Pemeliharaan (m3/s),Neraca Air (m3/s),Status\n";
    
    chartData.forEach((bin, idx) => {
      const debitNum = (bulkFormData[idx]?.debit !== undefined && bulkFormData[idx]?.debit !== "")
        ? parseFloat(bulkFormData[idx].debit)
        : (bin.debit || 0);
      const needNum = (bulkFormData[idx]?.need !== undefined && bulkFormData[idx]?.need !== "")
        ? parseFloat(bulkFormData[idx].need)
        : (bin.need || 0);
      const pemeliharaanNum = (bulkFormData[idx]?.pemeliharaan !== undefined && bulkFormData[idx]?.pemeliharaan !== "")
        ? parseFloat(bulkFormData[idx].pemeliharaan)
        : (bin.pemeliharaan || 0);
      const naNum = (bulkFormData[idx]?.na !== undefined && bulkFormData[idx]?.na !== "")
        ? parseFloat(bulkFormData[idx].na)
        : (bin.na !== undefined ? bin.na : (debitNum - (needNum + pemeliharaanNum)));
      const status = debitNum >= (needNum + pemeliharaanNum) ? "Surplus" : "Defisit";
      
      csv += `${idx + 1},"${bin.name}",${debitNum},${needNum},${pemeliharaanNum},${naNum.toFixed(2)},${status}\n`;
    });
    
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buildAdminPrintSvgChart = (bins: any[], avgDebitVal: number) => {
    const W = 760;
    const H = 225;
    const padL = 52;
    const padR = 18;
    const padT = 36;
    const padB = 42;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    if (!bins || bins.length === 0) return '';

    let maxVal = Math.max(
      ...bins.map((b: any) => Math.max(b.debit || 0, b.need || 0, b.pemeliharaan || 0, Math.max(b.na || 0, 0))),
      avgDebitVal,
      1
    );
    let minVal = Math.min(
      ...bins.map((b: any) => Math.min(b.na || 0, 0)),
      0
    );

    maxVal = maxVal * 1.15;
    if (minVal < 0) minVal = minVal * 1.15;
    const yRange = maxVal - minVal;

    const getY = (val: number) => padT + plotH - ((val - minVal) / yRange) * plotH;
    const zeroY = getY(0);

    // Y-axis grid & labels (5 levels)
    let yGrid = '';
    for (let i = 0; i <= 4; i++) {
      const val = minVal + (yRange * i) / 4;
      const y = getY(val);
      yGrid += `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${(padL + plotW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2,2" />
        <text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#475569" font-family="monospace">${val.toFixed(1)}</text>
      `;
    }

    const barGroupW = plotW / bins.length;
    const barW = 4.8;
    const gap = 1;
    const totalBarsW = 4 * barW + 3 * gap;

    let bars = '';
    bins.forEach((b: any, idx: number) => {
      const centerX = padL + (idx + 0.5) * barGroupW;
      const startX = centerX - totalBarsW / 2;

      const debitVal = b.debit || 0;
      const needVal = b.need || 0;
      const pemVal = b.pemeliharaan || 0;
      const naVal = b.na !== undefined ? b.na : (debitVal - (needVal + pemVal));

      const debitX = startX;
      const needX = startX + barW + gap;
      const pemX = startX + (barW + gap) * 2;
      const naX = startX + (barW + gap) * 3;

      const debitY = getY(Math.max(debitVal, 0));
      const debitH = Math.max(Math.abs(zeroY - debitY), 0.5);

      const needY = getY(Math.max(needVal, 0));
      const needH = Math.max(Math.abs(zeroY - needY), 0.5);

      const pemY = getY(Math.max(pemVal, 0));
      const pemH = Math.max(Math.abs(zeroY - pemY), 0.5);

      const isSurplus = naVal >= 0;
      const naY = isSurplus ? getY(naVal) : zeroY;
      const naH = Math.max(Math.abs(getY(naVal) - zeroY), 0.5);
      const naFill = isSurplus ? "#10b981" : "#dc2626";
      const naStroke = isSurplus ? "#059669" : "#b91c1c";

      const bgAlt = idx % 2 === 0
        ? `<rect x="${(padL + idx * barGroupW).toFixed(1)}" y="${padT}" width="${barGroupW.toFixed(1)}" height="${plotH}" fill="#f8fafc" opacity="0.75" />`
        : '';

      bars += `
        ${bgAlt}
        <!-- 1. Ketersediaan (Debit) -->
        <rect x="${debitX.toFixed(1)}" y="${debitY.toFixed(1)}" width="${barW.toFixed(1)}" height="${debitH.toFixed(1)}" fill="#0284c7" stroke="#0369a1" stroke-width="0.5" rx="1" />
        <!-- 2. Kebutuhan Air -->
        <rect x="${needX.toFixed(1)}" y="${needY.toFixed(1)}" width="${barW.toFixed(1)}" height="${needH.toFixed(1)}" fill="#ef4444" stroke="#b91c1c" stroke-width="0.5" rx="1" />
        <!-- 3. Pemeliharaan Sungai -->
        <rect x="${pemX.toFixed(1)}" y="${pemY.toFixed(1)}" width="${barW.toFixed(1)}" height="${pemH.toFixed(1)}" fill="#f59e0b" stroke="#d97706" stroke-width="0.5" rx="1" />
        <!-- 4. Neraca Air -->
        <rect x="${naX.toFixed(1)}" y="${naY.toFixed(1)}" width="${barW.toFixed(1)}" height="${naH.toFixed(1)}" fill="${naFill}" stroke="${naStroke}" stroke-width="0.5" rx="1" />
        <!-- Periode Label -->
        <text x="${centerX.toFixed(1)}" y="${(padT + plotH + 11).toFixed(1)}" text-anchor="end" font-size="7" font-weight="bold" fill="#1e293b" transform="rotate(-45 ${centerX.toFixed(1)} ${(padT + plotH + 11).toFixed(1)})">${b.name}</text>
      `;
    });

    let refLine = '';
    if (avgDebitVal > 0) {
      const yAvg = getY(avgDebitVal);
      refLine = `
        <line x1="${padL}" y1="${yAvg.toFixed(1)}" x2="${(padL + plotW).toFixed(1)}" y2="${yAvg.toFixed(1)}" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,4" />
        <rect x="${(padL + plotW - 132).toFixed(1)}" y="${(yAvg - 11).toFixed(1)}" width="128" height="10" fill="#0284c7" rx="2" />
        <text x="${(padL + plotW - 68).toFixed(1)}" y="${(yAvg - 3.5).toFixed(1)}" text-anchor="middle" font-size="7" font-weight="bold" fill="#ffffff">Q Rerata = ${avgDebitVal.toFixed(2)} m³/s</text>
      `;
    }

    return `
      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; page-break-inside: avoid; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <div style="font-size: 9.5px; font-weight: bold; color: #0f172a; margin-bottom: 3px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
          <span>Grafik Batang Bulanan Neraca Air (24 Periode)</span>
          <span style="font-size: 8px; color: #475569; font-weight: normal;">Satuan Debit: <strong>m³/detik</strong></span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="215" style="display: block; overflow: visible;">
          <!-- SVG Legend: immune to print color stripping -->
          <g transform="translate(60, 12)">
            <rect x="0" y="0" width="10" height="9" fill="#0284c7" stroke="#0369a1" stroke-width="0.5" rx="1.5" />
            <text x="14" y="7.5" font-size="7.5" font-weight="bold" fill="#0f172a">Ketersediaan (Debit)</text>

            <rect x="132" y="0" width="10" height="9" fill="#ef4444" stroke="#b91c1c" stroke-width="0.5" rx="1.5" />
            <text x="146" y="7.5" font-size="7.5" font-weight="bold" fill="#0f172a">Kebutuhan Air</text>

            <rect x="238" y="0" width="10" height="9" fill="#f59e0b" stroke="#d97706" stroke-width="0.5" rx="1.5" />
            <text x="252" y="7.5" font-size="7.5" font-weight="bold" fill="#0f172a">Pemeliharaan Sungai</text>

            <rect x="375" y="0" width="10" height="9" fill="#10b981" stroke="#047857" stroke-width="0.5" rx="1.5" />
            <text x="389" y="7.5" font-size="7.5" font-weight="bold" fill="#0f172a">Surplus Neraca Air</text>

            <rect x="505" y="0" width="10" height="9" fill="#dc2626" stroke="#991b1b" stroke-width="0.5" rx="1.5" />
            <text x="519" y="7.5" font-size="7.5" font-weight="bold" fill="#0f172a">Defisit Neraca Air</text>
          </g>

          <!-- Grids & Axes -->
          ${yGrid}
          <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${(padL + plotW).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="#334155" stroke-width="1.2" />
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${(padT + plotH).toFixed(1)}" stroke="#64748b" stroke-width="1.2" />
          <text x="16" y="${(padT + plotH / 2).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#334155" font-weight="bold" transform="rotate(-90 16 ${(padT + plotH / 2).toFixed(1)})">Debit &amp; Kebutuhan (m³/s)</text>

          <!-- Bars & Ref Line -->
          ${bars}
          ${refLine}
        </svg>
      </div>
    `;
  };

  const handlePrintYearlyData = () => {
    const selectedRegionObj = regions.find(r => r.id === chartSelectedRegion);
    const regionName = selectedRegionObj?.name || "DAS";
    const regionDesc = selectedRegionObj?.description || "Maluku";
    
    let totalDebit = 0, totalNeed = 0, totalPemeliharaan = 0, totalNA = 0;
    const wetPeriodsList: string[] = [];
    const dryPeriodsList: string[] = [];

    const effectiveBins = chartData.map((bin, idx) => {
      const debitNum = (bulkFormData[idx]?.debit !== undefined && bulkFormData[idx]?.debit !== "")
        ? parseFloat(bulkFormData[idx].debit)
        : (bin.debit || 0);
      const needNum = (bulkFormData[idx]?.need !== undefined && bulkFormData[idx]?.need !== "")
        ? parseFloat(bulkFormData[idx].need)
        : (bin.need || 0);
      const pemeliharaanNum = (bulkFormData[idx]?.pemeliharaan !== undefined && bulkFormData[idx]?.pemeliharaan !== "")
        ? parseFloat(bulkFormData[idx].pemeliharaan)
        : (bin.pemeliharaan || 0);
      const naNum = (bulkFormData[idx]?.na !== undefined && bulkFormData[idx]?.na !== "")
        ? parseFloat(bulkFormData[idx].na)
        : (bin.na !== undefined ? bin.na : (debitNum - (needNum + pemeliharaanNum)));

      totalDebit += debitNum;
      totalNeed += needNum;
      totalPemeliharaan += pemeliharaanNum;
      totalNA += naNum;

      return {
        ...bin,
        debit: debitNum,
        need: needNum,
        pemeliharaan: pemeliharaanNum,
        na: naNum,
      };
    });

    const avgDebit = totalDebit / 24;
    const avgNeed = totalNeed / 24;
    const avgPemeliharaan = totalPemeliharaan / 24;
    const avgNA = totalNA / 24;
    const overallStatus = avgDebit >= (avgNeed + avgPemeliharaan) ? "Surplus" : "Defisit";
    
    let rowsHtml = '';
    effectiveBins.forEach((bin, idx) => {
      const status = bin.debit >= (bin.need + bin.pemeliharaan) ? "Surplus" : "Defisit";
      const isWet = avgDebit > 0 && bin.debit >= avgDebit;

      if (avgDebit > 0) {
        if (isWet) wetPeriodsList.push(bin.name);
        else dryPeriodsList.push(bin.name);
      }
      
      const statusBg = status === "Surplus" ? "#d1fae5" : "#fee2e2";
      const statusColor = status === "Surplus" ? "#065f46" : "#991b1b";
      const seasonLabel = isWet 
        ? '<span style="color: #0369a1; font-weight: bold; background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-size: 8.5px;">Basah</span>' 
        : '<span style="color: #b45309; font-weight: bold; background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 8.5px;">Kering</span>';
      
      rowsHtml += `
        <tr>
          <td style="text-align: center; padding: 3.5px 5px; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding: 3.5px 5px; border: 1px solid #cbd5e1; font-weight: bold;">${bin.name}</td>
          <td style="text-align: right; padding: 3.5px 5px; border: 1px solid #cbd5e1;">${bin.debit.toFixed(2)}</td>
          <td style="text-align: right; padding: 3.5px 5px; border: 1px solid #cbd5e1;">${bin.need.toFixed(2)}</td>
          <td style="text-align: right; padding: 3.5px 5px; border: 1px solid #cbd5e1;">${bin.pemeliharaan.toFixed(2)}</td>
          <td style="text-align: right; padding: 3.5px 5px; border: 1px solid #cbd5e1; font-weight: bold; color: ${bin.na >= 0 ? '#047857' : '#dc2626'};">${bin.na.toFixed(2)}</td>
          <td style="text-align: center; padding: 3.5px 5px; border: 1px solid #cbd5e1; background-color: ${statusBg}; color: ${statusColor}; font-weight: bold;">${status}</td>
          <td style="text-align: center; padding: 3.5px 5px; border: 1px solid #cbd5e1;">${seasonLabel}</td>
        </tr>
      `;
    });

    const chartSvgHtml = buildAdminPrintSvgChart(effectiveBins, avgDebit);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Grafik Bulanan Neraca Air - ${regionName} (${chartYear})</title>
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body { font-family: Arial, sans-serif; margin: 6px 10px; color: #0f172a; font-size: 9px; line-height: 1.3; }
          h2 { text-align: center; font-size: 13px; font-weight: bold; margin: 0 0 2px 0; text-transform: uppercase; color: #0f172a; }
          .subtitle { text-align: center; font-size: 9.5px; color: #475569; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 2px; }
          th { background-color: #1e293b !important; color: #ffffff !important; padding: 3.5px 5px; border: 1px solid #0f172a; font-size: 8.5px; text-transform: uppercase; }
          td { font-size: 8.5px; border: 1px solid #cbd5e1; }
          tfoot tr td { font-weight: bold; background-color: #f8fafc; border: 1px solid #cbd5e1; }
          .season-box { margin-top: 6px; padding: 6px 10px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 8.5px; line-height: 1.45; }
          @media print {
            @page { size: A4 portrait; margin: 7mm; }
          }
        </style>
      </head>
      <body>
        <h2>Grafik Bulanan Neraca Air (24 Periode)</h2>
        <div class="subtitle">DAS: <strong>${regionName}</strong> (${regionDesc}) | Tahun: <strong>${chartYear}</strong></div>

        ${chartSvgHtml}

        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">No</th>
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
          <div>• <strong style="color: #0369a1;">Periode Basah (Debit ≥ Rerata):</strong> ${wetPeriodsList.length > 0 ? wetPeriodsList.join(", ") : "Tidak ada"}</div>
          <div>• <strong style="color: #b45309;">Periode Kering (Debit &lt; Rerata):</strong> ${dryPeriodsList.length > 0 ? dryPeriodsList.join(", ") : "Tidak ada"}</div>
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
    <div className="space-y-6 relative">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Selamat datang, {user?.name ?? "Admin"} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Ringkasan data neraca air wilayah Maluku terkini.
        </p>
      </div>

      {/* Recent data table */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">
            Data Wilayah DAS
          </h2>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsAddRegionModalOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Tambah DAS Baru
            </button>
            <button onClick={fetchData} className="text-xs text-cyan-400 hover:text-cyan-300">
              Segarkan
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">Wilayah DAS</th>
                <th className="px-5 py-3 font-medium">Debit Tersedia</th>
                <th className="px-5 py-3 font-medium">Kebutuhan Air</th>
                <th className="px-5 py-3 font-medium">Periode Terakhir</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-4 text-slate-400">Memuat data...</td></tr>
              ) : regions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-slate-400">Belum ada data wilayah.</td></tr>
              ) : (
                regions.map((e) => (
                  <tr
                    key={e.id}
                    className="text-slate-300 transition hover:bg-white/5"
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-white">
                      {e.name}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">{e.latestData?.debit_air ? `${e.latestData.debit_air} m³/s` : '-'}</td>
                    <td className="whitespace-nowrap px-5 py-3">{e.latestData?.kebutuhan_air ? `${e.latestData.kebutuhan_air} m³/s` : '-'}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {e.latestData?.period ? (
                        new Date(e.latestData.period).getUTCDate() < 15 
                          ? `Periode 1 (${new Date(e.latestData.period).toLocaleDateString('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' })})`
                          : `Periode 2 (${new Date(e.latestData.period).toLocaleDateString('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' })})`
                      ) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {e.latestData?.status ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            e.latestData.status === "Surplus"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {e.latestData.status}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right flex justify-end gap-2">
                      <button
                        onClick={() => openInputModal(e)}
                        className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                        Input Data
                      </button>
                      
                      <button
                        onClick={() => openWaterUsersModal(e)}
                        className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        Pengguna Air
                      </button>

                      <label className="cursor-pointer inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" x2="12" y1="3" y2="15"></line></svg>
                        Upload PDF
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            
                            const formData = new FormData();
                            formData.append("file", file);
                            formData.append("regionId", e.id);
                            
                            try {
                              const res = await fetch("/api/upload", {
                                method: "POST",
                                body: formData,
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert("Upload berhasil!");
                              } else {
                                alert("Gagal upload: " + data.error);
                              }
                            } catch (error) {
                              alert("Terjadi kesalahan sistem saat upload.");
                            }
                          }}
                        />
                      </label>
                      <label className="cursor-pointer inline-flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" x2="8" y1="2" y2="18"></line><line x1="16" x2="16" y1="6" y2="22"></line></svg>
                        Poligon DAS
                        <input
                          type="file"
                          accept=".zip,.json,.geojson,.shp"
                          className="hidden"
                          onChange={(ev) => handleUploadShapefile(ev, ev.target.files?.[0], e.id, "das")}
                        />
                      </label>
                      <label className="cursor-pointer inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500" title="Unggah Tutupan Lahan">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 4.1c.42.31.68.8.68 1.33v6.76c0 .54-.26 1.03-.68 1.33l-5.66 4.1a1.64 1.64 0 0 1-1.92 0l-5.66-4.1c-.42-.3-.68-.8-.68-1.33V8.12c0-.54.26-1.03.68-1.33l5.66-4.1a1.64 1.64 0 0 1 1.92 0Z"></path></svg>
                        Tutupan Lahan
                        <input
                          type="file"
                          accept=".zip,.json,.geojson,.shp"
                          className="hidden"
                          onChange={(ev) => handleUploadShapefile(ev, ev.target.files?.[0], e.id, "landcover")}
                        />
                      </label>
                      <label className="cursor-pointer inline-flex items-center gap-1 rounded bg-amber-700 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600" title="Unggah Jenis Tanah">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>
                        Jenis Tanah
                        <input
                          type="file"
                          accept=".zip,.json,.geojson,.shp"
                          className="hidden"
                          onChange={(ev) => handleUploadShapefile(ev, ev.target.files?.[0], e.id, "soiltype")}
                        />
                      </label>
                      <label className="cursor-pointer inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500" title="Unggah Jaringan Sungai">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                        Sungai
                        <input
                          type="file"
                          accept=".zip,.json,.geojson,.shp"
                          className="hidden"
                          onChange={(ev) => handleUploadShapefile(ev, ev.target.files?.[0], e.id, "river")}
                        />
                      </label>
                      <button
                        onClick={() => handleDeleteRegion(e.id, e.name)}
                        className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
                        title="Hapus DAS"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 px-5 py-4 gap-4">
          <h2 className="text-lg font-semibold text-white">
            Grafik Bulanan Neraca Air (24 Periode)
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={openBulkEditModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-teal-500 shadow-md shadow-teal-900/40 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
              Input Data Setahun
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
              title="Unduh Data Grafik 24 Periode (CSV/Excel)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Unduh CSV
            </button>

            <button
              onClick={handlePrintYearlyData}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-md shadow-cyan-900/40 cursor-pointer"
              title="Cetak PDF / Print Laporan Grafik 24 Periode"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Cetak PDF
            </button>

            <select 
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
              value={chartSelectedRegion}
              onChange={(e) => setChartSelectedRegion(e.target.value)}
            >
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select 
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
              value={chartYear}
              onChange={(e) => setChartYear(e.target.value)}
            >
              <option value="2023">Tahun 2023</option>
              <option value="2024">Tahun 2024</option>
              <option value="2025">Tahun 2025</option>
              <option value="2026">Tahun 2026</option>
              <option value="2027">Tahun 2027</option>
              <option value="2028">Tahun 2028</option>
              <option value="2029">Tahun 2029</option>
              <option value="2030">Tahun 2030</option>
            </select>
          </div>
        </div>
        
        <div className="p-5" id="admin-chart-container">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                barSize={16}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                {chartSummary.avgDebit > 0 && (
                  <ReferenceLine 
                    y={chartSummary.avgDebit} 
                    stroke="#0284c7" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{
                      value: `Batas Rerata (${chartSummary.avgDebit} m³/s)`,
                      position: 'top',
                      fill: '#38bdf8',
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  />
                )}
                <XAxis 
                  dataKey="name" 
                  tick={{fill: '#94a3b8', fontSize: 11}} 
                  angle={-45} 
                  textAnchor="end"
                  interval={0}
                  tickMargin={10}
                />
                <YAxis tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  cursor={{ fill: '#1e293b' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      const avgDebit = chartSummary.avgDebit || 0;
                      const isWet = avgDebit > 0 && data.debit >= avgDebit;
                      return (
                        <div className="p-3.5 rounded-2xl shadow-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md text-xs space-y-2 min-w-[210px]">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-1 gap-2">
                            <span className="font-bold text-slate-100 text-sm">{label}</span>
                            {data.hasData && avgDebit > 0 && (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isWet ? 'bg-blue-900/60 text-blue-200' : 'bg-amber-900/60 text-amber-200'
                              }`}>
                                {isWet ? 'Periode Basah' : 'Periode Kering'}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-300">
                              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#0ea5e9]"></span>Ketersediaan:</span>
                              <span className="font-bold text-white">{data.debit} m³/s</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#ef4444]"></span>Kebutuhan:</span>
                              <span className="font-bold text-white">{data.need} m³/s</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#f59e0b]"></span>Pemeliharaan:</span>
                              <span className="font-bold text-white">{data.pemeliharaan} m³/s</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-1.5">
                              <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#10b981]"></span>Neraca Air:</span>
                              <span className={`font-bold ${data.na >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {data.na} m³/s ({data.debit >= (data.need + data.pemeliharaan) ? 'Surplus' : 'Defisit'})
                              </span>
                            </div>
                            {avgDebit > 0 && (
                              <div className="text-[11px] text-slate-400 pt-1 border-t border-dashed border-slate-800 flex justify-between">
                                <span>Batas Rerata Tahunan:</span>
                                <span className="font-semibold text-slate-300">{avgDebit} m³/s</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{paddingTop: '25px'}} formatter={(value) => <span className="text-slate-300 ml-1">{value === 'debit' ? 'Ketersediaan (Debit)' : value === 'need' ? 'Kebutuhan Air' : value === 'pemeliharaan' ? 'Pemeliharaan Sungai' : 'Neraca Air (NA)'}</span>} />
                <Bar dataKey="debit" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={11} name="debit" />
                <Bar dataKey="need" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={11} name="need" />
                <Bar dataKey="na" fill="#10b981" radius={[4, 4, 0, 0]} barSize={11} name="na" />
                <Bar dataKey="pemeliharaan" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={11} name="pemeliharaan" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Summary Notes & Wet/Dry Season Analysis */}
          {(chartSummary.hasData || chartSummary.defisit.length > 0 || chartSummary.surplus.length > 0) && (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200">
                  Analisis Periode & Neraca Air Tahun {chartYear}:
                </h4>
                {chartSummary.avgDebit > 0 && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                    Rerata Debit Tahunan: {chartSummary.avgDebit} m³/s
                  </span>
                )}
              </div>

              {/* Wet & Dry Season Badges */}
              {chartSummary.avgDebit > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-950/40 border border-blue-800/60 p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <h5 className="text-sm font-bold text-blue-300">
                        Periode Basah (Q ≥ {chartSummary.avgDebit} m³/s)
                      </h5>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900 text-blue-200">
                        {chartSummary.wetPeriods.length} Periode
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {chartSummary.wetPeriods.length > 0 ? chartSummary.wetPeriods.join(", ") : "Tidak ada periode basah teridentifikasi"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-amber-950/40 border border-amber-800/60 p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <h5 className="text-sm font-bold text-amber-300">
                        Periode Kering (Q &lt; {chartSummary.avgDebit} m³/s)
                      </h5>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900 text-amber-200">
                        {chartSummary.dryPeriods.length} Periode
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {chartSummary.dryPeriods.length > 0 ? chartSummary.dryPeriods.join(", ") : "Tidak ada periode kering teridentifikasi"}
                    </p>
                  </div>
                </div>
              )}

              {/* Extremes info */}
              {chartSummary.maxDebit > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/70 border border-slate-800 p-2.5 rounded-xl">
                  <span>Puncak Maksimum: <strong className="text-blue-400">{chartSummary.maxDebit} m³/s</strong> ({chartSummary.maxPeriod})</span>
                  <span>Debit Terendah: <strong className="text-amber-400">{chartSummary.minDebit} m³/s</strong> ({chartSummary.minPeriod})</span>
                </div>
              )}
              
              {chartSummary.defisit.length > 0 && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-rose-500/20 p-1 text-rose-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-rose-400">Terpantau Defisit Neraca Air</h5>
                      <p className="text-sm text-slate-400 mt-1">
                        Kebutuhan air melebihi ketersediaan pada: <span className="font-semibold text-rose-300">{chartSummary.defisit.join(", ")}</span>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {chartSummary.surplus.length > 0 && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1 text-emerald-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-emerald-400">Terpantau Surplus Neraca Air</h5>
                      <p className="text-sm text-slate-400 mt-1">
                        Ketersediaan air mencukupi kebutuhan pada seluruh periode tahun {chartYear}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Data Modal */}
      {isModalOpen && selectedRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-1">Input Data Neraca Air</h3>
            <p className="text-sm text-slate-400 mb-6">Wilayah: {selectedRegion.name}</p>

            <form onSubmit={handleInputSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Bulan & Tahun</label>
                  <input
                    type="month"
                    required
                    value={formData.periodMonth}
                    onChange={(e) => setFormData({ ...formData, periodMonth: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Periode Ke-</label>
                  <select
                    value={formData.periodCycle}
                    onChange={(e) => setFormData({ ...formData, periodCycle: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="1">Periode 1 (Tgl 1 - 15)</option>
                    <option value="2">Periode 2 (Tgl 16 - 31)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Ketersediaan (m³/s)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.debit_air}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val);
                      const autoPemeliharaan = !isNaN(num) ? (num * 0.095).toFixed(2) : "";
                      setFormData(prev => ({
                        ...prev,
                        debit_air: val,
                        pemeliharaan_sungai: prev.pemeliharaan_sungai && prev.pemeliharaan_sungai !== "" ? prev.pemeliharaan_sungai : autoPemeliharaan
                      }));
                    }}
                    placeholder="Contoh: 150.5"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Kebutuhan (m³/s)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.kebutuhan_air}
                    onChange={(e) => setFormData({ ...formData, kebutuhan_air: e.target.value })}
                    placeholder="Contoh: 85.2"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Pemeliharaan Sungai (m³/s)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.pemeliharaan_sungai}
                    onChange={(e) => setFormData({ ...formData, pemeliharaan_sungai: e.target.value })}
                    placeholder="Otomatis: 0.095 x Debit"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <p className="text-[11px] text-amber-400 mt-1">Otomatis dihitung = 0.095 × Debit (dapat diubah manual jika perlu).</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Neraca Air (NA) (m³/s)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.neraca_air}
                    onChange={(e) => setFormData({ ...formData, neraca_air: e.target.value })}
                    placeholder="Opsional (Otomatis: Debit - Kebutuhan - Pemeliharaan)"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Kosongkan jika ingin dihitung otomatis dari (Ketersediaan - Kebutuhan - Pemeliharaan).</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition shadow-lg shadow-cyan-900/50"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Region Modal */}
      {isAddRegionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Tambah DAS Baru</h3>
            <form onSubmit={handleAddRegionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nama DAS</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DAS Kapuas"
                  value={newRegionData.name}
                  onChange={(e) => setNewRegionData({ ...newRegionData, name: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Keterangan / Lokasi</label>
                <input
                  type="text"
                  placeholder="Contoh: Kab. Kapuas"
                  value={newRegionData.description}
                  onChange={(e) => setNewRegionData({ ...newRegionData, description: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddRegionModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/50"
                >
                  Simpan DAS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                  <span>📅</span> Input Data Setahun (24 Periode)
                </h3>
                <p className="text-sm text-slate-400">
                  Wilayah: <strong className="text-slate-200">{regions.find(r => r.id === chartSelectedRegion)?.name}</strong> | Tahun: <strong className="text-slate-200">{chartYear}</strong>
                </p>
              </div>

              {/* Action Buttons: Cetak PDF & Unduh CSV */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                  title="Unduh Data Setahun Format CSV (Excel)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Unduh CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintYearlyData}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-900/40 cursor-pointer"
                  title="Cetak PDF / Print Laporan 24 Periode Setahun"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Cetak PDF</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form id="bulk-form" onSubmit={handleBulkSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {chartData.map((bin, index) => (
                    <div key={index} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                      <h4 className="text-sm font-bold text-slate-300 mb-3 border-b border-slate-700 pb-2">{bin.name}</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Ketersediaan (m³/s)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={bulkFormData[index].debit}
                            onChange={(e) => handleBulkChange(index, "debit", e.target.value)}
                            placeholder="0"
                            className="w-full rounded-md bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Kebutuhan (m³/s)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={bulkFormData[index].need}
                            onChange={(e) => handleBulkChange(index, "need", e.target.value)}
                            placeholder="0"
                            className="w-full rounded-md bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Pemeliharaan (m³/s)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={bulkFormData[index].pemeliharaan}
                            onChange={(e) => handleBulkChange(index, "pemeliharaan", e.target.value)}
                            placeholder="0"
                            className="w-full rounded-md bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-400 mb-1">Neraca Air / NA (m³/s)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={bulkFormData[index].na}
                            onChange={(e) => handleBulkChange(index, "na", e.target.value)}
                            placeholder="Otomatis"
                            className="w-full rounded-md bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            </div>
            
            <div className="p-5 border-t border-slate-800 shrink-0 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintYearlyData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Cetak PDF</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="bulk-form"
                  disabled={isSavingBulk}
                  className="rounded-lg bg-teal-600 px-6 py-2 text-sm font-bold text-white hover:bg-teal-500 transition shadow-lg shadow-teal-900/50 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingBulk ? 'Menyimpan...' : 'Simpan 24 Periode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Water Users Modal */}
      {isWaterUsersModalOpen && selectedRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 shrink-0 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Kelola Pengguna Air</h3>
                <p className="text-sm text-slate-400">Wilayah: {selectedRegion.name}</p>
              </div>
              <button
                onClick={() => setIsWaterUsersModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Form Tambah */}
              <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                <h4 className="text-sm font-bold text-white mb-4">Tambah Titik Baru</h4>
                <form onSubmit={handleAddWaterUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nama Pengguna Air</label>
                    <input
                      type="text"
                      required
                      value={newWaterUser.name}
                      onChange={(e) => setNewWaterUser({ ...newWaterUser, name: e.target.value })}
                      placeholder="Contoh: PDAM Wai Ruhu"
                      className="w-full rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newWaterUser.latitude}
                      onChange={(e) => setNewWaterUser({ ...newWaterUser, latitude: e.target.value })}
                      placeholder="-3.65"
                      className="w-full rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newWaterUser.longitude}
                      onChange={(e) => setNewWaterUser({ ...newWaterUser, longitude: e.target.value })}
                      placeholder="128.18"
                      className="w-full rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Kebutuhan Air (m³/s)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newWaterUser.kebutuhan}
                      onChange={(e) => setNewWaterUser({ ...newWaterUser, kebutuhan: e.target.value })}
                      placeholder="Contoh: 15.5"
                      className="w-full rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end mt-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/50"
                    >
                      Tambah Titik
                    </button>
                  </div>
                </form>
              </div>

              {/* Daftar Pengguna */}
              <div>
                <h4 className="text-sm font-bold text-white mb-4">Daftar Titik Pengguna Air</h4>
                {waterUsers.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Belum ada data titik pengguna air di wilayah ini.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-700">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-800 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Nama</th>
                          <th className="px-4 py-3">Koordinat</th>
                          <th className="px-4 py-3">Kebutuhan Air</th>
                          <th className="px-4 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50 bg-slate-900/50">
                        {waterUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-white">{user.name}</td>
                            <td className="px-4 py-3 text-slate-300">
                              <span className="text-slate-500">Lat:</span> {user.latitude} <br/>
                              <span className="text-slate-500">Lng:</span> {user.longitude}
                            </td>
                            <td className="px-4 py-3 text-slate-300 font-medium">{user.kebutuhan} m³/s</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDeleteWaterUser(user.id)}
                                className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
