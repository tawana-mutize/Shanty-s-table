-- Grants Kitchen dashboard access to the temporary test account.
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('tawamutize@gmail.com')
on conflict (user_id) do nothing;

-- This should return one row after the grant succeeds.
select
  au.email,
  ad.created_at
from public.admin_users ad
join auth.users au on au.id = ad.user_id
where lower(au.email) = lower('tawamutize@gmail.com');
