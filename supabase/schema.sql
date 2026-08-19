-- ============================================================================
-- Mysztec Marmitas - schema completo
-- Rode este arquivo no SQL Editor do Supabase (uma vez, em projeto novo).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tabelas ---

create table if not exists public.unidades (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  localizacao   text,
  active        boolean not null default true,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now()
);

create table if not exists public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,
  active        boolean not null default true,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now()
);

-- Perfil da aplicacao para cada conta do Supabase Auth.
-- E aqui que vivem `role` e `unidade_id`, que comandam toda a autorizacao.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  email         text,
  full_name     text,
  role          text not null default 'user' check (role in ('dono','admin','user')),
  unidade_id    uuid references public.unidades(id) on delete set null,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now()
);

create table if not exists public.employees (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  pin           text not null,
  department    text,
  active        boolean not null default true,
  unidade_id    uuid references public.unidades(id) on delete set null,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now()
);

create table if not exists public.meal_reservations (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  employee_name  text not null,
  date           date not null,
  status         text not null default 'reserved'
                 check (status in ('reserved','picked_up','not_picked_up')),
  reserved_at    timestamptz,
  picked_up_at   timestamptz,
  unidade_id     uuid references public.unidades(id) on delete set null,
  created_date   timestamptz not null default now(),
  updated_date   timestamptz not null default now(),
  -- Um funcionario so pode ter uma reserva por dia. No Base44 isso era
  -- garantido apenas pelo front; aqui o banco passa a impedir de fato.
  unique (employee_id, date)
);

create table if not exists public.app_settings (
  id                   uuid primary key default gen_random_uuid(),
  meal_price           numeric(10,2),
  no_pickup_fee        numeric(10,2),
  reservation_deadline text,
  restaurant_phone     text,
  restaurant_name      text,
  created_date         timestamptz not null default now(),
  updated_date         timestamptz not null default now()
);

create table if not exists public.global_settings (
  id                 uuid primary key default gen_random_uuid(),
  reserva_inicio     text,
  reserva_fim        text,
  retirada_inicio    text,
  retirada_fim       text,
  preco_marmita      numeric(10,2) default 0,
  taxa_nao_retirada  numeric(10,2) default 0,
  trava_manual       boolean not null default false,
  sistema_bloqueado  boolean not null default false,
  created_date       timestamptz not null default now(),
  updated_date       timestamptz not null default now()
);

create index if not exists idx_reservations_date on public.meal_reservations(date);
create index if not exists idx_reservations_unidade on public.meal_reservations(unidade_id);
create index if not exists idx_reservations_status on public.meal_reservations(status);
create index if not exists idx_employees_unidade on public.employees(unidade_id);
create index if not exists idx_employees_active on public.employees(active);

-- ------------------------------------------------- helpers de autorizacao ---
-- SECURITY DEFINER e obrigatorio: sem ele, uma policy de `profiles` que
-- consulta `profiles` entraria em recursao infinita.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select role in ('admin','dono') from public.profiles where id = auth.uid()), false);
$fn$;

create or replace function public.is_dono()
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select role = 'dono' from public.profiles where id = auth.uid()), false);
$fn$;

create or replace function public.my_unidade()
returns uuid language sql stable security definer set search_path = public as $fn$
  select unidade_id from public.profiles where id = auth.uid();
$fn$;

-- --------------------------------------------------------------- triggers ---

create or replace function public.touch_updated_date()
returns trigger language plpgsql as $fn$
begin
  new.updated_date := now();
  return new;
end $fn$;

do $do$
declare t text;
begin
  foreach t in array array['unidades','companies','profiles','employees',
                           'meal_reservations','app_settings','global_settings']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_date()', t);
  end loop;
end $do$;

-- -------------------------------------------------------------------- RLS ---

alter table public.unidades          enable row level security;
alter table public.companies         enable row level security;
alter table public.profiles          enable row level security;
alter table public.employees         enable row level security;
alter table public.meal_reservations enable row level security;
alter table public.app_settings      enable row level security;
alter table public.global_settings   enable row level security;

