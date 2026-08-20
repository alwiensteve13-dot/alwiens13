import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
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
