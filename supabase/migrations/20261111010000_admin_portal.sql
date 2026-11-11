-- Nexum · Portal de administración
-- Guarda el correo en `profiles` para poder listar usuarios sin acceder a auth.users.

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
