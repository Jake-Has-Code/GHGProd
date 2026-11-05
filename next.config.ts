import type { NextConfig } from 'next';
const containerBuild = process.env.GHG_CONTAINER_BUILD === 'true';
const nextConfig: NextConfig = {
  ...(containerBuild ? { output: 'standalone', distDir: '.next-container' } : {}),
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};
export default nextConfig;
