# Candy Shop Boumerdès — Supabase Integration Setup Guide

## Overview
This guide walks you through setting up Supabase as the permanent backend for your Candy Shop website. After completing these steps, all data (users, products, orders, keys, site content, etc.) will persist in Supabase PostgreSQL instead of browser localStorage.

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Complete database schema with tables, RLS policies, triggers, security definer functions, storage buckets, and seed data |
| `supabase-config.js` | Supabase URL and publishable key (safe for frontend) |
| `supabase-sync.js` | Client-side sync layer: warm cache, intercept writes, auth handlers, realtime |
| `SUPABASE_SETUP.md` | This documentation |

### Modified Files
| File | Changes |
|------|---------|
| `index.html` | Added Supabase CDN + config + sync scripts; added **Users** and **Activity Log** admin tabs |
| `app.js` | Wrapped `lsSet` to sync to Supabase; replaced auth (login/register/logout/redeem) with Supabase Auth; admin tabs now fetch live data; order confirmation uses secure RPC |

---

## Step 1: Run the SQL Migration

1. Open your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: **krdtfonxxdugmhduzwld**
3. Go to **SQL Editor** → **New Query**
4. Copy the **entire contents** of `supabase/schema.sql`
5. Paste and click **Run**

This creates:
- **Tables**: `profiles`, `categories`, `products`, `orders`, `registration_keys`, `site_content`, `gift_config`, `activity_log`, `notifications`
- **RLS policies** enforcing: users read own data, staff read all, only owners write sensitive tables
- **Security definer functions** for: key redemption, role/status changes, order confirmation, activity logging
- **Triggers** that auto-populate the **Activity Log** on every important change
- **Storage buckets**: `product-images` (public read, owner write), `site-assets` (public read, owner write)
- **Seed data** matching your current website (22 products, 7 categories, site content, gift config)

---

## Step 2: Configure Supabase Auth Settings

### Email Confirmation (Required for Production)
1. In Supabase Dashboard → **Authentication** → **Settings**
2. Under **Email Auth**, disable "Enable email confirmations" **only for development**
3. For production: **keep it enabled** and configure SMTP (Supabase sends confirmation emails)

### Site URL & Redirect URLs
1. Still in **Authentication** → **Settings** → **URL Configuration**
2. **Site URL**: `https://<your-github-username>.github.io/shop`
3. **Redirect URLs** (add all):
   - `https://<your-github-username>.github.io/shop`
   - `http://localhost:5500` (if testing locally with Live Server)
   - `http://127.0.0.1:5500`

### Email Templates (Optional)
- Customize the "Confirm signup" email template under **Authentication** → **Email Templates**

---

## Step 3: Deploy to GitHub Pages

Your project is a static site. The Supabase integration works 100% client-side (no server needed).

### GitHub Repository Setup
```bash
# If not already a git repo:
cd C:\Users\ANIS\Desktop\shop
git init
git add .
git commit -m "Candy Shop with Supabase integration"

# Create GitHub repo (via web UI or gh CLI)
# Then:
git remote add origin https://github.com/<your-username>/shop.git
git push -u origin main
```

### Enable GitHub Pages
1. Go to your GitHub repo → **Settings** → **Pages**
2. **Source**: "Deploy from a branch"
3. **Branch**: `main` / `/ (root)`
4. Click **Save**

Your site will be live at: `https://<your-username>.github.io/shop/`

---

## Step 4: Verify the Integration

After deployment, visit your live site and test:

### ✅ Public Features (work for everyone)
- [ ] Products load from Supabase (not localStorage seed)
- [ ] Cart persists across browser sessions
- [ ] Categories filter works
- [ ] Gift Box builder works
- [ ] Site content (hero, marquee, visit, reviews) loads from DB

### ✅ Authentication
- [ ] **Register** creates a Supabase Auth user + `profiles` row
- [ ] **Login** works with email/password (or username fallback)
- [ ] **Logout** clears session
- [ ] Session persists on refresh (Supabase JWT in localStorage)

### ✅ Owner Features (after redeeming owner key)
1. **Generate an owner key**: In Admin Dashboard → **Access Keys** → pick expiry → "Generate key"
2. **Log in as a regular user**, then go to Account → "Redeem staff key" → paste key
3. **Admin Dashboard** button appears in nav
4. **Admin Dashboard** shows:
   - [ ] **Products** tab: CRUD products, images upload to Storage
   - [ ] **Categories** tab: CRUD categories
   - [ ] **Access Keys** tab: generate/revoke CS- (owner) and EMP- (employee) keys
   - [ ] **Site Content** tab: edit hero, marquee, visit, reviews, logo, theme
   - [ ] **Gifts** tab: toggle gift pricing, manage DZD values, min/max
   - [ ] **Orders** tab: see all orders, confirm orders (via secure RPC)
   - [ ] **Users** tab: list all users, ban/unban (owner only)
   - [ ] **Activity Log** tab: paginated audit trail (owner only)
   - [ ] **Stats cards** at top: products, orders, revenue, new orders

### ✅ Employee Features
1. Generate an **EMP-** key as owner
2. Employee logs in, redeems EMP- key
3. Admin Dashboard opens but **only shows Orders tab + stats**

### ✅ Data Persistence Test
1. Add a product as owner → refresh page → product still there
2. Place an order as customer → refresh → order in admin Orders tab
3. Ban a user → try logging in as them → blocked ("account banned")
4. Change theme in Site Content → refresh → theme persists
5. Open site in **different browser/device** → all data visible

---

## Step 5: (Optional) Custom Domain

If you want a custom domain instead of `github.io`:

