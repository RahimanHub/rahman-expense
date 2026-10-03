# Rahman Expense v2.3 — Simple Password Login + Real-Time Sync (KWD)

This release removes the Supabase magic-link dependency from Rahman Expense. It uses normal **email + password** sign-in, so there is no localhost redirect and no authentication link to open from email.

## Upgrade
Upload all files in this folder to the `RahimanHub/rahman-expense` GitHub repository and replace the existing v2.0 files. GitHub Pages remains `main` + `/ (root)`.

Open:

`https://rahimanhub.github.io/rahman-expense/?v=2.3`

The sidebar should show **KWD only · v2.3**.

## Supabase one-time setup
1. Keep the existing `supabase_schema.sql` already run in the project.
2. In Supabase, open **Authentication → Providers → Email** (wording may vary).
3. Keep Email authentication enabled.
4. Turn **Confirm email** / **Email confirmations** OFF for this personal app. With confirmation disabled, Supabase returns a session immediately after signup instead of sending a confirmation link.
5. If the same email was already created by the old magic-link tests and has no password, delete that test user once from **Authentication → Users** before creating the account in Rahman Expense.

## Rahman Expense settings
Enter:
- Supabase Project URL
- Publishable key (`sb_publishable_...`)
- Your email
- A strong password (8+ characters)

Click **Save cloud setup**.

On the first device click **Create account** once. On the second device click **Sign in** using the same email and password.

The password is never saved in Rahman Expense. Supabase stores the authenticated session in the browser so you normally stay signed in.

When connected, Settings should show **Connected · Live** and **Live: On**.

## Security
Never put a Supabase secret or `service_role` key in this browser app. Only use the publishable/anon key with Row Level Security enabled.


## v2.3 fix
The v2.2 index accidentally referenced v2.1 asset URLs. v2.3 corrects all asset query versions to `?v=2.3`, so the browser loads the matching JavaScript/CSS immediately.
