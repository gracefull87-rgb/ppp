-- 마이그레이션 적용 전에 이미 만들어 둔 Auth 사용자에게도 프로필(비활성)을 만든다.
-- 여러 번 실행해도 안전하다(이미 있는 프로필은 건드리지 않음).
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1), '직원'), 30)
from auth.users u
on conflict (id) do nothing;
