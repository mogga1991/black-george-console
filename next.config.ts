import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Commented out for Cloudflare Pages deployment
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
