-- Etapa 84: Anexos na evolução (D1/item 6) + termo de consentimento de
-- imagem (D3/item 7) + fluxo de liberação de anexo entre terapeutas (P1,
-- aprovado no desenho). Terceira parte do pedido original, construída sobre
-- a base da Fase 2 (rascunho mutável + evolução assinada imutável).
--
-- Desenho resumido (já aprovado):
--   - Anexo pertence a um RASCUNHO (mutável, pode remover) ou a uma
--     EVOLUÇÃO JÁ ASSINADA (imutável, nunca remove) — nunca os dois. Ao
--     assinar, a action de assinatura troca o vínculo (mesma transação que
--     já copia o rascunho para patient_evolutions).
--   - Anexo é visível SÓ para quem o enviou (D3), diferente do TEXTO da
--     evolução, que todo terapeuta vinculado já lê desde a 0069. Acesso de
--     outro terapeuta só existe via LIBERAÇÃO explícita, registrada.
--   - Imagem/áudio exigem termo de consentimento VIGENTE no momento do
--     envio (D3/item 7); documento comum (laudo etc.) não exige (decisão
--     Q3). Revogar o termo NÃO apaga anexo já enviado (decisão Q2) — só
--     bloqueia envio novo.
--   - Admin e Coordenação NUNCA têm policy de select em nenhuma das
--     tabelas abaixo — mesmo padrão de patient_evolutions desde a 0031/0069.

-- ---------------------------------------------------------------------------
-- 1) Termo de consentimento — modelo (editável pelo admin) + instâncias
--    assinadas por paciente.
--
--    O MODELO é append-only: editar no admin cria uma VERSÃO NOVA (linha
--    nova), nunca reescreve a anterior — um termo assinado precisa continuar
--    apontando para o texto EXATO que foi mostrado e assinado na hora,
--    mesmo que o admin corrija o texto depois.
-- ---------------------------------------------------------------------------
create table public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  body text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.consent_templates enable row level security;

-- Só uma versão ativa por vez — publicar uma nova arquiva a anterior antes
-- (mesma transação, ver trigger abaixo).
create unique index consent_templates_single_active_idx
  on public.consent_templates (status)
  where status = 'active';

create unique index consent_templates_version_idx on public.consent_templates (version);

-- Arquiva a versão ativa anterior sozinho quando uma nova é publicada, pra
-- quem edita não precisar lembrar de fazer os dois passos manualmente (e
-- principalmente pra nunca existir duas versões 'active' ao mesmo tempo,
-- o que deixaria "qual termo vale" ambíguo).
create or replace function public.consent_templates_archive_previous()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.consent_templates
       set status = 'archived'
     where status = 'active'
       and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger consent_templates_archive_previous
  after insert on public.consent_templates
  for each row execute function public.consent_templates_archive_previous();

-- Modelo em si não é dado clínico (é texto jurídico/administrativo) —
-- leitura liberada a quem pode colher termo (profissional) ou administra
-- (admin/coordenação), pra saber o texto vigente antes de colher a
-- assinatura. Escrita só admin.
create policy "consent_templates_select"
  on public.consent_templates for select
  to authenticated
  using (
    public.current_role() = 'profissional'
    or public.is_admin()
    or public.is_coordinator()
  );

create policy "consent_templates_insert_admin_only"
  on public.consent_templates for insert
  to authenticated
  with check (public.is_admin());

-- Sem policy de update/delete: append-only, de propósito (ver comentário
-- acima). "Editar" na UI = inserir versão nova.

-- ---------------------------------------------------------------------------
-- 2) Termo assinado — uma linha por paciente enquanto vigente. Revogação é
--    uma transição (revoked_at), nunca um delete: o termo revogado continua
--    provando o que foi autorizado até a data da revogação.
-- ---------------------------------------------------------------------------
create table public.image_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid not null references public.consent_templates (id) on delete restrict,
  guardian_name text not null,
  guardian_relationship text not null,
  -- Assinatura na tela (PNG do traço) OU upload do termo assinado em papel
  -- (foto/PDF) — pelo menos um dos dois, nunca nenhum (check abaixo).
  signature_image_path text,
  signed_document_path text,
  collected_by uuid not null references public.professionals (id) on delete restrict,
  signed_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (signature_image_path is not null or signed_document_path is not null)
);

