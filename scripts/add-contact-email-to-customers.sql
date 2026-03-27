-- Add contact email support to customers
alter table public.customers
  add column if not exists contact_email text;

-- Optional format guard (allows null/empty values)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_contact_email_format_check'
  ) then
    alter table public.customers
      add constraint customers_contact_email_format_check
      check (
        contact_email is null
        or contact_email = ''
        or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      );
  end if;
end $$;

create index if not exists idx_customers_contact_email
  on public.customers (contact_email);
