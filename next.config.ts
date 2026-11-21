import type { NextConfig } from 'next';

import { STATIC_SECURITY_HEADERS } from './lib/infrastructure/security-headers';

const nextConfig: NextConfig = {
  // Nothing gains from advertising the framework and version to a scanner.
  poweredByHeader: false,
  reactStrictMode: true,

  /**
   * Phones and tablets on the same network, for `next dev` only.
   *
   * Next refuses cross-origin requests to /_next/* from an address it was not
   * told about, which is what blocks opening the dev server on a real phone.
   * The private ranges below are the ones a home or office router hands out.
   *
   * This is a development setting and Next ignores it in a production build,
   * so it does not widen anything a user could reach. Testing on a real phone
   * is worth having: an emulator will not show you a thumb reach problem or
   * how the layout behaves with the on-screen keyboard open.
   */
  allowedDevOrigins: [
    '192.168.0.*',
    '192.168.1.*',
    '192.168.8.*',
    '192.168.56.*',
    '192.168.100.*',
    '10.0.0.*',
    '172.20.10.*',
  ],

  /**
   * Stale links into the removed job board.
   *
   * Candid is a tool for one person and one document: upload a CV, tailor it
   * to an advert, see what was traced and what was refused, export it. An
   * in-house job board and an employer side were a second product bolted to
   * the side of that, and nothing could verify that an employer worked
   * anywhere they claimed, which made it a liability rather than a feature.
   *
   * The pages, the actions, the repository and the components are deleted.
   * These redirects exist only so a link someone saved while the board was
   * live lands somewhere useful instead of on a 404. The four tables are
   * still in the database, because dropping them destroys rows and no code
   * reads them any more.
   */
  async redirects() {
    return [
      { source: '/jobs', destination: '/dashboard', permanent: false },
      { source: '/jobs/:path*', destination: '/dashboard', permanent: false },
      { source: '/hiring', destination: '/dashboard', permanent: false },
      { source: '/hiring/:path*', destination: '/dashboard', permanent: false },
      { source: '/applications', destination: '/dashboard', permanent: false },
      { source: '/onboarding', destination: '/dashboard', permanent: false },
    ];
  },

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