-- unidades: todo autenticado le; admin/dono escreve
drop policy if exists unidades_read on public.unidades;
create policy unidades_read on public.unidades
  for select to authenticated using (true);
drop policy if exists unidades_write on public.unidades;
create policy unidades_write on public.unidades
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- companies: admin ve tudo, demais so as ativas
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies
  for select to authenticated using (public.is_admin() or active = true);
drop policy if exists companies_write on public.companies;
create policy companies_write on public.companies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: cada um le o proprio; admin le e escreve todos
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_write_admin on public.profiles;
create policy profiles_write_admin on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- employees: todo autenticado le; admin/dono escreve
drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees
  for select to authenticated using (true);
drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- meal_reservations: admin/dono veem tudo; usuario comum so a propria unidade.
-- Esta era a regra do Base44 e e a mais importante do sistema.
drop policy if exists reservations_read on public.meal_reservations;
create policy reservations_read on public.meal_reservations
  for select to authenticated
  using (public.is_admin() or unidade_id = public.my_unidade());

drop policy if exists reservations_insert on public.meal_reservations;
create policy reservations_insert on public.meal_reservations
  for insert to authenticated
  with check (public.is_admin() or unidade_id = public.my_unidade());

drop policy if exists reservations_update on public.meal_reservations;
create policy reservations_update on public.meal_reservations
  for update to authenticated
  using (public.is_admin() or unidade_id = public.my_unidade())
  with check (public.is_admin() or unidade_id = public.my_unidade());

drop policy if exists reservations_delete on public.meal_reservations;
create policy reservations_delete on public.meal_reservations
  for delete to authenticated using (public.is_admin());

-- app_settings / global_settings: todos leem, admin/dono escrevem
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists global_settings_read on public.global_settings;
create policy global_settings_read on public.global_settings
  for select to authenticated using (true);
drop policy if exists global_settings_write on public.global_settings;
create policy global_settings_write on public.global_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Somente o dono destrava o sistema bloqueado por inadimplencia.
create or replace function public.guard_sistema_bloqueado()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if old.sistema_bloqueado is true and new.sistema_bloqueado is false
     and not public.is_dono() then
    raise exception 'Apenas o dono pode desbloquear o sistema';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_guard_bloqueio on public.global_settings;
create trigger trg_guard_bloqueio before update on public.global_settings
  for each row execute function public.guard_sistema_bloqueado();

-- --------------------------------------------------------------- realtime ---

alter publication supabase_realtime add table public.employees;
alter publication supabase_realtime add table public.meal_reservations;

-- ---------------------------------------------------- fechamento do dia -----
-- No Base44 isso rodava no navegador (useEndOfDayProcessor): se ninguem
-- estivesse com a tela aberta, o dia nao fechava. Aqui vira uma funcao do
-- banco, que pode ser agendada com pg_cron e passa a rodar sozinha.

create or replace function public.close_pending_reservations(target_date date default current_date)
returns integer language plpgsql security definer set search_path = public as $fn$
declare affected integer;
begin
  update public.meal_reservations
     set status = 'not_picked_up'
   where date = target_date and status = 'reserved';
  get diagnostics affected = row_count;
  return affected;
end $fn$;

-- Para agendar (requer a extensao pg_cron habilitada no projeto):
--   select cron.schedule('fechar-dia', '5 23 * * *',
--     $cron$select public.close_pending_reservations()$cron$);

-- ----------------------------------------------------------- seed inicial ---

insert into public.global_settings (reserva_inicio, reserva_fim, retirada_inicio, retirada_fim, preco_marmita, taxa_nao_retirada)
select '07:00','10:00','11:00','13:30',18.00,5.00
where not exists (select 1 from public.global_settings);

insert into public.app_settings (meal_price, no_pickup_fee, reservation_deadline, restaurant_name)
select 18.00, 5.00, '10:00', 'Mysztec'
where not exists (select 1 from public.app_settings);
