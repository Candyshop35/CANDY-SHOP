/* eslint-disable */
/**
 * Supabase integration for Candy Shop — sync layer
 *
 * Requires: supabase-config.js  (window.CANDY_SUPABASE)  +  @supabase/supabase-js UMD.
 * Load order:
 *   1. supabase-config.js
 *   2. @supabase/supabase-js CDN  (optional — if missing, the site falls back to localStorage)
 *   3. supabase-sync.js  (this file)  — creates the client, warms the cache, wires interceptors
 *   4. app.js             — reads from the cache, routes writes through __candySync, auth via __candyAuth
 *
 * The data lives in Supabase as the single source of truth; localStorage is a warm cache
 * fed from the server before app.js boots, so a transient Supabase outage falls back silently
 * and the shop never renders with an empty shelf.
 */
(function () {
  'use strict';

  /* ── 0. Guards & state ──────────────────────────────────────────── */
  var cfg = window.CANDY_SUPABASE;
  var canRun = !!(cfg && cfg.url && cfg.publishable && window.supabase && window.supabase.createClient);
  if (!canRun) {
    // Supabase not configured — expose no-ops so app.js never crashes.
    window.__candySupabaseReady = false;
    window.__candySupa = null;
    window.__candyProfile = null;
    window.__candySync = function () {};
    window.__candyAuth = {
      ready: Promise.resolve(null),
      getSession: function () { return Promise.resolve(null); },
      signUp: function () { throw new Error('Supabase not configured.'); },
      signIn: function () { throw new Error('Supabase not configured.'); },
      signOut: function () { return Promise.resolve(); },
      redeemKey: function () { return Promise.reject(new Error('Supabase not configured.')); },
      setOrderStatus: function () { return Promise.reject(new Error('Supabase not configured.')); },
      log: function () { return Promise.resolve(); },
      uploadImage: function () { return Promise.reject(new Error('Supabase not configured.')); },
      fetchActivity: function () { return Promise.resolve([]); },
      fetchUsers: function () { return Promise.resolve([]); },
      setRole: function () { return Promise.reject(new Error('Supabase not configured.')); },
      setStatus: function () { return Promise.reject(new Error('Supabase not configured.')); },
      subscribeOrders: function () { return function () {}; }
    };
    return;
  }

  var supa = window.supabase.createClient(cfg.url, cfg.publishable);
  window.__candySupa = supa;
  window.__candySupabaseReady = false;
  window.__candyProfile = null;

  /* ── 1. localStorage cache bridge ───────────────────────────────── */
  var LS = {
    cart: 'candy_cart',
    products: 'candy_products',
    cats: 'candy_categories',
    keys: 'candy_keys',
    orders: 'candy_orders',
    site: 'candy_site',
    gift: 'candy_gift_config',
    session: 'candy_session'
  };

  function lsGet(k, fb) {
    try {
      var raw = localStorage.getItem(k);
      return raw == null ? fb : JSON.parse(raw);
    } catch (e) { return fb; }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) { return false; }
  }
  var toast = function (msg, type) {
    // Cheap local toast until app.js real toast() exists.
    console[type === 'error' ? 'warn' : 'log']('[sync]', type || 'info', msg);
    try {
      if (window.__candyToast) window.__candyToast(msg, type);
    } catch (e) {}
  };

  /* ── 2. Profile loader (role is in profiles, not auth) ─────────── */
  function loadProfile(uid) {
    if (!uid) { window.__candyProfile = null; return Promise.resolve(null); }
    // Defer: the helper `is_owner()`/`is_staff()` won't resolve until a
    // profile exists, but a profile select needs RLS to pass — the self
    // policy lets every user read their own row, so this succeeds even
    // before the trigger for a brand-new user has committed; we retry once.
    var tries = 0;
    function attempt() {
      tries += 1;
      return supa.from('profiles').select('*').eq('id', uid).maybeSingle()
        .then(function (r) {
          if (r.error && tries === 1 && String(r.error.message).indexOf('406') !== -1) {
            // Fresh user: trigger may not have fired yet.
            return new Promise(function (res) { setTimeout(function () { attempt().then(res); }, 350); });
          }
          if (r.data) {
            window.__candyProfile = r.data;
            // Mirror session role into localStorage for app.js compatibility.
            var sess = {
              name: r.data.name || r.data.email || 'User',
              email: r.data.email || '',
              role: r.data.role || 'customer',
              id: r.data.id
            };
            lsSet(LS.session, sess);
            return r.data;
          }
          window.__candyProfile = null;
          return null;
        });
    }
    return attempt();
  }

  /* ── 3. Public data cache warmer ────────────────────────────────── */
  async function warmCache() {
    try {
      var results = await Promise.allSettled([
        supa.from('categories').select('*').order('sort'),
        supa.from('products').select('*').order('created_at'),
        supa.from('site_content').select('*').eq('id', 1).maybeSingle(),
        supa.from('gift_config').select('*').eq('id', 1).maybeSingle()
      ]);

      // Categories
      if (results[0].status === 'fulfilled' && results[0].value.data) {
        var cats = results[0].value.data.map(function (r) {
          return { id: r.id, name: r.name, description: r.description || '' };
        });
        if (cats.length) lsSet(LS.cats, cats);
      }

      // Products
      if (results[1].status === 'fulfilled' && results[1].value.data) {
        var prods = results[1].value.data.map(function (r) {
          var p = {
            id: r.id,
            category: r.category,
            name: r.name,
            price: Number(r.price || 0),
            tag: r.tag || '',
            description: r.description || '',
            image: r.image || '',
            isGift: !!r.is_gift
          };
          if (r.stock != null) p.stock = r.stock;
          return p;
        });
        if (prods.length) lsSet(LS.products, prods);
      }

      // Site content
      if (results[2].status === 'fulfilled' && results[2].value.data) {
        var row = results[2].value.data;
        var site = lsGet(LS.site, null) || null;
        var nextSite = site ? JSON.parse(JSON.stringify(site)) : {};
        var patch = {};
        if (row.logo != null && row.logo !== '') patch.logo = row.logo;
        if (row.hero && typeof row.hero === 'object') patch.hero = row.hero;
        if (Array.isArray(row.marquee)) patch.marquee = row.marquee;
        if (row.visit && typeof row.visit === 'object') patch.visit = row.visit;
        if (Array.isArray(row.reviews)) patch.reviews = row.reviews;
        if (row.theme != null) patch.theme = row.theme;
        var merged = deepMergeWithSiteDefaults(nextSite, patch);
        lsSet(LS.site, merged);
      }

      // Gift config
      if (results[3].status === 'fulfilled' && results[3].value.data) {
        var g = results[3].value.data;
        var gc = {
          enabled: !!g.enabled,
          prices: Array.isArray(g.prices) ? g.prices.map(Number).filter(function (n) { return isFinite(n); }) : [500, 1000, 2000, 5000, 10000],
          minValue: g.min_value != null ? g.min_value : null,
          maxValue: g.max_value != null ? g.max_value : null
        };
        lsSet(LS.gift, gc);
      }

      // Staff-only datasets: preload only when the current user is staff.
      var profileForStaff = window.__candyProfile;
      if (profileForStaff && (profileForStaff.role === 'owner' || profileForStaff.role === 'employee')) {
        // Registration keys + orders
        var staffSets = await Promise.allSettled([
          supa.from('registration_keys').select('*').order('created_at'),
          supa.from('orders').select('*').order('created_at', { ascending: false })
        ]);
        if (staffSets[0].status === 'fulfilled' && staffSets[0].value.data) {
          var rawKeys = staffSets[0].value.data.map(function (r) {
            return {
              code: r.code,
              type: r.type || 'owner',
              createdAt: new Date(r.created_at).getTime(),
              expiresAt: new Date(r.expires_at).getTime(),
              used: !!r.used,
              usedBy: r.used_by || null,
              usedAt: r.used_at ? new Date(r.used_at).getTime() : null,
              revoked: !!r.revoked
            };
          });
          lsSet(LS.keys, rawKeys);
        }
        if (staffSets[1].status === 'fulfilled' && staffSets[1].value.data) {
          var rawOrders = staffSets[1].value.data.map(toLegacyOrder);
          lsSet(LS.orders, rawOrders);
        }
      } else if (profileForStaff && profileForStaff.role === 'customer') {
        // Customer: only their own orders.
        var custOrdersRes = await supa.from('orders').select('*').order('created_at', { ascending: false });
        if (custOrdersRes.data) {
          lsSet(LS.orders, custOrdersRes.data.map(toLegacyOrder));
        }
      }
    } catch (e) {
      console.warn('[supabase-sync] warmCache failed:', e);
    }
  }

  function deepMergeWithSiteDefaults(current, patch) {
    // Only called with flat keys for top-level; deep-merge on hero/visit.
    var out = current || {};
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (v !== undefined && v !== null) out[k] = v;
    });
    // Ensure marquee / reviews defaults if empty.
    if (!Array.isArray(out.marquee) || !out.marquee.length) { /* keep as-is; render fallback handles */ }
    return out;
  }

  function toLegacyOrder(row) {
    return {
      id: row.id,
      createdAt: new Date(row.created_at).getTime(),
      customerName: row.customer_name || '',
      customerPhone: row.customer_phone || '',
      customerEmail: row.customer_email || '',
      deliveryMode: row.delivery_mode || 'home',
      wilaya: row.wilaya || '',
      baladia: row.baladia || '',
      address: row.address || '',
      note: row.note || '',
      items: Array.isArray(row.items) ? row.items : [],
      subtotal: Number(row.subtotal || 0),
      status: row.status || 'new',
      selectedGiftPrice: row.selected_gift_price != null ? Number(row.selected_gift_price) : undefined,
      currency: row.currency || undefined,
      hasGifts: !!row.has_gifts,
      hasCustomGiftBox: !!row.has_custom_gift_box
    };
  }

  /* ── 4. Write interceptor (what app.js's patched lsSet calls) ───── */
  // Async queue so writes never interleave; each returns a promise that
  // resolves true on success / false on failure so the caller can react.
  var syncQueue = Promise.resolve();
  function enqueue(fn, name) {
    var run = syncQueue.then(function () { return fn(); });
    // Keep the chain alive even if one op throws, so later ops still run.
    syncQueue = run.then(function () { return null; }, function () { return null; });
    return run;
  }

  // Normalize a supabase-js result. The SDK resolves with {data, error}
  // rather than throwing, so we must check `.error` on EVERY call.
  function rlzErr(res, ctx) {
    var e = (res && res.error) ? res.error : null;
    if (e) {
      var msg = e.message || e.details || String(e);
      console.warn('[supabase-sync] ' + ctx + ': ' + (e.code ? e.code + ' ' : '') + msg);
    }
    return e;
  }

  // Report a failed save to the user in all cases (not just console).
  function reportSaveError(ctx, e) {
    var msg = (e && (e.message || e.details)) || String(e) || 'unknown error';
    var friendly = msg;
    if (/row-level security|42501|permission denied|policy/i.test(msg)) {
      friendly = 'Permission denied saving ' + ctx + '. Are you signed in as the owner?';
    } else if (/network|failed to fetch|load failed|offline/i.test(msg)) {
      friendly = 'Offline — could not save ' + ctx + '. Check your connection and retry.';
    }
    console.warn('[supabase-sync] ' + ctx + ': ' + msg);
    if (typeof window.__candyToast === 'function') {
      window.__candyToast('Could not save ' + ctx + '. ' + friendly, 'error');
    }
  }

  async function syncCategories(cats) {
    // Replace-all: only the owner ever calls this path.
    try {
      var incoming = (cats || []).map(function (c) {
        return { id: c.id, name: c.name, description: c.description || '', sort: 0 };
      });
      var keepIds = incoming.map(function (x) { return x.id; });
      var cur = await supa.from('categories').select('id');
      if (rlzErr(cur, 'categories read')) return false;
      var curIds = cur.data ? cur.data.map(function (r) { return r.id; }) : [];
      var toDelete = curIds.filter(function (id) { return keepIds.indexOf(id) === -1; });
      if (toDelete.length) {
        var del = await supa.from('categories').delete().in('id', toDelete);
        if (rlzErr(del, 'categories delete')) return false;
      }
      if (incoming.length) {
        var up = await supa.from('categories').upsert(incoming, { onConflict: 'id' });
        if (rlzErr(up, 'categories upsert')) return false;
      }
      return true;
    } catch (e) {
      reportSaveError('categories', e);
      return false;
    }
  }

  async function syncProducts(products) {
    try {
      var incoming = (products || []).map(function (p) {
        var row = {
          id: p.id,
          category: p.category || null,
          name: p.name,
          price: p.price != null ? p.price : 0,
          tag: p.tag || '',
          description: p.description || '',
          image: p.image || '',
          is_gift: !!p.isGift
        };
        if (p.stock != null && p.stock !== '' && Number.isFinite(Number(p.stock))) row.stock = Number(p.stock);
        else row.stock = null;
        return row;
      });
      var keepIds = incoming.map(function (x) { return x.id; });
      var cur = await supa.from('products').select('id');
      if (rlzErr(cur, 'products read')) return false;
      var curIds = cur.data ? cur.data.map(function (r) { return r.id; }) : [];
      var toDelete = curIds.filter(function (id) { return keepIds.indexOf(id) === -1; });
      if (toDelete.length) {
        var del = await supa.from('products').delete().in('id', toDelete);
        if (rlzErr(del, 'products delete')) return false;
      }
      if (incoming.length) {
        var up = await supa.from('products').upsert(incoming, { onConflict: 'id' });
        if (rlzErr(up, 'products upsert')) return false;
      }
      return true;
    } catch (e) {
      reportSaveError('products', e);
      return false;
    }
  }

  async function syncOrders(orders) {
    try {
      if (!Array.isArray(orders) || !orders.length) return true; // nothing to insert
      // Insert-only: never update/deletes existing orders client-side (status is RPC-managed).
      var ids = orders.map(function (o) { return o.id; });
      var existing = await supa.from('orders').select('id').in('id', ids);
      if (rlzErr(existing, 'orders read')) return false;
      var existingIds = existing.data ? existing.data.map(function (r) { return r.id; }) : [];
      var fresh = orders.filter(function (o) { return existingIds.indexOf(o.id) === -1; });
      if (!fresh.length) return true;
      var uid = (window.__candyProfile && window.__candyProfile.id)
        || (supa.auth.getSession ? (await supa.auth.getSession()).data.session?.user?.id : null);
      var rows = fresh.map(function (o) {
        return {
          id: o.id,
          user_id: uid || null,
          customer_name: o.customerName || '',
          customer_phone: o.customerPhone || '',
          customer_email: o.customerEmail || '',
          delivery_mode: o.deliveryMode || 'home',
          wilaya: o.wilaya || '',
          baladia: o.baladia || '',
          address: o.address || '',
          note: o.note || '',
          items: o.items || [],
          subtotal: o.subtotal != null ? o.subtotal : 0,
          status: o.status || 'new',
          selected_gift_price: o.selectedGiftPrice != null ? o.selectedGiftPrice : null,
          currency: o.currency || null,
          has_gifts: !!o.hasGifts,
          has_custom_gift_box: !!o.hasCustomGiftBox,
          created_at: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString()
        };
      });
      var ins = await supa.from('orders').insert(rows);
      if (rlzErr(ins, 'orders insert')) return false;
      return true;
    } catch (e) {
      reportSaveError('orders', e);
      return false;
    }
  }

  async function syncKeys(keys) {
    try {
      var incoming = (keys || []).map(function (k) {
        return {
          code: k.code,
          type: k.type || 'owner',
          created_at: k.createdAt ? new Date(k.createdAt).toISOString() : new Date().toISOString(),
          expires_at: k.expiresAt ? new Date(k.expiresAt).toISOString() : new Date(Date.now() + 24 * 3600000).toISOString(),
          used: !!k.used,
          used_by: k.usedBy != null ? String(k.usedBy) : null, // legacy local uses email; DB uses uuid
          used_at: k.usedAt ? new Date(k.usedAt).toISOString() : null,
          revoked: !!k.revoked
        };
      });
      var keepCodes = incoming.map(function (x) { return x.code; });
      var cur = await supa.from('registration_keys').select('code');
      if (rlzErr(cur, 'keys read')) return false;
      var curCodes = cur.data ? cur.data.map(function (r) { return r.code; }) : [];
      var toDelete = curCodes.filter(function (code) { return keepCodes.indexOf(code) === -1; });
      if (toDelete.length && window.__candyProfile && window.__candyProfile.role === 'owner') {
        var del = await supa.from('registration_keys').delete().in('code', toDelete);
        if (rlzErr(del, 'keys delete')) return false;
      }
      if (incoming.length) {
        incoming.forEach(function (r) {
          if (r.used_by && !/^[0-9a-f-]{36}$/i.test(String(r.used_by))) r.used_by = null;
        });
        var up = await supa.from('registration_keys').upsert(incoming, { onConflict: 'code' });
        if (rlzErr(up, 'keys upsert')) return false;
      }
      return true;
    } catch (e) {
      reportSaveError('registration keys', e);
      return false;
    }
  }

  async function syncSite(site) {
    try {
      if (!site) return true;
      var up = await supa.from('site_content').upsert({
        id: 1,
        logo: site.logo || '',
        hero: site.hero || {},
        marquee: Array.isArray(site.marquee) ? site.marquee : [],
        visit: site.visit || {},
        reviews: Array.isArray(site.reviews) ? site.reviews : [],
        theme: site.theme != null ? site.theme : null
      }, { onConflict: 'id' });
      if (rlzErr(up, 'site_content upsert')) return false;
      return true;
    } catch (e) {
      reportSaveError('site content', e);
      return false;
    }
  }

  async function syncGift(cfg) {
    try {
      if (!cfg) return true;
      var up = await supa.from('gift_config').upsert({
        id: 1,
        enabled: !!cfg.enabled,
        prices: Array.isArray(cfg.prices) ? cfg.prices : [],
        min_value: cfg.minValue != null ? cfg.minValue : null,
        max_value: cfg.maxValue != null ? cfg.maxValue : null
      }, { onConflict: 'id' });
      if (rlzErr(up, 'gift_config upsert')) return false;
      return true;
    } catch (e) {
      reportSaveError('gift config', e);
      return false;
    }
  }

  // Save one dataset to Supabase. Returns a Promise<boolean> (true = persisted).
  // If the client isn't ready, resolves false so callers never assume a save.
  window.__candySync = function syncEntry(key, value) {
    if (!window.__candySupabaseReady) return Promise.resolve(false);
    var fn;
    if (key === 'candy_categories') fn = function () { return syncCategories(value); };
    else if (key === 'candy_products') fn = function () { return syncProducts(value); };
    else if (key === 'candy_orders') fn = function () { return syncOrders(value); };
    else if (key === 'candy_keys') fn = function () { return syncKeys(value); };
    else if (key === 'candy_site') fn = function () { return syncSite(value); };
    else if (key === 'candy_gift_config') fn = function () { return syncGift(value); };
    else return Promise.resolve(true);
    return enqueue(fn, key);
  };

  /* ── 5. Auth helpers (exposed as window.__candyAuth) ───────────── */
  function normalizeError(err) {
    if (!err) return null;
    var msg = err.message || String(err) || 'Unknown error';
    msg = msg.replace(/Database error saving new user/gi, '').trim();
    return new Error(msg || 'Unknown error');
  }

  window.__candyAuth = {
    supa: supa,

    ready: (function () {
      var p = supa.auth.getSession()
        .then(function (r) {
          var sess = r && r.data && r.data.session;
          if (sess && sess.user) return loadProfile(sess.user.id);
          window.__candyProfile = null;
          return null;
        })
        .then(function () {
          return warmCache().then(function () {
            window.__candySupabaseReady = true;
            if (typeof window.__candyOnSupabaseReady === 'function') {
              try { window.__candyOnSupabaseReady(); } catch (e) { console.warn(e); }
            }
            return window.__candyProfile;
          });
        })
        .catch(function (e) {
          console.warn('[supabase-sync] bootstrap:', e.message || e);
          window.__candySupabaseReady = true;
          if (typeof window.__candyOnSupabaseReady === 'function') {
            try { window.__candyOnSupabaseReady(); } catch (e2) { console.warn(e2); }
          }
          return window.__candyProfile;
        });

      // Auth state listener: keep cache + profile + interceptors in sync
      supa.auth.onAuthStateChange(function (ev, session) {
        if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED') {
          if (session && session.user) {
            loadProfile(session.user.id).then(function () { warmCache(); });
          }
        } else if (ev === 'SIGNED_OUT') {
          window.__candyProfile = null;
          localStorage.removeItem(LS.session);
        }
      });

      return p;
    })(),

    getSession: async function () {
      var r = await supa.auth.getSession();
      return r.data.session || null;
    },

    signUp: async function (name, email, password) {
      var lower = String(email || '').trim().toLowerCase();
      var r = await supa.auth.signUp({
        email: lower,
        password: String(password || ''),
        options: { data: { name: name } }
      });
      if (r.error) throw normalizeError(r.error);
      // r.data.user.session may be null if email confirmation is required.
      // When Supabase is configured to auto-confirm (no email), session exists immediately.
      if (r.data && r.data.session && r.data.session.user) {
        await loadProfile(r.data.session.user.id);
      } else if (r.data && r.data.user) {
        await loadProfile(r.data.user.id);
      }
      // Best-effort: also ensure profiles row has correct name even if trigger already set it.
      try {
        if (r.data && r.data.user) {
          await supa.from('profiles').update({ name: name }).eq('id', r.data.user.id);
        }
      } catch (e) {}
      if (window.__candyProfile) {
        lsSet(LS.session, { name: window.__candyProfile.name || name, email: lower, role: window.__candyProfile.role || 'customer', id: window.__candyProfile.id });
      } else {
        lsSet(LS.session, { name: name, email: lower, role: 'customer' });
      }
      try { await callLog('user registered', 'user', lower, { name: name }); } catch (e) {}
      await warmCache();
      return r.data;
    },

    signIn: async function (email, password) {
      // Support "username or email" input like the legacy flow: if the string
      // is a plain username (no @), resolve the associated email from profiles,
      // falling back to the local legacy users cache when offline.
      var raw = String(email || '').trim();
      var lower = raw.toLowerCase();
      var isEmail = lower.indexOf('@') !== -1;
      var resolvedEmail = lower;

      if (!isEmail) {
        // 1) Try Supabase profiles (case-insensitive on name)
        try {
          var byName = await supa.from('profiles').select('email').ilike('name', raw).limit(1).maybeSingle();
          if (byName.data && byName.data.email) {
            resolvedEmail = String(byName.data.email).toLowerCase();
            isEmail = true;
          }
        } catch (e) {}
        if (!isEmail) {
          // 2) Legacy localStorage `candy_users` (lowercase email), if still present.
          try {
            var legacyUsers = JSON.parse(localStorage.getItem('candy_users') || '[]');
            var u = (Array.isArray(legacyUsers) ? legacyUsers : []).find(function (x) {
              return String(x.email || '').toLowerCase() === lower || String(x.name || '').toLowerCase() === lower;
            });
            if (u && u.email) resolvedEmail = String(u.email).toLowerCase();
            else throw new Error('Account not found. Check the email and try again.');
          } catch (e) { throw e; }
        }
      }

      var r = await supa.auth.signInWithPassword({ email: resolvedEmail, password: String(password || '') });
      if (r.error) throw normalizeError(r.error);
      var sess = r.data && r.data.session;
      if (sess && sess.user) await loadProfile(sess.user.id);
      // Safety: a banned user shouldn't hold a usable session.
      if (window.__candyProfile && window.__candyProfile.status === 'banned') {
        await supa.auth.signOut();
        window.__candyProfile = null;
        throw new Error('This account has been banned.');
      }
      await warmCache();
      try { await callLog('user login', 'user', resolvedEmail, null); } catch (e) {}
      return r.data;
    },

    signOut: async function () {
      try { await callLog('user logout', 'user', null, null); } catch (e) {}
      await supa.auth.signOut();
      window.__candyProfile = null;
      localStorage.removeItem(LS.session);
    },

    redeemKey: async function (code) {
      var r = await supa.rpc('redeem_registration_key', { p_code: String(code || '').trim().replace(/\s+/g, '').toUpperCase() });
      if (r.error) throw normalizeError(r.error);
      // Refresh profile to reflect the new role.
      var sess = await supa.auth.getSession();
      var uid = sess && sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id;
      if (uid) await loadProfile(uid);
      await warmCache();
      return r.data; // new role string ("owner" | "employee")
    },

    setOrderStatus: async function (orderId, status) {
      var r = await supa.rpc('set_order_status', { p_order_id: String(orderId), p_status: String(status) });
      if (r.error) throw normalizeError(r.error);
      await warmCache();
      return true;
    },

    log: async function (action, entity, entityId, details) {
      return callLog(action, entity, entityId, details);
    },

    uploadImage: async function (bucket, fileOrDataUrl, pathPrefix) {
      // fileOrDataUrl may be a File or a data: image/<type>;base64,...
      var bucketName = bucket === 'products' ? 'product-images' : 'site-assets';
      var file, ext, contentType;
      if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.indexOf('data:') === 0) {
        // Decode data URL -> Blob
        var head = fileOrDataUrl.slice(0, fileOrDataUrl.indexOf(','));
        contentType = /data:([^;]+)/.exec(head);
        contentType = contentType ? contentType[1] : 'image/png';
        ext = contentType.split('/').pop() || 'png';
        var b64 = fileOrDataUrl.slice(fileOrDataUrl.indexOf(',') + 1);
        var raw = atob(b64);
        var u8 = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
        file = new Blob([u8], { type: contentType });
      } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
        file = fileOrDataUrl;
        ext = (file.name && file.name.split('.').pop()) || 'jpg';
        contentType = file.type || 'image/jpeg';
      } else {
        throw new Error('uploadImage: unsupported image source');
      }
      var uidPart = (window.__candyProfile && window.__candyProfile.id) ? window.__candyProfile.id.slice(0, 8) : 'anon';
      var fname = String(pathPrefix || 'img') + '-' + uidPart + '-' + Date.now().toString(36) + '.' + ext.replace(/[^a-z0-9]/gi, '');
      var path = fname;
      var up = await supa.storage.from(bucketName).upload(path, file, { contentType: contentType, upsert: false });
      if (up.error) throw normalizeError(up.error);
      var pub = supa.storage.from(bucketName).getPublicUrl(up.data.path);
      return pub.data.publicUrl;
    },

    fetchActivity: async function (limit, offset) {
      var n = Math.max(1, Math.min(100, Number(limit) || 30));
      var o = Math.max(0, Number(offset) || 0);
      var q = await supa.from('activity_log').select('*').order('created_at', { ascending: false }).range(o, o + n - 1);
      if (q.error) throw normalizeError(q.error);
      return q.data || [];
    },

    fetchUsers: async function () {
      var q = await supa.from('profiles').select('*').order('created_at', { ascending: false });
      if (q.error) throw normalizeError(q.error);
      return q.data || [];
    },

    setRole: async function (targetId, role) {
      var r = await supa.rpc('set_user_role', { p_target: targetId, p_role: role });
      if (r.error) throw normalizeError(r.error);
      await warmCache();
      return true;
    },

    setStatus: async function (targetId, status) {
      var r = await supa.rpc('set_user_status', { p_target: targetId, p_status: status });
      if (r.error) throw normalizeError(r.error);
      await warmCache();
      return true;
    },

    subscribeOrders: function (onInsert) {
      var ch = supa.channel('candy-shop-orders-staff', { config: { broadcast: { self: false } } });
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, function (payload) {
        try {
          // Only notify staff sessions in this tab; warmCache into the local feed
          warmCache();
          onInsert(payload.new);
        } catch (e) {}
      });
      ch.subscribe();
      return function () {
        try { ch.unsubscribe(); supa.removeChannel(ch); } catch (e) {}
      };
    }
  };

  async function callLog(action, entity, entityId, details) {
    try {
      await supa.rpc('log_activity', {
        p_action: String(action || ''),
        p_entity: entity != null ? String(entity) : null,
        p_entity_id: entityId != null ? String(entityId) : null,
        p_details: details != null ? details : null
      });
    } catch (e) {}
  }
})();
