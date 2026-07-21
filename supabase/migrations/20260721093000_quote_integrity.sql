create sequence if not exists public.quote_number_seq;

create or replace function public.next_quote_number()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.quote_number_seq');
  return format(
    'QUO-%s-%s',
    to_char(now() at time zone 'Asia/Bangkok', 'YYYY'),
    lpad(sequence_value::text, 4, '0')
  );
end;
$$;

alter table public.quotes add column if not exists quote_number text;
alter table public.quotes add column if not exists created_by text references public.pins(id) on delete set null;
alter table public.quotes add column if not exists subtotal numeric not null default 0;
alter table public.quotes add column if not exists discount_total numeric not null default 0;
alter table public.quotes add column if not exists vat_rate numeric not null default 7;
alter table public.quotes add column if not exists vat_total numeric not null default 0;
alter table public.quotes add column if not exists grand_total numeric not null default 0;

update public.quotes
set
  quote_number = coalesce(quote_number, public.next_quote_number()),
  subtotal = case when subtotal = 0 then total else subtotal end,
  discount_total = coalesce(discount_total, 0),
  vat_rate = case when vat_rate = 0 then 7 else vat_rate end,
  vat_total = case when vat_total = 0 then round(total::numeric * 0.07, 2) else vat_total end,
  grand_total = case when grand_total = 0 then round(total::numeric * 1.07, 2) else grand_total end;

alter table public.quotes alter column quote_number set default public.next_quote_number();
alter table public.quotes alter column quote_number set not null;
create unique index if not exists quotes_quote_number_key on public.quotes(quote_number);

with ranked_pending as (
  select id, row_number() over (partition by quote_id order by requested_at desc, id desc) as row_number
  from public.quote_approvals
  where status = 'pending'
)
update public.quote_approvals approval
set status = 'expired'
from ranked_pending
where approval.id = ranked_pending.id
  and ranked_pending.row_number > 1;

create unique index if not exists quote_approvals_one_pending_per_quote
on public.quote_approvals(quote_id)
where status = 'pending';