1. In GitHub repo → **Settings** → **Pages** → **Custom domain**
2. Add your domain (e.g., `candyshop.dz`)
3. Add DNS records:
   - `CNAME` → `<your-username>.github.io`
4. In Supabase Auth → **URL Configuration** → update **Site URL** to `https://candyshop.dz`
5. Add redirect URLs for the custom domain

---

## Security Notes (Important!)

### What IS Secure (Server-Side Enforced)
| Action | Protected By |
|--------|--------------|
| Key redemption | `redeem_registration_key()` RPC (SECURITY DEFINER) |
| Role changes (customer → employee/owner) | `set_user_role()` RPC |
| User ban/unban | `set_user_status()` RPC |
| Order confirmation | `set_order_status()` RPC |
| Product/Category/Site/Gift writes | RLS policies (only `is_owner()`) |
| Reading all orders/keys/users | RLS policies (only `is_staff()`) |
| Activity log | RLS + triggers (server-side, cannot be bypassed) |

### What is NOT in Frontend Code
- **No service_role / secret key** anywhere
- Only the **publishable key** (`sb_publishable_...`) is in `supabase-config.js`
- This is safe to commit to GitHub Pages

### RLS Policies Summary
| Table | Read | Write |
|-------|------|-------|
| profiles | Self + Staff | Self (not role/status) |
| categories | Public | Owner only |
| products | Public | Owner only |
| orders | Own + Staff | Own (insert), Staff (update status via RPC) |
| registration_keys | Staff only | Owner only |
| site_content | Public | Owner only |
| gift_config | Public | Owner only |
| activity_log | Staff only | Triggers/RPC only |
| notifications | Staff read, Anon insert | — |

---

## Troubleshooting

### "Supabase not configured" toast / features missing
- Check browser console for: `Failed to load @supabase/supabase-js`
- Ensure CDN loads: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- Check `supabase-config.js` has correct URL and publishable key

### Auth not persisting / login fails
- Verify **Site URL** and **Redirect URLs** in Supabase Auth settings match your deployed URL exactly (including `https://`)
- Check email confirmation setting (if enabled, user must click email link first)

### Orders not showing in Admin
- Must be logged in as **owner** or **employee** (redeem a key)
- Check browser console for RLS errors
- Verify `is_staff()` function exists in DB (run schema.sql again if missing)

### Images not uploading
- Storage buckets require owner role
- Check `product-images` and `site-assets` buckets exist in Supabase → Storage
- Policies: public read, owner write (see schema.sql)

### Activity Log empty
- Triggers fire on DB changes (orders, products, keys, profiles)
- Make changes via the Admin Dashboard (which uses RPCs) to populate it
- Direct SQL edits in Supabase Dashboard also trigger it

---

## Environment Values Reference

### Supabase Project
- **URL**: `https://krdtfonxxdugmhduzwld.supabase.co`
- **Publishable Key**: `sb_publishable_fM-DU4KJ9hn09h2DvDNCog_GCwjUePS`
- **Project Ref**: `krdtfonxxdugmhduzwld`

### Local Storage Keys (Warm Cache — Synced to Supabase)
```
candy_cart              → orders table
candy_products          → products table
candy_categories        → categories table
candy_keys              → registration_keys table
candy_site              → site_content table (id=1)
candy_gift_config       → gift_config table (id=1)
candy_orders            → orders table (cached)
candy_session           → auth session mirror
candy_users             → legacy (profiles table is source of truth)
```

### Admin Default Credentials
- **Hardcoded Owner**: username `INVYX`, password `2705` (legacy fallback, not in Supabase)
- **Real Owner**: create account → redeem CS- key generated by existing owner

---

## Remaining Limitations / Server-Side Requirements

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password auth | ✅ Client-side | Works via Supabase Auth |
| Social login (Google, etc.) | ⚠️ Possible | Add provider in Supabase Auth → Providers |
| Password reset emails | ✅ Server-side | Configure SMTP in Supabase |
| **File uploads > 5MB** | ⚠️ Needs Edge Function | Current: base64 → Storage (limited by browser). For large files: create Supabase Edge Function to upload via service_role. |
| **Cron jobs** (cleanup, reports) | ⚠️ Needs pg_cron / Edge Function | Use Supabase Cron or GitHub Actions |
| **Search** (full-text) | ⚠️ Needs pg_trgm / Edge Function | Add GIN indexes + RPC |
| **Analytics dashboard** | ⚠️ Needs aggregation | Use Supabase Realtime + materialized views |
| **Webhooks** (order → email/SMS) | ⚠️ Needs Edge Function | Create `orders_insert` webhook handler |

**For a pure GitHub Pages deployment**, all core features work. The "⚠️" items above only apply if you need advanced automation or very large file uploads.

---

## Quick Commands Reference

```bash
# Test locally with Live Server (VS Code extension)
# Open index.html → Right-click → "Open with Live Server"

# Check JS syntax
node --check app.js
node --check supabase-sync.js

# View Supabase logs
# Dashboard → Logs → API / Auth / Postgres

# Run schema changes (if you modify schema.sql)
# Dashboard → SQL Editor → paste → Run
```

---

## Summary Checklist

- [ ] Run `supabase/schema.sql` in Supabase SQL Editor
- [ ] Configure Auth Site URL + Redirect URLs
- [ ] Push to GitHub, enable Pages
- [ ] Visit live site, test register/login/order flow
- [ ] Generate owner key, redeem it, verify Admin Dashboard
- [ ] Test Users tab (ban/unban), Activity Log
- [ ] Verify data persists across browsers/devices
- [ ] (Optional) Add custom domain + update Auth URLs

You're now running a **fully persistent, secure, serverless e-commerce site** on GitHub Pages with Supabase as the backend! 🎉