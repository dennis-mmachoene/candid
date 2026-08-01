# Phase 2 setup — what Dennis needs to do

Four steps. Roughly twenty minutes, most of it waiting for Google.

---

## 1. Run the migration

Supabase Dashboard → **SQL Editor** → New query. Paste the whole of
`supabase/migrations/0001_initial_schema.sql` and run it.

Then check it took:

- **Database → Tables** should list eight tables.
- **Database → Policies**: every table should show RLS enabled.
  `rate_limits` should show **RLS enabled with zero policies** — that is
  correct and deliberate. With RLS on and no policy, every statement from a
  normal user is denied, so nobody can reset their own rate limit.
- **Advisors → Security** should be clean. If it flags anything, tell me
  before continuing rather than dismissing it.

---

## 2. Set up Google sign-in

You need a Google OAuth client, and Supabase needs its ID and secret.

**First, get the callback URL from Supabase.** Dashboard →
**Authentication → Sign In / Providers → Google**. Copy the **Callback URL**
shown there. It looks like:

```
https://kmnvkttjwudsehewlfah.supabase.co/auth/v1/callback
```

**Then in Google Cloud Console** (`console.cloud.google.com`):

1. Create a project, or pick an existing one.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Candid`
   - User support email: your email
   - Developer contact: your email
   - Scopes: the defaults are fine. Candid needs `email` and `profile`, nothing more.
   - While the app is in Testing mode, only accounts you add under
     **Test users** can sign in. Add your own address.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Candid web`
   - **Authorised redirect URIs**: paste the Supabase callback URL from above.
     This must match exactly, including `https://` and no trailing slash.
   - Create, then copy the **Client ID** and **Client secret**.

**Back in Supabase**, on that same Google provider page: enable the provider,
paste the Client ID and Client secret, and save.

**One more Supabase setting.** Authentication → **URL Configuration**:

- Site URL: `http://localhost:3000`
- Additional redirect URLs: `http://localhost:3000/auth/callback`

Add the production URLs here too once the app is deployed to Vercel.

---

## 3. Fill in `.env.local`

Create `.env.local` in the project root. It is git-ignored.

```
NEXT_PUBLIC_SUPABASE_URL=https://kmnvkttjwudsehewlfah.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
ENCRYPTION_KEY=<generate this, see below>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Get the URL and publishable key from **Connect**, or **Settings → API Keys**.

**A note on key names.** Your dashboard shows
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not the `NEXT_PUBLIC_SUPABASE_ANON_KEY`
the build spec names. Supabase replaced the old `anon` and `service_role` JWT
keys with `sb_publishable_...` and `sb_secret_...`, and deprecates the old ones
at the end of 2026. The code uses the new names.

**Generate the encryption key.** In Git Bash:

```bash
openssl rand -base64 32
```

It must decode to exactly 32 bytes. Do not paste a 32-character passphrase —
that decodes to 24 bytes and the app will refuse it, which is deliberate.

Keep a copy somewhere safe. If you lose it, every stored identity header
becomes unrecoverable. That is the right behaviour after a breach and an
inconvenient one after a laptop reinstall.

`SUPABASE_SECRET_KEY` is not used by any code yet. It is needed in Phase 5 for
deleting auth users and running the retention purge. Fill it in now so you are
not hunting for it later.

---

## 4. Run it

```bash
npm install
npm run dev
```

Then walk through this and tell me where it breaks:

1. Open `http://localhost:3000`. Click **Sign in with Google**.
2. You should land on the consent screen, not the dashboard. It should name
   Supabase, Anthropic, Google and Vercel, with Anthropic marked
   *receives no identifying data*.
3. Try navigating straight to `http://localhost:3000/dashboard` before
   accepting. It should bounce you back to `/consent`.
4. Accept. You should reach the dashboard.
5. Upload a real CV, ideally one with your ID number in it.
6. Check the result on screen: it should confirm the ID number was redacted,
   and the stored preview should show no name, email or phone.
7. In Supabase → **Table Editor → resumes**, look at your row:
   - `content` should have no name, email, phone or ID number
   - `identity_header_enc` should be unreadable base64
   - there should be no `id_number` column at all
8. Sign out. Try `/dashboard` again. It should redirect to the landing page.

---

## What to expect that is not a bug

- **Google shows an "unverified app" warning** while the consent screen is in
  Testing mode. Fine for development.
- **The dashboard shows a raw text preview** of your de-identified CV. That is
  intentional for this phase, so you can see with your own eyes what was
  stripped. It goes away in Phase 3.
- **Tailoring does not work yet.** That is Phase 3 and needs the Anthropic key.
