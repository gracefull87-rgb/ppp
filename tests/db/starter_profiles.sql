-- 테스트용: Supabase 'User Management Starter' 예제가 만드는 것과 같은 profiles·트리거
create table public.profiles (
  id uuid references auth.users not null primary key, updated_at timestamptz,
  username text unique, full_name text, avatar_url text, website text);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url) values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ee', 'early@test.local');
