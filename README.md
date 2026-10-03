# Rahman Expense v2.14 — Groceries Category + Kuwait / India Separate Expenses

Developed by Rahiman.

## What changed
- Two permanent country tabs: **Kuwait** and **India**.
- Kuwait uses **KWD with 3 decimals**.
- India uses **INR with 2 decimals**.
- Transactions, available balance, monthly budgets, reports, category totals, statement imports and merchant learning remain **separate for each country**.
- Existing v2.7 and earlier data is migrated to **Kuwait** automatically.
- Shopping is split into **Personal Shopping** and **Home Shopping**.
- The shared category set includes **Utilities → Electricity / Water / Gas** for both countries.
- India payment methods include UPI, Debit Card, Credit Card, Cash, Bank Transfer and Net Banking.
- Statement/PDF/CSV import saves into whichever country tab is active.
- Receipt scanning saves into whichever country tab is active.

## IMPORTANT — run the Supabase migration once
Because v2.14 stores Kuwait and India separately in the cloud, open Supabase → SQL Editor and run the **new `supabase_schema.sql` from v2.14** once after deploying this version.

The migration:
- keeps all existing cloud transactions as Kuwait (`KW`),
- adds India (`IN`) support,
- separates monthly budgets by country,
- separates merchant/category learning by country,
- adds a separate India opening balance,
- preserves RLS and real-time synchronization.

## Upgrade on GitHub Pages
1. Upload all v2.14 files to `RahimanHub/rahman-expense`, replacing the existing files.
2. Wait for GitHub Pages to deploy.
3. Check `https://rahimanhub.github.io/rahman-expense/VERSION.txt` — it should show **v2.14**.
4. Open `https://rahimanhub.github.io/rahman-expense/refresh.html` once.
5. Open the normal app URL.
6. Run the new `supabase_schema.sql` in Supabase SQL Editor, then press **Sync now** in Rahman Expense Settings.

## Privacy
Receipt/statement files are processed temporarily in the browser and are not stored in Supabase. Only confirmed transaction data is synchronized.

## v2.14 category update

- Added **Groceries** as a dedicated top-level expense category for both Kuwait and India.
- Grocery subcategories: Supermarket, Vegetables & Fruits, Meat & Fish, Household Food, General, Other.
- Supermarkets such as Lulu, Carrefour, Sultan, D-Mart, Reliance Fresh, Nesto and similar merchants are suggested as **Groceries → Supermarket**.
- Existing older transactions stored as **Food → Groceries** are automatically shown as **Groceries → General**.
- Restaurant/delivery/coffee purchases remain under **Food**.


## v2.14 budget persistence fix

Monthly budget inputs are now persisted while typing, mirrored synchronously to a local shadow copy, and restored from the newest local/IndexedDB copy after refresh. Pressing Refresh while a budget field is still focused no longer loses the entered amount. Cloud sync still runs normally after edits.


## Accounts & cards (v2.14)
- Separate Kuwait and India accounts.
- Debit card / bank / cash current balance.
- Credit card limit, outstanding balance and available credit.
- Accounts sync privately through Supabase Realtime.
- Run the included `supabase_schema.sql` once after upgrading to v2.14.

## v2.14 Kuwait money view

Kuwait Accounts now shows **Cash in hand**, **Bank / debit balance**, **Cash + bank**, and **Credit cards** separately. Credit cards show limit, outstanding and available credit. No new Supabase migration is required if the v2.11 accounts schema was already run.


## v2.14 quick balance update
- Kuwait Accounts page now includes a Quick Update panel for Cash in Hand, Cash at Bank / Debit Balance, Credit Card Limit, and Credit Card Outstanding.
- Saving the panel updates the primary account in each group, saves locally, and queues Supabase sync automatically.
- No database/schema update is required if the v2.11 accounts schema was already applied.


## v2.14 automatic account balance rules
- Expense paid from Cash: Cash in Hand decreases by the expense amount.
- Expense paid from Bank/Debit: Bank/Debit balance decreases by the expense amount.
- Expense paid by Credit Card: Credit-card outstanding increases; available credit decreases automatically.
- Income linked to Cash/Bank: the selected balance increases.
- Cash withdrawal: transfer Bank/Debit → Cash. Bank decreases and Cash in Hand increases by the same amount.
- Credit-card payment/top-up: transfer Bank/Debit → Credit Card. Bank decreases and credit-card outstanding decreases by the same amount.
- Editing or deleting a linked transaction reverses its previous account effect before applying the new one.
- Dashboard Available Balance = Cash in Hand + Bank/Debit balances − Credit-card outstanding.

### One-time database migration for v2.14
Run the included `supabase_schema.sql` once in Supabase SQL Editor. It adds `account_id` and `to_account_id` columns to transactions so the account links sync correctly between devices.
