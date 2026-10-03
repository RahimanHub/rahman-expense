# Rahman Expense v2.6 — Statement Import + Real-Time Sync (KWD)

Rahman Expense is a KWD-only personal expense manager for iPhone and laptop, developed by Rahiman. v2.6 adds bank and credit-card statement import while preserving the working Supabase real-time sync and mobile/desktop interface.

## Upgrade on GitHub Pages
Upload all files in this folder to `RahimanHub/rahman-expense`, replacing the existing files. GitHub Pages stays on `main` + `/ (root)`.

Check:
`https://rahimanhub.github.io/rahman-expense/VERSION.txt`

It should show **v2.6**.

Then open once:
`https://rahimanhub.github.io/rahman-expense/refresh.html`

## v2.6 statement import
Open **Transactions → Import statement** or **Settings → Import statement**.

Supported input:
- Text-based PDF bank statements
- Scanned PDF statements (local OCR fallback, first 8 scanned pages)
- CSV exports
- Statement screenshots/images

Rahman Expense:
1. Reads the file locally in the browser.
2. Detects transaction rows one-by-one.
3. Treats debit purchases as expenses.
4. Treats deposits/refunds as income when detected.
5. Treats credit-card repayments, minimum-due settlements, WAMD/outward transfers and similar rows as **transfers** so purchases are not double-counted.
6. Suggests expense categories using merchant rules and keywords.
7. Shows a review screen before saving.
8. Flags likely duplicates using date, type, amount, merchant/reference and an import fingerprint.
9. Saves selected rows as individual Rahman Expense transactions and syncs them through Supabase.

## Credit-card statements
A credit-card statement can be imported the same way. Purchases are added as individual expenses. Payment/settlement rows are marked as transfers by default. Always review detected rows before saving because bank layouts vary.

## PDF invoice / receipt
The receipt scanner now also accepts a single PDF invoice. It extracts PDF text locally, then fills amount, merchant, date and category for confirmation.

## Privacy
Statement and receipt files are temporary and are not uploaded to Rahman Expense cloud storage. Confirmed transaction data only is synchronized to Supabase. PDF.js/Tesseract libraries are loaded in the browser from jsDelivr.

## Supabase
No database schema change is required from v2.5 for statement import. Continue using the same Supabase Project URL, publishable key, email and password. Never use a secret/service_role key in the browser app.
