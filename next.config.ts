import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // hasil Simulasi HEC-HMS (data/hms) dibaca API lewat fs - ikutkan ke paket server Vercel
  outputFileTracingIncludes: {
    '/api/hms': ['./data/hms/**/*'],
    '/api/hms/*': ['./data/hms/**/*'],
    '/api/hms/*/unduh': ['./data/hms/**/*'],
    '/api/hms/*/data': ['./data/hms/**/*'],
  },
  allowedDevOrigins: ['southampton-reggae-tires-responded.trycloudflare.com'],
  experimental: {
    proxyClientMaxBodySize: '1000mb',
    serverActions: {
      bodySizeLimit: '1000mb',
    },
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/uploads/:path*',
          destination: '/api/file-proxy/uploads/:path*'
        },
        {
          source: '/geojson/:path*',
          destination: '/api/file-proxy/geojson/:path*'
        }
      ]
    };
  },
};

export default nextConfig;
