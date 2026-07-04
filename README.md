# QuickCal

Zero-friction weekly calorie tracker. React + Vite + Supabase (GitHub sign-in).

## Setup — do these once, in order

### 1. Database table

In your Supabase project: **SQL Editor → New query**, paste the contents of
`supabase-setup.sql`, click **Run**. This creates a `kv` table with row-level
security so each user only sees their own rows.

### 2. GitHub OAuth app

1. GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**
2. Fill in:
   - Homepage URL: `https://YOUR-DEPLOYED-URL` (you can put a placeholder and update later)
   - **Authorization callback URL:** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     (find your project ref in Supabase → Project Settings → General)
3. Copy the **Client ID**, generate and copy a **Client Secret**.

### 3. Enable GitHub provider in Supabase

Supabase → **Authentication → Providers → GitHub** → enable, paste Client ID
and Client Secret, save.

Then in **Authentication → URL Configuration**:
- Site URL: your deployed URL (e.g. `https://quickcal.pages.dev`)
- Additional redirect URLs: add `http://localhost:5173` for local dev.

### 4. Environment variables

Copy `.env.example` to `.env` and fill in from Supabase →
**Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

(The anon key is safe to expose in a frontend — RLS is what protects the data.)

### 5. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173, sign in with GitHub, add an egg.

### 6. Deploy (Cloudflare Pages / Vercel / Netlify)

- Push this folder to a GitHub repo.
- Connect the repo in your host of choice.
- Build command: `npm run build` · Output directory: `dist`
- Add the two `VITE_*` environment variables in the host's dashboard.
- After the first deploy, go back and update the **Site URL** in Supabase
  (step 3) and the Homepage URL in the GitHub OAuth app to the real URL.

### 7. On your phone

Open the deployed URL in Safari/Chrome → Share → **Add to Home Screen**.
It launches full-screen like a native app.

## Notes

- Data is stored per user, per week (`week:YYYY-MM-DD` keys, Sunday-start),
  plus a `budget` key. Weeks reset automatically.
- There's an in-memory fallback so a flaky connection never blocks logging;
  failed saves are logged to the console.
