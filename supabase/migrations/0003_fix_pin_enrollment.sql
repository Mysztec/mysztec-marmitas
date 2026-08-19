-- ============================================================================
-- 0003 - Corrige o cadastro do PIN no primeiro uso
--
-- Duas falhas da migracao anterior:
--
--   1. As funcoes de PIN foram criadas com `search_path = public`, mas no
--      Supabase a extensao pgcrypto vive no schema `extensions`. Dentro das
--      funcoes, crypt() e gen_salt() ficavam invisiveis e a chamada estourava
--      com "function gen_salt(unknown) does not exist" -- o que, no front,
--      aparecia como a tela travando sem mensagem.
--
--   2. O cadastro do PIN no primeiro uso valia tambem na retirada. Como o
--      fluxo pretendido e o funcionario definir a senha ao reservar pela
--      primeira vez, uma tentativa de retirada consumia essa janela sem que a
--      operacao sequer pudesse dar certo (nao havia reserva).
-- ============================================================================

-- ------------------------------------------- 1. Conferencia e cadastro -----

drop function if exists public.check_employee_pin(uuid, text);

/**
 * Confere o PIN do funcionario.
 *
 * Com p_allow_enroll = true e nenhum PIN cadastrado, o PIN informado passa a
 * ser o dele. E o fluxo desejado: o RH cadastra o funcionario sem senha e a
 * propria pessoa define a sua na primeira reserva, sem precisar informar nada
 * a terceiros. A janela fecha no primeiro uso.
 */
create or replace function public.check_employee_pin(
  p_employee     uuid,
  p_pin          text,
  p_allow_enroll boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions  -- pgcrypto mora em `extensions`
as $fn$
declare
  stored text;
  ok     boolean;
  novo   boolean := false;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'enrolled', false);
  end if;

  select pin_hash into stored from public.employees where id = p_employee;

  if stored is null then
    if not p_allow_enroll then
      -- Sem PIN cadastrado e sem permissao para cadastrar agora.
      insert into public.pin_attempts (employee_id, succeeded) values (p_employee, false);
      return jsonb_build_object('ok', false, 'enrolled', false, 'reason', 'sem_pin_cadastrado');
    end if;
    update public.employees
       set pin_hash = crypt(p_pin, gen_salt('bf'))
     where id = p_employee;
    ok   := true;
    novo := true;
  else
    ok := (stored = crypt(p_pin, stored));
  end if;

  insert into public.pin_attempts (employee_id, succeeded) values (p_employee, ok);
  return jsonb_build_object('ok', ok, 'enrolled', novo);
end $fn$;

-- ------------------------------------------------ 2. PIN pelo admin --------

create or replace function public.set_employee_pin(p_employee uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
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

  delete from public.pin_attempts where employee_id = p_employee;
  return jsonb_build_object('ok', true);
end $fn$;

-- ----------------------------------- 3. Reserva: cadastra PIN se faltar ----

create or replace function public.reserve_meal(p_employee uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  emp        public.employees%rowtype;
  bloqueado  boolean;
  nova       public.meal_reservations%rowtype;
  veredito   jsonb;
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

  if not public.is_admin() and emp.unidade_id is distinct from public.my_unidade() then
    return jsonb_build_object('ok', false, 'error', 'fora_da_unidade');
  end if;

  if public.employee_pin_locked(p_employee) then
    return jsonb_build_object('ok', false, 'error', 'bloqueado_por_tentativas');
  end if;

  -- A reserva e o unico ponto em que o funcionario pode cadastrar o proprio PIN.
  veredito := public.check_employee_pin(p_employee, p_pin, true);
  if not (veredito->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', 'pin_incorreto');
  end if;

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

  return jsonb_build_object(
    'ok', true,
    'enrolled', (veredito->>'enrolled')::boolean,
    'reservation', to_jsonb(nova)
  );
end $fn$;

-- ------------------------- 4. Retirada: exige PIN ja cadastrado ------------

create or replace function public.pickup_meal(p_employee uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  emp       public.employees%rowtype;
  bloqueado boolean;
  res       public.meal_reservations%rowtype;
  veredito  jsonb;
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

  -- Sem cadastro de PIN aqui: quem chega na retirada ja reservou, e reservar
  -- exige PIN. Assim uma tentativa de retirada nao consome a janela de
  -- cadastro de outra pessoa.
  veredito := public.check_employee_pin(p_employee, p_pin, false);
  if not (veredito->>'ok')::boolean then
    if veredito->>'reason' = 'sem_pin_cadastrado' then
      return jsonb_build_object('ok', false, 'error', 'sem_pin_cadastrado');
    end if;
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

-- ------------------------------------------------ 5. Permissoes ------------
-- A assinatura de check_employee_pin mudou, entao os grants sao refeitos.

revoke execute on function public.check_employee_pin(uuid, text, boolean)
  from public, anon, authenticated;

grant execute on function public.reserve_meal(uuid, text)     to authenticated;
grant execute on function public.pickup_meal(uuid, text)      to authenticated;
grant execute on function public.set_employee_pin(uuid, text) to authenticated;
