-- Ledgerly Pro cloud schema (Supabase/PostgreSQL)
-- Run in Supabase SQL Editor when deploying the synchronized version.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'KWD' check (currency = 'KWD'),
  opening_balance numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
create index if not exists transactions_user_date_idx on public.transactions(user_id, txn_date desc);
create index if not exists transactions_user_category_idx on public.transactions(user_id, category, txn_date desc);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_month date not null,
  category text not null,
  planned_amount numeric(14,3) not null default 0 check (planned_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, budget_month, category)
);
create index if not exists monthly_budgets_user_month_idx on public.monthly_budgets(user_id, budget_month);

create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  category text not null,
  subcategory text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, merchant_key)
);

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

-- Keep updated_at current for two-way device synchronization.
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

-- v1.9 REAL-TIME SYNC -------------------------------------------------------
-- Postgres Changes is disabled for new Supabase projects until tables are
-- added to the supabase_realtime publication. The app subscribes only to the
-- signed-in user's rows; RLS remains the primary data-access boundary.

-- Explicit browser privileges: signed-out visitors get no financial-table
-- access; authenticated users may operate only on rows allowed by RLS.
revoke all on table public.profiles from anon;
revoke all on table public.transactions from anon;
revoke all on table public.monthly_budgets from anon;
revoke all on table public.merchant_rules from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.monthly_budgets to authenticated;
grant select, insert, update, delete on table public.merchant_rules to authenticated;

-- Required so filtered DELETE events can be matched by Realtime. With RLS,
-- clients still receive only the primary key in payload.old for deletes.
alter table public.transactions replica identity full;
alter table public.monthly_budgets replica identity full;
alter table public.merchant_rules replica identity full;
alter table public.profiles replica identity full;

-- Idempotently enable Postgres Changes for Rahman Expense tables.
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
