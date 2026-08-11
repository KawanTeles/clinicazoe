-- Etapa 45: Documentos Clínicos — armazenamento privado de arquivos anexados
-- ao prontuário (laudos, exames, encaminhamentos, fotos). Mesmo princípio de
-- sigilo profissional da Etapa 31 (LGPD): documento clínico é prontuário, não
-- gestão administrativa — só o profissional que enviou tem acesso, admin não
-- vê conteúdo nem metadado.
--
-- RLS em duas camadas: a tabela `clinical_documents` controla quem enxerga a
-- LINHA (metadados); o bucket `clinical-documents` controla quem baixa o
-- ARQUIVO. As duas precisam concordar — path do arquivo usa o mesmo dono
-- (auth.uid()) como primeira pasta, igual ao bucket `avatars` (Etapa 1).
--
-- Delete físico é uma exceção deliberada ao padrão "histórico nunca se
-- perde" do resto do prontuário (patient_evolutions e ai_reports não têm
-- policy de delete): em alto volume de atendimento, envio errado de arquivo
-- (paciente trocado, exame de outra pessoa) é frequente e precisa de
-- correção real, não só ocultação. Em troca, upload e delete passam por
-- logAudit (Etapa 30) — perde-se o arquivo, nunca o rastro de quem
-- enviou/removeu o quê e quando.

create table public.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  evolution_id uuid references public.patient_evolutions (id) on delete set null,
  description text,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp'
  )),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  -- created_by é NOT NULL: "on delete restrict", não "set null" — mesma
  -- lição da Etapa 42 (patient_evolutions_created_by_fkey), que corrigiu
  -- exatamente essa contradição (coluna NOT NULL com FK "set null" trava o
  -- delete do profile com "violates not-null constraint").
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.clinical_documents enable row level security;

create index clinical_documents_patient_idx
  on public.clinical_documents (patient_id, created_at desc);
create index clinical_documents_professional_idx
  on public.clinical_documents (professional_id, created_at desc);
create index clinical_documents_evolution_idx
  on public.clinical_documents (evolution_id)
  where evolution_id is not null;

-- Mesma validação de patient_evolutions_validate (Etapa 25): se o documento
-- referencia uma evolução, ela precisa realmente pertencer a esse mesmo
-- paciente e profissional — não dá pra pendurar um documento na evolução de
-- outra pessoa só porque o ID foi adivinhado/copiado.
create or replace function public.clinical_documents_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  evo record;
begin
  if new.evolution_id is not null then
    select patient_id, professional_id
      into evo
      from public.patient_evolutions
      where id = new.evolution_id;

    if evo is null then
      raise exception 'Evolução não encontrada.';
    end if;

    if evo.patient_id <> new.patient_id or evo.professional_id <> new.professional_id then
      raise exception 'O documento deve pertencer ao mesmo paciente e profissional da evolução vinculada.';
    end if;
  end if;

  return new;
end;
$$;

create trigger clinical_documents_validate_bi
  before insert on public.clinical_documents
  for each row execute function public.clinical_documents_validate();

-- Sigilo profissional (mesmo espírito da Etapa 31): só quem enviou vê;
-- admin não tem policy de select, não enxerga metadado nem conteúdo.
create policy "clinical_documents_select_own"
  on public.clinical_documents for select
  to authenticated
  using (professional_id = auth.uid());

create policy "clinical_documents_insert_own"
  on public.clinical_documents for insert
  to authenticated
  with check (professional_id = auth.uid() and created_by = auth.uid());

-- Delete físico permitido só ao profissional dono (created_by) — exceção
-- deliberada ao padrão de histórico imutável do resto do prontuário (ver
-- comentário no topo). Sem policy de delete para admin/recepcionista/
-- paciente.
create policy "clinical_documents_delete_own"
  on public.clinical_documents for delete
  to authenticated
  using (created_by = auth.uid());

-- Sem policy de update: documento é imutável — para corrigir, remove e
-- reenvia (cada operação fica com seu próprio rastro em audit_logs).

insert into public.role_permissions (role, permission) values
  ('profissional', 'documents.upload'),
  ('profissional', 'documents.view.own'),
  ('profissional', 'documents.delete.own')
on conflict (role, permission) do nothing;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado + policies próprias (segunda camada de RLS).
-- Path: `{professional_id}/{patient_id}/{document_id}.{ext}` — o primeiro
-- nível da pasta é o dono (auth.uid()), mesmo padrão do bucket `avatars`
-- (Etapa 1), então a policy não precisa fazer join com a tabela.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-documents', 'clinical-documents', false, 10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "clinical_documents_storage_select_owner"
  on storage.objects for select
  using (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "clinical_documents_storage_insert_owner"
  on storage.objects for insert
  with check (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "clinical_documents_storage_delete_owner"
  on storage.objects for delete
  using (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = auth.uid()::text);
