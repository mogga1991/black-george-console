import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { 
    serverActions: { allowedOrigins: ['*'] },
    turbo: {
      root: '/Users/georgemogga/Desktop/黑男孩应用/cre-console'
    }
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
