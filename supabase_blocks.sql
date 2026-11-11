-- Fechar dias e horarios (feriados, compromissos) + agenda aberta ate o fim do ano
create table if not exists barbearia.blocks (
  day  date not null,
  slot text,                         -- null = dia inteiro fechado
  created_at timestamptz not null default now()
);
create unique index if not exists blocks_day_slot_idx on barbearia.blocks (day, coalesce(slot, '*'));
alter table barbearia.blocks enable row level security;
revoke all on barbearia.blocks from public, anon, authenticated;

create or replace function public.bb_get_blocks(p_from date, p_to date)
returns table(d date, t text) language sql stable security definer set search_path = pg_temp as $$
  select day, slot from barbearia.blocks where day between p_from and p_to
$$;

create or replace function public.bb_barber_set_block(p_token text, p_day date, p_slot text, p_blocked boolean)
returns void language plpgsql security definer set search_path = pg_temp as $$
begin
  perform barbearia.auth_check(p_token);
  if p_day is null then raise exception 'data_invalida'; end if;
  if p_slot is not null and p_slot !~ '^\d\d:\d\d$' then raise exception 'horario_invalido'; end if;
  if p_blocked then
    insert into barbearia.blocks (day, slot) values (p_day, p_slot) on conflict do nothing;
  else
    delete from barbearia.blocks where day = p_day and slot is not distinct from p_slot;
  end if;
end $$;

create or replace function public.bb_create_booking(p_name text, p_surname text, p_phone text, p_service_id text, p_date date, p_time text)
returns jsonb language plpgsql security definer set search_path = pg_temp as $$
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
  if p_date is null or p_date < today
     or p_date > greatest(make_date(extract(year from today)::int, 12, 31), today + 60) then
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
  if exists (select 1 from barbearia.blocks where day = p_date and (slot is null or slot = p_time)) then
    raise exception 'horario_bloqueado';
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

revoke all on function public.bb_get_blocks(date, date), public.bb_barber_set_block(text, date, text, boolean),
  public.bb_create_booking(text, text, text, text, date, text) from public;
grant execute on function public.bb_get_blocks(date, date), public.bb_barber_set_block(text, date, text, boolean),
  public.bb_create_booking(text, text, text, text, date, text) to anon, authenticated;
