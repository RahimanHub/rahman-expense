# Rahman Expense v2.14 — Available Balance Formula Fix

Rahman Expense keeps Kuwait (KWD) and India (INR) expenses, budgets, accounts/cards and reports separate. Developed by Rahiman.

## v2.14 change

The Dashboard **Available Balance** now uses the account values directly:

`Cash in Hand + Cash at Bank / Debit Balance - Credit Card Outstanding`

Example: KWD 30.000 + KWD 319.000 - KWD 134.676 = **KWD 214.324 available**.

The Dashboard also shows the three values directly below the available balance so the calculation is easy to verify.

## Database

No new database migration is required for v2.14 if the Accounts schema from v2.11+ has already been run successfully.

## Deployment

1. Upload all files from this folder to `RahimanHub/rahman-expense`, replacing the existing files.
2. Wait for GitHub Pages to finish deploying.
3. Check `https://rahimanhub.github.io/rahman-expense/VERSION.txt` and confirm it shows **v2.14**.
4. Open `https://rahimanhub.github.io/rahman-expense/refresh.html` once.
5. Reopen the normal app and use **Sync now** on each device.

The refresh page removes old app caches only; it does not delete local expense data.
