-- Login social (Google OAuth): guarda a foto de perfil vinda do provedor
-- externo separada de avatar_path (que é um caminho no Storage privado,
-- usado só para uploads manuais e exige signed URL).

alter table public.profiles
  add column if not exists avatar_url text;

-- Atualiza o trigger de criação de profile para também aproveitar nome e
-- foto quando o cadastro vier de um provedor OAuth (ex.: Google preenche
-- full_name/name e avatar_url/picture no raw_user_meta_data). O fluxo de
-- cadastro por senha continua idêntico: essas chaves simplesmente não
-- existem no metadata dele, então avatar_url fica null como antes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'role', 'paciente'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;
