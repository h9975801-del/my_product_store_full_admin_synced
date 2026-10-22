-- Выполните в Supabase → SQL Editor. Политики разрешают запись только аутентифицированным пользователям.
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'custom' check (category in ('mount','print','custom')),
  price text not null default 'Цена по запросу',
  tag text not null default '',
  description text not null default '',
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
for select to anon, authenticated using (active = true);

drop policy if exists "Authenticated users can manage products" on public.products;
create policy "Authenticated users can manage products" on public.products
for all to authenticated using (true) with check (true);

insert into public.products (name,category,price,tag,description,active)
select v.name,v.category,v.price,v.tag,v.description,true
from (values
('Струбцины для монтажа дверей','mount','Цена по запросу','Для монтажа','Помогают фиксировать наличники и детали во время установки. Возможность комплектации уточняется.'),
('Уголки для плитки под 45°','mount','Цена по запросу','Отделка','Аксессуары для аккуратной отделки внешних углов плитки с запилом под 45 градусов.'),
('Изделия, напечатанные на 3D-принтере','print','Цена по запросу','3D-печать','Детали и полезные аксессуары по готовой модели или по вашим размерам и задаче.'),
('Другие собственные изделия','custom','Рассчитаем стоимость','Индивидуально','Есть идея или нестандартная задача? Опишите её — обсудим конструкцию, сроки и изготовление.')
) as v(name,category,price,tag,description)
where not exists (select 1 from public.products p where p.name=v.name);

-- Storage: create bucket named product-photos as PUBLIC in Supabase Dashboard.
-- Then run these policies. Upload/delete are restricted to authenticated users.
drop policy if exists "Authenticated admins upload product photos" on storage.objects;
create policy "Authenticated admins upload product photos" on storage.objects
for insert to authenticated with check (bucket_id = 'product-photos');

drop policy if exists "Public can view product photos" on storage.objects;
create policy "Public can view product photos" on storage.objects
for select to anon, authenticated using (bucket_id = 'product-photos');

drop policy if exists "Authenticated admins update product photos" on storage.objects;
create policy "Authenticated admins update product photos" on storage.objects
for update to authenticated using (bucket_id = 'product-photos') with check (bucket_id = 'product-photos');

drop policy if exists "Authenticated admins delete product photos" on storage.objects;
create policy "Authenticated admins delete product photos" on storage.objects
for delete to authenticated using (bucket_id = 'product-photos');
