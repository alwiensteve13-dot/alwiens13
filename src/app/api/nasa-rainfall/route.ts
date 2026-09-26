import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow longer execution time for Vercel if deployed

export async function POST(request: Request) {
  try {
    const { lat, lon, startDate, endDate } = await request.json();

    if (lat === undefined || lon === undefined) {
      return NextResponse.json({ error: 'Latitude and Longitude are required' }, { status: 400 });
    }

    // Validasi input agar hanya angka koordinat & tanggal yang diteruskan ke NASA
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
      return NextResponse.json({ error: 'Invalid latitude/longitude' }, { status: 400 });
    }

    const start = startDate || '20000101';
    const end = endDate || '20251231';
    if (!/^\d{8}$/.test(String(start)) || !/^\d{8}$/.test(String(end))) {
      return NextResponse.json({ error: 'Invalid date format (YYYYMMDD)' }, { status: 400 });
    }

    // NASA POWER API URL for daily point data
    // parameters: PRECTOTCORR = Precipitation Corrected
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=RE&longitude=${lonNum}&latitude=${latNum}&start=${start}&end=${end}&format=CSV`;

    console.log(`Fetching NASA data: ${url}`);
    
    // We add a timeout since NASA API can sometimes be slow for 25 years
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: 'Failed to fetch data from NASA API', details: errorText }, { status: response.status });
    }

    const csvText = await response.text();
    
    return new NextResponse(csvText, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="nasa_rainfall_${start}_${end}.csv"`
      }
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'NASA API Request timed out after 2 minutes. Try smaller date range.' }, { status: 504 });
    }
    console.error('NASA FETCH ERROR:', error, error.cause);
    return NextResponse.json({ error: 'Gagal menghubungi server NASA. ' + (error.cause?.message || error.message) }, { status: 500 });
  }
}
