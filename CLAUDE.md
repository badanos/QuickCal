# QuickCal

Personal weekly calorie tracker (single user: Nadav). React + Vite PWA, Supabase backend, GitHub OAuth. Built for phone use via Add to Home Screen.

## Design intent — read this first

**Minimum friction is the product.** The entire point is logging a food in 2–3 taps. Any change that adds taps, screens, or required decisions to the core logging flow is wrong by default, even if it adds capability. Prefer removing options over adding them. When a feature needs UI, put the choice inside a popup the user already opens, not on a new screen (see fat-% variant pills as the reference pattern).

Visual style: dark, monospace, restrained — near-black bg (#0B0E14), panel #131826, accents cyan/amber/green/pink/purple per category. All styles are inline JS objects in `App.jsx` (`styles` const). No CSS framework; keep it that way.

## Architecture

- `src/App.jsx` — the whole app, one component. Intentionally a single file; do not split into components/ until it actually hurts.
- `src/storage.js` — the ONLY persistence seam. `load(key, fallback)` / `save(key, value)` over a Supabase `kv` table, with in-memory fallback so flaky network never blocks logging. Any storage backend change happens here and nowhere else.
- `src/supabase.js` — client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (.env, gitignored).
- `src/main.jsx` — auth gate: GitHub OAuth via Supabase (`signInWithOAuth`), renders App when session exists, passes `onSignOut`.
- `supabase-setup.sql` — creates `kv` table: PK (user_id, key), value jsonb, RLS policies scoping all ops to `auth.uid()`. user_id defaults to `auth.uid()` so the client never sends it.

## Data model (keys in kv table)

- `budget` — weekly kcal budget, int. Default 14000.
- `week:YYYY-MM-DD` — array of entries for the week starting that **Sunday** (Israel weeks). Entry: `{ t: epoch_ms, d: "YYYY-MM-DD", kcal: int, label: string }`. Weeks "reset" simply because the key changes; old weeks remain stored.
- `customFoods` — array of `{ n, u: "portion", k, e: "✦" }`, user-created foods shown in the CUSTOM ring.
- `variantPrefs` — `{ [foodName]: variantName }`, last-picked fat-% per food, pre-selected next time (sticky defaults).

## UI structure

- Header: weekly budget (tap ✎ to edit), big REMAINING number, progress bar (cyan → amber >80% → red >100%), used/today subtotals.
- Dial: center "+ KCAL" button (free-form kcal entry with quick chips) surrounded by 5 category circles at 72°: PROTEIN, CARB, VEG, OTHER, CUSTOM.
- Category tap → ring of foods (radial layout adapts to item count; rings are ~10–11 items, keep them near that). Food tap → amount popup: optional fat-% variant pills (dairy only — percentages only, no brand/product-type variants), 0.5-step quantity stepper, live kcal total, ADD.
- CUSTOM ring has a dashed "+ ADD" button → name + kcal/portion popup. No edit/delete for custom foods yet (known gap; if added, reuse the confirm pattern).
- Below dial: THIS WEEK log, grouped by day (newest first, "Today" label), per-day subtotal, each row shows time (HH:MM, en-GB), label, kcal, ✕ → confirmation popup before removal. Timestamps exist on all entries; they are shown only in this list.
- Undo toast (4s) after every add.
- Food kcal values are rough standard averages, chosen for speed over precision. User is Israeli — food list reflects that (pita, bureka, hummus, cottage 3%/5%, cheese 9%/28%).

## Conventions

- Foods: `{ n: name, u: unit, k: kcal/unit, e: emoji, v?: [{n: "3%", k}] }` in the `FOODS` const.
- Terse, direct communication. Concise rationale. Don't over-engineer; the user will push back if you do.
- Verify `npm run build` passes after changes.

## Setup state / remaining steps

README.md has the full checklist. Supabase project exists; table + GitHub OAuth provider + .env may still be pending — ask before assuming. Deploy target: Cloudflare Pages / Vercel (build `npm run build`, output `dist`, set the two VITE_ env vars). After first deploy: set Site URL in Supabase Auth URL Configuration and the OAuth app Homepage URL.
