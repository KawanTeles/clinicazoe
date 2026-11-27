-- Remoção definitiva do login/portal do paciente (decisão do cliente,
-- substitui a simplificação anterior que só escondia os links). NADA é
-- apagado: cadastro, atendimentos, evoluções, programas, financeiro e
-- faltas de cada paciente continuam intactos. O que muda é só a capacidade
-- de autenticar — a identidade em auth.users continua existindo porque
-- profiles.id/appointments.patient_id (e todo o resto do modelo de dado)
-- dependem dela.
--
-- Três camadas, de propósito (defesa em profundidade — cada uma cobre uma
-- falha diferente das outras duas):
--   1) profiles.status = 'inactive' — já é checado por getCurrentUser() no
--      nível da aplicação (src/lib/auth.ts); reaproveita o mesmo mecanismo
--      já usado por setPatientStatus(), nada novo.
--   2) auth.users.banned_until — bloqueia no próprio Supabase Auth: sem
--      isso, um e-mail/senha real cadastrado por engano continuaria
--      conseguindo gerar sessão nova via login ou "esqueci minha senha",
--      mesmo com a UI toda removida (API do Supabase não liga pra
--      profiles.status, só pra auth.users).
--   3) Apagar auth.sessions/auth.refresh_tokens — deriruba qualquer sessão
--      JÁ aberta na hora, em vez de só impedir sessão nova (um token de
--      acesso emitido antes do ban continuaria passando até expirar
--      sozinho, só pela trava 2).
--
-- Reversível manualmente se um dia precisar: profiles.status = 'active',
-- auth.users.banned_until = null, e reinserir as linhas de role_permissions
-- abaixo (este arquivo não apaga nenhuma migration anterior, só desliga o
-- acesso por cima do que já existe).

-- profiles_prevent_role_self_escalation (0001_init.sql/0078) bloqueia
-- qualquer UPDATE que mude status/role fora de uma sessão com
-- is_admin()=true — correto para a aplicação, mas uma migration roda sem
-- contexto de sessão (auth.uid() nulo), então is_admin() também dá falso
-- aqui e o trigger bloquearia esta atualização em massa legítima. Desliga só
-- pelo tempo desta transação (migration inteira é 1 transação; religa antes
-- do commit, então nunca fica desprotegido pra uso normal da aplicação).
alter table public.profiles disable trigger profiles_prevent_role_self_escalation;

update public.profiles
set status = 'inactive'
where role = 'paciente' and status = 'active';

alter table public.profiles enable trigger profiles_prevent_role_self_escalation;

update auth.users
set banned_until = 'infinity'
where id in (select id from public.profiles where role = 'paciente');

delete from auth.sessions
where user_id in (select id from public.profiles where role = 'paciente');

delete from auth.refresh_tokens
where user_id in (select id::text from public.profiles where role = 'paciente');

-- Permissões que só o papel paciente usava (login nunca mais acontece, então
-- nunca mais são checadas) — limpeza, não é preciso deixar linha morta.
delete from public.role_permissions
where role = 'paciente'
  and permission in (
    'dashboard.view',
    'profile.edit.self',
    'appointments.book',
    'appointments.view.own',
    'waitlist.join'
  );
