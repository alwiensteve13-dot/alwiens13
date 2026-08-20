"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

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

      const combined = regionsData.map(region => {
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
      
      const res = await fetch("/api/upload-geojson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: regionId,
          geojson,
          type
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`File ${type} berhasil diunggah!`);
      } else {
        alert("Gagal unggah: " + data.error);
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

      if (res.ok) {
        setIsAddRegionModalOpen(false);
        setNewRegionData({ name: "", description: "" });
        fetchData();
        alert("DAS berhasil ditambahkan!");
      } else {
        const errorData = await res.json();
        alert("Gagal menambahkan DAS: " + errorData.error);
      }
    } catch (error) {
      alert("Terjadi kesalahan sistem saat menyimpan DAS.");
    }
  };

  const handleDeleteRegion = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus DAS ${name}? Data neraca air dan poligon yang terkait mungkin ikut terhapus.`)) return;

    try {
      const res = await fetch(`/api/regions?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("DAS berhasil dihapus!");
        fetchData(); // Refresh data
      } else {
        const errorData = await res.json();
        alert("Gagal menghapus DAS: " + errorData.error);
      }
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
        }
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

  const handlePrintYearlyData = async () => {
    const selectedRegionObj = regions.find(r => r.id === chartSelectedRegion);
    const regionName = selectedRegionObj?.name || "DAS";
    const regionDesc = selectedRegionObj?.description || "Maluku";
    
    let chartImgHtml = '';
    const chartContainer = document.getElementById("admin-chart-container");
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
        console.warn("Failed to capture chart image for print:", err);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let rowsHtml = '';
    let totalDebit = 0, totalNeed = 0, totalPemeliharaan = 0, totalNA = 0;
    
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
      
      totalDebit += debitNum;
      totalNeed += needNum;
      totalPemeliharaan += pemeliharaanNum;
      totalNA += naNum;
      
      const statusBg = status === "Surplus" ? "#d1fae5" : "#fee2e2";
      const statusColor = status === "Surplus" ? "#065f46" : "#991b1b";
      
      rowsHtml += `
        <tr>
          <td style="text-align: center; padding: 3px 5px; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding: 3px 5px; border: 1px solid #cbd5e1; font-weight: bold;">${bin.name}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1;">${debitNum.toFixed(2)}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1;">${needNum.toFixed(2)}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1;">${pemeliharaanNum.toFixed(2)}</td>
          <td style="text-align: right; padding: 3px 5px; border: 1px solid #cbd5e1; font-weight: bold; color: ${naNum >= 0 ? '#047857' : '#dc2626'};">${naNum.toFixed(2)}</td>
          <td style="text-align: center; padding: 3px 5px; border: 1px solid #cbd5e1; background-color: ${statusBg}; color: ${statusColor}; font-weight: bold;">${status}</td>
        </tr>
      `;
    });
    
    const avgDebit = totalDebit / 24;
    const avgNeed = totalNeed / 24;
    const avgPemeliharaan = totalPemeliharaan / 24;
    const avgNA = totalNA / 24;
    const overallStatus = avgDebit >= (avgNeed + avgPemeliharaan) ? "Surplus" : "Defisit";

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
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
          }
        </style>
      </head>
      <body>
        <h2>Grafik Bulanan Neraca Air (24 Periode)</h2>
        <div class="subtitle">DAS: <strong>${regionName}</strong> (${regionDesc}) | Tahun: <strong>${chartYear}</strong></div>

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
              <th style="text-align: center;">Status</th>
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
            </tr>
          </tfoot>
        </table>

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
    
    chartData.forEach(bin => {
      if (bin.hasData) {
        if (bin.debit >= (bin.need + bin.pemeliharaan)) {
          surplus.push(bin.name);
        } else {
          defisit.push(bin.name);
        }
      }
    });
    
    return { surplus, defisit };
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
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>📊</span> Grafik Bulanan Neraca Air (24 Periode)
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
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  formatter={(value: any, name: any) => [
                    `${value} m³/s`, 
                    name === 'debit' ? 'Ketersediaan' : name === 'need' ? 'Kebutuhan' : name === 'pemeliharaan' ? 'Pemeliharaan' : 'Neraca Air (NA)'
                  ]}
                />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{paddingTop: '25px'}} formatter={(value) => <span className="text-slate-300 ml-1">{value === 'debit' ? 'Ketersediaan (Debit)' : value === 'need' ? 'Kebutuhan Air' : value === 'pemeliharaan' ? 'Pemeliharaan Sungai' : 'Neraca Air (NA)'}</span>} />
                <Bar dataKey="debit" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={11} name="debit" />
                <Bar dataKey="need" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={11} name="need" />
                <Bar dataKey="na" fill="#10b981" radius={[4, 4, 0, 0]} barSize={11} name="na" />
                <Bar dataKey="pemeliharaan" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={11} name="pemeliharaan" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Summary Notes */}
          {(chartSummary.defisit.length > 0 || chartSummary.surplus.length > 0) && (
            <div className="mt-6 flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-slate-300">Catatan Analisis Tahun {chartYear}:</h4>
              
              {chartSummary.defisit.length > 0 && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-rose-500/20 p-1 text-rose-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-rose-400">Terpantau Defisit</h5>
                      <p className="text-sm text-slate-400 mt-1">
                        Kebutuhan air melebihi ketersediaan pada: <span className="font-semibold text-rose-300">{chartSummary.defisit.join(", ")}</span>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {chartSummary.surplus.length > 0 && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1 text-emerald-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-emerald-400">Terpantau Surplus</h5>
                      <p className="text-sm text-slate-400 mt-1">
                        Ketersediaan air mencukupi pada: <span className="font-semibold text-emerald-300">{chartSummary.surplus.join(", ")}</span>.
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
