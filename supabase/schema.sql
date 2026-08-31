-- =====================================================================
--  CANDY SHOP BOUMERDÈS — Supabase schema (permanent backend)
--  Run this whole file once in: Supabase Dashboard → SQL Editor → New query
--  You can paste it and hit "Run". It is idempotent for the create statements
--  via `create table if not exists` / `drop ... if exists` where needed.
--
--  Tables: profiles, categories, products, orders, registration_keys,
--          site_content, gift_config, activity_log, notifications
--  + RLS policies, security definer functions, activity-log triggers,
--    storage buckets, and seed data matching the current website.
-- =====================================================================

-- ---------- Enable extensions ----------
create extension if not exists "pgcrypto";

-- =====================================================================
--  1. PROFILES  (extends auth.users, holds role + status)
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text default '',
  email       text,
  role        text not null default 'customer'
              check (role in ('customer','employee','owner')),
  status      text not null default 'active'
              check (status in ('active','banned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a Supabase Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  ROLE / STAFF HELPERS  (depends on public.profiles — defined immediately
--  after the table so every later `for select using (public.is_*())` can bind)
-- =====================================================================
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and status = 'active'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner','employee') and status = 'active'
  );
$$;

grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- RLS
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_self"     on public.profiles;
drop policy if exists "profiles_read_staff"    on public.profiles;
drop policy if exists "profiles_insert_self"   on public.profiles;
drop policy if exists "profiles_update_self"   on public.profiles;

create policy "profiles_read_self"   on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_read_staff"  on public.profiles
  for select using (public.is_staff());

create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

-- Self-update is allowed but the user may NOT change their own role or status.
create policy "profiles_update_self" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role is not distinct from (select p.role from public.profiles p where p.id = id)
    and status is not distinct from (select p.status from public.profiles p where p.id = id)
  );

