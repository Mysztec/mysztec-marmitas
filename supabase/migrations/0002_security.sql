-- ============================================================================
-- 0002 - Endurecimento de seguranca
--
-- Corrige falhas herdadas do desenho original, em que o PIN do funcionario era
-- guardado e conferido em texto plano no navegador. Resumo do que muda:
--
--   1. PIN passa a ser hash bcrypt e some da API publica
--   2. Reserva e retirada passam a ser feitas por RPC que confere o PIN no
--      servidor, junto com janela de horario, unidade e bloqueio do sistema
--   3. Tentativas de PIN sao registradas e limitadas (anti forca bruta)
--   4. Escrita direta em meal_reservations fica restrita a admin
--   5. Admin deixa de conseguir se promover a dono
--   6. Funcoes internas deixam de ser chamaveis pela API
-- ============================================================================

-- --------------------------------------------------- 1. PIN vira hash ------

alter table public.employees add column if not exists pin_hash text;

-- Converte os PINs existentes. gen_salt('bf') usa bcrypt: mesmo com acesso
-- total ao banco, o PIN original nao e recuperavel.
update public.employees
   set pin_hash = crypt(pin, gen_salt('bf'))
 where pin is not null and pin <> '' and pin_hash is null;

alter table public.employees drop column if exists pin;

-- ------------------------------------- 2. Registro de tentativas de PIN ----

