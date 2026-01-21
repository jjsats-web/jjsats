# Supabase Setup (Products)

หน้านี้ (`/product`) ใช้ API เดิมคือ `/api/products` แต่เปลี่ยน storage ไปเก็บ/ดึงจาก Supabase แทน

## ไฟล์เชื่อมต่อ Supabase

- Server/API: `lib/supabase/server.ts` (อ่าน `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` หรือ `SUPABASE_ANON_KEY`)
- Client (ถ้าต้องการเรียกจาก client component): `lib/supabase/client.ts` (อ่าน `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## 1) ตั้งค่า Environment Variables

กำหนดค่าอย่างใดอย่างหนึ่ง:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (แนะนำสำหรับฝั่ง Server เท่านั้น) หรือ `SUPABASE_ANON_KEY`

> หมายเหตุ: ห้ามนำ `SUPABASE_SERVICE_ROLE_KEY` ไปใช้ในฝั่ง Client และถ้าจะ deploy สู่ public ควรเพิ่ม auth/ใช้ RLS ให้เหมาะสมก่อน

## 2) สร้างตาราง `products`

รันใน Supabase SQL Editor (แนะนำให้รันทีละบล็อก)  
ถ้าเจอ `syntax error at or near "drop"` ให้เช็กว่าแต่ละ statement จบด้วย `;` ครบ โดยเฉพาะบรรทัด `with check (true);`

### 2.1 Table + Trigger

```sql
-- 1) UUID generator
create extension if not exists "pgcrypto";

-- 2) Table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  unit text,
  dealer_price numeric(12,2) not null default 0,
  project_price numeric(12,2) not null default 0,
  user_price numeric(12,2) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Indexes (optional แต่แนะนำ)
create index if not exists products_name_idx on public.products (name);
create index if not exists products_sku_idx on public.products (sku);

-- 4) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();
```

### 2.2 RLS + Policies (dev-open)

```sql
-- 5) RLS (เปิดไว้) + policy สำหรับ dev แบบเปิดกว้าง
-- ถ้าคุณใช้ SUPABASE_SERVICE_ROLE_KEY ผ่าน route handler ฝั่ง server อย่างเดียว
-- policy ด้านล่าง "ไม่จำเป็น" แต่ใส่ไว้เพื่อให้ใช้งานด้วย anon key ได้ด้วย
alter table public.products enable row level security;

drop policy if exists "products_read_all" on public.products;
create policy "products_read_all"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "products_insert_all" on public.products;
create policy "products_insert_all"
on public.products
for insert
to anon, authenticated
with check (true);

drop policy if exists "products_update_all" on public.products;
create policy "products_update_all"
on public.products
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "products_delete_all" on public.products;
create policy "products_delete_all"
on public.products
for delete
to anon, authenticated
using (true);

-- 6) Grants (บางโปรเจกต์ต้องกำหนดเพิ่มเพื่อให้ PostgREST ทำงานได้)
grant select, insert, update, delete on table public.products to anon, authenticated;
```

## 3) Generate TypeScript Types

โปรเจกต์มีสคริปต์ `npm run gen:types` เพื่อ gen types จาก Supabase ลงไฟล์ `lib/supabase/database.types.ts`

- ตั้งค่าใน `.env.local` อย่างน้อย 1 แบบ:
  - `SUPABASE_PROJECT_ID` (หรือมี `SUPABASE_URL` ให้สคริปต์ดึง project ref ให้) + (แนะนำ) `SUPABASE_ACCESS_TOKEN`
  - หรือใช้ `SUPABASE_DB_URL` เพื่อ gen จาก database url โดยตรง
- รันคำสั่ง: `npm run gen:types`

## 4) ตาราง `customers` (สำหรับหน้า /customer)

รันทีละบล็อกใน Supabase SQL Editor

### 4.1 Table + Trigger

```sql
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  system_name text,
  tax_id text,
  contact_name text,
  contact_phone text,
  address text,
  approx_purchase_date text,
  project_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_company_idx on public.customers (company_name);
-- (optional) เพิ่ม index ตามการค้นหาที่ต้องการในอนาคตได้

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute procedure public.set_updated_at();
```

### 4.2 RLS + Policy (dev-open)

```sql
alter table public.customers enable row level security;

drop policy if exists "customers_read_all" on public.customers;
create policy "customers_read_all"
on public.customers
for select
to anon, authenticated
using (true);

