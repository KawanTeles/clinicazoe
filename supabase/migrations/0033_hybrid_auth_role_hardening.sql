-- Autenticação híbrida: Google OAuth exclusivo para pacientes.
--
-- Até aqui, handle_new_user() lia "role" de raw_user_meta_data. Esse campo
-- é o mesmo "options.data" que o próprio cliente envia em
-- supabase.auth.signUp() (fluxo público de autocadastro) — ou seja, nada
-- impedia que alguém chamasse signUp() manualmente com
-- options.data.role = 'admin' e criasse uma conta administrativa sem
-- nenhuma aprovação. O login social também cai nesse mesmo campo
-- (raw_user_meta_data.name/picture vêm do Google), então a mesma lacuna
-- valia para o OAuth.
--
-- raw_app_meta_data, ao contrário, só pode ser definido pela service role
-- (admin.auth.admin.createUser com { app_metadata }) — nunca pelo cliente
-- autenticado com a anon key. A partir de agora o role só é aceito a
-- partir dali, e login via Google força sempre 'paciente', não importa o
-- que venha no metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text := new.raw_app_meta_data ->> 'provider';
  resolved_role text;
begin
  if provider = 'google' then
    resolved_role := 'paciente';
  else
    resolved_role := coalesce(new.raw_app_meta_data ->> 'role', 'paciente');
  end if;

  insert into public.profiles (id, full_name, phone, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'phone',
    resolved_role,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;
