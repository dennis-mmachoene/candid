/**
 * Tests for the Content Security Policy and the static security headers.
 *
 * A CSP is easy to write and easy to write wrongly, and the failure is silent:
 * a policy with `'unsafe-inline'` in `script-src` looks like a CSP, reports
 * like a CSP, and stops nothing. These assert the directives that actually
 * carry weight rather than that a header exists.
 */

import { describe, expect, it } from 'vitest';

import {
  NOINDEX_HEADER,
  STATIC_SECURITY_HEADERS,
  buildCsp,
} from '@/lib/infrastructure/security-headers';

function directive(header: string, name: string): string {
  const found = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name);
  return found ?? '';
}

describe('Content Security Policy', () => {
  const production = buildCsp(false);
  const development = buildCsp(true);

  it('generates a fresh nonce every time', () => {
    const nonces = new Set(
      Array.from({ length: 25 }, () => buildCsp(false).nonce),
    );
    expect(nonces.size).toBe(25);
  });

  it('puts the nonce in the policy it returns', () => {
    expect(production.header).toContain(`'nonce-${production.nonce}'`);
  });

  /**
   * The single most important assertion in this file. A CSP with
   * `'unsafe-inline'` in `script-src` is decoration.
   */
  it('never allows inline script', () => {
    const scriptSrc = directive(production.header, 'script-src');
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it('does not allow eval in production', () => {
    expect(directive(production.header, 'script-src')).not.toContain(
      "'unsafe-eval'",
    );
  });

  /**
   * React uses eval in development to rebuild server-side error stacks in the
   * browser. Refusing it there makes debugging miserable and protects nobody,
   * since a development server is not exposed.
   */
  it('allows eval in development only', () => {
    expect(directive(development.header, 'script-src')).toContain(
      "'unsafe-eval'",
    );
  });

  it('blocks framing, plugins and base tag rewriting', () => {
    expect(production.header).toContain("frame-ancestors 'none'");
    expect(production.header).toContain("object-src 'none'");
    expect(production.header).toContain("base-uri 'self'");
  });

  it('restricts where forms may post', () => {
    const formAction = directive(production.header, 'form-action');
    expect(formAction).toContain("'self'");
    // Sign-in is a form submission that ends in a redirect to Google.
    expect(formAction).toContain('https://accounts.google.com');
  });

  it('allows Supabase and nothing else to be connected to', () => {
    const connectSrc = directive(production.header, 'connect-src');
    expect(connectSrc).toContain('https://*.supabase.co');
    expect(connectSrc).toContain('wss://*.supabase.co');
    expect(connectSrc).not.toContain('*;');
    expect(connectSrc).not.toContain("'unsafe");
  });

  it('upgrades insecure requests in production only', () => {
    expect(production.header).toContain('upgrade-insecure-requests');
    // On localhost there is no HTTPS to upgrade to.
    expect(development.header).not.toContain('upgrade-insecure-requests');
  });

  /**
   * `style-src 'unsafe-inline'` is a known, documented compromise. This test
   * exists so that it stays deliberate: if someone tightens it, this fails and
   * they have to think about whether a production build was verified.
   */
  it('documents the style-src compromise rather than hiding it', () => {
    expect(directive(production.header, 'style-src')).toBe(
      "style-src 'self' 'unsafe-inline'",
    );
  });
});

describe('static security headers', () => {
  const byKey = new Map(
    STATIC_SECURITY_HEADERS.map((header) => [header.key, header.value]),
  );

  it('denies framing for older browsers too', () => {
    expect(byKey.get('X-Frame-Options')).toBe('DENY');
  });

  it('stops content-type sniffing', () => {
    expect(byKey.get('X-Content-Type-Options')).toBe('nosniff');
  });

  /**
   * Paths in this app carry CV and tailoring ids. A full referrer sent to a
   * third-party site would hand over the id of someone's CV.
   */
  it('does not leak full paths to other origins', () => {
    expect(byKey.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('turns off device APIs the product never uses', () => {
    const policy = byKey.get('Permissions-Policy') ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('sets HSTS with subdomains', () => {
    const hsts = byKey.get('Strict-Transport-Security') ?? '';
    expect(hsts).toContain('includeSubDomains');
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0)).toBeGreaterThanOrEqual(
      31536000,
    );
  });

  /**
   * noindex is applied per-path in middleware, not here. Blanket-noindexing
   * would hide the landing page from search, which for a product nobody has
   * heard of would be a self-inflicted wound.
   */
  it('does not blanket-noindex the whole site', () => {
    expect(byKey.has('X-Robots-Tag')).toBe(false);
    expect(NOINDEX_HEADER.value).toContain('noindex');
  });
});
