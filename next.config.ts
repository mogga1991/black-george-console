import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { 
    serverActions: { allowedOrigins: ['*'] } 
  },
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
