# Rahman Expense v1.9 — Real-Time Sync (KWD)

This build is prepared for the GitHub repository **rahman-expense** and GitHub Pages. It is responsive for iPhone and laptop, KWD-only, local-first, and supports optional **real-time Supabase synchronization**.

## What v1.9 adds

When the same Supabase account is signed in on both devices, changes to transactions, monthly budgets, merchant rules and opening balance can appear automatically on the other open device within seconds. A manual **Sync now** button remains available as a fallback. Receipt photos are never synchronized.

## Update GitHub

Upload the contents of this folder to the root of your `rahman-expense` repository and replace the existing v1.8 files. `index.html` must remain at repository root. GitHub Pages should stay configured as **main → / (root)**.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run the complete `supabase_schema.sql` from this package. The v1.9 section enables Realtime publication for the required tables and keeps RLS enabled.
3. In Supabase Authentication, enable email sign-in and set the Site URL / redirect URL to your GitHub Pages address, for example `https://rahimanhub.github.io/rahman-expense/`.
4. In Rahman Expense → **Settings**, enter your Supabase Project URL and **publishable/anon public key**. Never enter a service-role/secret key.
5. Enter your email and tap **Email me a sign-in link**. Sign in on both iPhone and laptop with the same account.
6. The Settings status should show **Connected · Live** and **Live: On**.

## Test real-time sync

Keep Rahman Expense open on laptop and iPhone. Add a small test expense on one device. After cloud save completes, the other open device should update automatically. Also test editing and deleting a transaction and changing a monthly budget.

## Privacy

- GitHub Pages hosts only the app code.
- Financial records stay local unless Supabase sync is enabled.
- Supabase Row Level Security restricts each signed-in user to their own rows.
- Receipt photos remain temporary and are not uploaded by Rahman Expense.
- Keep the Supabase service-role/secret key out of GitHub and out of the browser app.

## Backup

Use **Export backup** on laptop or **Share backup** on iPhone and save the JSON file to Google Drive if desired.
