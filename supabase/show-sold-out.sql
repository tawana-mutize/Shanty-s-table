-- Let customers see every menu item while RLS still prevents public editing.
drop policy if exists "Public can view available meals" on public.menu_items;
drop policy if exists "Public can view menu" on public.menu_items;

create policy "Public can view menu"
on public.menu_items for select
to anon
using (true);
