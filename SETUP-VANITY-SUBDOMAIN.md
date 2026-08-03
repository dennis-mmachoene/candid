# Making the Google sign-in screen say `candid`

Today the Google consent screen reads:

> Sign in to **kmnvkttjwudsehewlfah.supabase.co**

Nothing in this repository controls that. Google displays the root domain of the
OAuth **callback**, and the callback belongs to Supabase Auth, not to Candid.
The chain is app → Supabase → Google → **Supabase's** callback → app, so the
only domain Google ever sees is the Supabase one.

A vanity subdomain changes that callback to `candid.supabase.co`, and the
consent screen follows.

---

## What this does and does not buy you

| | Before | After |
|---|---|---|
| Consent screen reads | `kmnvkttjwudsehewlfah.supabase.co` | `candid.supabase.co` |
| Shows a logo | No | No |
| Shows "Candid" alone, no domain | No | No |

It still says `supabase.co`. Getting the screen to read **Candid** with a logo
and no domain requires Google brand verification, and that requires verifying
ownership of the authorized domain — which you cannot do for `supabase.co`.
That path needs a full custom domain (`auth.yourdomain.co.za`) and a domain you
actually own.

**Prerequisite:** the Supabase organisation must be on a paid plan (Pro, Team or
Enterprise). Vanity subdomains are a paid add-on and the CLI will refuse
otherwise. They are also marked experimental by Supabase, which is why every
command below carries `--experimental`.

---

## 1. Check the name is free

```bash
npm install -g supabase
supabase login

supabase vanity-subdomains check-availability \
  --project-ref kmnvkttjwudsehewlfah \
  --desired-subdomain candid \
  --experimental
```

`candid` is a common word and may well be taken. Have a second choice ready —
`candid-app`, `candidcv`, `getcandid`. Whatever you pick becomes part of a URL
that is awkward to change later, so choose once.

---

## 2. Tell Google about the new callback — **before** activating

This is the step that breaks sign-in if you skip it, and it breaks it for
everyone at once.

Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 client →
**Authorised redirect URIs**. Add the new one *alongside* the existing one:

```
https://kmnvkttjwudsehewlfah.supabase.co/auth/v1/callback   ← keep this
https://candid.supabase.co/auth/v1/callback                 ← add this
```

Both must be present. Activation switches the callback immediately, and Google
refuses any redirect URI it has not been told about — so if the new one is
missing at that moment, every sign-in fails with `redirect_uri_mismatch` until
you add it.

Keeping the old one also means you can reverse the activation without a second
outage.

---

## 3. Activate

```bash
supabase vanity-subdomains activate \
  --project-ref kmnvkttjwudsehewlfah \
  --desired-subdomain candid \
  --experimental
```

Sign in on production and confirm the consent screen now reads
`candid.supabase.co`. If it still shows the old reference, the browser is
showing you a cached consent — open a private window.

---

## 4. Point the application at the new domain (optional)

The original project domain **keeps working**. Both resolve to the same project,
so nothing forces this change and nothing breaks if you leave it.

Change it when you want the network tab and any copied URL to read `candid`:

- Vercel → Settings → Environment Variables → `NEXT_PUBLIC_SUPABASE_URL` →
  `https://candid.supabase.co`
- Your local `.env.local`, so development matches production
- The `E2E_SUPABASE_URL` repository secret, if you have configured it

**Redeploy afterwards.** `NEXT_PUBLIC_*` variables are inlined at build time, so
editing the value changes nothing until the next build. A deployment that
appears to have ignored the change is almost always this.

---

## What does not need to change

**The Content Security Policy.** `lib/infrastructure/security-headers.ts` allows
`https://*.supabase.co` and `wss://*.supabase.co`, and `candid.supabase.co`
matches both. This is a genuine advantage of a vanity subdomain over a full
custom domain, which would sit outside that wildcard and require the policy —
and its test — to be widened.

**The environment schema.** `NEXT_PUBLIC_SUPABASE_URL` is validated as a URL,
not against a hostname pattern, so a vanity subdomain passes unchanged.

**Supabase Auth URL configuration.** Site URL and Redirect URLs describe *your
application's* addresses (`https://candid-theta.vercel.app`), not Supabase's own
callback. They are unaffected.

**The publishable and secret keys.** A vanity subdomain does not rotate them.

**The consent record.** Supabase is still the operator and still processes the
same data in the same jurisdiction. Nothing in `lib/domain/consent.ts` changes,
and the policy version does not need incrementing — this is a change of address,
not a change of who processes what.

---

## Reversing it

```bash
supabase vanity-subdomains delete \
  --project-ref kmnvkttjwudsehewlfah \
  --experimental
```

Then set `NEXT_PUBLIC_SUPABASE_URL` back and redeploy. Leave the old callback
URL in Google Cloud Console throughout and this is a clean rollback; remove it
and you have swapped one outage for another.

---

## If you decide not to do this

It is a defensible thing to leave alone, and worth writing down rather than
hiding. The consent screen showing a provider's domain is a constraint of using
a managed authentication service on a free plan — a cost trade-off, not a design
error. `docs/ISJ107V_Assignment3_Project_Documentation.docx` records known
limitations for exactly this kind of item.
