import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove static export for API routes to work properly
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
  // Configure for Cloudflare Pages deployment
  experimental: {
    runtime: 'edge',
  },
};

export default nextConfig;
