# Rahman Expense v2.4 — Mobile Professional + Simple Login + Real-Time Sync (KWD)

Rahman Expense is a KWD-only personal expense manager for iPhone and laptop. This release keeps the working Supabase email/password sync and improves mobile identity, drill-down navigation, and receipt camera handling.

## Upgrade on GitHub Pages
Upload all files in this folder to the `RahimanHub/rahman-expense` GitHub repository and replace the existing files. GitHub Pages remains `main` + `/ (root)`.

After deployment, check:

`https://rahimanhub.github.io/rahman-expense/VERSION.txt`

It should show **v2.4**.

Then open once:

`https://rahimanhub.github.io/rahman-expense/refresh.html`

This clears only legacy app caches and keeps local expense data intact.

## v2.4 improvements
- Mobile now shows **Rahman Expense**, **KWD only**, the app version, and **Developed by Rahiman**.
- Desktop sidebar and Settings also show **Developed by Rahiman**.
- Dashboard **Income** opens Income transactions.
- Dashboard **Expenses** opens Expense transactions.
- Dashboard **Budget left** opens Monthly Budget.
- Report metric cards drill down to the matching Transactions or Budget page.
- Budget **Actual spending** opens expense transactions.
- Mobile **Scan receipt** attempts to open the rear-camera picker directly.
- Receipt editor has explicit **Take photo** and **Choose image** buttons for better iPhone compatibility.
- Receipt images remain temporary and are not stored in cloud sync.

## Supabase sync
Use the same Supabase Project URL, publishable key, email, and password on iPhone and laptop. When connected, Settings should show **Connected · Live** and **Live: On**.

## Security
Never put a Supabase secret or `service_role` key in the browser app. Use only the publishable/anon key with Row Level Security enabled.
