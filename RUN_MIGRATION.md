# Run the Supabase Migration (No Manual SQL Editing)

Pick **one** of these methods:

---

## Method 1: Supabase CLI (Recommended)

```bash
# 1. Install CLI
npm install -g supabase  # or: brew install supabase/tap/supabase

# 2. Login (opens browser)
supabase login

# 3. Link to your project
supabase link --project-ref krdtfonxxdugmhduzwld

# 4. Create migration file
mkdir -p supabase/migrations
cp supabase/schema.sql supabase/migrations/20260831000000_initial_schema.sql

# 5. Push to remote (runs the SQL)
supabase db push
```

---

## Method 2: Direct `psql` (Fastest, No CLI Setup)

```bash
# Get your DB password from: Supabase Dashboard → Settings → Database → Connection string
# Format: postgresql://postgres:[YOUR-PASSWORD]@db.krdtfonxxdugmhduzwld.supabase.co:5432/postgres

psql "postgresql://postgres:YOUR_PASSWORD@db.krdtfonxxdugmhduzwld.supabase.co:5432/postgres" \
  -f supabase/schema.sql
```

---

## Method 3: Supabase Dashboard (GUI, No Terminal)

1. Open: https://supabase.com/dashboard/project/krdtfonxxdugmhduzwld/sql/new
2. Click **"Run SQL file"** (top right)
3. Select: `supabase/schema.sql`
4. Click **Run**

---

## Method 4: Node Script (If You Have Service Role Key)

```bash
# Get Service Role Key: Dashboard → Settings → API → service_role (secret)
npm install @supabase/supabase-js
node run-migration.js "your-service-role-key"
```

---

## Verify It Worked

After any method, check in Dashboard → **Table Editor** that these tables exist:

| Table | Expected Rows |
|-------|---------------|
| `categories` | 7 |
| `products` | 22 |
| `site_content` | 1 |
| `gift_config` | 1 |
| `profiles` | 0 (auto-created on signup) |
| `orders` | 0 |
| `registration_keys` | 0 |
| `activity_log` | 0 |
| `notifications` | 0 |

Also check **Storage** → buckets: `product-images`, `site-assets`

---

## Troubleshooting

**"relation already exists"** — Normal! The schema uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`. Safe to re-run.

**"permission denied"** — You're using the wrong key. Use **service_role** (not anon/publishable) for Methods 2 & 4.

**"connection refused"** — Check your IP is allowed: Dashboard → Settings → Database → Connection Pooling → Allowed IPs (or use 0.0.0.0/0 temporarily).

---

## After Migration: Deploy

```bash
git add .
git commit -m "Supabase schema + integration"
git push origin main
# GitHub Pages auto-deploys from main branch
```