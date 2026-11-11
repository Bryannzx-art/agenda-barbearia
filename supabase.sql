-- =====================================================================
-- BARBEARIA · banco de dados do Supabase (versão isolada)
-- As tabelas ficam no schema "barbearia" e as funções públicas começam
-- com "bb_", para não mexer em nada que já exista no projeto.
-- Pode rodar de novo sem medo: não apaga agendamentos nem a senha.
--
-- Segurança: as tabelas ficam fechadas (ninguém lê direto pelo site).
-- Tudo passa pelas funções bb_*. A senha do painel é guardada com
-- hash (bcrypt) e nunca aparece no index.html.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists barbearia;

-- ---------- tabelas ----------
create table if not exists barbearia.settings (
  id            int primary key default 1 check (id = 1),
  config        jsonb not null,
  barber_name   text not null,
  barber_phone  text not null,
  password_hash text not null
);

create table if not exists barbearia.bookings (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  surname      text not null,
  phone        text not null,
  service_id   text not null,
  service_name text not null,
  price        numeric(10,2) not null,
  duration     int not null,
  day          date not null,
  slot         text not null,
  status       text not null default 'agendado' check (status in ('agendado','concluido')),
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (day, slot)
);
create index if not exists bookings_phone_idx on barbearia.bookings (phone);

create table if not exists barbearia.barber_sessions (
  token      text primary key,
  expires_at timestamptz not null
);

create table if not exists barbearia.login_attempts (
  id bigserial primary key,
  at timestamptz not null default now()
);

-- ---------- dados iniciais (só na primeira vez) ----------
-- Senha inicial do painel: 11223344  (troque depois em Ajustes > Senha do painel)
insert into barbearia.settings (id, config, barber_name, barber_phone, password_hash)
values (
  1,
  '{
    "shopName": "Barbearia do Bryan",
    "open": "09:00",
    "close": "19:00",
    "step": 15,
    "closedDays": [0],
    "services": [
      {"id": "acabamento",    "name": "Acabamento",    "duration": 5,  "price": 20},
      {"id": "barba",         "name": "Barba",         "duration": 10, "price": 30},
      {"id": "corte-degrade", "name": "Corte Degradê", "duration": 15, "price": 35},
      {"id": "corte-social",  "name": "Corte Social",  "duration": 15, "price": 30},
      {"id": "pigmentacao",   "name": "Pigmentação",   "duration": 10, "price": 25}
    ]
  }'::jsonb,
  'bryan peixe',
  '16993397066',
  extensions.crypt('11223344', extensions.gen_salt('bf'))
)
on conflict (id) do nothing;

-- ---------- trava tudo ----------
alter table barbearia.settings        enable row level security;
alter table barbearia.bookings        enable row level security;
alter table barbearia.barber_sessions enable row level security;
alter table barbearia.login_attempts  enable row level security;

revoke all on schema barbearia from public, anon, authenticated;
revoke all on all tables    in schema barbearia from public, anon, authenticated;
revoke all on all sequences in schema barbearia from public, anon, authenticated;

-- ---------- funções internas (ficam no schema fechado) ----------
create or replace function barbearia.norm_phone(p text) returns text
language sql immutable set search_path = pg_temp as $$
  select case when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;

create or replace function barbearia.norm_name(p text) returns text
language sql immutable set search_path = pg_temp as $$
  select lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')))
$$;

create or replace function barbearia.bk_json(b barbearia.bookings) returns jsonb
language sql immutable set search_path = pg_temp as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'surname', b.surname, 'phone', b.phone,
    'serviceId', b.service_id, 'serviceName', b.service_name,
    'price', b.price, 'duration', b.duration,
    'date', b.day, 'time', b.slot, 'status', b.status, 'doneAt', b.done_at)
$$;

create or replace function barbearia.auth_check(p_token text) returns void
language plpgsql security definer set search_path = pg_temp as $$
begin
  delete from barbearia.barber_sessions where expires_at < now();
  if p_token is null or not exists (
    select 1 from barbearia.barber_sessions where token = p_token and expires_at > now()
  ) then
    raise exception 'nao_autorizado';
  end if;
end $$;

-- ---------- funções do cliente ----------
create or replace function public.bb_get_config() returns jsonb
language sql stable security definer set search_path = pg_temp as $$
  select config from barbearia.settings where id = 1
$$;

-- horários já ocupados (só dia e hora, sem dados de ninguém)
create or replace function public.bb_get_taken(p_from date, p_to date)
returns table (d date, t text)
language sql stable security definer set search_path = pg_temp as $$
  select day, slot from barbearia.bookings where day between p_from and p_to
$$;

