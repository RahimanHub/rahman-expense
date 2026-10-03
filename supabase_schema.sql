-- Rahman Expense v2.14 cloud schema / migration
-- Kuwait (KWD) and India (INR) are stored separately under one private account.
-- Safe to run again in Supabase SQL Editor after earlier Rahman Expense versions.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'KWD' check (currency = 'KWD'),
  opening_balance numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists opening_balance_inr numeric(14,2) not null default 0;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'KW',
  type text not null check (type in ('expense','income','transfer')),
  amount numeric(14,3) not null check (amount > 0),
  merchant text,
  category text,
  subcategory text,
  txn_date date not null,
  payment_method text,
  note text,
  receipt_retained boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.transactions add column if not exists country text not null default 'KW';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='transactions_country_check' and conrelid='public.transactions'::regclass) then
    alter table public.transactions add constraint transactions_country_check check (country in ('KW','IN'));
  end if;
end $$;
create index if not exists transactions_user_country_date_idx on public.transactions(user_id, country, txn_date desc);
create index if not exists transactions_user_country_category_idx on public.transactions(user_id, country, category, txn_date desc);


-- Rahman Expense v2.14 transaction-to-account links.
-- These columns let expenses/income/transfers update the correct cash, bank/debit or credit-card balance.
alter table public.transactions add column if not exists account_id uuid;
alter table public.transactions add column if not exists to_account_id uuid;
create index if not exists transactions_user_account_idx on public.transactions(user_id, account_id);
create index if not exists transactions_user_to_account_idx on public.transactions(user_id, to_account_id);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'KW',
  budget_month date not null,
  category text not null,
  planned_amount numeric(14,3) not null default 0 check (planned_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.monthly_budgets add column if not exists country text not null default 'KW';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='monthly_budgets_country_check' and conrelid='public.monthly_budgets'::regclass) then
    alter table public.monthly_budgets add constraint monthly_budgets_country_check check (country in ('KW','IN'));
  end if;
end $$;
alter table public.monthly_budgets drop constraint if exists monthly_budgets_user_id_budget_month_category_key;
drop index if exists public.monthly_budgets_user_id_budget_month_category_key;
create unique index if not exists monthly_budgets_user_country_month_category_uidx on public.monthly_budgets(user_id,country,budget_month,category);
create index if not exists monthly_budgets_user_country_month_idx on public.monthly_budgets(user_id,country,budget_month);

create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'KW',
  merchant_key text not null,
  category text not null,
  subcategory text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.merchant_rules add column if not exists country text not null default 'KW';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='merchant_rules_country_check' and conrelid='public.merchant_rules'::regclass) then
    alter table public.merchant_rules add constraint merchant_rules_country_check check (country in ('KW','IN'));
  end if;
end $$;
alter table public.merchant_rules drop constraint if exists merchant_rules_user_id_merchant_key_key;
drop index if exists public.merchant_rules_user_id_merchant_key_key;
create unique index if not exists merchant_rules_user_country_merchant_uidx on public.merchant_rules(user_id,country,merchant_key);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.merchant_rules enable row level security;

drop policy if exists "profiles are private" on public.profiles;
create policy "profiles are private" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "transactions are private" on public.transactions;
create policy "transactions are private" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budgets are private" on public.monthly_budgets;
create policy "budgets are private" on public.monthly_budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "merchant rules are private" on public.merchant_rules;
create policy "merchant rules are private" on public.merchant_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.ledgerly_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.ledgerly_set_updated_at();
drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.ledgerly_set_updated_at();
drop trigger if exists monthly_budgets_set_updated_at on public.monthly_budgets;
create trigger monthly_budgets_set_updated_at before update on public.monthly_budgets for each row execute function public.ledgerly_set_updated_at();
drop trigger if exists merchant_rules_set_updated_at on public.merchant_rules;
create trigger merchant_rules_set_updated_at before update on public.merchant_rules for each row execute function public.ledgerly_set_updated_at();

revoke all on table public.profiles from anon;
revoke all on table public.transactions from anon;
revoke all on table public.monthly_budgets from anon;
revoke all on table public.merchant_rules from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.monthly_budgets to authenticated;
grant select, insert, update, delete on table public.merchant_rules to authenticated;

alter table public.transactions replica identity full;
alter table public.monthly_budgets replica identity full;
alter table public.merchant_rules replica identity full;
alter table public.profiles replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='transactions') then
    execute 'alter publication supabase_realtime add table public.transactions';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='monthly_budgets') then
    execute 'alter publication supabase_realtime add table public.monthly_budgets';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='merchant_rules') then
    execute 'alter publication supabase_realtime add table public.merchant_rules';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end $$;

-- Existing v2.7 and earlier cloud rows automatically remain Kuwait rows because
-- the new country columns default to 'KW'. India starts completely separate.

-- Rahman Expense v2.12 accounts & cards
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'KW' check (country in ('KW','IN')),
  name text not null,
  account_type text not null check (account_type in ('debit','credit','bank','cash')),
  balance numeric(14,3) not null default 0,
  credit_limit numeric(14,3) not null default 0 check (credit_limit >= 0),
  outstanding_balance numeric(14,3) not null default 0 check (outstanding_balance >= 0),
  issuer text,
  last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accounts_user_country_idx on public.accounts(user_id,country);
alter table public.accounts enable row level security;
drop policy if exists "accounts are private" on public.accounts;
create policy "accounts are private" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.ledgerly_set_updated_at();
revoke all on table public.accounts from anon;
grant select, insert, update, delete on table public.accounts to authenticated;
alter table public.accounts replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='accounts') then
    execute 'alter publication supabase_realtime add table public.accounts';
  end if;
end $$;
