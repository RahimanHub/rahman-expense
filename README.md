# Rahman Expense v1.8 — GitHub Pages Ready (KWD)

This build is prepared specifically for the GitHub repository **rahman-expense** and GitHub Pages. It is responsive for iPhone and laptop, KWD-only, local-first, and includes optional private Supabase sync.

## Upload to GitHub

Upload the **contents of this folder** to the root of your `rahman-expense` repository. The repository root should contain `index.html`, `app.js`, `styles.css`, `service-worker.js`, `manifest.webmanifest`, `icon.svg`, `cloud-config.js`, `supabase_schema.sql`, `README.md`, and `VERSION.txt`.

Do not upload the outer folder as a nested folder inside the repository. `index.html` must be visible at the repository root.

## Enable GitHub Pages

1. Open the `rahman-expense` repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Branch: **main**. Folder: **/ (root)**.
5. Click **Save**.
6. Wait for GitHub to publish the site.

Your address will normally be:

`https://<your-github-username>.github.io/rahman-expense/`

## iPhone

Open the GitHub Pages address in Safari, tap **Share → Add to Home Screen**. The PWA uses relative paths so it works correctly under the `/rahman-expense/` GitHub Pages subfolder.

## Privacy and sync

- By default, financial data stays in browser storage on that device.
- Receipt photos are temporary and are not included in cloud sync.
- Optional Supabase sync can synchronize confirmed transactions, budgets, merchant rules and profile data between iPhone and laptop.
- Use only the Supabase Project URL and **anon/publishable key**. Never place a `service_role` key in this project.
- `supabase_schema.sql` enables Row Level Security for per-user data.

## Google Drive backup

Use **Export backup** on laptop or **Share backup** on iPhone and save the JSON file to Google Drive. Google Drive is a backup location, not the live database.