-- =====================================================================
--  3. CATEGORIES
-- =====================================================================
create table if not exists public.categories (
  id          text primary key,
  name        text not null,
  description text default '',
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "categories_read"     on public.categories;
drop policy if exists "categories_write"    on public.categories;

create policy "categories_read"  on public.categories
  for select using (true);

create policy "categories_write" on public.categories
  for all using (public.is_owner()) with check (public.is_owner());

-- =====================================================================
--  4. PRODUCTS  (including gifts; images stored as public URL or Storage URL)
-- =====================================================================
create table if not exists public.products (
  id          text primary key,
  category    text references public.categories(id) on delete set null,
  name        text not null,
  price       numeric not null default 0,
  stock       integer,                -- null = unlimited
  tag         text default '',
  description text default '',
  image       text default '',
  is_gift     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "products_read"  on public.products;
drop policy if exists "products_write" on public.products;

create policy "products_read"  on public.products
  for select using (true);

create policy "products_write" on public.products
  for all using (public.is_owner()) with check (public.is_owner());

-- =====================================================================
--  5. ORDERS  (customer + delivery info + items JSON + status)
-- =====================================================================
create table if not exists public.orders (
  id                  text primary key,
  user_id             uuid references auth.users(id) on delete set null,
  customer_name       text,
  customer_phone      text,
  customer_email      text,
  delivery_mode       text default 'home',
  wilaya              text default '',
  baladia             text default '',
  address             text default '',
  note                text default '',
  items               jsonb not null default '[]',
  subtotal            numeric not null default 0,
  status              text not null default 'new'
                      check (status in ('new','confirmed','pending','cancelled')),
  selected_gift_price numeric,
  currency            text,
  has_gifts           boolean not null default false,
  has_custom_gift_box boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "orders_read_own"    on public.orders;
drop policy if exists "orders_read_staff"  on public.orders;
drop policy if exists "orders_insert_own"  on public.orders;
drop policy if exists "orders_insert_guest" on public.orders;

create policy "orders_read_own"   on public.orders
  for select using (auth.uid() = user_id);

create policy "orders_read_staff" on public.orders
  for select using (public.is_staff());

-- Customers may insert, but RLS forces the order to belong to them.
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

-- Guest checkout: allow INSERT where user_id IS NULL (anonymous orders)
create policy "orders_insert_guest" on public.orders
  for insert with check (user_id IS NULL);

-- Order updates (status changes) go through the security definer below.

-- =====================================================================
--  6. REGISTRATION KEYS  (owner CS- / employee EMP-)
-- =====================================================================
create table if not exists public.registration_keys (
  code        text primary key,
  type        text not null default 'owner' check (type in ('owner','employee')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used        boolean not null default false,
  used_by     uuid,
  used_at     timestamptz,
  revoked     boolean not null default false
);

alter table public.registration_keys enable row level security;

-- Only staff can list keys (so a customer never sees all keys).
drop policy if exists "regkeys_read_staff"  on public.registration_keys;
drop policy if exists "regkeys_write_owner" on public.registration_keys;

create policy "regkeys_read_staff"  on public.registration_keys
  for select using (public.is_staff());

create policy "regkeys_write_owner" on public.registration_keys
  for all using (public.is_owner()) with check (public.is_owner());

-- =====================================================================
--  7. SITE CONTENT  (singleton row id = 1)
-- =====================================================================
create table if not exists public.site_content (
  id          integer primary key default 1 check (id = 1),
  logo        text default '',
  hero        jsonb not null default '{}',
  marquee     jsonb not null default '[]',
  visit       jsonb not null default '{}',
  reviews     jsonb not null default '[]',
  theme       jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "site_read"  on public.site_content;
drop policy if exists "site_write" on public.site_content;

create policy "site_read"  on public.site_content
  for select using (true);

create policy "site_write" on public.site_content
  for all using (public.is_owner()) with check (public.is_owner());

-- =====================================================================
--  8. GIFT CONFIG  (singleton row id = 1)
-- =====================================================================
create table if not exists public.gift_config (
  id          integer primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  prices      jsonb not null default '[500,1000,2000,5000,10000]',
  min_value   integer,
  max_value   integer,
  updated_at  timestamptz not null default now()
);

alter table public.gift_config enable row level security;

drop policy if exists "gift_read"  on public.gift_config;
drop policy if exists "gift_write" on public.gift_config;

create policy "gift_read"  on public.gift_config
  for select using (true);

create policy "gift_write" on public.gift_config
  for all using (public.is_owner()) with check (public.is_owner());

-- =====================================================================
--  9. ACTIVITY / AUDIT LOG
-- =====================================================================
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_name  text,
  actor_role  text,
  action      text not null,
  entity      text,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_actor_idx  on public.activity_log (actor_id);

alter table public.activity_log enable row level security;

-- Only staff may read the log.
drop policy if exists "log_read_staff" on public.activity_log;

create policy "log_read_staff" on public.activity_log
  for select using (public.is_staff());

-- Inserts are done ONLY through the security definer function log_activity()
-- (or DB triggers), never raw client inserts.

-- Client-callable logging helper (any authenticated user can log their own actions).
create or replace function public.log_activity(
  p_action  text,
  p_entity  text default null,
  p_entity_id text default null,
  p_details jsonb  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid  uuid := auth.uid();
  _name text;
  _role text;
begin
  select name, role into _name, _role from public.profiles where id = _uid;
  insert into public.activity_log (actor_id, actor_name, actor_role, action, entity, entity_id, details)
  values (_uid, _name, _role, p_action, p_entity, p_entity_id, p_details);
end;
$$;

grant execute on function public.log_activity(text, text, text, jsonb) to anon, authenticated;

-- ---------- Automated activity-log triggers (server-side, always run) ---------

-- Orders: created
create or replace function public.log_order_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
  values (new.user_id, 'customer', 'order created', 'order', new.id,
          jsonb_build_object('customer', new.customer_name, 'subtotal', new.subtotal, 'status', new.status));
  return new;
end;
$$;
drop trigger if exists trg_log_order_created on public.orders;
create trigger trg_log_order_created after insert on public.orders
  for each row execute function public.log_order_created();

-- Orders: status changed
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.activity_log (actor_id, actor_name, actor_role, action, entity, entity_id, details)
    values (auth.uid(), (select name from public.profiles where id = auth.uid()),
            (select role from public.profiles where id = auth.uid()),
            'order status changed', 'order', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_log_order_status on public.orders;
create trigger trg_log_order_status after update on public.orders
  for each row execute function public.log_order_status();

-- Products: inserted / updated / deleted
create or replace function public.log_product_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
    values (auth.uid(), 'owner', 'product created', 'product', new.id,
            jsonb_build_object('name', new.name, 'price', new.price));
  elsif (tg_op = 'UPDATE') then
    if old.price is distinct from new.price then
      insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
      values (auth.uid(), 'owner', 'product price changed', 'product', new.id,
              jsonb_build_object('from', old.price, 'to', new.price, 'name', new.name));
    else
      insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
      values (auth.uid(), 'owner', 'product edited', 'product', new.id,
              jsonb_build_object('name', new.name));
    end if;
  elsif (tg_op = 'DELETE') then
    insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
    values (auth.uid(), 'owner', 'product deleted', 'product', old.id,
            jsonb_build_object('name', old.name));
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_log_product on public.products;
create trigger trg_log_product after insert or update or delete on public.products
  for each row execute function public.log_product_change();

-- Registration keys: created / used / revoked
create or replace function public.log_key_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
    values (auth.uid(), 'owner', 'registration key created', 'key', new.code,
            jsonb_build_object('type', new.type, 'expires_at', new.expires_at));
  elsif (tg_op = 'UPDATE') then
    if new.used and old.used is distinct from new.used then
      insert into public.activity_log (actor_id, actor_name, actor_role, action, entity, entity_id, details)
      values (auth.uid(), (select name from public.profiles where id = auth.uid()),
              (select role from public.profiles where id = auth.uid()),
              'registration key used', 'key', new.code,
              jsonb_build_object('type', new.type, 'used_by', new.used_by));
    elsif new.revoked and old.revoked is distinct from new.revoked then
      insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
      values (auth.uid(), 'owner', 'registration key revoked', 'key', new.code, null);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_log_key on public.registration_keys;
create trigger trg_log_key after insert or update on public.registration_keys
  for each row execute function public.log_key_change();

-- Users: role / status changed (admin management)
create or replace function public.log_profile_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.role is distinct from new.role) then
    insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
    values (auth.uid(), 'owner', 'user role changed', 'user', new.id,
            jsonb_build_object('email', new.email, 'from', old.role, 'to', new.role));
  end if;
  if (old.status is distinct from new.status) then
    insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, details)
    values (auth.uid(), 'owner', 'user ' || new.status, 'user', new.id,
            jsonb_build_object('email', new.email));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_log_profile on public.profiles;
create trigger trg_log_profile after update on public.profiles
  for each row execute function public.log_profile_change();

-- =====================================================================
--  10. SECURITY DEFINER ACTION FUNCTIONS  (server-side protected)
-- =====================================================================

-- Redeem a registration key: only the caller may redeem, function validates
-- the key and sets the caller's role. Server-side, cannot be bypassed in JS.
create or replace function public.redeem_registration_key(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid     uuid := auth.uid();
  _rec     public.registration_keys;
  _result  text;
begin
  if _uid is null then
    raise exception 'must be logged in';
  end if;

  select * into _rec from public.registration_keys
    where upper(code) = upper(replace(p_code, ' ', ''));
  if not found then
    raise exception 'This key does not exist.';
  end if;
  if _rec.revoked then
    raise exception 'This key has been revoked.';
  end if;
  if _rec.used then
    raise exception 'This key has already been used.';
  end if;
  if _rec.expires_at <= now() then
    raise exception 'This key has expired.';
  end if;

  update public.registration_keys
    set used = true, used_by = _uid, used_at = now()
    where code = _rec.code;

  update public.profiles
    set role = _rec.type, updated_at = now()
    where id = _uid;

  _result := _rec.type;
  return _result;
end;
$$;

grant execute on function public.redeem_registration_key(text) to authenticated;

-- Owner-only: set another user's role.
create or replace function public.set_user_role(p_target uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'owner access required';
  end if;
  if p_role not in ('customer','employee','owner') then
    raise exception 'invalid role';
  end if;
  update public.profiles set role = p_role, updated_at = now() where id = p_target;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Owner-only: set another user's status (active / banned).
create or replace function public.set_user_status(p_target uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'owner access required';
  end if;
  if p_status not in ('active','banned') then
    raise exception 'invalid status';
  end if;
  update public.profiles set status = p_status, updated_at = now() where id = p_target;
end;
$$;

grant execute on function public.set_user_status(uuid, text) to authenticated;

-- Staff-only: confirm / set an order status.
create or replace function public.set_order_status(p_order_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff access required';
  end if;
  if p_status not in ('new','confirmed','pending','cancelled') then
    raise exception 'invalid status';
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;

grant execute on function public.set_order_status(text, text) to authenticated;

-- =====================================================================
--  11. NOTIFICATIONS  (optional; staff can see cross-device order popups)
-- =====================================================================
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  order_id      text,
  customer_name text,
  item_count    integer default 0,
  total         numeric default 0,
  seen          boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notif_read_staff"  on public.notifications;
drop policy if exists "notif_write_anon"  on public.notifications;

-- Public insert so any user (customer placing an order) can create one.
create policy "notif_write_anon" on public.notifications
  for insert with check (true);

create policy "notif_read_staff" on public.notifications
  for select using (public.is_staff());

-- =====================================================================
--  12. SEED DATA  (mirrors the current website defaults)
-- =====================================================================

-- Categories
insert into public.categories (id, name, description, sort) values
  ('c1', 'Gourmet Candies',    'Artisanal chocolates, chewy sweets and gummies.', 1),
  ('c2', 'Crunchy Chips',      'Kettle-cooked and baked chips in bold flavours.', 2),
  ('c3', 'Curated Gifts',      'Beautifully wrapped gift boxes for every occasion.', 3),
  ('c4', 'Premium Chocolates', 'Single-origin tablets and pralines, hand-finished.', 4),
  ('c5', 'Snacks',             'Savoury and sweet snack bites for any craving.', 5),
  ('c6', 'Candy',              'Classic and specialty candies from around the world.', 6),
  ('c7', 'Drinks',             'Refreshing beverages, artisanal sodas and cold brews.', 7)
on conflict (id) do nothing;

-- Products
insert into public.products (id, category, name, price, stock, tag, description, image, is_gift) values
  ('p1',  'c1', 'Chocolate Truffles',     2400, 15, 'Bestseller', 'Silky, slow-crafted truffles enrobed in rich dark chocolate.', 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?q=80&w=1000&auto=format&fit=crop', false),
  ('p2',  'c1', 'Fruit & Sour Gummies',    950, 30, 'New', 'Chewy gummies in bright fruit flavours — a shop favourite.', 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?q=80&w=1000&auto=format&fit=crop', false),
  ('p3',  'c2', 'Salted Kettle Chips',     180, 50, '', 'Hand-cooked chips with the perfect crunch and sea salt.', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?q=80&w=1000&auto=format&fit=crop', false),
  ('p4',  'c2', 'Spicy Paprika Chips',     220, 45, '', 'Bold, smoky paprika with a gentle kick. Addictive.', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=1000&auto=format&fit=crop', false),
  ('p5',  'c3', 'Signature Cake Box',     5600,  8, 'Most Given', 'A show-stopping box featuring our best-loved compositions.', 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=1000&auto=format&fit=crop', false),
  ('p6',  'c3', 'Friendship Gift Box',    4200, 12, '', 'A thoughtful mix of treats, wrapped beautifully for sharing.', 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1000&auto=format&fit=crop', false),
  ('p7',  'c4', 'Dark 70% Single-Origin', 1800, 20, '', 'Bold single-origin tablet — deep cocoa with fruit notes.', 'https://images.unsplash.com/photo-1481391319762-47dff72954d9?q=80&w=1000&auto=format&fit=crop', false),
  ('p8',  'c4', 'Handcrafted Pralines',   2600, 16, 'Signature', 'Pralines finished by hand — the crown of our range.', 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?q=80&w=1000&auto=format&fit=crop', false),
  ('p9',  'c5', 'Mixed Nuts Deluxe',       850, 40, 'New', 'Premium roasted nuts with sea salt and herbs.', 'https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1000&auto=format&fit=crop', false),
  ('p10', 'c5', 'Spicy Trail Mix',         950, 35, '', 'Nuts, seeds, and dried fruit with a kick of chili.', 'https://images.unsplash.com/photo-1597578465468-3a5c7b9a5c7b?q=80&w=1000&auto=format&fit=crop', false),
  ('p11', 'c5', 'Cheese Crisps',           650, 60, '', 'Baked 100% cheese crisps — keto friendly and crunchy.', 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?q=80&w=1000&auto=format&fit=crop', false),
  ('p12', 'c5', 'Sea Salt Popcorn',        450, 80, '', 'Light and fluffy popcorn with fine sea salt.', 'https://images.unsplash.com/photo-1578849278619-e73541694434?q=80&w=1000&auto=format&fit=crop', false),
  ('p13', 'c6', 'Sour Belt Candy',         550, 100, 'Bestseller', 'Tangy sour belts in rainbow flavors.', 'https://images.unsplash.com/photo-1582058091401-f87a2e55a40f?q=80&w=1000&auto=format&fit=crop', false),
  ('p14', 'c6', 'Licorice Twists',         650, 50, '', 'Classic black licorice twists — authentic taste.', 'https://images.unsplash.com/photo-1559339352-11d035aa65ef?q=80&w=1000&auto=format&fit=crop', false),
  ('p15', 'c6', 'Peppermint Candies',      450, 80, '', 'Refreshing peppermint hard candies in a tin.', 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?q=80&w=1000&auto=format&fit=crop', false),
  ('p16', 'c6', 'Caramel Chews',           750, 60, 'New', 'Soft, buttery caramel chews wrapped individually.', 'https://images.unsplash.com/photo-1559339352-11d035aa65ef?q=80&w=1000&auto=format&fit=crop', false),
  ('p17', 'c6', 'Jelly Beans Mix',         850, 45, '', 'Assorted gourmet jelly beans — 20+ flavors.', 'https://images.unsplash.com/photo-1582058091401-f87a2e55a40f?q=80&w=1000&auto=format&fit=crop', false),
  ('p18', 'c7', 'Artisanal Cola',          650, 30, 'New', 'Small-batch cola with natural cane sugar and spices.', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=1000&auto=format&fit=crop', false),
  ('p19', 'c7', 'Sparkling Lemonade',       550, 40, '', 'Fresh-pressed lemons with a gentle sparkle.', 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?q=80&w=1000&auto=format&fit=crop', false),
  ('p20', 'c7', 'Cold Brew Coffee',        1200, 25, 'Bestseller', 'Steeped 18 hours — smooth, chocolatey, low acidity.', 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?q=80&w=1000&auto=format&fit=crop', false),
  ('p21', 'c7', 'Kombucha Variety Pack',   2400, 15, '', '4 flavors: ginger, berry, citrus, original.', 'https://images.unsplash.com/photo-1581453904507-626f3b5e0b5e?q=80&w=1000&auto=format&fit=crop', false),
  ('p22', 'c7', 'Herbal Iced Tea',         480, 50, '', 'Hibiscus, mint, and lemongrass — naturally caffeine-free.', 'https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=1000&auto=format&fit=crop', false)
on conflict (id) do nothing;

-- Site content singleton
insert into public.site_content (id, logo, hero, marquee, visit, reviews)
values (
  1,
  'https://cdn.discordapp.com/attachments/1515105758633529454/1543275605359984751/LOGO_.png?ex=6a9446e8&is=6a92f568&hm=24b9fceb66868dfc725648b1b89dc933e1bd4122b91e56a37e9444903695269e',
  '{"eyebrow":"Premium Candy & Chips Boutique — Boumerdès","titleLine1":"The Art","titleEmphasis":"Sweetness","subtitle":"Gourmet candies, savoury chips and curated gift boxes — sourced with care and composed daily in the heart of Boumerdès.","heroImage":"https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=2000&auto=format&fit=crop","rating":"4.3"}'::jsonb,
  '["Gourmet Candies","Savory Chips","Curated Gifts","Premium Chocolates"]'::jsonb,
  '{"eyebrow":"Visit Us","titleLine1":"Find us in the","titleEmphasis":"heart of Boumerdès","lede":"Step inside for a coffee, a box of macarons, or a cake made just for you.","address":"QF44+WWC, Boumerdès, Algeria","phone":"0664 97 49 19","phoneHref":"213664974919","hours":"Mon – Sat · 9:00 – 21:00","mapSrc":"https://www.google.com/maps?q=QF44%2BWWC+Boumerd%C3%A8s+Algeria&z=15&output=embed","instagram":"https://www.instagram.com/candy_shop_35/"}'::jsonb,
  '[{"name":"Yasmine B.","role":"Regular customer","stars":5,"quote":"The macarons are the best I''ve had in Algeria — light, fresh and so elegant. The boutique itself feels like a little Parisian corner."},{"name":"Amine K.","role":"Birthday order","stars":5,"quote":"Ordered a signature cake for my daughter''s birthday — beautiful, delicious and ready exactly on time. Truly premium service."},{"name":"Lina M.","role":"Local guide","stars":4,"quote":"Beautiful boutique, friendly staff and the gummies are dangerously good. A lovely spot to treat yourself in Boumerdès."}]'::jsonb
)
on conflict (id) do nothing;

-- Gift config singleton
insert into public.gift_config (id, enabled, prices, min_value, max_value)
values (1, false, '[500,1000,2000,5000,10000]'::jsonb, null, null)
on conflict (id) do nothing;

-- =====================================================================
--  13. STORAGE BUCKETS  (images, logos, uploads)
-- =====================================================================
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('site-assets',    'site-assets',    true)
on conflict (id) do nothing;

-- product-images: public read, owner write
drop policy if exists "product_images_public_read"  on storage.objects;
drop policy if exists "product_images_owner_write"  on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "product_images_owner_write" on storage.objects
  for all using (bucket_id = 'product-images' and public.is_owner())
  with check (bucket_id = 'product-images' and public.is_owner());

-- site-assets: public read, owner write
drop policy if exists "site_assets_public_read" on storage.objects;
drop policy if exists "site_assets_owner_write" on storage.objects;
create policy "site_assets_public_read" on storage.objects
  for select using (bucket_id = 'site-assets');
create policy "site_assets_owner_write" on storage.objects
  for all using (bucket_id = 'site-assets' and public.is_owner())
  with check (bucket_id = 'site-assets' and public.is_owner());

-- Allow anonymous/authenticated to read public files in these buckets
-- (the two select policies above already grant it).