alter table public.image_consents enable row level security;

-- Só um termo VIGENTE (não revogado) por paciente — um novo termo só pode
-- ser colhido depois de revogar o anterior, nunca dois vigentes ao mesmo
-- tempo (senão "o termo está vigente?" vira uma pergunta ambígua).
create unique index image_consents_one_active_per_patient_idx
  on public.image_consents (patient_id)
  where revoked_at is null;

create index image_consents_patient_idx on public.image_consents (patient_id, signed_at desc);

-- Mesma checagem de vínculo que o resto do prontuário: só quem já atende
-- (ou atendeu) o paciente pode colher o termo dele — reusa
-- is_appointment_cotherapist indiretamente via exists em appointments.
create or replace function public.image_consents_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.appointments a
     where a.patient_id = new.patient_id
       and (a.professional_id = new.collected_by
            or exists (
              select 1 from public.appointment_professionals ap
               where ap.appointment_id = a.id and ap.professional_id = new.collected_by
            ))
  ) then
    raise exception 'Só é possível colher o termo de um paciente já vinculado ao profissional.';
  end if;
  return new;
end;
$$;

create trigger image_consents_validate_bi
  before insert on public.image_consents
  for each row execute function public.image_consents_validate();

-- Leitura: qualquer profissional vinculado ao paciente (mesmo critério da
-- 0069 para o TEXTO da evolução) — um terapeuta novo precisa saber se já
-- existe termo vigente, sem precisar ser quem colheu. Nome/parentesco do
-- responsável não é "conteúdo clínico" no sentido sigiloso — é dado
-- administrativo de consentimento, mas mesmo assim fica de fora de
-- admin/recepção/coordenação, por ser dado pessoal do responsável.
create policy "image_consents_select_linked"
  on public.image_consents for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = image_consents.patient_id
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  );

create policy "image_consents_insert_own"
  on public.image_consents for insert
  to authenticated
  with check (collected_by = auth.uid());

-- Revogar é a ÚNICA alteração permitida, e só por quem já tinha leitura
-- (mesmo grupo de profissionais vinculados) — não precisa ser
-- necessariamente quem colheu originalmente (o responsável pode revogar
-- falando com qualquer terapeuta da equipe que atende a criança).
create policy "image_consents_update_revoke"
  on public.image_consents for update
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = image_consents.patient_id
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  )
  with check (true);

-- with check(true) acima não restringe QUAL coluna muda — RLS não tem esse
-- vocabulário (não dá pra expressar "só revoked_at/revoked_by" num with
-- check, que só vê a linha inteira). O gatilho abaixo é quem de fato impede
-- reescrever um termo já assinado por essa porta.
create or replace function public.image_consents_restrict_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.revoked_at is not null then
    raise exception 'Este termo já estava revogado.';
  end if;
  if new.patient_id <> old.patient_id
     or new.template_id <> old.template_id
     or new.guardian_name <> old.guardian_name
     or new.guardian_relationship <> old.guardian_relationship
     or coalesce(new.signature_image_path, '') <> coalesce(old.signature_image_path, '')
     or coalesce(new.signed_document_path, '') <> coalesce(old.signed_document_path, '')
     or new.collected_by <> old.collected_by
     or new.signed_at <> old.signed_at
  then
    raise exception 'Só é possível revogar um termo — nenhum outro campo pode ser alterado.';
  end if;
  return new;
end;
$$;

create trigger image_consents_restrict_update_bu
  before update on public.image_consents
  for each row execute function public.image_consents_restrict_update();

