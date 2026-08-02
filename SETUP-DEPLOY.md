# Deploying to Vercel

Twenty minutes, and one ordering problem worth knowing about before you start:
you cannot set `NEXT_PUBLIC_SITE_URL` correctly until you know your Vercel URL,
and you do not know that until you have deployed once. So the first deploy is
expected to have broken sign-in. That is step 4, not a mistake.

---

## 1. Import the repository

Vercel → **Add New** → **Project** → import `dennis-mmachoene/candid`.

Framework preset, build command and output directory are all detected. Change
nothing.

**Do not deploy yet.** Add the environment variables first, or the build fails
on the Zod environment check — which is the check doing its job.

---

## 2. Environment variables

Under **Environment Variables**, add all seven. Tick **Production**,
**Preview** and **Development** for each unless noted.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase → Connect |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` — **Production only** |
| `ANTHROPIC_API_KEY` | `sk-ant-…` — **Production only** |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` |
| `ENCRYPTION_KEY` | the 32-byte base64 key from `.env.local` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for now — fixed in step 4 |

**Use the same `ENCRYPTION_KEY` as local.** It is not a per-environment secret;
it is the key that decrypts identity headers. A different value in production
means production cannot read anything encrypted locally, and vice versa.

**The two marked Production only** are genuinely secret. Preview deployments get
public URLs and there is no reason for a preview build to hold a key that
bypasses Row-Level Security or spends money.

Then **Deploy**.

---

## 3. Note the URL

Something like `https://candid-xyz123.vercel.app`. Copy it exactly, including
`https://` and with no trailing slash.

---

## 4. Fix `NEXT_PUBLIC_SITE_URL`, then redeploy

Vercel → Settings → Environment Variables → edit `NEXT_PUBLIC_SITE_URL` to the
URL from step 3.

This is what builds the OAuth redirect. Left at `localhost:3000`, production
sign-in sends people to a server on their own machine, which either fails or —
worse — succeeds if they happen to be running `npm run dev`.

**Redeploy after changing it.** `NEXT_PUBLIC_*` variables are inlined at build
time, so editing the value does nothing until the next build. Deployments →
latest → **Redeploy**.

---

## 5. Tell Supabase the new URL is allowed

Supabase → Authentication → **URL Configuration**:

- **Site URL:** your Vercel URL
- **Redirect URLs:** add `https://your-app.vercel.app/auth/callback`

Keep the localhost entries. You still develop locally.

**For preview deployments** (optional), Supabase accepts a wildcard:

```
https://*-your-vercel-scope.vercel.app/auth/callback
```

Without it, sign-in works in production and fails on every preview, because
each preview gets a fresh hostname.

### Google Cloud needs no change

Worth stating because it is the step people expect and then break something
looking for.

The redirect chain is: your app → Supabase → Google → **Supabase's** callback →
your app. Google only ever redirects to Supabase, and that URL has not changed.
Only Supabase's own allowlist needs to learn about the new destination.

---

## 6. Verify

In order, on the deployed URL:

1. Landing page loads.
2. **Open the browser console.** No CSP violations. This is the first time the
   policy has run over HTTPS with real static assets, and `upgrade-insecure-requests`
   is active in production but not locally — so this is genuinely new ground.
3. Sign in with Google. You should reach the consent gate.
4. Accept, upload a CV with an ID number in it, confirm the preview is clean.
5. Tailor against a real advert. Download the PDF and open it.
6. Delete the account, and confirm in Supabase that nothing of it remains.
7. Run the deployed URL through `securityheaders.com`.

If step 3 loops back to the landing page with `?error=auth`, it is almost always
step 4 or 5 above: either `NEXT_PUBLIC_SITE_URL` is stale (redeploy) or the
callback is missing from Supabase's redirect list.

---

## What to expect that is not a bug

- **Google shows an unverified-app warning.** Your OAuth consent screen is still
  in Testing mode, so only accounts on the test-user list can sign in at all.
  Publishing it is a separate step and needs a privacy policy URL — you have
  one, at `/privacy`.
- **The first request after a quiet period is slow.** Serverless cold start.
- **`Strict-Transport-Security` includes `preload`.** Harmless on a `vercel.app`
  subdomain. If you move to a custom domain, understand what preloading commits
  you to before submitting it — it is difficult to undo.

---

## After it is live

Run the end-to-end suite against production once:

```bash
E2E_BASE_URL=https://your-app.vercel.app npm run e2e
```

The suite creates and deletes its own accounts, so it is safe, but it does write
to whatever database that deployment points at. If you would rather not have
test rows in production even briefly, point a separate Supabase project at a
preview deployment instead.
