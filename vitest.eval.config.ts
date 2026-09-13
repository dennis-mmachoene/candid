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
export default defineConfig({
  test: {
    environment: 'node',
    include: ['evaluation/**/*.eval.ts'],

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
