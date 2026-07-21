create table if not exists public.pin_login_attempts (
  attempt_key text primary key,
  failed_attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz null
);

alter table public.pin_login_attempts enable row level security;

create or replace function public.pin_login_retry_after(input_attempt_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    greatest(0, ceil(extract(epoch from (locked_until - now())))::integer),
    0
  )
  from public.pin_login_attempts
  where attempt_key = input_attempt_key;
$$;

create or replace function public.record_pin_login_failure(input_attempt_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.pin_login_attempts%rowtype;
  now_at timestamptz := now();
begin
  select * into attempt
  from public.pin_login_attempts
  where attempt_key = input_attempt_key
  for update;

  if not found then
    insert into public.pin_login_attempts (attempt_key, failed_attempts, window_started_at)
    values (input_attempt_key, 1, now_at);
    return 0;
  end if;

  if attempt.locked_until is not null and attempt.locked_until > now_at then
    return ceil(extract(epoch from (attempt.locked_until - now_at)))::integer;
  end if;

  if attempt.window_started_at < now_at - interval '5 minutes' then
    attempt.failed_attempts := 1;
    attempt.window_started_at := now_at;
  else
    attempt.failed_attempts := attempt.failed_attempts + 1;
  end if;

  if attempt.failed_attempts >= 5 then
    attempt.locked_until := now_at + interval '15 minutes';
  else
    attempt.locked_until := null;
  end if;

  update public.pin_login_attempts
  set
    failed_attempts = attempt.failed_attempts,
    window_started_at = attempt.window_started_at,
    locked_until = attempt.locked_until
  where attempt_key = input_attempt_key;

  return coalesce(ceil(extract(epoch from (attempt.locked_until - now_at)))::integer, 0);
end;
$$;

create or replace function public.clear_pin_login_failures(input_attempt_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pin_login_attempts where attempt_key = input_attempt_key;
$$;

revoke all on public.pin_login_attempts from public, anon, authenticated;
revoke all on function public.pin_login_retry_after(text) from public, anon, authenticated;
revoke all on function public.record_pin_login_failure(text) from public, anon, authenticated;
revoke all on function public.clear_pin_login_failures(text) from public, anon, authenticated;
grant execute on function public.pin_login_retry_after(text) to service_role;
grant execute on function public.record_pin_login_failure(text) to service_role;
grant execute on function public.clear_pin_login_failures(text) to service_role;
