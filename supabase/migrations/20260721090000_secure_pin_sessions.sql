create extension if not exists pgcrypto;

alter table public.pins add column if not exists pin_hash text;

update public.pins
set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf', 12))
where pin_hash is null
  and pin is not null;

alter table public.pins alter column pin drop not null;
update public.pins set pin = null where pin_hash is not null;
alter table public.pins alter column pin_hash set not null;

create or replace function public.verify_pin(input_pin text)
returns table (
  id text,
  first_name text,
  last_name text,
  role text,
  signature_image text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.first_name, p.last_name, p.role, p.signature_image
  from public.pins p
  where p.pin_hash = extensions.crypt(input_pin, p.pin_hash)
  limit 1;
$$;

create or replace function public.register_pin(
  input_pin text,
  input_id text,
  input_first_name text,
  input_last_name text,
  input_role text,
  input_signature_image text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(input_pin));

  if exists (
    select 1
    from public.pins p
    where p.pin_hash = extensions.crypt(input_pin, p.pin_hash)
  ) then
    raise exception 'PIN already exists' using errcode = '23505';
  end if;

  insert into public.pins (id, pin, pin_hash, first_name, last_name, role, signature_image)
  values (
    input_id,
    null,
    extensions.crypt(input_pin, extensions.gen_salt('bf', 12)),
    input_first_name,
    input_last_name,
    case when input_role = 'admin' then 'admin' else 'user' end,
    nullif(input_signature_image, '')
  );

  return input_id;
end;
$$;

create or replace function public.update_pin(
  input_id text,
  input_pin text default null,
  input_first_name text default null,
  input_last_name text default null,
  input_signature_image text default null,
  replace_signature boolean default false
)
returns table (
  id text,
  first_name text,
  last_name text,
  signature_image text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if input_pin is not null then
    perform pg_advisory_xact_lock(hashtext(input_pin));

    if exists (
      select 1
      from public.pins p
      where p.id <> input_id
        and p.pin_hash = extensions.crypt(input_pin, p.pin_hash)
    ) then
      raise exception 'PIN already exists' using errcode = '23505';
    end if;
  end if;

  return query
  update public.pins p
  set
    pin = case when input_pin is null then p.pin else null end,
    pin_hash = case when input_pin is null then p.pin_hash else extensions.crypt(input_pin, extensions.gen_salt('bf', 12)) end,
    first_name = coalesce(input_first_name, p.first_name),
    last_name = coalesce(input_last_name, p.last_name),
    signature_image = case when replace_signature then nullif(input_signature_image, '') else p.signature_image end
  where p.id = input_id
  returning p.id, p.first_name, p.last_name, p.signature_image, p.created_at;
end;
$$;

revoke all on function public.verify_pin(text) from public, anon, authenticated;
revoke all on function public.register_pin(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_pin(text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.verify_pin(text) to service_role;
grant execute on function public.register_pin(text, text, text, text, text, text) to service_role;
grant execute on function public.update_pin(text, text, text, text, text, boolean) to service_role;
