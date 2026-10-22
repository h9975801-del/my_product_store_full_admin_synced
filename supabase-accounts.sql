-- УЖЕ ПРИМЕНЕНО к проекту «Baza» (через коннектор). Файл оставлен для справки / нового проекта.
-- Требует существующую функцию public.is_store_admin() и таблицу public.store_admins
-- (роль администратора из исходной настройки магазина).

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '',
  contact text not null default '',
  email text not null default '',
  comment text not null default '',
  items jsonb not null default '[]',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
alter table public.orders enable row level security;
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders" on public.orders for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users create own orders" on public.orders;
create policy "Users create own orders" on public.orders for insert to authenticated with check (user_id = (select auth.uid()) and status = 'new');
drop policy if exists "Admins read all orders" on public.orders;
create policy "Admins read all orders" on public.orders for select to authenticated using ((select public.is_store_admin()));

create table if not exists public.carts (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  items jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.carts enable row level security;
drop policy if exists "Users manage own cart" on public.carts;
create policy "Users manage own cart" on public.carts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.orders from anon;
revoke all on public.carts from anon;
