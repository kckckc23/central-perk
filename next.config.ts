import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The map library is client-only; no server-side canvas dependencies needed.
  reactStrictMode: true,
};

export default nextConfig;