-- ---------------------------------------------------------------------------
-- 3) Anexo da evolução.
-- ---------------------------------------------------------------------------
create table public.evolution_attachments (
  id uuid primary key default gen_random_uuid(),
  -- Exatamente um dos dois: rascunho (mutável) OU evolução assinada
  -- (imutável). A assinatura troca de um pro outro na mesma transação que
  -- copia o rascunho pra patient_evolutions.
  draft_id uuid references public.evolution_drafts (id) on delete cascade,
  evolution_id uuid references public.patient_evolutions (id) on delete restrict,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  kind text not null check (kind in ('imagem', 'documento', 'audio')),
  caption text,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null check (mime_type in (
    'image/webp', 'application/pdf',
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
    'audio/wav', 'audio/x-wav', 'audio/webm'
  )),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  -- Obrigatório quando kind é imagem/áudio (gatilho abaixo valida que o
  -- termo referenciado é do mesmo paciente e estava vigente no momento do
  -- envio); sempre null quando kind é documento (decisão Q3 — laudo comum
  -- não exige termo).
  consent_id uuid references public.image_consents (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((draft_id is not null) <> (evolution_id is not null))
);

alter table public.evolution_attachments enable row level security;

create index evolution_attachments_draft_idx
  on public.evolution_attachments (draft_id) where draft_id is not null;
create index evolution_attachments_evolution_idx
  on public.evolution_attachments (evolution_id) where evolution_id is not null;
create index evolution_attachments_professional_patient_idx
  on public.evolution_attachments (professional_id, patient_id);

-- attachment_access_grants criada JÁ AQUI (fora de ordem com a seção 4 mais
-- abaixo) porque a policy de SELECT de evolution_attachments, logo a
-- seguir, precisa ler esta tabela — e attachment_id referencia
-- evolution_attachments(id), então também não pode vir antes desta linha.
create table public.attachment_access_grants (
  id uuid primary key default gen_random_uuid(),
  -- null = liberação TOTAL (todos os anexos deste autor, deste paciente,
  -- inclusive os futuros) — não só o que existe hoje. Se for um UUID,
  -- liberação de UM anexo específico.
  attachment_id uuid references public.evolution_attachments (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  author_professional_id uuid not null references public.professionals (id) on delete cascade,
  granted_to_professional_id uuid not null references public.professionals (id) on delete cascade,
  granted_by uuid not null references public.profiles (id) on delete restrict,
  justification text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  check (granted_to_professional_id <> author_professional_id)
);

alter table public.attachment_access_grants enable row level security;

create index attachment_access_grants_recipient_idx
  on public.attachment_access_grants (granted_to_professional_id) where revoked_at is null;
create index attachment_access_grants_author_idx
  on public.attachment_access_grants (author_professional_id, patient_id);

create or replace function public.evolution_attachments_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  src record;
  consent record;
begin
  -- Consistência com o rascunho/evolução referenciado — mesmo paciente e
  -- profissional, mesmo padrão de clinical_documents_validate (0045).
  if new.draft_id is not null then
    select patient_id, professional_id into src from public.evolution_drafts where id = new.draft_id;
    if src is null then
      raise exception 'Rascunho não encontrado.';
    end if;
    if src.patient_id <> new.patient_id or src.professional_id <> new.professional_id then
      raise exception 'O anexo deve pertencer ao mesmo paciente e profissional do rascunho.';
    end if;
  end if;

  if new.evolution_id is not null then
    select patient_id, professional_id into src from public.patient_evolutions where id = new.evolution_id;
    if src is null then
      raise exception 'Evolução não encontrada.';
    end if;
    if src.patient_id <> new.patient_id or src.professional_id <> new.professional_id then
      raise exception 'O anexo deve pertencer ao mesmo paciente e profissional da evolução.';
    end if;
  end if;

  -- Imagem/áudio: termo vigente obrigatório, do mesmo paciente, no momento
  -- do envio. Mensagem de erro clara o bastante pra virar o aviso da tela
  -- (item 7: "mensagem clara explicando como colher o termo").
  if new.kind in ('imagem', 'audio') then
    if new.consent_id is null then
      raise exception 'Nenhum termo de consentimento vigente para este paciente — colha o termo antes de anexar imagem ou áudio.';
    end if;
    select patient_id, revoked_at into consent from public.image_consents where id = new.consent_id;
    if consent is null or consent.patient_id <> new.patient_id then
      raise exception 'O termo informado não pertence a este paciente.';
    end if;
    if consent.revoked_at is not null then
      raise exception 'O termo de consentimento deste paciente foi revogado — colha um novo termo antes de anexar imagem ou áudio.';
    end if;
  elsif new.consent_id is not null then
    raise exception 'Documento comum não referencia termo de consentimento.';
  end if;

  return new;
end;
$$;

create trigger evolution_attachments_validate_bi
  before insert on public.evolution_attachments
  for each row execute function public.evolution_attachments_validate();

-- SELECT: o autor sempre; outro profissional só com liberação ativa
-- (específica deste anexo, ou "liberação total" deste autor pra este
-- paciente — attachment_id null na grant, ver tabela abaixo).
create policy "evolution_attachments_select"
  on public.evolution_attachments for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.attachment_access_grants g
       where g.granted_to_professional_id = auth.uid()
         and g.revoked_at is null
         and (
           g.attachment_id = evolution_attachments.id
           or (g.attachment_id is null
               and g.author_professional_id = evolution_attachments.professional_id
               and g.patient_id = evolution_attachments.patient_id)
         )
    )
  );

