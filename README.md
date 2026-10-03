# Rahman Expense v2.0 — Fresh Storage + Real-Time Sync (KWD)

This build fixes the issue where a newly deployed version could still load old browser data.

## Important change

Rahman Expense v2.0 uses a **new IndexedDB database name and new state key**. It does **not** automatically import older Ledgerly/Rahman Expense browser storage. This means the app starts clean on each device after v2.0 is deployed. Older browser data is left untouched in the browser and is not deleted.

Cloud sync remains optional. Once Supabase is configured and the same account is used on iPhone and laptop, both devices can share the same cloud data.

## Update GitHub

Upload the contents of this folder to the root of the `rahman-expense` repository and replace the existing files. Keep GitHub Pages configured as **main → / (root)**.

After GitHub Pages finishes deploying, open:

`https://rahimanhub.github.io/rahman-expense/?v=2.0`

The sidebar should show **KWD only · v2.0** and the app should start with fresh local data.

## Privacy

- Old local browser data is not deleted; v2.0 simply does not read it.
- GitHub Pages hosts only the app files.
- Financial records stay local unless Supabase sync is enabled.
- Receipt photos remain temporary and are not synchronized.
- Never put a Supabase service-role key in GitHub or in the browser app.
