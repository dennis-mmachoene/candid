/**
 * Stub for the `server-only` package.
 *
 * That package deliberately throws when imported outside a React Server
 * Component, which is exactly what we want in the app and exactly what breaks a
 * plain Node test runner. vitest.config.ts aliases it here so infrastructure
 * modules can be unit-tested.
 *
 * This does not weaken the guard: the alias applies only to vitest. In a real
 * build, importing `lib/infrastructure/env.ts` from a Client Component is still
 * a build error.
 */
export {};
