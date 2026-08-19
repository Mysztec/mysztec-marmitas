-- ============================================================================
-- 0004 - Redefinicao de senha do funcionario
--
-- Faltava resposta para "esqueci meu PIN". A unica saida era o admin definir um
-- PIN novo com set_employee_pin, o que traz de volta o problema que o desenho
-- tenta evitar: alguem do RH conhecendo a senha da pessoa.
--
-- Aqui o admin nao escolhe senha nenhuma. Ele apaga a atual e abre uma janela
-- curta em que o proprio funcionario cadastra a nova no totem. O admin nunca
-- ve o PIN, e cada redefinicao fica registrada com autor e horario.
-- ============================================================================

-- ---------------------------------------------- 1. Janela de cadastro ------

alter table public.employees
  add column if not exists pin_enroll_until timestamptz;

comment on column public.employees.pin_enroll_until is
  'Ate quando este funcionario pode cadastrar um PIN novo no totem. '
  'Preenchido por reset_employee_pin; limpo assim que o PIN e cadastrado.';

-- ------------------------------------------------- 2. Auditoria ------------

create table if not exists public.pin_resets (
  id           bigserial primary key,
  employee_id  uuid references public.employees(id) on delete cascade,
  reset_by     uuid references auth.users(id) on delete set null,
  reset_at     timestamptz not null default now()
);

create index if not exists idx_pin_resets_employee
  on public.pin_resets (employee_id, reset_at desc);

alter table public.pin_resets enable row level security;

-- Escrita so pela funcao SECURITY DEFINER; leitura para admin/dono.
drop policy if exists pin_resets_admin_read on public.pin_resets;
create policy pin_resets_admin_read on public.pin_resets
  for select to authenticated using (public.is_admin());

-- ------------------------------- 3. Conferencia respeita a janela ----------

create or replace function public.check_employee_pin(
  p_employee     uuid,
  p_pin          text,
  p_allow_enroll boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  emp    public.employees%rowtype;
  ok     boolean;
  novo   boolean := false;
  liberado boolean;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'enrolled', false);
  end if;

  select * into emp from public.employees where id = p_employee;
  if not found then
    return jsonb_build_object('ok', false, 'enrolled', false);
  end if;

  -- Cadastro liberado pelo contexto (primeira reserva) ou por uma
  -- redefinicao recente feita pelo administrador.
  liberado := p_allow_enroll
              or (emp.pin_enroll_until is not null and emp.pin_enroll_until > now());

  if emp.pin_hash is null then
    if not liberado then
      insert into public.pin_attempts (employee_id, succeeded) values (p_employee, false);
      return jsonb_build_object('ok', false, 'enrolled', false, 'reason', 'sem_pin_cadastrado');
    end if;
    update public.employees
       set pin_hash = crypt(p_pin, gen_salt('bf')),
           pin_enroll_until = null   -- a janela fecha no primeiro uso
     where id = p_employee;
    ok   := true;
    novo := true;
  else
    ok := (emp.pin_hash = crypt(p_pin, emp.pin_hash));
  end if;

  insert into public.pin_attempts (employee_id, succeeded) values (p_employee, ok);
  return jsonb_build_object('ok', ok, 'enrolled', novo);
end $fn$;

-- --------------------------------------------- 4. Redefinicao pelo admin ---

/**
 * Apaga o PIN do funcionario e abre uma janela de 30 minutos para que ele
 * cadastre um novo no totem, em qualquer fase do dia.
 *
 * O admin nao informa senha nenhuma -- por isso continua sem saber o PIN de
 * ninguem. A janela e curta de proposito: enquanto ela estiver aberta, quem
 * chegar primeiro naquele nome define o PIN, entao o intervalo entre pedir a
 * redefinicao e digitar a senha nova deve ser o menor possivel.
 */
create or replace function public.reset_employee_pin(p_employee uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  emp   public.employees%rowtype;
  ate   timestamptz;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'sem_permissao');
  end if;

  select * into emp from public.employees where id = p_employee;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'funcionario_invalido');
  end if;

  ate := now() + interval '30 minutes';

  update public.employees
     set pin_hash = null,
         pin_enroll_until = ate
   where id = p_employee;

  -- Zera o bloqueio por tentativas: quem esqueceu a senha costuma ter errado
  -- varias vezes antes de pedir ajuda.
  delete from public.pin_attempts where employee_id = p_employee;

  insert into public.pin_resets (employee_id, reset_by) values (p_employee, auth.uid());

  return jsonb_build_object('ok', true, 'enroll_until', ate);
end $fn$;

-- ---------------------------------------- 5. Desbloqueio sem redefinir -----
-- Quando a pessoa lembra a senha mas ja estourou o limite de tentativas,
-- apagar o PIN seria exagero.

create or replace function public.unlock_employee_pin(p_employee uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'sem_permissao');
  end if;

  delete from public.pin_attempts where employee_id = p_employee;
  return jsonb_build_object('ok', true);
end $fn$;

-- --------------------------------------------------- 6. Permissoes ---------

revoke execute on function public.check_employee_pin(uuid, text, boolean)
  from public, anon, authenticated;

grant execute on function public.reset_employee_pin(uuid)  to authenticated;
grant execute on function public.unlock_employee_pin(uuid) to authenticated;