drop policy if exists "customers_insert_all" on public.customers;
create policy "customers_insert_all"
on public.customers
for insert
to anon, authenticated
with check (true);

-- เพิ่ม policy update/delete ได้ตามต้องการ
-- ถ้าต้องการให้หน้า /customer แก้ไขข้อมูลได้ (PUT /api/customers/[id])
drop policy if exists "customers_update_all" on public.customers;
create policy "customers_update_all"
on public.customers
for update
to anon, authenticated
using (true)
with check (true);

grant update on table public.customers to anon, authenticated;
```

### ลบคอลัมน์ `system_name` ออกจาก `customers`

ถ้าไม่ต้องการเก็บฟิลด์ “ระบบ” อีกต่อไป ให้รัน:

```sql
alter table public.customers
  drop column if exists system_name;
```

## 6) ตาราง `quotes` (บันทึกใบเสนอราคา)

สร้างเพื่อรองรับการบันทึกจากปุ่ม “บันทึกใบเสนอราคา” ในหน้า `/`:

```sql
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  company_name text not null,
  system_name text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.quotes enable row level security;

drop policy if exists "quotes_read_all" on public.quotes;
create policy "quotes_read_all"
on public.quotes
for select
to anon, authenticated
using (true);

drop policy if exists "quotes_insert_all" on public.quotes;
create policy "quotes_insert_all"
on public.quotes
for insert
to anon, authenticated
with check (true);

drop policy if exists "quotes_update_all" on public.quotes;
create policy "quotes_update_all"
on public.quotes
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "quotes_delete_all" on public.quotes;
create policy "quotes_delete_all"
on public.quotes
for delete
to anon, authenticated
using (true);

grant select, insert, update, delete on table public.quotes to anon, authenticated;
```

## 7) ตาราง `pins` (สำหรับเก็บรหัส PIN เข้าหน้าทะเบียนลูกค้า)

สร้างไว้เพื่อใช้กับหน้า `/pin` และ API `/api/pin`/`/api/pin/register`:

```sql
create table if not exists public.pins (
  id text primary key,
  pin text not null,
  first_name text,
  last_name text,
  role text not null default 'user',
  signature_image text,
  created_at timestamptz not null default now()
);

-- ถ้ามีตารางเดิมแล้ว ให้เพิ่มคอลัมน์ที่ขาด
alter table public.pins
add column if not exists role text not null default 'user',
add column if not exists signature_image text;

alter table public.pins enable row level security;

drop policy if exists "pins_read_all" on public.pins;
create policy "pins_read_all"
on public.pins
for select
to anon, authenticated
using (true);

drop policy if exists "pins_upsert_all" on public.pins;
create policy "pins_upsert_all"
on public.pins
for insert
to anon, authenticated
with check (true);

create policy "pins_update_all"
on public.pins
for update
to anon, authenticated
using (true)
with check (true);

grant select, insert, update on table public.pins to anon, authenticated;
```
## Troubleshooting

- ถ้า `/api/products` ขึ้น 500 และ response เป็น `...contains placeholder...` ให้แก้ `.env.local` ให้เป็นค่าจริง (อย่าให้มีคำว่า `YOUR_...` ต่อท้าย/นำหน้า)
- ถ้า error ว่า `relation "products" does not exist` ให้รัน SQL ในหัวข้อ `2.1` เพื่อสร้างตารางก่อน
- ถ้า error ว่า `column ... does not exist` ให้ตรวจ schema ให้ตรงกับที่ API ใช้: `id,name,sku,unit,dealer_price,project_price,user_price,description,created_at`

## 5) Migration: เปลี่ยนจาก `unit_price` → 3 ราคา

ถ้าคุณมีตาราง `products` เดิมที่ยังใช้ `unit_price` และต้องการเปลี่ยนเป็น `dealer_price / project_price / user_price`:

```sql
alter table public.products
add column if not exists dealer_price numeric(12,2) not null default 0,
add column if not exists project_price numeric(12,2) not null default 0,
add column if not exists user_price numeric(12,2) not null default 0;

update public.products
set dealer_price = coalesce(dealer_price, unit_price, 0),
    project_price = coalesce(project_price, unit_price, 0),
    user_price = coalesce(user_price, unit_price, 0);

-- optional: ถ้าไม่ต้องการใช้แล้วค่อยลบทิ้ง
alter table public.products
drop column if exists unit_price;
```
