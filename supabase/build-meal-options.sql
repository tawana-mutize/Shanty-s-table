-- Adds editable choices to every build-your-own meal.
alter table public.menu_items
add column if not exists options jsonb not null default '{"proteins":[],"sides":[]}'::jsonb;

update public.menu_items
set options = '{"proteins":["Beef stew","Chicken stew","Savoury mince"],"sides":["No side","Complimentary coleslaw","Cabbage"]}'::jsonb
where id = 'rice'
  and (options is null or options = '{"proteins":[],"sides":[]}'::jsonb);

update public.menu_items
set options = '{"proteins":["Beef stew","Chicken stew","Savoury mince"],"sides":["No side","Cabbage","Complimentary coleslaw"]}'::jsonb
where id = 'sadza'
  and (options is null or options = '{"proteins":[],"sides":[]}'::jsonb);