create or replace function public.bb_create_booking(
  p_name text, p_surname text, p_phone text,
  p_service_id text, p_date date, p_time text
) returns jsonb
language plpgsql security definer set search_path = pg_temp as $$
declare
  cfg jsonb; svc jsonb; ph text; n text; sn text;
  today date; nowmin int; tmin int; omin int; cmin int; stp int;
  rec barbearia.bookings;
begin
  n  := btrim(coalesce(p_name, ''));
  sn := btrim(coalesce(p_surname, ''));
  ph := barbearia.norm_phone(p_phone);
  if length(n) < 2 or length(n) > 60 or length(sn) < 2 or length(sn) > 60
     or length(ph) not in (10, 11) then
    raise exception 'dados_invalidos';
  end if;

  select config into cfg from barbearia.settings where id = 1;
  select e.value into svc
    from jsonb_array_elements(cfg->'services') as e
   where e.value->>'id' = p_service_id limit 1;
  if svc is null then raise exception 'servico_invalido'; end if;

  today := (now() at time zone 'America/Sao_Paulo')::date;
  if p_date is null or p_date < today or p_date > today + 60 then
    raise exception 'data_invalida';
  end if;
  if (cfg->'closedDays') @> to_jsonb(extract(dow from p_date)::int) then
    raise exception 'dia_fechado';
  end if;

  if p_time is null or p_time !~ '^\d\d:\d\d$' then raise exception 'horario_invalido'; end if;
  tmin := split_part(p_time, ':', 1)::int * 60 + split_part(p_time, ':', 2)::int;
  omin := split_part(cfg->>'open', ':', 1)::int * 60 + split_part(cfg->>'open', ':', 2)::int;
  cmin := split_part(cfg->>'close', ':', 1)::int * 60 + split_part(cfg->>'close', ':', 2)::int;
  stp  := coalesce((cfg->>'step')::int, 15);
  if tmin < omin or tmin + stp > cmin or (tmin - omin) % stp <> 0 then
    raise exception 'horario_invalido';
  end if;
  if p_date = today then
    nowmin := extract(hour from (now() at time zone 'America/Sao_Paulo'))::int * 60
            + extract(minute from (now() at time zone 'America/Sao_Paulo'))::int;
    if tmin <= nowmin then raise exception 'horario_invalido'; end if;
  end if;

  begin
    insert into barbearia.bookings (name, surname, phone, service_id, service_name, price, duration, day, slot)
    values (n, sn, ph, svc->>'id', svc->>'name',
            (svc->>'price')::numeric, (svc->>'duration')::int, p_date, p_time)
    returning * into rec;
  exception when unique_violation then
    raise exception 'horario_ocupado';
  end;
  return barbearia.bk_json(rec);
end $$;

create or replace function public.bb_my_bookings(p_phone text) returns jsonb
language sql stable security definer set search_path = pg_temp as $$
  select coalesce(jsonb_agg(barbearia.bk_json(b) order by b.day desc, b.slot desc), '[]'::jsonb)
  from (
    select * from barbearia.bookings
     where phone = barbearia.norm_phone(p_phone)
     order by day desc, slot desc limit 40
  ) b
$$;

create or replace function public.bb_cancel_booking(p_id uuid, p_phone text) returns void
language plpgsql security definer set search_path = pg_temp as $$
declare n int;
begin
  delete from barbearia.bookings
   where id = p_id
     and phone = barbearia.norm_phone(p_phone)
     and status = 'agendado'
     and day >= (now() at time zone 'America/Sao_Paulo')::date;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'nao_encontrado'; end if;
end $$;

-- ---------- funções do barbeiro (exigem login com senha) ----------
-- Devolve {ok:true, token} ou {ok:false, error}. Depois de 5 senhas
-- erradas, bloqueia por 15 minutos.
create or replace function public.bb_barber_login(
  p_name text, p_surname text, p_phone text, p_password text
) returns jsonb
language plpgsql security definer set search_path = extensions, pg_temp as $$
declare s barbearia.settings; fails int; tk text;
begin
  select * into s from barbearia.settings where id = 1;
  delete from barbearia.login_attempts where at < now() - interval '1 day';

  if barbearia.norm_name(p_name || ' ' || p_surname) <> s.barber_name
     or barbearia.norm_phone(p_phone) <> s.barber_phone then
    return jsonb_build_object('ok', false, 'error', 'senha_incorreta');
  end if;

  select count(*) into fails from barbearia.login_attempts where at > now() - interval '15 minutes';
  if fails >= 5 then
    return jsonb_build_object('ok', false, 'error', 'muitas_tentativas');
  end if;

  if p_password is null or s.password_hash <> crypt(p_password, s.password_hash) then
    insert into barbearia.login_attempts default values;
    return jsonb_build_object('ok', false, 'error', 'senha_incorreta');
  end if;

  delete from barbearia.login_attempts where true;
  delete from barbearia.barber_sessions where expires_at < now();
  tk := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into barbearia.barber_sessions (token, expires_at) values (tk, now() + interval '12 hours');
  return jsonb_build_object('ok', true, 'token', tk);
