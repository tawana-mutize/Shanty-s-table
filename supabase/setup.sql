-- Shanty's Table: Supabase database, permissions, and image storage.
-- Run this entire file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.menu_items (
  id text primary key,
  name text not null check (char_length(name) between 1 and 100),
  description text not null check (char_length(description) between 1 and 500),
  price integer not null check (price >= 0),
  image text not null,
  badge text not null default '' check (char_length(badge) <= 40),
  kind text not null check (kind in ('ready', 'build', 'snack')),
  available boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  phone text not null check (char_length(phone) between 1 and 40),
  collection_time text not null check (char_length(collection_time) between 1 and 40),
  notes text not null default '' check (char_length(notes) <= 500),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total integer not null check (total > 0),
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'collected')),
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists menu_items_sort_order_idx on public.menu_items (sort_order);

alter table public.admin_users enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;

revoke all on public.admin_users from anon, authenticated;
revoke all on public.menu_items from anon, authenticated;
revoke all on public.orders from anon, authenticated;

grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items to authenticated;
grant insert on public.orders to anon;
grant select, update on public.orders to authenticated;

drop policy if exists "Public can view available meals" on public.menu_items;
create policy "Public can view available meals"
on public.menu_items for select
to anon
using (available = true);

drop policy if exists "Admins can view all meals" on public.menu_items;
create policy "Admins can view all meals"
on public.menu_items for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can add meals" on public.menu_items;
create policy "Admins can add meals"
on public.menu_items for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Admins can update meals" on public.menu_items;
create policy "Admins can update meals"
on public.menu_items for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins can delete meals" on public.menu_items;
create policy "Admins can delete meals"
on public.menu_items for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Customers can place orders" on public.orders;
create policy "Customers can place orders"
on public.orders for insert
to anon
with check (
  status = 'new'
  and total > 0
  and jsonb_array_length(items) between 1 and 50
);

drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders"
on public.orders for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

insert into public.menu_items
  (id, name, description, price, image, badge, kind, available, sort_order)
values
  ('fries-chicken', 'Fries & Chicken', 'Sticky grilled chicken, seasoned fries & fresh salads', 25, '/food/fries-chicken.jpeg', 'Popular', 'ready', true, 0),
  ('fries-ribs', 'Fries & Ribs', 'Tender glazed ribs with golden seasoned fries', 35, '/food/fries-chicken.jpeg', '', 'ready', true, 1),
  ('fish-chips', 'Fish & Chips', 'Crispy spiced fish, chips, lemon & sweet chilli', 25, '/food/fish-chips.jpeg', '', 'ready', true, 2),
  ('kebab', 'Kebab Box', 'A loaded box of kebab, fries, salad & sauce', 30, '/food/jollof-chicken.jpeg', '', 'ready', true, 3),
  ('jollof', 'Jollof, Chicken & Mince', 'A full plate of jollof rice, savoury mince & baked chicken', 30, '/food/jollof-chicken.jpeg', 'Shanty''s pick', 'ready', true, 4),
  ('pasta', 'Pasta & Savoury Mince', 'Tagliatelle topped with rich mince, coleslaw & potato salad', 30, '/food/pasta-mince.jpeg', '', 'ready', true, 5),
  ('rice', 'Build your Rice', 'Choose your stew and add a fresh side', 30, '/food/rice-stew.jpeg', '', 'build', true, 6),
  ('sadza', 'Build your Sadza', 'Choose your protein and vegetables', 30, '/food/sadza-beef.jpeg', '', 'build', true, 7),
  ('pies', 'Homemade Pies', 'Flaky, golden and freshly baked', 10, '/food/pies.jpeg', '', 'snack', true, 8),
  ('samosas', 'Samosas', 'Crispy handmade savoury parcels', 10, '/food/samosas.jpeg', '', 'snack', true, 9),
  ('drinks', 'Soft Drinks', 'Cold assorted soft drinks', 10, '/food/fries-chicken.jpeg', '', 'snack', true, 10)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  8000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view menu images" on storage.objects;
create policy "Public can view menu images"
on storage.objects for select
to public
using (bucket_id = 'menu-images');

drop policy if exists "Admins can upload menu images" on storage.objects;
create policy "Admins can upload menu images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'menu-images' and (select public.is_admin()));

drop policy if exists "Admins can update menu images" on storage.objects;
create policy "Admins can update menu images"
on storage.objects for update
to authenticated
using (bucket_id = 'menu-images' and (select public.is_admin()))
with check (bucket_id = 'menu-images' and (select public.is_admin()));

drop policy if exists "Admins can delete menu images" on storage.objects;
create policy "Admins can delete menu images"
on storage.objects for delete
to authenticated
using (bucket_id = 'menu-images' and (select public.is_admin()));
