-- Etapa 78: perfil "Coordenação" — papel novo + acúmulo de função.
--
-- Contexto (feedback da coordenadora): ela precisa saber se as evoluções
-- estão sendo feitas e quantas foram, SEM acesso ao conteúdo clínico. Isso
-- exige um papel próprio no sistema. Mas o modelo de papéis é uma coluna
-- única (profiles.role), e o pedido também exige que uma pessoa possa ser
-- terapeuta E coordenadora ao mesmo tempo — se "coordenacao" fosse apenas um
-- quinto valor da coluna, a coordenadora que atende deixaria de ser
-- 'profissional' e perderia agenda própria, vínculo com pacientes e acesso
-- às próprias evoluções. Inaceitável.
--
-- Desenho adotado (aprovado antes da implementação):
--   1. 'coordenacao' entra como valor válido de role -> é o papel de quem SÓ
--      coordena e não atende. Selecionável na tela de Equipe, só por admin.
--   2. profiles.is_coordinator é o ACÚMULO de função -> quem é
--      'profissional' e também coordena. Só faz sentido sobre
--      'profissional', e o gatilho abaixo garante isso.
--   3. public.is_coordinator() responde "sim" nos dois casos. TODA policy
--      nova de coordenação usa essa função e nunca testa role direto, para a
--      dualidade ficar escondida num único lugar.
--
-- Consequência deliberada do desenho: as policies de coordenação NUNCA
-- concedem acesso a conteúdo clínico. Quem acumula os dois papéis enxerga
-- texto de evolução e anexos exclusivamente pelas policies de terapeuta, que
-- exigem vínculo com o paciente (0069). Portanto "ela vê o conteúdo apenas
-- dos pacientes dela" não precisa de regra própria — é consequência
-- automática, não um caso especial que alguém possa esquecer de manter.

-- ---------------------------------------------------------------------------
-- 1) Novo valor de role. Mesmo padrão de drop+add da check usado na 0020/0067.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'recepcionista', 'profissional', 'paciente', 'coordenacao'));

alter table public.role_permissions drop constraint role_permissions_role_check;
alter table public.role_permissions add constraint role_permissions_role_check
  check (role in ('admin', 'recepcionista', 'profissional', 'paciente', 'coordenacao'));

-- ---------------------------------------------------------------------------
-- 2) Acúmulo de função.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column is_coordinator boolean not null default false;

comment on column public.profiles.is_coordinator is
  'Acumulo da funcao de Coordenacao sobre um profissional que tambem atende. Só pode ser true quando role = profissional (normalizado pelo gatilho profiles_normalize_coordinator). Para "é coordenação?" use public.is_coordinator(), nunca esta coluna direto — ela não cobre o papel puro.';

-- O acúmulo é um atributo DERIVADO do papel: não existe "coordenador
-- acumulado" sobre admin, recepção, paciente ou sobre o próprio papel puro de
-- coordenação. Normalizar num gatilho BEFORE (em vez de só falhar numa check)
-- evita que trocar o cargo de alguém exploda com erro obscuro — o acúmulo
-- simplesmente deixa de existir junto com o papel que o sustentava.
create or replace function public.profiles_normalize_coordinator()
returns trigger
language plpgsql
as $$
begin
  if new.role <> 'profissional' then
    new.is_coordinator := false;
  end if;
  return new;
end;
$$;

create trigger profiles_normalize_coordinator
  before insert or update on public.profiles
  for each row execute function public.profiles_normalize_coordinator();

-- Defesa em profundidade: a check nunca deve disparar, porque o gatilho BEFORE
-- acima roda antes das constraints. Fica como rede de segurança caso o gatilho
-- seja removido ou desabilitado por engano no futuro.
alter table public.profiles add constraint profiles_is_coordinator_requires_profissional
  check (not is_coordinator or role = 'profissional');

-- ---------------------------------------------------------------------------
-- 3) Função de apoio única para o RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- profiles.is_coordinator qualificado de propósito: a coluna tem o mesmo
  -- nome desta função, e deixar o identificador nu obrigaria quem lê a
  -- lembrar da regra de precedência do Postgres para saber o que está sendo
  -- avaliado. Numa função de segurança, não se deixa isso implícito.
  select coalesce(
    (select profiles.role = 'coordenacao' or profiles.is_coordinator
       from public.profiles
      where profiles.id = auth.uid()),
    false
  );
$$;

comment on function public.is_coordinator() is
  'True para o papel puro coordenacao e para o profissional com acumulo de funcao. Usar em toda policy de coordenacao — nunca testar role = coordenacao direto, senao a coordenadora que tambem atende fica de fora.';

-- ---------------------------------------------------------------------------
-- 4) Endurece o bloqueio de auto-promoção (0001_init).
--    Sem isto, is_coordinator seria a única coluna de privilégio que o
--    próprio usuário poderia alterar sozinho via policy
--    profiles_update_self_or_admin — uma auto-promoção silenciosa.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.is_coordinator is distinct from old.is_coordinator)
     and not public.is_admin() then
    raise exception 'Somente administradores podem alterar cargo ou status.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Permissões do papel.
--    Escopo mínimo desta etapa, de propósito: só o que tem tela existente e
--    funcionando. O acompanhamento de evoluções, a gestão de modelos e a
--    biblioteca de protocolos entram junto com as telas delas, nas etapas
--    seguintes — permissão semeada sem tela é item de menu quebrado.
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('coordenacao', 'dashboard.view'),
  ('coordenacao', 'profile.edit.self');

-- ---------------------------------------------------------------------------
-- 6) Leitura da agenda.
--    A coordenação precisa enxergar os atendimentos para saber qual gerou
--    qual pendência de evolução (é a base da etapa de acompanhamento) e para
--    as contagens operacionais do dashboard. Só SELECT: as policies de
--    insert/update/delete de appointments não são tocadas, então ela não
--    cria, não edita e não cancela nada.
--    appointments é tabela de agenda/operação, não de prontuário — mesmo
--    tratamento que admin e recepção já recebem aqui desde a 0039.
-- ---------------------------------------------------------------------------
--    Mantém public.is_appointment_cotherapist(id) em vez de reescrever o
--    join em appointment_professionals: a 0040 trocou exatamente esse join
--    por essa função para quebrar a recursão infinita (42P17) entre
--    appointments_select e appointment_professionals_select, e a 0050
--    consolidou o padrão. Só acrescenta a cláusula de coordenação.
drop policy "appointments_select" on public.appointments;
create policy "appointments_select"
  on public.appointments for select
  to authenticated
  using (
    patient_id = auth.uid()
    or professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
    or public.is_coordinator()
    or public.is_appointment_cotherapist(id)
  );

-- Nota deliberada sobre o que NÃO entra nesta etapa:
--   * profiles: a coordenação ainda não lê nome de paciente/profissional. A
--     tela de acompanhamento vai precisar, e vai receber uma VIEW que expõe
--     só id e nome — não a tabela inteira, que também tem telefone (dado de
--     contato fora do escopo aprovado).
--   * patient_evolutions, patient_evolution_addenda, clinical_documents,
--     ai_reports, session_transcriptions: nenhuma policy nova. Coordenação
--     segue com acesso ZERO a conteúdo clínico, igual recepção e igual admin
--     desde a 0031/0069.
--   * financial_entries, financial_transactions: nenhuma policy nova.
--     Sem financeiro por padrão, conforme decidido.
