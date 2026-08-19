-- ============================================================================
-- 0006 - Lista de funcionarios bloqueados por tentativas
--
-- O painel precisa saber quem travou para oferecer o desbloqueio. Consultar
-- pin_attempts direto exigiria filtro por intervalo de tempo na camada de
-- dados; uma funcao resolve com a mesma regra usada em employee_pin_locked,
-- sem expor o historico de tentativas de cada pessoa.
-- ============================================================================

create or replace function public.locked_employees()
returns setof uuid
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select employee_id
    from public.pin_attempts
   where succeeded = false
     and attempted_at > now() - interval '15 minutes'
     and public.is_admin()
   group by employee_id
  having count(*) >= 5;
$fn$;

revoke execute on function public.locked_employees() from public, anon;
grant  execute on function public.locked_employees() to authenticated;
