import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The evaluation harness, kept deliberately apart from the test suite.
 *
 * `npm test` gates the build. It must stay fast, offline and deterministic, so
 * a regression turns it red and nothing else does.
 *
 * Evaluation is the opposite kind of thing. It reads 2484 real PDFs off disk,
 * and one of its runs calls a paid API over the network. It is slow, it depends
 * on data that is not in the repository, and it can fail for reasons that say
 * nothing about whether the code is correct. A failed evaluation must never
 * block a merge, so it gets its own config and its own command.
 *
 * The two aliases are copied from vitest.config.ts for the same reasons given
 * there: `@` for the path alias the app uses, and `server-only` stubbed so that
 * infrastructure modules can be imported outside a React Server Component.
 */

/**
 * Read .env.local the way Next.js does, because Vitest does not.
 *
 * `npm run dev` loads .env.local on its own. Vitest loads nothing at all, so
 * without this the Measurement 4 run finds no ANTHROPIC_API_KEY, skips itself
 * and reports a pass. That is the worst outcome available: a measurement that
 * quietly did not happen looks identical to one that succeeded, and the number
 * it was supposed to produce gets quoted anyway.
 *
 * Deliberately minimal. It does not expand `${VAR}` references, handle values
 * spanning several lines, or strip a trailing `# comment` from a value. The
 * file it reads is written by `vercel env pull`, which produces none of those.
 *
 * Anything already present in the real environment wins, so a key exported on
 * the command line still overrides the file, and CI is unaffected.
 */
function loadLocalEnv(): Record<string, string> {
  const found: Record<string, string> = {};
  const assignment = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

  // Later files win, matching the order Next.js applies them.
  for (const file of ['.env', '.env.local']) {
    let contents: string;

    try {
      contents = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    } catch {
      // A missing file is the normal case for at least one of these.
      continue;
    }

    for (const line of contents.split(/\r?\n/)) {
      const match = assignment.exec(line);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;

      // Strip one matching pair of surrounding quotes, nothing cleverer.
      found[key] = rawValue.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
    }
  }

  return found;
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['evaluation/**/*.eval.ts'],
    env: loadLocalEnv(),

    // The default five-second budget is meaningless here. Parsing 2484 PDFs
    // takes minutes, and the tailoring run waits on a model.
    testTimeout: 45 * 60 * 1000,
    hookTimeout: 10 * 60 * 1000,

    // One file at a time. The AI run is rate limited, and interleaved progress
    // output from parallel files is unreadable when you are watching it.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./tests/stubs/server-only.ts', import.meta.url),
      ),
    },
  },
});
