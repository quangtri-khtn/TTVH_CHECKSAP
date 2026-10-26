import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Required for apps/web/Dockerfile — bundles server + minimal node_modules
  // into .next/standalone instead of shipping the full node_modules tree.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
    proxyTimeout: 300_000,
  },
  async rewrites() {
    const backendUrl = process.env.API_INTERNAL_URL || 'http://localhost:3001';
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
