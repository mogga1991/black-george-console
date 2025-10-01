import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { 
    serverActions: { allowedOrigins: ['*'] }
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  reactStrictMode: false,
};

export default nextConfig;