create policy "evolution_attachments_insert_own"
  on public.evolution_attachments for insert
  to authenticated
  with check (professional_id = auth.uid() and created_by = auth.uid());

-- UPDATE só pra uma transição específica (a assinatura trocando draft_id
-- por evolution_id) — using() exige que AINDA esteja em rascunho; depois da
-- troca, draft_id vira null e a linha deixa de bater no using(), travando
-- qualquer novo update. Mesmo efeito prático de "imutável após assinar"
-- que patient_evolutions tem por SIMPLESMENTE não ter policy de update —
-- aqui precisa de policy porque a transição de vínculo é legítima.
create policy "evolution_attachments_update_on_sign"
  on public.evolution_attachments for update
  to authenticated
  using (created_by = auth.uid() and draft_id is not null)
  with check (created_by = auth.uid());

-- with check acima só garante que created_by não muda — não impede
-- reescrever file_path/mime_type/kind/consent_id etc. durante a mesma
-- transição. O gatilho é quem de fato restringe a UMA mudança possível:
-- draft_id -> null, evolution_id -> preenchido, mais nada.
create or replace function public.evolution_attachments_restrict_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.draft_id is null then
    raise exception 'Anexo de evolução já assinada não pode ser alterado.';
  end if;
  if new.draft_id is not null or new.evolution_id is null then
    raise exception 'A única alteração permitida é a transição de rascunho para evolução assinada.';
  end if;
  if new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.kind <> old.kind
     or new.file_name <> old.file_name
     or new.file_path <> old.file_path
     or new.mime_type <> old.mime_type
     or new.file_size_bytes <> old.file_size_bytes
     or coalesce(new.consent_id::text, '') <> coalesce(old.consent_id::text, '')
     or coalesce(new.caption, '') <> coalesce(old.caption, '')
     or new.created_by <> old.created_by
  then
    raise exception 'A única alteração permitida é apontar o anexo para a evolução recém-assinada.';
  end if;
  return new;
end;
$$;

create trigger evolution_attachments_restrict_update_bu
  before update on public.evolution_attachments
  for each row execute function public.evolution_attachments_restrict_update();

-- DELETE: só enquanto ainda é rascunho (mutável) — depois de assinar, nunca
-- (sem policy cobrindo evolution_id is not null).
create policy "evolution_attachments_delete_while_draft"
  on public.evolution_attachments for delete
  to authenticated
  using (created_by = auth.uid() and draft_id is not null);

-- ---------------------------------------------------------------------------
-- 4) Liberação de anexo entre terapeutas (P1). A TABELA já foi criada mais
--    acima (antes das policies de evolution_attachments, que leem
--    attachment_access_grants no próprio SELECT — precisava existir antes).
-- ---------------------------------------------------------------------------