end $$;

create or replace function public.bb_barber_logout(p_token text) returns void
language sql security definer set search_path = pg_temp as $$
  delete from barbearia.barber_sessions where token = p_token
$$;

create or replace function public.bb_barber_bookings(p_token text) returns jsonb
language plpgsql security definer set search_path = pg_temp as $$
begin
  perform barbearia.auth_check(p_token);
  return (select coalesce(jsonb_agg(barbearia.bk_json(b) order by b.day, b.slot), '[]'::jsonb)
            from barbearia.bookings b);
end $$;

create or replace function public.bb_barber_set_status(p_token text, p_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = pg_temp as $$
begin
  perform barbearia.auth_check(p_token);
  update barbearia.bookings
     set status  = case when p_done then 'concluido' else 'agendado' end,
         done_at = case when p_done then now() else null end
   where id = p_id;
end $$;

create or replace function public.bb_barber_delete(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = pg_temp as $$
begin
  perform barbearia.auth_check(p_token);
  delete from barbearia.bookings where id = p_id;
end $$;

create or replace function public.bb_barber_save_config(p_token text, p_config jsonb)
returns void language plpgsql security definer set search_path = pg_temp as $$
begin
  perform barbearia.auth_check(p_token);
  if jsonb_typeof(p_config->'services') <> 'array'
     or jsonb_array_length(p_config->'services') = 0
     or coalesce(p_config->>'open', '') !~ '^\d\d:\d\d$'
     or coalesce(p_config->>'close', '') !~ '^\d\d:\d\d$' then
    raise exception 'dados_invalidos';
  end if;
  update barbearia.settings set config = p_config where id = 1;
end $$;

create or replace function public.bb_barber_change_password(p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = extensions, pg_temp as $$
declare s barbearia.settings;
begin
  perform barbearia.auth_check(p_token);
  select * into s from barbearia.settings where id = 1;
  if p_old is null or s.password_hash <> crypt(p_old, s.password_hash) then
    raise exception 'senha_atual_incorreta';
  end if;
  if p_new is null or length(p_new) < 6 then raise exception 'senha_curta'; end if;
  update barbearia.settings set password_hash = crypt(p_new, gen_salt('bf')) where id = 1;
  delete from barbearia.barber_sessions where token <> p_token;
end $$;

-- ---------- libera só as funções bb_ ----------
revoke execute on function
  barbearia.norm_phone(text), barbearia.norm_name(text),
  barbearia.bk_json(barbearia.bookings), barbearia.auth_check(text)
from public, anon, authenticated;

revoke execute on function
  public.bb_get_config(), public.bb_get_taken(date, date),
  public.bb_create_booking(text, text, text, text, date, text),
  public.bb_my_bookings(text), public.bb_cancel_booking(uuid, text),
  public.bb_barber_login(text, text, text, text), public.bb_barber_logout(text),
  public.bb_barber_bookings(text), public.bb_barber_set_status(text, uuid, boolean),
  public.bb_barber_delete(text, uuid), public.bb_barber_save_config(text, jsonb),
  public.bb_barber_change_password(text, text, text)
from public;

grant execute on function
  public.bb_get_config(), public.bb_get_taken(date, date),
  public.bb_create_booking(text, text, text, text, date, text),
  public.bb_my_bookings(text), public.bb_cancel_booking(uuid, text),
  public.bb_barber_login(text, text, text, text), public.bb_barber_logout(text),
  public.bb_barber_bookings(text), public.bb_barber_set_status(text, uuid, boolean),
  public.bb_barber_delete(text, uuid), public.bb_barber_save_config(text, jsonb),
  public.bb_barber_change_password(text, text, text)
to anon, authenticated;

-- ===== Bloqueios de horários (folgas, feriados, compromissos) =====
-- (já aplicado no projeto; slot nulo = dia inteiro bloqueado)
-- create table if not exists barbearia.blocks (day date not null, slot text, created_at timestamptz not null default now());
-- Funções: public.bb_get_blocks(p_from date, p_to date), public.bb_barber_set_block(p_token text, p_day date, p_slot text, p_blocked boolean)
-- bb_create_booking recusa 'horario_bloqueado' e aceita datas até 31/12 do ano corrente.
