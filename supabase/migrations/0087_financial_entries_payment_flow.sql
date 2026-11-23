-- Fase 2 das correções pós-auditoria (financeiro): marcar como pago em
-- lote, comprovante opcional, desfazer com motivo, e quem/quando confirmou
-- visível na tela (hoje só no audit_log). Também aplica a [DECISÃO 1]
-- confirmada com o cliente: só recepção e admin podem dar baixa num
-- lançamento — profissional passa a só VISUALIZAR o status (a policy de
-- SELECT da migration 0010 não muda).

-- ---------------------------------------------------------------------------
-- 1) Colunas novas: quem confirmou o pagamento (hoje só no audit_log, sem
--    aparecer na tela), comprovante opcional, e rastro de "desfazer".
-- ---------------------------------------------------------------------------
alter table public.financial_entries
  add column paid_by uuid references public.profiles (id) on delete set null,
  add column payment_proof_path text,
  add column undone_at timestamptz,
  add column undone_by uuid references public.profiles (id) on delete set null,
  add column undo_reason text;

comment on column public.financial_entries.paid_by is
  'Quem deu a baixa (marcou como pago) — preenchido por markAsPaid/markEntriesAsPaid. Nunca o próprio profissional desde esta migração (ver policy financial_entries_update abaixo).';
comment on column public.financial_entries.payment_proof_path is
  'Path no bucket privado payment-proofs (imagem/PDF). Opcional — nulo quando não há comprovante anexado.';
comment on column public.financial_entries.undo_reason is
  'Motivo obrigatório ao reverter pago -> em_aberto (undoMarkAsPaid). Preenchido junto com undone_at/undone_by.';

-- Nota sobre item 11 do pedido (duplicidade conceitual de "convênio"):
-- payment_method aceita o valor 'convenio' (forma de pagamento) E a linha
-- também tem insurance_id (o convênio específico, sempre preenchido, mesmo
-- quando payment_method é 'particular'/dinheiro/cartão/pix — nesse caso
-- aponta para o convênio "Particular" cadastrado em Configurações). Ou seja:
-- payment_method='convenio' não é redundante com insurance_id — ele é quem
-- decide SE o atendimento é cobrado de um convênio terceiro (reembolso/
-- faturamento à operadora) ou pago diretamente pelo paciente (dinheiro/
-- cartão/pix), enquanto insurance_id sempre identifica QUAL convênio/
-- Particular precificou a consulta. Mantido como está por decisão desta
-- fase (sem migration arriscada); documentado aqui para não ser confundido
-- com um bug no futuro.
comment on column public.financial_entries.payment_method is
  'Forma de cobrança deste lançamento (dinheiro/cartao/pix/convenio) — independente de insurance_id, que sempre identifica qual convênio/Particular precificou a consulta, mesmo quando payment_method não é ''convenio''. Não é redundante: ver comentário da migration 0087.';

-- ---------------------------------------------------------------------------
-- 2) [DECISÃO 1] Profissional deixa de poder dar baixa no próprio
--    lançamento — só vê (policy de SELECT da 0010, inalterada). Recepção
--    mantém o que já tinha (financial_entries_update_recepcionista, 0022).
-- ---------------------------------------------------------------------------
drop policy "financial_entries_update" on public.financial_entries;

create policy "financial_entries_update"
  on public.financial_entries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Trigger ajustada: só admin (bypassa tudo) ou recepcionista (campos
-- limitados) chegam aqui agora — o branch que liberava
-- old.professional_id = auth.uid() não tem mais como ser alcançado (sem
-- policy de UPDATE pra esse caso), removido para não sugerir que ainda é
-- possível.
create or replace function public.prevent_financial_entry_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if public.current_role() <> 'recepcionista' then
    raise exception 'Não autorizado.';
  end if;

  if new.value <> old.value
     or new.due_date <> old.due_date
     or new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.insurance_id is distinct from old.insurance_id
     or new.payment_method <> old.payment_method then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Bucket privado para o comprovante de pagamento — só admin/recepção
--    leem e enviam (nunca o profissional, nem o paciente). Path:
--    {financial_entry_id}/{arquivo}.{ext} — não há "dono" individual como em
--    evolution-attachments (o lançamento já pertence à clínica, não a uma
--    pessoa), por isso a policy é por role, não por pasta.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "payment_proofs_storage_select"
  on storage.objects for select
  using (bucket_id = 'payment-proofs' and (public.is_admin() or public.current_role() = 'recepcionista'));

create policy "payment_proofs_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and (public.is_admin() or public.current_role() = 'recepcionista'));

-- Sem policy de update/delete: comprovante enviado é permanente, mesmo se o
-- pagamento for desfeito depois (undoMarkAsPaid não apaga o arquivo) — mesmo
-- princípio de evidência que não se perde já usado em consent-signatures
-- (migration 0084).