-- Quem libera: o próprio autor, OU a Coordenação quando o autor está
-- inativo (saiu da clínica) — exatamente a regra combinada no desenho.
create or replace function public.attachment_access_grants_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_status text;
begin
  if new.granted_by <> auth.uid() then
    raise exception 'granted_by precisa ser quem está autenticado.';
  end if;

  if new.author_professional_id = auth.uid() then
    return new; -- o próprio autor sempre pode liberar o que é dele.
  end if;

  if public.is_coordinator() then
    select status into author_status from public.profiles where id = new.author_professional_id;
    if author_status = 'inactive' then
      return new;
    end if;
    raise exception 'A Coordenação só libera anexos de um autor inativo. Este profissional ainda está ativo — peça a liberação a ele.';
  end if;

  raise exception 'Só o autor do anexo, ou a Coordenação quando o autor está inativo, pode liberar acesso.';
end;
$$;

create trigger attachment_access_grants_validate_bi
  before insert on public.attachment_access_grants
  for each row execute function public.attachment_access_grants_validate();

create policy "attachment_access_grants_select"
  on public.attachment_access_grants for select
  to authenticated
  using (
    granted_to_professional_id = auth.uid()
    or author_professional_id = auth.uid()
    or granted_by = auth.uid()
  );

-- INSERT liberado para quem está autenticado — a checagem de QUEM pode
-- liberar o quê é toda feita no gatilho acima (mais fácil de testar e de
-- dar mensagem de erro específica do que espalhar em with check()).
create policy "attachment_access_grants_insert"
  on public.attachment_access_grants for insert
  to authenticated
  with check (true);

-- Revogar: mesmo grupo que pode liberar (autor, ou coordenação com autor
-- inativo) — reusa o mesmo gatilho de validação não dá pra aplicar direto
-- num update (ele é pensado pro insert), então repete a regra na policy.
create policy "attachment_access_grants_update_revoke"
  on public.attachment_access_grants for update
  to authenticated
  using (
    author_professional_id = auth.uid()
    or (
      public.is_coordinator()
      and exists (
        select 1 from public.profiles p
         where p.id = attachment_access_grants.author_professional_id and p.status = 'inactive'
      )
    )
  )
  with check (true);

-- Mesma limitação do with check(true): o gatilho é quem garante que só
-- revoked_at/revoked_by mudam nesta porta.
create or replace function public.attachment_access_grants_restrict_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.revoked_at is not null then
    raise exception 'Esta liberação já estava revogada.';
  end if;
  if new.attachment_id is distinct from old.attachment_id
     or new.patient_id <> old.patient_id
     or new.author_professional_id <> old.author_professional_id
     or new.granted_to_professional_id <> old.granted_to_professional_id
     or new.granted_by <> old.granted_by
     or new.justification <> old.justification
     or new.granted_at <> old.granted_at
  then
    raise exception 'Só é possível revogar uma liberação — nenhum outro campo pode ser alterado.';
  end if;
  return new;
end;
$$;

create trigger attachment_access_grants_restrict_update_bu
  before update on public.attachment_access_grants
  for each row execute function public.attachment_access_grants_restrict_update();

-- ---------------------------------------------------------------------------
-- 5) Log de visualização de anexo — reaproveita audit_logs (já existe,
--    0001), não cria tabela nova. "quem anexou" já fica implícito no INSERT
--    de evolution_attachments + o logAudit que a action vai chamar; "quem
--    visualizou" é a action de download gerando a URL assinada chamando
--    logAudit toda vez, action 'evolution_attachment.viewed'.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6) Permissões novas.
-- ---------------------------------------------------------------------------
-- 'attachment_grants.manage_inactive' é só da Coordenação, de propósito —
-- o pedido original nomeia "Coordenação libera quando o autor está
-- inativo", nunca o admin; dar a permissão de UI ao admin sem o gatilho
-- attachment_access_grants_validate aceitar a inserção dele deixaria a
-- tela acessível e a ação sempre falhando, o que é pior do que não oferecer
-- a tela.
insert into public.role_permissions (role, permission) values
  ('profissional', 'evolution_attachments.manage'),
  ('profissional', 'image_consents.manage'),
  ('admin', 'consent_templates.manage'),
  ('coordenacao', 'attachment_grants.manage_inactive')
