import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * The dependency rule, made mechanical.
 *
 * `lib/domain` holds the two guarantees. It stays pure so those rules can be
 * tested without a network, a database or an API key — and so that swapping the
 * AI provider cannot quietly change what counts as fabrication. Reviewers
 * forget; lint does not.
 */
const domainPurityRule = {
  files: ['lib/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['next', 'next/*'],
            message:
              'lib/domain must stay framework-free. Move this into app/ or lib/infrastructure/.',
          },
          {
            group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
            message: 'lib/domain must stay framework-free.',
          },
          {
            group: ['@supabase/*', '@anthropic-ai/*'],
            message:
              'lib/domain must not import a vendor SDK. Depend on a port in lib/domain/ports.ts and implement it in lib/infrastructure/.',
          },
          {
            group: [
              'zod',
              'unpdf',
              'mammoth',
              'pdf-lib',
              'docx',
              'crypto',
              'node:crypto',
              'fs',
              'node:fs',
            ],
            message:
              'lib/domain must stay free of I/O and third-party parsing. Do this at the infrastructure boundary instead.',
          },
          {
            group: [
              '**/infrastructure/**',
              '@/lib/infrastructure/*',
              '../infrastructure/*',
              '../../infrastructure/*',
            ],
            message:
              'The dependency rule points inward: infrastructure may import domain, never the reverse.',
          },
        ],
      },
    ],
  },
};

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  domainPurityRule,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
