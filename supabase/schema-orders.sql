create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_order_code text not null unique,
  status text not null default 'pending_payment',
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'unfulfilled',
  currency text not null default 'EUR',
  subtotal_amount numeric(10,2) not null default 0,
  shipping_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address_json jsonb not null,
  billing_address_json jsonb,
  notes text,
  payment_provider text not null default 'redsys',
  payment_reference text,
  payment_raw_response jsonb,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (
    status in ('pending_payment', 'paid', 'preparing', 'shipped', 'cancelled')
  ),
  constraint orders_payment_status_check check (
    payment_status in ('pending', 'paid', 'failed', 'refunded')
  ),
  constraint orders_fulfillment_status_check check (
    fulfillment_status in ('unfulfilled', 'preparing', 'shipped', 'delivered')
  ),
  constraint orders_subtotal_amount_check check (subtotal_amount >= 0),
  constraint orders_shipping_amount_check check (shipping_amount >= 0),
  constraint orders_total_amount_check check (total_amount >= 0),
  constraint orders_customer_email_check check (position('@' in customer_email) > 1)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sku text not null,
  product_slug text not null,
  product_name text not null,
  variant_label text not null,
  unit_price numeric(10,2) not null,
  quantity integer not null,
  line_total numeric(10,2) not null,
  product_image text,
  created_at timestamptz not null default now(),
  constraint order_items_unit_price_check check (unit_price >= 0),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_line_total_check check (line_total >= 0)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_fulfillment_status_idx on public.orders (fulfillment_status);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_sku_idx on public.order_items (sku);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orders_updated_at on public.orders;

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "service role manages orders" on public.orders;
create policy "service role manages orders"
on public.orders
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages order items" on public.order_items;
create policy "service role manages order items"
on public.order_items
for all
to service_role
using (true)
with check (true);
