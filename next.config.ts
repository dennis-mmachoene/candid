import type { NextConfig } from 'next';

import { STATIC_SECURITY_HEADERS } from './lib/infrastructure/security-headers';

const nextConfig: NextConfig = {
  // Nothing gains from advertising the framework and version to a scanner.
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        // The Content-Security-Policy is not here. It carries a per-request
        // nonce, so it is built in middleware. Everything in this list is the
        // same on every response, so it belongs at the edge of the config
        // rather than recomputed on each request.
        source: '/:path*',
        headers: [...STATIC_SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
