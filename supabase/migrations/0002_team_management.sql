-- Etapa 2/3: gestão de equipe — sincroniza último acesso do Auth para profiles.

create or replace function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
    set last_sign_in_at = new.last_sign_in_at
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_sign_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_sign_in();