create table if not exists public.pin_attempts (
  id           bigserial primary key,
  employee_id  uuid references public.employees(id) on delete cascade,
  succeeded    boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_pin_attempts_lookup
  on public.pin_attempts (employee_id, attempted_at desc);

alter table public.pin_attempts enable row level security;

-- Ninguem le nem escreve direto: so as funcoes SECURITY DEFINER tocam nisso.
drop policy if exists pin_attempts_admin_read on public.pin_attempts;
create policy pin_attempts_admin_read on public.pin_attempts
  for select to authenticated using (public.is_admin());

-- ------------------------------------------- 3. Helpers de verificacao -----

create or replace function public.employee_pin_locked(p_employee uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select count(*) >= 5
    from public.pin_attempts
   where employee_id = p_employee
     and succeeded = false
     and attempted_at > now() - interval '15 minutes';
$fn$;

/**
 * Confere o PIN. Se o funcionario ainda nao tem PIN, o primeiro informado passa
 * a valer -- comportamento herdado do sistema anterior, mantido de proposito
 * para nao travar o cadastro em campo.
 */
create or replace function public.check_employee_pin(p_employee uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  stored text;
  ok     boolean;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return false;
  end if;

  select pin_hash into stored from public.employees where id = p_employee;

  if stored is null then
    update public.employees
       set pin_hash = crypt(p_pin, gen_salt('bf'))
     where id = p_employee;
    ok := true;
  else
    ok := (stored = crypt(p_pin, stored));
  end if;

  insert into public.pin_attempts (employee_id, succeeded) values (p_employee, ok);
  return ok;
end $fn$;

/** Fase corrente do dia, calculada no servidor a partir de global_settings. */
create or replace function public.current_phase()
returns text language plpgsql stable security definer set search_path = public as $fn$
declare
  s public.global_settings%rowtype;
  agora text;
begin
  select * into s from public.global_settings limit 1;
  if not found then return 'done'; end if;
  if s.trava_manual then return 'locked'; end if;

  -- America/Sao_Paulo: o horario configurado e local, nao UTC.
  agora := to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI');

  if s.reserva_inicio is not null and s.reserva_fim is not null
     and agora >= s.reserva_inicio and agora <= s.reserva_fim then
    return 'reserve';
  end if;
  if s.retirada_inicio is not null and s.retirada_fim is not null
     and agora >= s.retirada_inicio and agora <= s.retirada_fim then
    return 'pickup';
  end if;
  return 'done';
end $fn$;

-- ------------------------------------------------ 4. RPC de reserva --------

create or replace function public.reserve_meal(p_employee uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  emp        public.employees%rowtype;
  bloqueado  boolean;
  nova       public.meal_reservations%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'nao_autenticado');
  end if;

  select sistema_bloqueado into bloqueado from public.global_settings limit 1;
  if coalesce(bloqueado, false) and not public.is_dono() then
    return jsonb_build_object('ok', false, 'error', 'sistema_bloqueado');
  end if;

  if public.current_phase() <> 'reserve' then
    return jsonb_build_object('ok', false, 'error', 'fora_da_janela');
  end if;

  select * into emp from public.employees where id = p_employee;
  if not found or emp.active is false then
    return jsonb_build_object('ok', false, 'error', 'funcionario_invalido');
  end if;

  -- Usuario comum so opera funcionarios da propria unidade.
  if not public.is_admin() and emp.unidade_id is distinct from public.my_unidade() then
    return jsonb_build_object('ok', false, 'error', 'fora_da_unidade');
  end if;

  if public.employee_pin_locked(p_employee) then
    return jsonb_build_object('ok', false, 'error', 'bloqueado_por_tentativas');
  end if;

  if not public.check_employee_pin(p_employee, p_pin) then
    return jsonb_build_object('ok', false, 'error', 'pin_incorreto');
  end if;

  -- A data e o status vem do servidor: o cliente nao escolhe nenhum dos dois.
  insert into public.meal_reservations
    (employee_id, employee_name, date, status, reserved_at, unidade_id)
  values
    (emp.id, emp.name, (now() at time zone 'America/Sao_Paulo')::date,
     'reserved', now(), emp.unidade_id)
  on conflict (employee_id, date) do nothing
  returning * into nova;

  if nova.id is null then
    return jsonb_build_object('ok', false, 'error', 'ja_reservado');
  end if;

  return jsonb_build_object('ok', true, 'reservation', to_jsonb(nova));
end $fn$;

-- ----------------------------------------------- 5. RPC de retirada --------

create or replace function public.pickup_meal(p_employee uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  emp       public.employees%rowtype;
  bloqueado boolean;
  res       public.meal_reservations%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'nao_autenticado');
  end if;

  select sistema_bloqueado into bloqueado from public.global_settings limit 1;
  if coalesce(bloqueado, false) and not public.is_dono() then
    return jsonb_build_object('ok', false, 'error', 'sistema_bloqueado');
  end if;

  if public.current_phase() <> 'pickup' then
    return jsonb_build_object('ok', false, 'error', 'fora_da_janela');
  end if;

  select * into emp from public.employees where id = p_employee;
  if not found or emp.active is false then
    return jsonb_build_object('ok', false, 'error', 'funcionario_invalido');
  end if;

  if not public.is_admin() and emp.unidade_id is distinct from public.my_unidade() then
    return jsonb_build_object('ok', false, 'error', 'fora_da_unidade');
  end if;

  if public.employee_pin_locked(p_employee) then
    return jsonb_build_object('ok', false, 'error', 'bloqueado_por_tentativas');
  end if;

  if not public.check_employee_pin(p_employee, p_pin) then
    return jsonb_build_object('ok', false, 'error', 'pin_incorreto');
  end if;

  select * into res
    from public.meal_reservations
   where employee_id = emp.id
     and date = (now() at time zone 'America/Sao_Paulo')::date
     and status = 'reserved'
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'sem_reserva');
  end if;

  update public.meal_reservations
     set status = 'picked_up', picked_up_at = now()
   where id = res.id
  returning * into res;

  return jsonb_build_object('ok', true, 'reservation', to_jsonb(res));
end $fn$;

-- --------------------------------------------- 6. PIN definido pelo admin --

create or replace function public.set_employee_pin(p_employee uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'sem_permissao');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'error', 'pin_invalido');
  end if;

  update public.employees
     set pin_hash = crypt(p_pin, gen_salt('bf'))
   where id = p_employee;

  -- Zera o bloqueio por tentativas ao redefinir o PIN.
  delete from public.pin_attempts where employee_id = p_employee;

  return jsonb_build_object('ok', true);
end $fn$;

-- ------------------------- 7. Escrita de reservas restrita a admin ---------
-- O caminho normal (totem) agora passa pelas RPCs acima, que sao SECURITY
-- DEFINER e por isso nao dependem destas policies. Escrita direta fica so
-- para o painel administrativo.

drop policy if exists reservations_insert on public.meal_reservations;
create policy reservations_insert on public.meal_reservations
  for insert to authenticated with check (public.is_admin());

drop policy if exists reservations_update on public.meal_reservations;
create policy reservations_update on public.meal_reservations
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------- 8. Admin nao se promove a dono ----------------

create or replace function public.guard_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- Somente o dono cria ou remove outro dono.
  if (tg_op = 'INSERT' and new.role = 'dono') and not public.is_dono() then
    raise exception 'Apenas o dono pode criar outro dono';
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      if (new.role = 'dono' or old.role = 'dono') and not public.is_dono() then
        raise exception 'Apenas o dono pode alterar o papel de dono';
      end if;
      -- Ninguem muda o proprio papel, nem o dono: evita perda acidental do
      -- unico acesso total e fecha a auto-promocao de admin.
      if new.id = auth.uid() then
        raise exception 'Nao e permitido alterar o proprio papel';
      end if;
    end if;
  end if;

  return new;
end $fn$;

drop trigger if exists trg_guard_role on public.profiles;
create trigger trg_guard_role before insert or update on public.profiles
  for each row execute function public.guard_role_escalation();

-- ------------------- 9. Funcoes internas fora da API publica ---------------
-- Sem isto qualquer autenticado poderia chamar close_pending_reservations()
-- pelo PostgREST e marcar o dia inteiro como nao retirado, gerando taxa
-- indevida para todos os funcionarios.

revoke execute on function public.close_pending_reservations(date) from public, anon, authenticated;
revoke execute on function public.check_employee_pin(uuid, text)   from public, anon, authenticated;
revoke execute on function public.employee_pin_locked(uuid)        from public, anon, authenticated;
revoke execute on function public.guard_sistema_bloqueado()        from public, anon, authenticated;
revoke execute on function public.guard_role_escalation()          from public, anon, authenticated;
revoke execute on function public.touch_updated_date()             from public, anon, authenticated;

-- Estas continuam chamaveis: o front precisa delas.
grant execute on function public.reserve_meal(uuid, text)      to authenticated;
grant execute on function public.pickup_meal(uuid, text)       to authenticated;
grant execute on function public.set_employee_pin(uuid, text)  to authenticated;
grant execute on function public.current_phase()               to authenticated;

-- ------------------- 10. Fechamento do dia agendado no banco ---------------
-- Antes isso rodava no navegador: qualquer usuario comum disparava um UPDATE
-- em massa, e se ninguem abrisse o sistema o dia simplesmente nao fechava.
-- Agora e uma tarefa do banco, executada com privilegio proprio.

do $do$
begin
  create extension if not exists pg_cron;

  perform cron.unschedule('fechar-dia')
    where exists (select 1 from cron.job where jobname = 'fechar-dia');

  perform cron.schedule(
    'fechar-dia',
    '5 2 * * *',  -- 23:05 em America/Sao_Paulo (pg_cron agenda em UTC)
    $cron$select public.close_pending_reservations(
             ((now() at time zone 'America/Sao_Paulo')::date))$cron$
  );
exception when others then
  raise notice 'pg_cron indisponivel (%). Agende o fechamento manualmente.', sqlerrm;
end $do$;

-- --------------------------- 11. Nada exposto ao papel anonimo -------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
