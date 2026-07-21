do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('customers', 'pins', 'products', 'quotes', 'quote_approvals')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end;
$$;

alter table public.customers enable row level security;
alter table public.pins enable row level security;
alter table public.products enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_approvals enable row level security;

revoke all on table public.customers from anon, authenticated;
revoke all on table public.pins from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.quotes from anon, authenticated;
revoke all on table public.quote_approvals from anon, authenticated;