on conflict (role, permission) do nothing;

-- ---------------------------------------------------------------------------
-- 7) Storage: dois buckets privados, mesmo padrão de duas camadas já usado
--    em clinical-documents/avatars (path com o dono como primeira pasta).
-- ---------------------------------------------------------------------------

-- Anexos de evolução: path {professional_id}/{patient_id}/{attachment_id}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evolution-attachments', 'evolution-attachments', false, 15728640,
  array[
    'image/webp', 'application/pdf',
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
    'audio/wav', 'audio/x-wav', 'audio/webm'
  ]
)
on conflict (id) do nothing;

create policy "evolution_attachments_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'evolution-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.evolution_attachments ea
         join public.attachment_access_grants g
           on g.revoked_at is null
          and (g.attachment_id = ea.id
               or (g.attachment_id is null and g.author_professional_id = ea.professional_id and g.patient_id = ea.patient_id))
         where ea.file_path = name
           and g.granted_to_professional_id = auth.uid()
      )
    )
  );

create policy "evolution_attachments_storage_insert_owner"
  on storage.objects for insert
  with check (bucket_id = 'evolution-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "evolution_attachments_storage_delete_owner"
  on storage.objects for delete
  using (bucket_id = 'evolution-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Assinatura/termo em papel: path {patient_id}/{consent_id}.{ext} — dono
-- aqui é o PACIENTE, não o profissional (o termo é do paciente, lido por
-- qualquer terapeuta vinculado, igual a tabela image_consents).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consent-signatures', 'consent-signatures', false, 5242880,
  array['image/webp', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

create policy "consent_signatures_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'consent-signatures'
    and exists (
      select 1 from public.appointments a
       where a.patient_id::text = (storage.foldername(name))[1]
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  );

create policy "consent_signatures_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'consent-signatures'
    and exists (
      select 1 from public.appointments a
       where a.patient_id::text = (storage.foldername(name))[1]
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  );

-- Sem policy de delete em consent-signatures: o termo (e sua evidência) é
-- permanente, mesmo revogado — mesmo princípio de histórico clínico que
-- nunca se perde.

-- ---------------------------------------------------------------------------
-- 8) Função para a Coordenação ver QUAIS pacientes têm anexo de um autor
--    inativo, sem ver o anexo em si — ela não tem (e não ganha aqui) policy
--    de select em evolution_attachments, então sem isso não haveria como
--    saber para qual paciente liberar o acesso de outro profissional. Mesmo
--    padrão SECURITY DEFINER de get_evolution_tracking (Etapa 81): autorização
--    checada DENTRO da função, devolve só identificador + nome + contagem,
--    nunca o conteúdo do anexo.
-- ---------------------------------------------------------------------------
create or replace function public.get_patients_with_evolution_attachments(p_author_professional_id uuid)
returns table (
  patient_id uuid,
  patient_name text,
  attachment_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_coordinator() then
    raise exception 'Acesso negado.';
  end if;

  if not exists (select 1 from public.profiles where id = p_author_professional_id and status = 'inactive') then
    raise exception 'A Coordenação só consulta anexos de um autor inativo.';
  end if;

  return query
  select ea.patient_id, pat.full_name, count(*)
    from public.evolution_attachments ea
    join public.profiles pat on pat.id = ea.patient_id
   where ea.professional_id = p_author_professional_id
   group by ea.patient_id, pat.full_name
   order by pat.full_name;
end;
$$;

comment on function public.get_patients_with_evolution_attachments is
  'Lista pacientes com anexo de evolução de um profissional INATIVO, para a Coordenação decidir a quem liberar — nunca expõe o anexo em si. Autorização (is_coordinator() + autor inativo) verificada DENTRO da função.';
