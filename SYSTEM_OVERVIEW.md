# System Overview (Quotation App)

## Pages & Features
- `app/page.tsx` — ใบเสนอราคา (client): ใส่ข้อมูลลูกค้า/รายการสินค้า, เพิ่มรายการจาก “ค้นหา (ชื่อ/รหัส)” ซึ่งดึงสินค้าแบบสดจาก Supabase ผ่าน `/api/products`, ไม่มีประวัติใบเสนอราคาจำลองแล้ว
- `app/customer/page.tsx` — ทะเบียนลูกค้า (client): บันทึก/ดึงลูกค้าผ่าน `/api/customers` (Supabase)
- `app/product/page.tsx` — คลังสินค้าบริษัท (client): CRUD สินค้าผ่าน `/api/products` (Supabase)
- `app/layout.tsx`, `app/globals.css` — layout และสไตล์รวม

## APIs (App Router)
- `app/api/products` — GET/POST สินค้า (Supabase table `products`)
- `app/api/products/[id]` — PUT/DELETE สินค้า (Supabase table `products`)
- `app/api/customers` — GET/POST ลูกค้า (Supabase table `customers`)
- `app/api/customers/[id]` — PUT ลูกค้า (Supabase table `customers`)

## Supabase Integration
- Server client: `lib/supabase/server.ts` (ใช้ `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`, มี validation ตรวจ placeholder/รูปแบบ key/โปรเจ็กต์)
- Client helper (ถ้าต้องใช้): `lib/supabase/client.ts` (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, มี validation เช่นกัน)
- Types generator script: `scripts/gen-supabase-types.mjs` (`npm run gen:types`), ใช้ Supabase CLI (dev dependency `supabase`)

## Environment Variables (ตัวอย่างใน `.env.local`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client ถ้าต้องใช้)
- Optional for types gen: `SUPABASE_PROJECT_ID`/`SUPABASE_DB_URL`, `SUPABASE_SCHEMA`, `SUPABASE_TYPES_OUTPUT`

## Database Schema (Supabase)
- `products`: `id uuid pk`, `name text`, `sku text`, `unit text`, `dealer_price numeric`, `project_price numeric`, `user_price numeric`, `description text`, `created_at`, `updated_at`, RLS dev-open policies (อ่าน/เขียน/อัปเดต/ลบ)
- `customers`: `id uuid pk`, `company_name`, `system_name`, `tax_id`, `contact_name`, `contact_phone`, `address`, `approx_purchase_date`, `project_name`, `created_at`, `updated_at`, RLS dev-open policies (select/insert; update/delete เพิ่มได้ตามต้องการ)
- SQL step-by-step อยู่ใน `SUPABASE.md`

## Commands
- `npm run dev` — dev server
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm run gen:types` — gen Supabase DB types → `lib/supabase/database.types.ts`

## Known Requirements
- ต้องตั้งค่า `.env.local` เป็นค่าจริง (ไม่ใช่ placeholder) มิฉะนั้น `/api/*` จะ 500 ด้วยข้อความเตือน
- RLS policies ใน `SUPABASE.md` เปิดกว้างสำหรับ dev; ก่อน deploy production ควรปรับ policy/role ให้ปลอดภัย
