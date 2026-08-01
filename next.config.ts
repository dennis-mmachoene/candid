import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Nothing gains from advertising the framework and version to a scanner.
  // Full security headers and CSP land in Phase 5 (M7).
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
