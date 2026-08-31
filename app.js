/* ============================================================
   Candy Shop Boumerdès — Shop, Cart, Admin & Keys
   Vanilla JS. Data in localStorage.
   ============================================================ */
(function () {
  'use strict';

  /* """"" Storage """"" */
  var lsGet = function (k, fallback) {
    try {
      var raw = localStorage.getItem(k);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  };
  var lsSet = function (k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) {
      toast('Storage full — your image is too large for the browser.\nTry a smaller image, or remove old products. (localStorage ~5 MB cap)', 'error');
      return false;
    }
  };

  var CART_KEY = 'candy_cart';
  var PRODUCTS_KEY = 'candy_products';
  var CATS_KEY = 'candy_categories';
  var KEYS_KEY = 'candy_keys';
  var SITE_KEY = 'candy_site';
  var ORDERS_KEY = 'candy_orders';
  var USERS_KEY = 'candy_users';
  var SESSION_KEY = 'candy_session';
  var GIFT_KEY = 'candy_gift_config';

  /* """"" Gift pricing configuration (owner-controlled) """"" */
  var DEFAULT_GIFT = {
    enabled: false,       // master toggle: is gift price-selection on?
    prices: [500, 1000, 2000, 5000, 10000], // DZD options shown to customers
    minValue: null,       // optional minimum DZD value
    maxValue: null        // optional maximum DZD value
  };
  var giftConfig = lsGet(GIFT_KEY, null);
  if (!giftConfig || typeof giftConfig !== 'object' || !Array.isArray(giftConfig.prices)) {
    giftConfig = JSON.parse(JSON.stringify(DEFAULT_GIFT));
    lsSet(GIFT_KEY, giftConfig);
  }
  function isGiftEnabled() { return !!giftConfig.enabled; }
  function isGiftProduct(p) { return !!(p && p.isGift); }

  /* """"" Seed """"" */
  var cats = lsGet(CATS_KEY, null);
  if (!cats) {
    cats = [
      { id: 'c1', name: 'Gourmet Candies',    description: 'Artisanal chocolates, chewy sweets and gummies.' },
      { id: 'c2', name: 'Crunchy Chips',      description: 'Kettle-cooked and baked chips in bold flavours.' },
      { id: 'c3', name: 'Curated Gifts',      description: 'Beautifully wrapped gift boxes for every occasion.' },
      { id: 'c4', name: 'Premium Chocolates', description: 'Single-origin tablets and pralines, hand-finished.' },
      { id: 'c5', name: 'Snacks',             description: 'Savoury and sweet snack bites for any craving.' },
      { id: 'c6', name: 'Candy',              description: 'Classic and specialty candies from around the world.' },
      { id: 'c7', name: 'Drinks',             description: 'Refreshing beverages, artisanal sodas and cold brews.' }
    ];
    lsSet(CATS_KEY, cats);
  }

  var products = lsGet(PRODUCTS_KEY, null);
  if (!products) {
    products = [
      { id: 'p1', category: 'c1', name: 'Chocolate Truffles',     price: 2400, stock: 15, tag: 'Bestseller',  description: 'Silky, slow-crafted truffles enrobed in rich dark chocolate.', image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p2', category: 'c1', name: 'Fruit & Sour Gummies',   price:  950, stock: 30, tag: 'New',        description: 'Chewy gummies in bright fruit flavours — a shop favourite.',  image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p3', category: 'c2', name: 'Salted Kettle Chips',    price:  180, stock: 50,                     description: 'Hand-cooked chips with the perfect crunch and sea salt.', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p4', category: 'c2', name: 'Spicy Paprika Chips',    price:  220, stock: 45,                     description: 'Bold, smoky paprika with a gentle kick. Addictive.',      image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p5', category: 'c3', name: 'Signature Cake Box',     price: 5600, stock:  8, tag: 'Most Given', description: 'A show-stopping box featuring our best-loved compositions.', image: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p6', category: 'c3', name: 'Friendship Gift Box',    price: 4200, stock: 12,                     description: 'A thoughtful mix of treats, wrapped beautifully for sharing.', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p7', category: 'c4', name: 'Dark 70% Single-Origin', price: 1800, stock: 20,                     description: 'Bold single-origin tablet — deep cocoa with fruit notes.',  image: 'https://images.unsplash.com/photo-1481391319762-47dff72954d9?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p8', category: 'c4', name: 'Handcrafted Pralines',   price: 2600, stock: 16, tag: 'Signature',  description: 'Pralines finished by hand — the crown of our range.',      image: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?q=80&w=1000&auto=format&fit=crop' },
      // Snacks (c5)
      { id: 'p9', category: 'c5', name: 'Mixed Nuts Deluxe',      price:  850, stock: 40, tag: 'New',        description: 'Premium roasted nuts with sea salt and herbs.', image: 'https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p10', category: 'c5', name: 'Spicy Trail Mix',       price:  950, stock: 35,                    description: 'Nuts, seeds, and dried fruit with a kick of chili.', image: 'https://images.unsplash.com/photo-1597578465468-3a5c7b9a5c7b?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p11', category: 'c5', name: 'Cheese Crisps',         price:  650, stock: 60,                    description: 'Baked 100% cheese crisps — keto friendly and crunchy.', image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p12', category: 'c5', name: 'Sea Salt Popcorn',      price:  450, stock: 80,                    description: 'Light and fluffy popcorn with fine sea salt.', image: 'https://images.unsplash.com/photo-1578849278619-e73541694434?q=80&w=1000&auto=format&fit=crop' },
      // Candy (c6)
      { id: 'p13', category: 'c6', name: 'Sour Belt Candy',       price:  550, stock: 100, tag: 'Bestseller', description: 'Tangy sour belts in rainbow flavors.', image: 'https://images.unsplash.com/photo-1582058091401-f87a2e55a40f?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p14', category: 'c6', name: 'Licorice Twists',       price:  650, stock: 50,                    description: 'Classic black licorice twists — authentic taste.', image: 'https://images.unsplash.com/photo-1559339352-11d035aa65ef?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p15', category: 'c6', name: 'Peppermint Candies',    price:  450, stock: 80,                    description: 'Refreshing peppermint hard candies in a tin.', image: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p16', category: 'c6', name: 'Caramel Chews',         price:  750, stock: 60, tag: 'New',        description: 'Soft, buttery caramel chews wrapped individually.', image: 'https://images.unsplash.com/photo-1559339352-11d035aa65ef?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p17', category: 'c6', name: 'Jelly Beans Mix',       price:  850, stock: 45,                    description: 'Assorted gourmet jelly beans — 20+ flavors.', image: 'https://images.unsplash.com/photo-1582058091401-f87a2e55a40f?q=80&w=1000&auto=format&fit=crop' },
      // Drinks (c7)
      { id: 'p18', category: 'c7', name: 'Artisanal Cola',        price:  650, stock: 30, tag: 'New',        description: 'Small-batch cola with natural cane sugar and spices.', image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p19', category: 'c7', name: 'Sparkling Lemonade',     price:  550, stock: 40,                    description: 'Fresh-pressed lemons with a gentle sparkle.', image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p20', category: 'c7', name: 'Cold Brew Coffee',      price:  1200, stock: 25, tag: 'Bestseller', description: 'Steeped 18 hours — smooth, chocolatey, low acidity.', image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p21', category: 'c7', name: 'Kombucha Variety Pack',  price:  2400, stock: 15,                  description: '4 flavors: ginger, berry, citrus, original.', image: 'https://images.unsplash.com/photo-1581453904507-626f3b5e0b5e?q=80&w=1000&auto=format&fit=crop' },
      { id: 'p22', category: 'c7', name: 'Herbal Iced Tea',       price:  480, stock: 50,                    description: 'Hibiscus, mint, and lemongrass — naturally caffeine-free.', image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=1000&auto=format&fit=crop' }
    ];
    lsSet(PRODUCTS_KEY, products);
  }

  var cart   = lsGet(CART_KEY, []);
  var keys   = lsGet(KEYS_KEY, []);
  var orders = lsGet(ORDERS_KEY, []);
  var users  = lsGet(USERS_KEY, []);
  var session = lsGet(SESSION_KEY, null);

  /* """"" Editable site content (owner-controlled) """"" */
  var DEFAULT_SITE = {
    logo: 'https://cdn.discordapp.com/attachments/1515105758633529454/1543275605359984751/LOGO_.png?ex=6a9446e8&is=6a92f568&hm=24b9fceb66868dfc725648b1b89dc933e1bd4122b91e56a37e9444903695269e',
    hero: {
      eyebrow: 'Premium Candy & Chips Boutique — Boumerdès',
      titleLine1: 'The Art',
      titleEmphasis: 'Sweetness',
      subtitle: 'Gourmet candies, savoury chips and curated gift boxes — sourced with care and composed daily in the heart of Boumerdès.',
      heroImage: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=2000&auto=format&fit=crop',
      rating: '4.3'
    },
    marquee: ['Gourmet Candies', 'Savory Chips', 'Curated Gifts', 'Premium Chocolates'],
    visit: {
      eyebrow: 'Visit Us',
      titleLine1: 'Find us in the',
      titleEmphasis: 'heart of Boumerdès',
      lede: 'Step inside for a coffee, a box of macarons, or a cake made just for you.',
      address: 'QF44+WWC, Boumerdès, Algeria',
      phone: '0664 97 49 19',
      phoneHref: '213664974919',
      hours: 'Mon – Sat · 9:00 – 21:00',
      mapSrc: 'https://www.google.com/maps?q=QF44%2BWWC+Boumerd%C3%A8s+Algeria&z=15&output=embed',
      instagram: 'https://www.instagram.com/candy_shop_35/'
    },
    reviews: [
      { name: 'Yasmine B.', role: 'Regular customer', stars: 5, quote: 'The macarons are the best I\'ve had in Algeria — light, fresh and so elegant. The boutique itself feels like a little Parisian corner.' },
      { name: 'Amine K.', role: 'Birthday order', stars: 5, quote: 'Ordered a signature cake for my daughter\'s birthday — beautiful, delicious and ready exactly on time. Truly premium service.' },
      { name: 'Lina M.', role: 'Local guide', stars: 4, quote: 'Beautiful boutique, friendly staff and the gummies are dangerously good. A lovely spot to treat yourself in Boumerdès.' }
    ],
    theme: null // null = use CSS defaults
  };

  // Default theme values (matching CSS :root)
  var DEFAULT_THEME = {
    bg: '#faf5ee',
    bgSoft: '#f3ebdf',
    accent: '#d9a0a5',
    accentDeep: '#c4848b',
    accentSoft: '#f3dde0',
    ink: '#2b2a28',
    inkSoft: '#6e6861',
    inkFaint: '#a39a91',
    line: 'rgba(43, 42, 40, 0.09)',
    white: '#ffffff',
    glassBg: 'rgba(255, 255, 255, 0.58)',
    glassBorder: 'rgba(255, 255, 255, 0.75)',
    glassBlur: '22px',
    shadowSm: '0 12px 28px -20px rgba(43, 42, 40, 0.30)',
    shadowMd: '0 26px 52px -26px rgba(43, 42, 40, 0.30)',
    shadowLg: '0 44px 88px -34px rgba(43, 42, 40, 0.34)',
    shadowRose: '0 18px 44px -18px rgba(196, 132, 139, 0.55)'
  };

  var site = lsGet(SITE_KEY, null);
  if (!site) {
    site = JSON.parse(JSON.stringify(DEFAULT_SITE));
    lsSet(SITE_KEY, site);
  }
  // Ensure nested defaults exist (forward-compat for older stored data)
  // ONLY add missing properties, NEVER overwrite existing ones
  var defaults = JSON.parse(JSON.stringify(DEFAULT_SITE));
  function deepMergeDefaults(target, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        if (target[key] === undefined || target[key] === null) {
          target[key] = JSON.parse(JSON.stringify(source[key]));
        } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          deepMergeDefaults(target[key], source[key]);
        }
      }
    }
  }
  deepMergeDefaults(site, defaults);

  // Theme system
  function getCurrentTheme() {
    var root = document.documentElement;
    return {
      bg: getComputedStyle(root).getPropertyValue('--bg').trim() || DEFAULT_THEME.bg,
      bgSoft: getComputedStyle(root).getPropertyValue('--bg-soft').trim() || DEFAULT_THEME.bgSoft,
      accent: getComputedStyle(root).getPropertyValue('--accent').trim() || DEFAULT_THEME.accent,
      accentDeep: getComputedStyle(root).getPropertyValue('--accent-deep').trim() || DEFAULT_THEME.accentDeep,
      accentSoft: getComputedStyle(root).getPropertyValue('--accent-soft').trim() || DEFAULT_THEME.accentSoft,
      ink: getComputedStyle(root).getPropertyValue('--ink').trim() || DEFAULT_THEME.ink,
      inkSoft: getComputedStyle(root).getPropertyValue('--ink-soft').trim() || DEFAULT_THEME.inkSoft,
      inkFaint: getComputedStyle(root).getPropertyValue('--ink-faint').trim() || DEFAULT_THEME.inkFaint,
      line: getComputedStyle(root).getPropertyValue('--line').trim() || DEFAULT_THEME.line,
      white: getComputedStyle(root).getPropertyValue('--white').trim() || DEFAULT_THEME.white,
      glassBg: getComputedStyle(root).getPropertyValue('--glass-bg').trim() || DEFAULT_THEME.glassBg,
      glassBorder: getComputedStyle(root).getPropertyValue('--glass-border').trim() || DEFAULT_THEME.glassBorder,
      glassBlur: getComputedStyle(root).getPropertyValue('--glass-blur').trim() || DEFAULT_THEME.glassBlur,
      shadowSm: getComputedStyle(root).getPropertyValue('--shadow-sm').trim() || DEFAULT_THEME.shadowSm,
      shadowMd: getComputedStyle(root).getPropertyValue('--shadow-md').trim() || DEFAULT_THEME.shadowMd,
      shadowLg: getComputedStyle(root).getPropertyValue('--shadow-lg').trim() || DEFAULT_THEME.shadowLg,
      shadowRose: getComputedStyle(root).getPropertyValue('--shadow-rose').trim() || DEFAULT_THEME.shadowRose
    };
  }

  function applyTheme(theme) {
    if (!theme) return;
    var root = document.documentElement;
    var mappings = {
      bg: '--bg',
      bgSoft: '--bg-soft',
      accent: '--accent',
      accentDeep: '--accent-deep',
      accentSoft: '--accent-soft',
      ink: '--ink',
      inkSoft: '--ink-soft',
      inkFaint: '--ink-faint',
      line: '--line',
      white: '--white',
      glassBg: '--glass-bg',
      glassBorder: '--glass-border',
      glassBlur: '--glass-blur',
      shadowSm: '--shadow-sm',
      shadowMd: '--shadow-md',
      shadowLg: '--shadow-lg',
      shadowRose: '--shadow-rose'
    };
    for (var key in mappings) {
      if (theme[key] !== undefined && theme[key] !== null) {
        root.style.setProperty(mappings[key], theme[key]);
      }
    }
    // Persist theme in site object
    site.theme = theme;
    lsSet(SITE_KEY, site);
  }

  function resetThemeToDefaults() {
    applyTheme(DEFAULT_THEME);
  }

  // Apply saved theme on init (before any rendering)
  if (site.theme) {
    applyTheme(site.theme);
  }

  // Version tracking for future migrations
  var STORAGE_VERSION = '1.0';
  var storedVersion = lsGet('candy_storage_version', null);
  if (!storedVersion) {
    lsSet('candy_storage_version', STORAGE_VERSION);
  }

  /* """"" Data Export/Import """"" */
  function exportAllData() {
    var data = {
      version: STORAGE_VERSION,
      exportedAt: Date.now(),
      users: lsGet(USERS_KEY, []),
      session: lsGet(SESSION_KEY, null),
      cart: lsGet(CART_KEY, []),
      products: lsGet(PRODUCTS_KEY, []),
      cats: lsGet(CATS_KEY, []),
      keys: lsGet(KEYS_KEY, []),
      site: lsGet(SITE_KEY, null),
      orders: lsGet(ORDERS_KEY, []),
      giftConfig: lsGet(GIFT_KEY, null),
      storageVersion: lsGet('candy_storage_version', '1.0'),
      ownerCreated: lsGet('candy_owner_created', false)
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'candy-shop-backup-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Data exported successfully.', 'success');
  }

  function importAllData(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data || typeof data !== 'object') {
          toast('Invalid backup file.', 'error');
          return;
        }
        if (data.users) lsSet(USERS_KEY, data.users);
        if (data.session) lsSet(SESSION_KEY, data.session);
        if (data.cart) lsSet(CART_KEY, data.cart);
        if (data.products) lsSet(PRODUCTS_KEY, data.products);
        if (data.cats) lsSet(CATS_KEY, data.cats);
        if (data.keys) lsSet(KEYS_KEY, data.keys);
        if (data.site) lsSet(SITE_KEY, data.site);
        if (data.orders) lsSet(ORDERS_KEY, data.orders);
        if (data.giftConfig && typeof data.giftConfig === 'object' && Array.isArray(data.giftConfig.prices)) lsSet(GIFT_KEY, data.giftConfig);
        if (data.storageVersion) lsSet('candy_storage_version', data.storageVersion);
        if (data.ownerCreated !== undefined) lsSet('candy_owner_created', data.ownerCreated);
        toast('Data imported successfully. Reloading...', 'success');
        setTimeout(function () { window.location.reload(); }, 800);
      } catch (err) {
        toast('Failed to import: ' + err.message, 'error');
      }
    };
    reader.onerror = function () { toast('Could not read file.', 'error'); };
    reader.readAsText(file);
  }

  function clearAllData() {
    var keysToClear = [USERS_KEY, SESSION_KEY, CART_KEY, PRODUCTS_KEY, CATS_KEY, KEYS_KEY, SITE_KEY, ORDERS_KEY, GIFT_KEY, 'candy_storage_version', 'candy_owner_created', 'candy_notifications'];
    keysToClear.forEach(function (k) { localStorage.removeItem(k); });
    toast('All data cleared. Reloading...', 'success');
    setTimeout(function () { window.location.reload(); }, 800);
  }

  function getStorageStats() {
    var stats = {};
    var total = 0;
    var allKeys = [USERS_KEY, SESSION_KEY, CART_KEY, PRODUCTS_KEY, CATS_KEY, KEYS_KEY, SITE_KEY, ORDERS_KEY, 'candy_storage_version', 'candy_owner_created', 'candy_notifications'];
    allKeys.forEach(function (k) {
      var val = localStorage.getItem(k);
      var size = val ? new Blob([val]).size : 0;
      stats[k] = size;
      total += size;
    });
    stats.total = total;
    stats.totalKB = (total / 1024).toFixed(2);
    return stats;
  }

  /* """"" DOM refs """"" */
  function $(id) { return document.getElementById(id); }

  var cartBtn        = $('cartBtn');
  var cartCount      = $('cartCount');
  var cartPanel      = $('cartPanel');
  var cartBackdrop   = $('cartBackdrop');
  var cartClose      = $('cartClose');
  var cartItems      = $('cartItems');
  var cartTotal      = $('cartTotal');
  var checkoutBtn    = $('checkoutBtn');
  var accountWrap    = $('accountWrap');
  var accountBtn     = $('accountBtn');
  var accountDrop    = $('accountDrop');
  var accountLabel   = $('accountLabel');
  var adminBtn       = $('adminBtn');
  var shopGrid       = $('shopGrid');
  var shopFilters    = $('shopFilters');

  /* """"" Utils """"" */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US') + ' DA'; }
  function catName(id) {
    var c = cats.find(function (x) { return x.id === id; });
    return c ? c.name : 'Other';
  }
  function product(id) { return products.find(function (p) { return p.id === id; }); }
  function findUser(emailLower) { return users.find(function (u) { return u.email === emailLower; }); }

  /* """"" Role helpers """"" */
  function isStaff() {
    return session && (session.role === 'owner' || session.role === 'employee');
  }
  function isOwner() {
    return session && session.role === 'owner';
  }
  function isEmployee() {
    return session && session.role === 'employee';
  }
  function orderStatusLabel(status) {
    var map = {
      'new': { text: 'New', class: 'st-new' },
      'confirmed': { text: 'Confirmed', class: 'st-confirmed' },
      'pending': { text: 'Pending', class: 'st-pending' },
      'cancelled': { text: 'Cancelled', class: 'st-revoked' }
    };
    return map[status] || { text: status, class: '' };
  }

  /* """"" Toast """"" */
  function toast(msg, type) {
    var host = $('toastHost');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    var icon = type === 'error'
      ? '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>'
      : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>';
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icon + '</svg><span>' + esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 420);
    }, 3200);
  }

  /* """"" Modal & scroll helpers """"" */
  function syncScroll() {
    var anyModalOpen = !!document.querySelector('.modal-overlay.open');
    var cartOpen = cartPanel && cartPanel.classList.contains('open');
    document.body.classList.toggle('no-scroll', anyModalOpen || cartOpen);
  }

  function openModal(id) {
    document.querySelectorAll('.modal-overlay.open').forEach(function (el) {
      if (el.id !== id) el.classList.remove('open');
    });
    var m = $(id);
    if (m) m.classList.add('open');
    document.body.classList.add('no-scroll');
  }

  function closeModalOverlays() {
    document.querySelectorAll('.modal-overlay.open').forEach(function (el) {
      el.classList.remove('open');
    });
    syncScroll();
  }

  /* """"" Account menu """"" */
  function buildAccountMenu() {
    if (!accountDrop || !accountLabel || !adminBtn) return;

    var av = accountBtn.querySelector('.av');
    if (!session) {
      accountDrop.innerHTML =
        '<button class="acc-action" data-action="login"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg><span>Login</span></button>' +
        '<button class="acc-action" data-action="register"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11v2"/></svg><span>Create account</span></button>';
      accountLabel.textContent = 'Account';
      if (av) av.style.display = '';
      adminBtn.classList.add('hidden');
    } else if (session.role === 'owner') {
      accountDrop.innerHTML =
        '<div class="account-head"><strong>' + esc(session.name) + '</strong><span>Owner</span><small>' + esc(session.email) + '</small></div>' +
        '<button class="acc-action" data-action="admin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>Admin Dashboard</span></button>' +
        '<button class="acc-action" data-action="logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>Logout</span></button>';
      accountLabel.textContent = session.name.split(' ')[0];
      if (av) av.style.display = '';
      adminBtn.classList.remove('hidden');
    } else if (session.role === 'employee') {
      accountDrop.innerHTML =
        '<div class="account-head"><strong>' + esc(session.name) + '</strong><span>Employee</span><small>' + esc(session.email) + '</small></div>' +
        '<button class="acc-action" data-action="admin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>Orders Dashboard</span></button>' +
        '<button class="acc-action" data-action="logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>Logout</span></button>';
      accountLabel.textContent = session.name.split(' ')[0];
      if (av) av.style.display = '';
      adminBtn.classList.remove('hidden');
    } else {
      accountDrop.innerHTML =
        '<div class="account-head"><strong>' + esc(session.name) + '</strong><span>Member</span><small>' + esc(session.email) + '</small></div>' +
        '<button class="acc-action" data-action="redeem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15 6l3 3z"/></svg><span>Redeem staff key</span></button>' +
        '<button class="acc-action" data-action="logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>Logout</span></button>';
      accountLabel.textContent = session.name.split(' ')[0];
      if (av) av.style.display = '';
      adminBtn.classList.add('hidden');
    }
    accountWrap.classList.remove('open');
    accountBtn.setAttribute('aria-expanded', 'false');
  }

  /* Account button click - toggle dropdown */
  if (accountBtn && accountWrap) {
    accountBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = accountWrap.classList.toggle('open');
      accountBtn.setAttribute('aria-expanded', String(isOpen));
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!accountWrap.contains(e.target)) {
        accountWrap.classList.remove('open');
        accountBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Account dropdown actions (delegated) */
  function setupAccountDropDelegation() {
    if (!accountDrop) return;
    // Remove any existing listeners by cloning (simple way to dedupe)
    var newDrop = accountDrop.cloneNode(true);
    accountDrop.parentNode.replaceChild(newDrop, accountDrop);
    accountDrop = newDrop;
    accountDrop.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      accountWrap.classList.remove('open');
      accountBtn.setAttribute('aria-expanded', 'false');
      if (action === 'login') { closeModalOverlays(); openModal('modalLogin'); }
      else if (action === 'register') { closeModalOverlays(); openModal('modalRegister'); }
      else if (action === 'admin') { closeModalOverlays(); openAdmin(); }
      else if (action === 'redeem') { closeModalOverlays(); openModal('modalRedeem'); }
      else if (action === 'logout') { session = null; lsSet(SESSION_KEY, null); buildAccountMenu(); toast('Logged out.', 'success'); }
    });
  }
  setupAccountDropDelegation();

  /* """"" Auth """"" */
  var loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var rawUser = $('loginUser').value.trim();
      var pass = $('loginPass').value;
      if (!rawUser || !pass) { toast('Fill in all login fields.', 'error'); return; }

      if (rawUser.toUpperCase() === 'INVYX' && pass === '2705') {
        session = { name: 'INVYX', email: 'invyx@owner.local', role: 'owner' };
        lsSet(SESSION_KEY, session);
        closeModalOverlays();
        buildAccountMenu();
        toast('Welcome back, Owner. Admin Dashboard is now available.', 'success');
        return;
      }

      var u = findUser(rawUser.toLowerCase());
      if (u && u.password === pass) {
        session = { name: u.name, email: u.email, role: u.role || 'customer' };
        lsSet(SESSION_KEY, session);
        closeModalOverlays();
        buildAccountMenu();
        toast('Welcome back, ' + u.name.split(' ')[0] + '!', 'success');
      } else {
        toast('Incorrect credentials — check your email and password.', 'error');
      }
    });
  }

  var regForm = $('regForm');
  if (regForm) {
    regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('regName').value.trim();
      var email = $('regEmail').value.trim().toLowerCase();
      var p1 = $('regPass').value;
      var p2 = $('regPass2').value;
      if (name.length < 2) { toast('Please enter a username.', 'error'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Please enter a valid email.', 'error'); return; }
      if (p1.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
      if (p1 !== p2) { toast('Passwords do not match.', 'error'); return; }
      if (findUser(email)) { toast('This email is already registered. Try logging in.', 'error'); return; }

      var user = { id: uid('u'), name: name, email: email, password: p1, role: 'customer', createdAt: Date.now() };
      users.push(user);
      lsSet(USERS_KEY, users);
      session = { name: user.name, email: user.email, role: 'customer' };
      lsSet(SESSION_KEY, session);
      closeModalOverlays();
      buildAccountMenu();
      toast('Account created — welcome ' + user.name.split(' ')[0] + '!', 'success');
    });
  }

  var redeemForm = $('redeemForm');
  if (redeemForm) {
    redeemForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!session) { toast('Log in first, then redeem the key.', 'error'); return; }
      if (session.role === 'owner' || session.role === 'employee') { toast('You already have staff access.', 'error'); return; }
      var raw = $('redeemKey').value.trim().toUpperCase().replace(/\s+/g, '');
      if (!raw) { toast('Paste a key to activate.', 'error'); return; }
      var found = keys.find(function (k) { return k.code === raw; });
      if (!found) { toast('This key does not exist.', 'error'); return; }
      if (found.revoked) { toast('This key has been revoked.', 'error'); return; }
      if (found.used) { toast('This key has already been used.', 'error'); return; }
      if (found.expiresAt <= Date.now()) { toast('This key has expired.', 'error'); return; }

      var keyType = found.type || 'owner'; // back-compat: old keys default to owner
      found.used = true;
      found.usedBy = session.email;
      found.usedAt = Date.now();
      lsSet(KEYS_KEY, keys);
      session.role = keyType;
      lsSet(SESSION_KEY, session);

      var u = findUser(session.email);
      if (u) { u.role = keyType; lsSet(USERS_KEY, users); }

      closeModalOverlays();
      buildAccountMenu();
      renderKeys();
      renderEmpKeys();
      if (keyType === 'owner') {
        toast('Owner access activated — the Admin Dashboard is now available.', 'success');
      } else {
        toast('Employee access activated — you can now view and confirm orders.', 'success');
      }
    });
  }

  /* """"" Cart """"" */
  function cartItem(id) { return cart.find(function (x) { return x.id === id; }); }
  function cartQty() { return cart.reduce(function (s, x) { return s + x.qty; }, 0); }
  function cartTotalAmt() { return cart.reduce(function (s, x) { var p = product(x.id); return s + (p ? p.price * x.qty : 0); }, 0); }

  function addToCart(id, qty) {
    var p = product(id);
    if (!p) return;
    qty = Math.max(1, qty | 0);
    var it = cartItem(id);
    var max = (p.stock != null ? p.stock : 9999);
    if (it) it.qty = Math.min(it.qty + qty, max);
    else cart.push({ id: id, qty: Math.min(qty, max) });
    lsSet(CART_KEY, cart);
    renderCartBadge();
    renderCart();
  }

  function setQty(id, qty) {
    var it = cartItem(id);
    if (!it) return;
    var p = product(id);
    if (qty <= 0) cart = cart.filter(function (x) { return x.id !== id; });
    else it.qty = (p && p.stock != null) ? Math.min(qty, p.stock) : qty;
    lsSet(CART_KEY, cart);
    renderCartBadge();
    renderCart();
  }

  function removeFromCart(id) {
    cart = cart.filter(function (x) { return x.id !== id; });
    lsSet(CART_KEY, cart);
    renderCartBadge();
    renderCart();
  }

  function renderCartBadge() {
    if (!cartCount) return;
    var n = cartQty();
    cartCount.textContent = String(n);
    cartCount.classList.toggle('zero', n === 0);
    if (cartBtn) { cartBtn.classList.remove('pop'); void cartBtn.offsetWidth; cartBtn.classList.add('pop'); }
  }

  function renderCart() {
    if (!cartItems || !cartTotal || !checkoutBtn) return;
    if (!cart.length) {
      cartItems.innerHTML =
        '<div class="cart-empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 2H2"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/></svg>' +
        '<p>Your cart is empty.</p><small>Pick something sweet from the collection.</small>' +
        '</div>';
      cartTotal.textContent = '0 DA';
      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = '0.5';
      checkoutBtn.style.pointerEvents = 'none';
      return;
    }
    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = '1';
    checkoutBtn.style.pointerEvents = '';
    cartItems.innerHTML = cart.map(function (entry) {
      var p = product(entry.id);
      if (!p) return '';
      return (
        '<div class="cart-line">' +
          '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
          '<div class="cart-line-body"><h4>' + esc(p.name) + '</h4><div class="p">' + fmt(p.price) + '</div>' +
            '<div class="cart-line-qty"><button data-cq="dec" data-id="' + esc(entry.id) + '" aria-label="Decrease quantity">−</button><span>' + entry.qty + '</span><button data-cq="inc" data-id="' + esc(entry.id) + '" aria-label="Increase quantity">+</button></div>' +
          '</div>' +
          '<div class="cart-line-right"><strong class="line-total">' + fmt(p.price * entry.qty) + '</strong><button class="cart-remove" data-rm="' + esc(entry.id) + '" aria-label="Remove ' + esc(p.name) + '">—</button></div>' +
        '</div>'
      );
    }).join('');
    cartTotal.textContent = fmt(cartTotalAmt());
  }

  function openCart() {
    renderCart();
    cartPanel.classList.add('open');
    cartPanel.setAttribute('aria-hidden', 'false');
    cartBackdrop.classList.add('open');
    cartBackdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }
  function closeCart() {
    cartPanel.classList.remove('open');
    cartPanel.setAttribute('aria-hidden', 'true');
    cartBackdrop.classList.remove('open');
    cartBackdrop.setAttribute('aria-hidden', 'true');
    syncScroll();
  }

  // Cart button - with defensive check
  if (cartBtn) {
    cartBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openCart();
    });
  }
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);
  if (checkoutBtn) checkoutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    openCheckout();
  });
  if (cartItems) cartItems.addEventListener('click', function (e) {
    var cq = e.target.closest('[data-cq]');
    if (cq) {
      var id = cq.getAttribute('data-id');
      var it = cartItem(id);
      if (!it) return;
      setQty(id, it.qty + (cq.getAttribute('data-cq') === 'inc' ? 1 : -1));
      return;
    }
    var rm = e.target.closest('[data-rm]');
    if (rm) removeFromCart(rm.getAttribute('data-rm'));
  });

  /* """"" Delivery checkout """"" */
  var coForm = $('checkoutForm');
  var coWilaya = $('coWilaya');
  var coBaladia = $('coBaladia');
  var coBaladiaOther = $('coBaladiaOther');
  var coAddressField = $('coAddressField');
  var coCount = $('coCount');
  var coTotal = $('coTotal');

  var WILAYAS = (window.CANDY_WILAYAS || []).slice();

  function wilayaName(code) {
    for (var i = 0; i < WILAYAS.length; i++) {
      if (String(WILAYAS[i].code) === String(code)) return WILAYAS[i].name;
    }
    return String(code || '');
  }

  function buildWilayaSelect() {
    if (!coWilaya) return;
    var opts = '<option value="">Choose a wilaya</option>';
    WILAYAS.forEach(function (w) {
      opts += '<option value="' + w.code + '">' + esc(w.name) + '</option>';
    });
    coWilaya.innerHTML = opts;
  }

  function onWilayaChange() {
    if (!coBaladia) return;
    var w = null;
    for (var i = 0; i < WILAYAS.length; i++) {
      if (String(WILAYAS[i].code) === String(coWilaya.value)) w = WILAYAS[i];
    }
    if (!w) {
      coBaladia.innerHTML = '<option value="">First choose a wilaya</option>';
      coBaladia.disabled = true;
      return;
    }
    var opts = '<option value="">Choose a baladia</option>';
    w.baladias.forEach(function (b) { opts += '<option value="' + esc(b) + '">' + esc(b) + '</option>'; });
    opts += '<option value="__other__">Other / not listed</option>';
    coBaladia.innerHTML = opts;
    coBaladia.disabled = false;
  }

  function syncDeliveryMode() {
    var checked = document.querySelector('input[name="deliveryPlace"]:checked');
    var isPickup = checked && checked.value === 'pickup';
    if (coWilaya) coWilaya.closest('.form-row').style.display = isPickup ? 'none' : '';
    if (coAddressField) coAddressField.style.display = isPickup ? 'none' : '';
    if (coWilaya) coWilaya.required = !isPickup;
    if (coBaladia) coBaladia.required = !isPickup;
  }

  function resetCheckoutForm() {
    if (coForm) coForm.reset();
    if (coBaladia) { coBaladia.innerHTML = '<option value="">First choose a wilaya</option>'; coBaladia.disabled = true; }
    if (coBaladiaOther) { coBaladiaOther.value = ''; coBaladiaOther.hidden = true; }
    syncDeliveryMode();
  }

  function openCheckout() {
    if (!cart.length) { toast('Your cart is empty.', 'error'); return; }
    if (!session) {
      toast('Please log in or create an account to place an order.', 'error');
      openModal('modalLogin');
      return;
    }
    resetCheckoutForm();
    if (coCount) coCount.textContent = cartQty() + ' item(s)';
    if (coTotal) coTotal.textContent = fmt(cartTotalAmt());
    renderGiftSelector();
    closeCart();
    openModal('modalCheckout');
  }

  /* """"" Gift price selection in checkout """"" */
  var giftPriceChoice = null; // selected DZD value (numeric) or null
  var giftModeItems = null;   // product ids in the cart that are gifts

  function cartGiftProducts() {
    return cart.filter(function (x) {
      var p = product(x.id);
      return p && isGiftProduct(p);
    });
  }

  // Build the DZD option list from giftConfig (owner-controlled), honoring min/max.
  function activeGiftPrices() {
    if (!giftConfig || !Array.isArray(giftConfig.prices)) return [];
    var lo = (giftConfig.minValue == null) ? 0 : Number(giftConfig.minValue);
    var hi = (giftConfig.maxValue == null) ? Infinity : Number(giftConfig.maxValue);
    return giftConfig.prices.filter(function (v) {
      var n = Number(v);
      return isFinite(n) && n > 0 && n >= lo && n <= hi;
    }).map(Number).sort(function (a, b) { return a - b; });
  }

  function renderGiftSelector() {
    var section = $('giftPriceSection');
    var optionsHost = $('giftPriceOptions');
    if (section) section.classList.add('hidden');
    giftPriceChoice = null;
    giftModeItems = null;
    var giftItems = cartGiftProducts();
    if (!isGiftEnabled() || !giftItems.length) return;

    var prices = activeGiftPrices();
    if (prices.length < 1) {
      // Owner hasn't configured any valid DZD values — block gifting clearly.
      if (section) {
        optionsHost.innerHTML = '<p class="gift-price-hint" style="color:var(--accent-deep);font-weight:600;">Gift values are not available right now. Please contact the shop.</p>';
        section.classList.remove('hidden');
      }
      return;
    }

    giftModeItems = giftItems.map(function (x) { return x.id; });
    optionsHost.innerHTML = prices.map(function (v) {
      return '<button type="button" class="gift-price-option" data-value="' + v + '" role="radio" aria-checked="false">' + fmt(v) + '</button>';
    }).join('');
    if ($('giftPriceSelected')) $('giftPriceSelected').classList.add('hidden');
    if ($('giftPriceError')) $('giftPriceError').classList.add('hidden');
    if (section) section.classList.remove('hidden');

    optionsHost.querySelectorAll('.gift-price-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectGiftPrice(Number(btn.getAttribute('data-value')));
      });
    });
  }

  function selectGiftPrice(value) {
    giftPriceChoice = value;
    if ($('giftPriceOptions')) {
      $('giftPriceOptions').querySelectorAll('.gift-price-option').forEach(function (b) {
        var on = Number(b.getAttribute('data-value')) === value;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }
    if ($('giftPriceError')) $('giftPriceError').classList.add('hidden');
    var sel = $('giftPriceSelected');
    if (sel) {
      sel.textContent = 'Gift value selected: ' + fmt(value);
      sel.classList.remove('hidden');
    }
    updateGiftCheckoutTotals();
  }

  function updateGiftCheckoutTotals() {
    if (!giftModeItems) return;
    var base = 0, giftQty = 0;
    cart.forEach(function (x) {
      if (giftModeItems.indexOf(x.id) !== -1) {
        giftQty += x.qty;
      } else {
        var p = product(x.id);
        if (p) base += p.price * x.qty;
      }
    });
    if (coTotal) {
      var total = base + (giftPriceChoice ? giftPriceChoice * giftQty : 0);
      coTotal.textContent = fmt(total);
    }
  }

  function scrollGiftIntoView() {
    var sec = $('giftPriceSection');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // total order value computed live (used at submit)
  function computeOrderSubtotal() {
    var base = 0, giftQty = 0;
    cart.forEach(function (x) {
      var p = product(x.id);
      if (!p) return;
      if (giftModeItems && giftModeItems.indexOf(x.id) !== -1) {
        giftQty += x.qty;
      } else {
        base += p.price * x.qty;
      }
    });
    return base + (giftPriceChoice ? giftPriceChoice * giftQty : 0);
  }

  if (coWilaya) coWilaya.addEventListener('change', onWilayaChange);
  if (coBaladia) coBaladia.addEventListener('change', function () {
    var other = coBaladia.value === '__other__';
    if (coBaladiaOther) { coBaladiaOther.hidden = !other; if (other) coBaladiaOther.focus(); }
  });
  document.querySelectorAll('input[name="deliveryPlace"]').forEach(function (r) {
    r.addEventListener('change', function () { syncDeliveryMode(); });
  });
  document.querySelectorAll('.delivery-option').forEach(function (lab) {
    var radio = lab.querySelector('input');
    var upd = function () { lab.classList.toggle('selected', radio.checked); };
    upd(); radio.addEventListener('change', upd);
  });
  if (coForm) coForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!cart.length) { toast('Your cart is empty.', 'error'); return; }
    if (!session) {
      toast('Please log in or create an account to place an order.', 'error');
      closeModalOverlays();
      openModal('modalLogin');
      return;
    }

    var name = $('coFullName').value.trim();
    var phone = $('coPhone').value.trim().replace(/[\s-]/g, '').replace(/^(\+213|00213)/, '0');
    var modeEl = document.querySelector('input[name="deliveryPlace"]:checked');
    var mode = modeEl ? modeEl.value : 'home';
    var wilCode = coWilaya ? coWilaya.value : '';
    var balSD = coBaladia ? coBaladia.value : '';
    var address = $('coAddress').value.trim();
    var note = $('coNote').value.trim();

    if (name.length < 3) { toast('Please enter the full name of the person receiving the order.', 'error'); return; }
    if (!/^0[2-9]\d{8}$/.test(phone)) { toast('Enter a valid Algerian phone number (e.g. 0555555555).', 'error'); return; }

    // Gift validation: if the cart contains gift products and gift pricing is enabled,
    // a DZD value MUST be chosen before the order can be finalised.
    var hasGifts = isGiftEnabled() && giftModeItems && giftModeItems.length > 0;
    if (hasGifts && (giftPriceChoice == null || !isFinite(giftPriceChoice))) {
      toast('Please choose a gift value before continuing.', 'error');
      var err = $('giftPriceError');
      if (err) err.classList.remove('hidden');
      scrollGiftIntoView();
      return;
    }

    var baladiaName = '';
    if (mode === 'pickup') {
      baladiaName = '';
    } else {
      if (!wilCode) { toast('Choose a wilaya (province).', 'error'); return; }
      if (!balSD) { toast('Choose a baladia (commune).', 'error'); return; }
      if (balSD === '__other__') {
        baladiaName = coBaladiaOther ? coBaladiaOther.value.trim() : '';
        if (!baladiaName) { toast('Type your commune name.', 'error'); return; }
      } else {
        baladiaName = balSD;
      }
    }

    var place = mode === 'pickup'
      ? 'Pickup at the boutique — Boumerdès city centre'
      : 'Home delivery — ' + wilayaName(wilCode) + (baladiaName ? ' — ' + baladiaName : '') + (address ? ', ' + address : '');

    var isGiftOrder = isGiftEnabled() && giftModeItems && giftModeItems.length > 0;

    // Build order record — gift items carry selectedGiftPrice/currency/type.
    var orderItems = cart.map(function (entry) {
      var p = product(entry.id);
      if (!p) return null;
      var isGiftLine = isGiftOrder && giftModeItems.indexOf(entry.id) !== -1;
      if (isGiftLine) {
        return {
          id: p.id,
          name: p.name,
          price: giftPriceChoice, // effective unit price for a gift is the chosen DZD value
          qty: entry.qty,
          image: p.image,
          type: 'gift',
          selectedGiftPrice: giftPriceChoice,
          currency: 'DZD'
        };
      }
      return { id: p.id, name: p.name, price: p.price, qty: entry.qty, image: p.image };
    }).filter(Boolean);

    var resolvedSubtotal = isGiftOrder ? computeOrderSubtotal() : cartTotalAmt();

    var order = {
      id: uid('o'),
      createdAt: Date.now(),
      customerName: name,
      customerPhone: phone,
      customerEmail: session.email,
      deliveryMode: mode,
      wilaya: wilCode ? wilayaName(wilCode) : '',
      baladia: baladiaName,
      address: address,
      note: note,
      items: orderItems,
      subtotal: resolvedSubtotal,
      status: 'new'
    };
    if (isGiftOrder) {
      order.selectedGiftPrice = giftPriceChoice;
      order.currency = 'DZD';
      order.hasGifts = true;
    }

    orders.unshift(order);
    lsSet(ORDERS_KEY, orders);

    var n = cart.length;
    var total = fmt(cartTotalAmt());
    cart = [];
    lsSet(CART_KEY, cart);
    renderCartBadge();
    renderCart();
    closeModalOverlays();

    var toastMsg = 'Order placed — ' + n + ' item(s) · ' + total + '.\n' + place + '.\nWe\'ll call ' + name + ' on ' + $('coPhone').value.trim() + ' to confirm.';
    if (note) toastMsg += '\nNote: ' + note;
    toast(toastMsg, 'success');
    resetCheckoutForm();

    // Trigger owner/employee notifications
    notifyNewOrder(order);
  });
  buildWilayaSelect();

  /* """"" Shop (filters + dynamic grid) """"" */
  var activeCat = 'all';

  function renderFilters() {
    if (!shopFilters) return;
    shopFilters.innerHTML =
      '<button class="chip' + (activeCat === 'all' ? ' active' : '') + '" data-cat="all">All</button>' +
      cats.map(function (c) {
        var count = products.filter(function (p) { return p.category === c.id; }).length;
        return '<button class="chip' + (activeCat === c.id ? ' active' : '') + '" data-cat="' + esc(c.id) + '">' + esc(c.name) + ' <span style="opacity:0.55">(' + count + ')</span></button>';
      }).join('');
    shopFilters.querySelectorAll('.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCat = btn.getAttribute('data-cat');
        shopFilters.querySelectorAll('.chip').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-cat') === activeCat);
        });
        renderShop();
      });
    });
  }

  function renderShop() {
    if (!shopGrid) return;
    var list = activeCat === 'all'
      ? products.slice()
      : products.filter(function (p) { return p.category === activeCat; });

    if (!list.length) {
      shopGrid.innerHTML = '<p class="shop-empty">Nothing in this category yet — the owner hasn&apos;t added products here. Open the Admin Dashboard to add some.</p>';
      return;
    }

    shopGrid.innerHTML = list.map(function (p) {
      var sold  = (p.stock != null && p.stock <= 0);
      var low   = (p.stock != null && p.stock > 0 && p.stock <= 5);
      var giftBadge = isGiftEnabled() && isGiftProduct(p);
      var media = '<div class="card-media"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' + (giftBadge ? '<span class="card-chip chip-gift">gift</span>' : (p.tag ? '<span class="card-chip">' + esc(p.tag) + '</span>' : '')) + '</div>';
      var title = '<h3 class="card-title">' + esc(p.name) + '</h3>';
      var giftNote = giftBadge ? '<span class="stock-note gift-hint">Gift — choose value at checkout (DZD)</span>' : '';
      var body  = '<p class="card-text">' + esc((p.description || '').slice(0, 110)) + ((p.description || '').length > 110 ? '…' : '') + '</p>';
      var price = '<div class="shop-price"><span class="amount">' + fmt(p.price) + '</span></div>';
      var stepper = '<div class="stepper"><button data-sp="dec" aria-label="Decrease quantity">−</button><span>1</span><button data-sp="inc" aria-label="Increase quantity">+</button></div>';
      var addBtn  = '<button class="btn btn-primary" data-add="' + esc(p.id) + '"' + (sold ? ' disabled style="opacity:0.5;cursor:not-allowed"' : '') + '>' + (sold ? 'Sold out' : 'Add to cart') + '</button>';
      var buyRow  = '<div class="shop-buy">' + stepper + addBtn + '</div>';
      var stockNote = low ? '<span class="stock-note">Only ' + p.stock + ' left!</span>' : (sold ? '<span class="stock-note">Currently unavailable — check back soon.</span>' : '');
      return (
        '<article class="shop-card reveal' + (sold ? ' soldout' : '') + '">' +
          media +
          '<div class="card-body">' + title + body + price + giftNote + buyRow + stockNote + '</div>' +
        '</article>'
      );
    }).join('');

    shopGrid.querySelectorAll('[data-sp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = btn.closest('.shop-card').querySelector('.stepper span');
        var v = parseInt(box.textContent, 10) || 1;
        v += (btn.getAttribute('data-sp') === 'inc' ? 1 : -1);
        box.textContent = String(Math.max(1, v));
      });
    });
    shopGrid.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-add');
        var card = btn.closest('.shop-card');
        var qty = parseInt(card.querySelector('.stepper span').textContent, 10) || 1;
        var p = product(id);
        if (!p) return;
        if (p.stock != null && p.stock <= 0) { toast('Sorry — this item is sold out.', 'error'); return; }
        addToCart(id, qty);
        btn.textContent = 'Added ✓';
        setTimeout(function () { btn.textContent = 'Add to cart'; }, 1200);
      });
    });

    if (window.observeReveals) window.observeReveals(shopGrid);
  }

  /* """"" Owner-editable site content rendering """"" */
  function renderBrand() {
    // .brand-logo imgs exist hard-coded in the HTML; keep them in sync with localStorage.
    // Hard-coded src is the fallback if localStorage was cleared.
    var href = (site.logo && site.logo.trim()) ? site.logo.trim() : DEFAULT_SITE.logo;
    document.querySelectorAll('.brand-logo').forEach(function (img) { img.src = href; });
    var favicon = document.querySelector('link[rel="icon"]');
    if (favicon && href && (href.indexOf('data:') !== 0 || favicon.getAttribute('href') === DEFAULT_SITE.logo)) {
      // For an image favicon we only override if the stored value is a plain URL (not a data URL).
      if (href.indexOf('data:') !== 0) favicon.setAttribute('href', href);
    }
  }

  function renderSiteContent() {
    renderBrand();
    renderHero();
    renderMarquee();
    renderVisit();
    renderReviews();
    if (window.observeReveals) window.observeReveals(document);
  }

  function renderHero() {
    var h = site.hero || DEFAULT_SITE.hero;
    var eyebrow = document.querySelector('.hero .eyebrow');
    var title = document.querySelector('.hero-title');
    var sub = document.querySelector('.hero-sub');
    var img = document.querySelector('.hero-bg img');
    var ratingStrong = document.querySelector('.rating-meta strong');
    if (eyebrow) eyebrow.innerHTML = '<span class="eyebrow-dot" aria-hidden="true"></span>' + esc(h.eyebrow || '');
    if (title) title.innerHTML = esc(h.titleLine1 || '') + ' of <em>' + esc(h.titleEmphasis || '') + '</em>';
    if (sub) sub.textContent = h.subtitle || '';
    if (img && h.heroImage) img.src = h.heroImage;
    if (ratingStrong && h.rating) ratingStrong.textContent = h.rating + ' / 5';
  }

  function renderMarquee() {
    var track = document.querySelector('.marquee-track');
    if (!track) return;
    var items = (site.marquee || []).filter(function (x) { return x && x.trim(); });
    if (!items.length) items = DEFAULT_SITE.marquee.slice();
    var unit = items.map(function (it) { return '<span>' + esc(it) + '</span><i>—</i>'; }).join('');
    track.innerHTML = unit + unit; // duplicate for seamless loop
  }

  var STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';

  function renderReviews() {
    var grid = document.querySelector('.reviews-grid');
    if (!grid) return;
    var list = (site.reviews || []).filter(function (r) { return r && r.name; });
    if (!list.length) list = DEFAULT_SITE.reviews.slice();
    grid.innerHTML = list.map(function (r) {
      var n = Math.max(0, Math.min(5, parseInt(r.stars, 10) || 5));
      var stars = '';
      for (var i = 0; i < 5; i++) stars += STAR_SVG;
      var initial = (r.name || '?').trim().charAt(0).toUpperCase();
      return (
        '<figure class="review reveal">' +
          '<div class="review-stars" aria-label="' + n + ' out of 5 stars">' + stars + '</div>' +
          '<blockquote class="review-quote">"' + esc(r.quote || '') + '"</blockquote>' +
          '<figcaption class="review-author">' +
            '<span class="review-avatar" aria-hidden="true">' + esc(initial) + '</span>' +
            '<span class="review-meta"><strong>' + esc(r.name) + '</strong><em>' + esc(r.role || '') + '</em></span>' +
          '</figcaption>' +
        '</figure>'
      );
    }).join('');
  }

  function renderVisit() {
    var v = site.visit || DEFAULT_SITE.visit;
    var eyebrow = document.querySelector('.visit .eyebrow');
    var title = document.querySelector('.visit .section-title');
    var lede = document.querySelector('.visit-lede');
    var addr = document.querySelector('.visit-list .visit-item:nth-child(1) span div');
    var phone = document.querySelector('.visit-list .visit-item:nth-child(2) a');
    var phoneLabel = document.querySelector('.visit-list .visit-item:nth-child(2) span div');
    var hours = document.querySelector('.visit-list .visit-item:nth-child(3) span div');
    var map = document.querySelector('.visit-map iframe');
    var callBtns = document.querySelectorAll('a[href^="tel:"]');

    if (eyebrow) eyebrow.innerHTML = '<span class="eyebrow-dot" aria-hidden="true"></span>' + esc(v.eyebrow || '');
    if (title) title.innerHTML = esc(v.titleLine1 || '') + ' <em>' + esc(v.titleEmphasis || '') + '</em>';
    if (lede) lede.textContent = v.lede || '';
    if (addr) addr.textContent = v.address || '';
    if (phone) {
      phone.textContent = v.phone || '';
      phone.setAttribute('href', 'tel:+' + (v.phoneHref || ''));
    }
    if (phoneLabel) phoneLabel.innerHTML = '<strong>Phone</strong><a href="tel:+' + esc(v.phoneHref || '') + '">' + esc(v.phone || '') + '</a>';
    if (hours) hours.innerHTML = '<strong>Opening Hours</strong><span>' + esc(v.hours || '') + '</span>';
    if (map && v.mapSrc) map.src = v.mapSrc;

    // Update all tel: links (hero call button, mobile bar, visit call button)
    callBtns.forEach(function (b) {
      if (b.getAttribute('href') && b.getAttribute('href').indexOf('tel:') === 0) {
        b.setAttribute('href', 'tel:+' + (v.phoneHref || ''));
      }
    });

    // Instagram link in footer
    var ig = document.querySelector('.footer-social a');
    if (ig && v.instagram) {
      ig.textContent = '@' + (v.instagram.split('/').filter(Boolean).pop() || 'instagram');
      ig.setAttribute('href', v.instagram);
    }
  }

  /* """"" Admin dashboard """"" */
  function syncAdminOpenedState() {
    var m = $('modalAdmin');
    if (m && m.classList.contains('open')) {
      // Update admin role label
      var roleLabel = $('adminRoleLabel');
      if (roleLabel) {
        if (isOwner()) {
          roleLabel.textContent = 'Owner — Logged in as ' + esc(session.name);
        } else if (isEmployee()) {
          roleLabel.textContent = 'Employee — Logged in as ' + esc(session.name);
        } else {
          roleLabel.textContent = 'Staff — Logged in as ' + esc(session.name);
        }
      }

      if (isOwner()) {
        // Owner sees all tabs and stats
        var statsEl = $('adminStats');
        if (statsEl) statsEl.style.display = 'grid';

        // Show all tabs for owner
        document.querySelectorAll('.admin-tab').forEach(function (t) {
          t.style.display = '';
        });

        // Render all owner content
        renderAdminProducts();
        renderAdminCategories();
        renderKeys();
        renderEmpKeys();
        renderSiteTab();
        renderAdminStats();
        syncThemeInputs();
        updateStorageStats();

        // Render orders/gifts if the respectively active tab is open
        var activeTab = document.querySelector('.admin-tab.active');
        if (activeTab) {
          var activeTabId = activeTab.getAttribute('data-tab');
          if (activeTabId === 'tabOrders') renderOrders();
          if (activeTabId === 'tabGifts') renderGiftAdmin();
        }
      } else if (isEmployee()) {
        // Employee only sees Orders tab and stats
        var statsEl = $('adminStats');
        if (statsEl) statsEl.style.display = 'grid'; // Show stats for employees too

        // Hide non-Orders tabs for employee
        document.querySelectorAll('.admin-tab').forEach(function (t) {
          var tabId = t.getAttribute('data-tab');
          t.style.display = tabId === 'tabOrders' ? '' : 'none';
        });

        // Make sure Orders tab is active for employee
        var ordersTab = document.querySelector('.admin-tab[data-tab="tabOrders"]');
        var ordersPanel = $('tabOrders');
        if (ordersTab && ordersPanel) {
          document.querySelectorAll('.admin-tab').forEach(function (x) { x.classList.remove('active'); });
          document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
          ordersTab.classList.add('active');
          ordersPanel.classList.add('active');
        }

        // Render orders and stats for employee
        renderOrders();
        renderAdminStats(); // Show stats for employees
      }
    }
  }

  function renderAdminStats() {
    if (!isStaff()) return;
    var stats = {
      products: products.length,
      orders: orders.length,
      revenue: orders.reduce(function (s, o) { return s + (o.subtotal || 0); }, 0),
      newOrders: orders.filter(function (o) { return o.status === 'new'; }).length
    };
    if ($('statProducts')) $('statProducts').textContent = stats.products;
    if ($('statOrders')) $('statOrders').textContent = stats.orders;
    if ($('statRevenue')) $('statRevenue').textContent = fmt(stats.revenue);
    if ($('statNewOrders')) $('statNewOrders').textContent = stats.newOrders;
    // Update order stats badge in Orders tab
    if ($('orderStats')) {
      $('orderStats').innerHTML =
        '<span class="order-stat new">New: ' + stats.newOrders + '</span>' +
        '<span class="order-stat confirmed">Confirmed: ' + (stats.orders - stats.newOrders) + '</span>';
    }
  }

  function openAdmin() {
    if (!session || !isStaff()) {
      toast('Staff access required. Log in and redeem a staff key.', 'error');
      return;
    }
    openModal('modalAdmin');
    syncAdminOpenedState();
  }

  /* Tabs */
  document.querySelectorAll('.admin-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      var id = t.getAttribute('data-tab');
      // Employees can only access Orders tab
      if (isEmployee() && id !== 'tabOrders') {
        toast('Employees can only access the Orders tab.', 'error');
        return;
      }
      document.querySelectorAll('.admin-tab').forEach(function (x) {
        x.classList.toggle('active', x === t);
      });
      document.querySelectorAll('.admin-panel').forEach(function (p) {
        p.classList.toggle('active', p.id === id);
      });
      if (id === 'tabProducts')   renderAdminProducts();
      if (id === 'tabCategories') renderAdminCategories();
      if (id === 'tabKeys')       renderKeys();
      if (id === 'tabSite')       renderSiteTab();
      if (id === 'tabGifts')      renderGiftAdmin();
      if (id === 'tabOrders')     renderOrders();
    });
  });

  /* """ Product admin """ */
  var editingProductId = null;
  var pendingImage = null; // base64 string when a new file was chosen

  function resetProductForm() {
    editingProductId = null;
    pendingImage = null;
    $('pName').value = '';
    $('pDesc').value = '';
    $('pPrice').value = '';
    $('pStock').value = '';
    $('pTag').value = '';
    $('pUrl').value = '';
    if ($('pIsGift')) $('pIsGift').checked = false;
    var pPreviewEl = $('pPreview');
    pPreviewEl.hidden = true;
    pPreviewEl.removeAttribute('src');
    $('pRemoveImg').classList.add('hidden');
    $('productForm').classList.add('hidden');
    rebuildPCatOptions();
  }

  function rebuildPCatOptions() {
    var sel = $('pCat');
    if (!sel) return;
    sel.innerHTML = cats.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
    }).join('');
  }

  function renderAdminProducts() {
    rebuildPCatOptions();
    var list = products.slice();
    var host = $('productList');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<p class="shop-empty" style="text-align:left;">No products yet — add your first one above.</p>';
      return;
    }
    var pen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
    var trash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    host.innerHTML = list.map(function (p) {
      return (
        '<div class="admin-row">' +
          '<img class="thumb" src="' + esc(p.image || '') + '" alt="' + esc(p.name || '') + '">' +
          '<div class="admin-row-info"><h4>' + esc(p.name) + '</h4><p>' + esc((p.description || '').slice(0, 64)) + '</p></div>' +
          '<span class="tag tag-cat">' + esc(catName(p.category)) + '</span>' +
          '<span class="tag tag-price">' + fmt(p.price) + '</span>' +
          '<span class="tag tag-stock">' + (p.stock != null ? p.stock + ' in stock' : '∞') + '</span>' +
          '<div class="row-actions">' +
            '<button class="icon-btn" data-edit="' + esc(p.id) + '" title="Edit">' + pen + '</button>' +
            '<button class="icon-btn danger" data-del="' + esc(p.id) + '" title="Delete">' + trash + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  $('newProductBtn').addEventListener('click', function () {
    resetProductForm();
    $('productForm').classList.remove('hidden');
    $('productForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('cancelProductBtn').addEventListener('click', function () {
    $('productForm').classList.add('hidden');
    resetProductForm();
  });

  $('productList').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-edit]');
    if (ed) { editProduct(ed.getAttribute('data-edit')); return; }
    var del = e.target.closest('[data-del]');
    if (del) deleteProduct(del.getAttribute('data-del'));
  });

  function editProduct(id) {
    var p = product(id);
    if (!p) return;
    editingProductId = id;
    pendingImage = null;
    rebuildPCatOptions();
    $('pName').value = p.name;
    $('pCat').value = p.category;
    $('pPrice').value = p.price;
    $('pStock').value = (p.stock == null ? '' : String(p.stock));
    $('pDesc').value = p.description || '';
    $('pTag').value = p.tag || '';
    $('pUrl').value = (p.image && p.image.indexOf('data:') !== 0) ? p.image : '';
    if ($('pIsGift')) $('pIsGift').checked = !!p.isGift;
    var pv2 = $('pPreview');
    if (p.image && p.image.indexOf('data:') === 0) {
      pv2.src = p.image; pv2.hidden = false;
    } else {
      pv2.hidden = true; pv2.removeAttribute('src');
    }
    $('productForm').classList.remove('hidden');
    $('productForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function deleteProduct(id) {
    var p = product(id);
    if (!p) return;
    if (!confirm('Delete "' + p.name + '"? This cannot be undone.')) return;
    products = products.filter(function (x) { return x.id !== id; });
    lsSet(PRODUCTS_KEY, products);
    cart = cart.filter(function (e) { return e.id !== id; });
    lsSet(CART_KEY, cart);
    renderAdminProducts();
    renderShop();
    renderFilters();
    renderCartBadge();
    renderCart();
    toast('Product deleted.', 'success');
  }

  /* Image file -> base64 (no hard size limit) */
  var dz          = $('pDrop');
  var fileInput   = $('pFile');
  var pPreview    = $('pPreview');
  var removeImgBtn= $('pRemoveImg');

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (f) handleFile(f);
  });
  ['dragover', 'dragenter'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  });
  ['dragleave', 'dragend'].forEach(function (ev) {
    dz.addEventListener(ev, function () { dz.classList.remove('dragover'); });
  });
  dz.addEventListener('drop', function (e) {
    e.preventDefault();
    dz.classList.remove('dragover');
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  removeImgBtn.addEventListener('click', function () {
    pendingImage = null;
    pPreview.hidden = true;
    pPreview.removeAttribute('src');
    removeImgBtn.classList.add('hidden');
  });

  function handleFile(file) {
    if (file.type && file.type.indexOf('image/') !== 0) {
      toast('Please choose an image file (JPG, PNG, WebP…).', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      pendingImage = ev.target.result; // data URL
      pPreview.src = pendingImage;
      pPreview.hidden = false;
      removeImgBtn.classList.remove('hidden');
      toast('Image ready — no file-size limit enforced by the shop.');
    };
    reader.onerror = function () { toast('Could not read that file.', 'error'); };
    reader.readAsDataURL(file);
  }

  $('productForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('pName').value.trim();
    var cat  = $('pCat').value;
    var rawPrice = parseFloat($('pPrice').value);
    var rawStock = $('pStock').value.trim();
    var stock = (rawStock === '' ? null : parseInt(rawStock, 10));
    var desc = $('pDesc').value.trim();
    var tag  = $('pTag').value.trim();
    var url  = $('pUrl').value.trim();
    var isGift = $('pIsGift') ? $('pIsGift').checked : false;

    if (!name) { toast('Product needs a name.', 'error'); return; }
    if (!isFinite(rawPrice) || rawPrice < 0) { toast('Enter a valid price (>= 0).', 'error'); return; }

    var image;
    if (pendingImage) image = pendingImage;
    else if (url) image = url;
    else if (editingProductId) {
      var existing = product(editingProductId);
      image = existing ? existing.image : '';
    } else {
      image = '';
    }
    if (!image) { toast('Add an image — upload from your PC or paste a URL.', 'error'); return; }

    if (editingProductId) {
      var p2 = product(editingProductId);
      if (!p2) return;
      p2.name = name;
      p2.category = cat;
      p2.price = rawPrice;
      p2.stock = (stock == null || isNaN(stock) ? null : stock);
      p2.description = desc;
      p2.tag = tag;
      p2.image = image;
      p2.isGift = isGift;
      toast('Product updated.', 'success');
    } else {
      products.push({
        id: uid('p'),
        name: name,
        category: cat,
        price: rawPrice,
        stock: (stock == null || isNaN(stock) ? null : stock),
        description: desc,
        tag: tag,
        image: image,
        isGift: isGift
      });
      toast('Product added.', 'success');
    }

    if (!lsSet(PRODUCTS_KEY, products)) return;

    resetProductForm();
    renderAdminProducts();
    renderShop();
    renderFilters();
  });

  /* """ Category admin """ */
  var editingCatId = null;

  function resetCatForm() {
    editingCatId = null;
    $('cName').value = '';
    $('cDesc').value = '';
    $('catSubmit').textContent = 'Add category';
    $('cancelCatBtn').classList.add('hidden');
  }

  function renderAdminCategories() {
    var host = $('catList');
    if (!host) return;
    if (!cats.length) {
      host.innerHTML = '<p class="shop-empty" style="text-align:left;">No categories yet.</p>';
      return;
    }
    var pen2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
    var trash2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    host.innerHTML = cats.map(function (c) {
      var count = products.filter(function (p) { return p.category === c.id; }).length;
      return (
        '<div class="admin-row">' +
          '<div class="admin-row-info"><h4>' + esc(c.name) + '</h4><p>' + esc(c.description || '—') + '</p></div>' +
          ' <span class="tag tag-cat">' + count + ' product(s)</span>' +
          '<div class="row-actions">' +
            '<button class="icon-btn" data-ce="' + esc(c.id) + '" title="Edit">' + pen2 + '</button>' +
            '<button class="icon-btn danger" data-cd="' + esc(c.id) + '" title="Delete">' + trash2 + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  $('catForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('cName').value.trim();
    var desc = $('cDesc').value.trim();
    if (!name) { toast('Category needs a name.', 'error'); return; }
    if (editingCatId) {
      var cEdited = cats.find(function (x) { return x.id === editingCatId; });
      if (cEdited) { cEdited.name = name; cEdited.description = desc; toast('Category updated.', 'success'); }
    } else {
      cats.push({ id: uid('c'), name: name, description: desc });
      toast('Category added.', 'success');
    }
    if (!lsSet(CATS_KEY, cats)) return;
    resetCatForm();
    renderAdminCategories();
    renderFilters();
    renderShop();
    renderAdminProducts();
  });

  $('cancelCatBtn').addEventListener('click', resetCatForm);

  $('catList').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-ce]');
    if (ed) {
      var c = cats.find(function (x) { return x.id === ed.getAttribute('data-ce'); });
      if (c) {
        editingCatId = c.id;
        $('cName').value = c.name;
        $('cDesc').value = c.description || '';
        $('catSubmit').textContent = 'Save changes';
        $('cancelCatBtn').classList.remove('hidden');
        $('catForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }
    var del = e.target.closest('[data-cd]');
    if (del) deleteCategory(del.getAttribute('data-cd'));
  });

  function deleteCategory(id) {
    if (cats.length === 1) {
      toast('You cannot delete the last category.', 'error');
      return;
    }
    var victims = products.filter(function (p) { return p.category === id; });
    var c = cats.find(function (x) { return x.id === id; });
    var other = cats.filter(function (x) { return x.id !== id; })[0];
    if (victims.length) {
      if (!confirm('Delete category "' + c.name + '"?\n\nIts ' + victims.length + ' product(s) will move to "' + other.name + '".')) return;
      products.forEach(function (p) { if (p.category === id) p.category = other.id; });
      lsSet(PRODUCTS_KEY, products);
    } else {
      if (!confirm('Delete category "' + c.name + '"?')) return;
    }
    cats = cats.filter(function (x) { return x.id !== id; });
    lsSet(CATS_KEY, cats);
    resetCatForm();
    renderAdminCategories();
    renderFilters();
    renderShop();
    renderAdminProducts();
    toast('Category deleted.', 'success');
  }

  /* """ Owner keys """ */
  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    try {
      return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return d.toISOString(); }
  }

  function toInputStr(d) {
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  if ($('kvExpiry')) {
    var nowPlus10 = new Date(Date.now() + 10 * 60 * 1000);
    $('kvExpiry').min = toInputStr(nowPlus10);
  }

  function genCode(prefix) {
    prefix = prefix || 'CS';
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var chunk = function (n) {
      var out = '';
      for (var i = 0; i < n; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
      return out;
    };
    return prefix + '-' + chunk(4) + '-' + chunk(4) + '-' + chunk(4);
  }

  function renderKeys() {
    var host = $('keyList');
    if (!host) return;
    if (!keys.length) {
      host.innerHTML = '<p class="shop-empty" style="text-align:left;">No keys generated yet. Create one above.</p>';
      return;
    }
    var copyIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var banIc  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>';
    host.innerHTML = keys.slice().reverse().map(function (k) {
      var label, cls;
      if (k.revoked) { label = 'Revoked'; cls = 'st-revoked'; }
      else if (k.used) { label = 'Used'; cls = 'st-used'; }
      else if (k.expiresAt <= Date.now()) { label = 'Expired'; cls = 'st-expired'; }
      else { label = 'Active'; cls = 'st-active'; }
      var canRevoke = !k.revoked && !k.used;
      return (
        '<div class="key-row">' +
          '<span class="key-code">' + esc(k.code) + '</span>' +
          '<span class="st ' + cls + '">' + label + '</span>' +
          '<span class="key-meta">' +
            '<span>Expires <strong>' + esc(fmtDate(k.expiresAt)) + '</strong></span>' +
            (k.used ? '<span>Used by ' + esc(k.usedBy || '') + ' — ' + esc(fmtDate(k.usedAt)) + '</span>' : '<span>Created ' + esc(fmtDate(k.createdAt)) + '</span>') +
          '</span>' +
          '<div class="row-actions">' +
            '<button class="icon-btn" data-copy="' + esc(k.code) + '" title="Copy key to clipboard">' + copyIc + '</button>' +
            (canRevoke ? '<button class="icon-btn danger" data-revoke="' + esc(k.code) + '" title="Revoke">' + banIc + '</button>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  $('keyList').addEventListener('click', function (e) {
    var cp = e.target.closest('[data-copy]');
    if (cp) {
      var raw = cp.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(raw).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = raw;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        ta.remove();
      }
      toast('Key copied to clipboard.');
      return;
    }
    var rv = e.target.closest('[data-revoke]');
    if (rv) {
      var code = rv.getAttribute('data-revoke');
      var rec = keys.find(function (x) { return x.code === code; });
      if (rec && confirm('Revoke key ' + code + '? It will be unusable from now on.')) {
        rec.revoked = true;
        lsSet(KEYS_KEY, keys);
        renderKeys();
        toast('Key revoked.', 'success');
      }
    }
  });

  $('kvForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('kvExpiry').value;
    if (!v) { toast('Choose an expiration date and time.', 'error'); return; }
    var t = new Date(v).getTime();
    if (!isFinite(t) || t <= Date.now()) { toast('Expiration must be in the future.', 'error'); return; }
    var code = genCode('CS');
    keys.push({ code: code, createdAt: Date.now(), expiresAt: t, used: false, revoked: false, type: 'owner' });
    lsSet(KEYS_KEY, keys);
    $('generateResult').textContent = code;
    renderKeys();
    toast('Owner key generated: ' + code, 'success');
  });

  /* """ Employee keys """ */
  function renderEmpKeys() {
    var host = $('empKeyList');
    if (!host) return;
    var empKeys = keys.filter(function (k) { return k.type === 'employee'; });
    if (!empKeys.length) {
      host.innerHTML = '<p class="shop-empty" style="text-align:left;">No employee keys generated yet. Create one above.</p>';
      return;
    }
    var copyIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var banIc  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>';
    host.innerHTML = empKeys.slice().reverse().map(function (k) {
      var label, cls;
      if (k.revoked) { label = 'Revoked'; cls = 'st-revoked'; }
      else if (k.used) { label = 'Used'; cls = 'st-used'; }
      else if (k.expiresAt <= Date.now()) { label = 'Expired'; cls = 'st-expired'; }
      else { label = 'Active'; cls = 'st-active'; }
      var canRevoke = !k.revoked && !k.used;
      return (
        '<div class="key-row">' +
          '<span class="key-code">' + esc(k.code) + '</span>' +
          '<span class="st ' + cls + '">' + label + '</span>' +
          '<span class="key-meta">' +
            '<span>Expires <strong>' + esc(fmtDate(k.expiresAt)) + '</strong></span>' +
            (k.used ? '<span>Used by ' + esc(k.usedBy || '') + ' — ' + esc(fmtDate(k.usedAt)) + '</span>' : '<span>Created ' + esc(fmtDate(k.createdAt)) + '</span>') +
          '</span>' +
          '<div class="row-actions">' +
            '<button class="icon-btn" data-emp-copy="' + esc(k.code) + '" title="Copy key to clipboard">' + copyIc + '</button>' +
            (canRevoke ? '<button class="icon-btn danger" data-emp-revoke="' + esc(k.code) + '" title="Revoke">' + banIc + '</button>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  $('empKeyList').addEventListener('click', function (e) {
    var cp = e.target.closest('[data-emp-copy]');
    if (cp) {
      var raw = cp.getAttribute('data-emp-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(raw).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = raw;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        ta.remove();
      }
      toast('Employee key copied to clipboard.');
      return;
    }
    var rv = e.target.closest('[data-emp-revoke]');
    if (rv) {
      var code = rv.getAttribute('data-emp-revoke');
      var rec = keys.find(function (x) { return x.code === code; });
      if (rec && confirm('Revoke employee key ' + code + '? It will be unusable from now on.')) {
        rec.revoked = true;
        lsSet(KEYS_KEY, keys);
        renderEmpKeys();
        toast('Employee key revoked.', 'success');
      }
    }
  });

  $('empKeyForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('empKeyExpiry').value;
    if (!v) { toast('Choose an expiration date and time.', 'error'); return; }
    var t = new Date(v).getTime();
    if (!isFinite(t) || t <= Date.now()) { toast('Expiration must be in the future.', 'error'); return; }
    var code = genCode('EMP');
    keys.push({ code: code, createdAt: Date.now(), expiresAt: t, used: false, revoked: false, type: 'employee' });
    lsSet(KEYS_KEY, keys);
    $('empGenerateResult').textContent = code;
    renderEmpKeys();
    toast('Employee key generated: ' + code, 'success');
  });

  /* """"" Site Content admin """"" */
  var editingReviewIdx = null;

  function renderSiteTab() {
    renderReviewList();
    populateLogoForm();
    populateHeroForm();
    populateMarqueeForm();
    populateVisitForm();
  }

  /* """ Gifts tab """ */
  function renderGiftAdmin() {
    // Only owner can access gift admin
    if (!isOwner()) {
      toast('Owner access required.', 'error');
      return;
    }
    renderGiftToggle();
    renderGiftPrices();
    renderGiftLimits();
  }

  function renderGiftToggle() {
    var el = $('giftToggle');
    var label = $('giftToggleLabel');
    if (!el) return;
    el.checked = !!giftConfig.enabled;
    el.onchange = function () {
      giftConfig.enabled = el.checked;
      lsSet(GIFT_KEY, giftConfig);
      label.textContent = el.checked ? 'ON' : 'OFF';
      toast('Gift pricing ' + (el.checked ? 'enabled' : 'disabled') + '.', 'success');
      // Re-render shop and filters to reflect the change
      renderShop();
      renderFilters();
      renderAdminProducts();
    };
    label.textContent = giftConfig.enabled ? 'ON' : 'OFF';
  }

  function renderGiftPrices() {
    var host = $('giftPriceList');
    if (!host) return;
    var prices = (giftConfig && Array.isArray(giftConfig.prices)) ? giftConfig.prices.slice().sort(function (a, b) { return a - b; }) : [];
    if (!prices.length) {
      host.innerHTML = '<p class="shop-empty" style="text-align:left;">No gift prices configured. Add DZD values above.</p>';
      return;
    }
    var trash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    host.innerHTML = prices.map(function (v) {
      return (
        '<div class="admin-row">' +
          '<div class="admin-row-info"><h4>' + fmt(v) + '</h4><p>Gift value option</p></div>' +
          '<div class="row-actions">' +
            '<button class="icon-btn danger" data-gp-del="' + v + '" title="Delete">' + trash + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Add price form handler
    var form = $('giftPriceForm');
    if (form) {
      // Avoid duplicate listeners
      var newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);
      newForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var val = parseInt($('giftPriceValue').value, 10);
        if (!isFinite(val) || val <= 0) { toast('Enter a valid DZD amount.', 'error'); return; }
        if (giftConfig.prices.indexOf(val) !== -1) { toast('This value already exists.', 'error'); return; }
        giftConfig.prices.push(val);
        lsSet(GIFT_KEY, giftConfig);
        renderGiftPrices();
        renderShop();
        renderAdminProducts();
        toast('Gift price ' + fmt(val) + ' added.', 'success');
      });
    }

    // Delete handlers
    host.querySelectorAll('[data-gp-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = parseInt(btn.getAttribute('data-gp-del'), 10);
        if (!confirm('Remove ' + fmt(val) + ' from gift options?')) return;
        giftConfig.prices = giftConfig.prices.filter(function (x) { return x !== val; });
        lsSet(GIFT_KEY, giftConfig);
        renderGiftPrices();
        renderShop();
        renderAdminProducts();
        toast('Gift price removed.', 'success');
      });
    });
  }

  function renderGiftLimits() {
    var form = $('giftLimitsForm');
    if (!form) return;
    $('giftMinVal').value = (giftConfig.minValue != null) ? giftConfig.minValue : '';
    $('giftMaxVal').value = (giftConfig.maxValue != null) ? giftConfig.maxValue : '';

    var newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var min = $('giftMinVal').value.trim();
      var max = $('giftMaxVal').value.trim();
      var minVal = min === '' ? null : parseInt(min, 10);
      var maxVal = max === '' ? null : parseInt(max, 10);
      if (min !== '' && (!isFinite(minVal) || minVal < 0)) { toast('Minimum must be a non-negative number.', 'error'); return; }
      if (max !== '' && (!isFinite(maxVal) || maxVal <= 0)) { toast('Maximum must be a positive number.', 'error'); return; }
      if (minVal != null && maxVal != null && minVal > maxVal) { toast('Minimum cannot exceed maximum.', 'error'); return; }
      giftConfig.minValue = minVal;
      giftConfig.maxValue = maxVal;
      lsSet(GIFT_KEY, giftConfig);
      renderGiftPrices();
      renderShop();
      renderAdminProducts();
      toast('Gift limits saved.', 'success');
    });
  }

  /* """ Orders tab """ */
  function renderOrders() {
    var host = $('orderList');
    if (!host) return;
    var list = orders.slice();
    if (!list.length) {
      host.innerHTML = '<div class="admin-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M22 12h-4l-3 9-3-9H2"/><path d="M22 12V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg><p>No orders yet.</p><small>New orders will appear here.</small></div>';
      return;
    }
    var confirmIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>';
    host.innerHTML = list.map(function (o) {
      var statusInfo = orderStatusLabel(o.status);
      var itemsHtml = o.items.map(function (it) {
        return '<div class="order-item">' +
          (it.image ? '<img src="' + esc(it.image) + '" alt="' + esc(it.name || '') + '" class="order-item-img">' : '') +
          '<div class="order-item-info"><strong>' + esc(it.name) + '</strong><span>— ' + it.qty + ' · ' + fmt(it.price) + '</span></div>' +
          '<div class="order-item-total">' + fmt(it.price * it.qty) + '</div>' +
        '</div>';
      }).join('');
      var canConfirm = o.status === 'new' && isStaff();
      var confirmBtn = canConfirm ? '<button class="btn btn-primary btn-sm order-confirm-btn" data-confirm="' + esc(o.id) + '">' + confirmIc + ' Confirm</button>' : '';
      var deliveryHtml = o.deliveryMode === 'pickup'
        ? 'Pickup at boutique — Boumerdès city centre'
        : 'Delivery " ' + (o.wilaya || '') + (o.baladia ? ' / ' + o.baladia : '') + (o.address ? ' / ' + o.address : '');
      return (
        '<article class="order-card">' +
          '<header class="order-card-header">' +
            '<div><strong>Order #' + esc(o.id.slice(-6).toUpperCase()) + '</strong><span>' + new Date(o.createdAt).toLocaleString('en-GB', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) + '</span></div>' +
            '<span class="st ' + statusInfo.class + '">' + statusInfo.text + '</span>' +
          '</header>' +
          '<div class="order-customer">' +
            '<div><strong>' + esc(o.customerName) + '</strong><span>' + esc(o.customerPhone) + '</span></div>' +
          '</div>' +
          '<div class="order-items">' + itemsHtml + '</div>' +
          '<footer class="order-card-footer">' +
            '<div class="order-delivery">' + esc(deliveryHtml) + '</div>' +
            '<div class="order-footer-right">' +
              '<strong class="order-total">' + fmt(o.subtotal) + '</strong>' +
              confirmBtn +
            '</div>' +
          '</footer>' +
        '</article>'
      );
    }).join('');
  }

  $('orderList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-confirm]');
    if (!btn) return;
    var orderId = btn.getAttribute('data-confirm');
    var order = orders.find(function (o) { return o.id === orderId; });
    if (!order) return;
    if (order.status !== 'new') { toast('Order is no longer new.', 'error'); return; }
    order.status = 'confirmed';
    lsSet(ORDERS_KEY, orders);
    renderOrders();
    toast('Order #' + orderId.slice(-6).toUpperCase() + ' confirmed.', 'success');
  });

  var pendingLogo = null;

  function populateLogoForm() {
    var href = (site.logo || DEFAULT_SITE.logo || '').trim();
    var textUrl = (href && href.indexOf('data:') !== 0) ? href : '';
    if ($('lgLogo')) $('lgLogo').value = textUrl;
    var wrap = $('lgPreviewWrap');
    var img = $('lgPreview');
    if (wrap && img) {
      if (href) { img.src = href; wrap.classList.remove('hidden'); } else { wrap.classList.add('hidden'); }
    }
    pendingLogo = null;
  }

  function populateHeroForm() {
    var h = site.hero || DEFAULT_SITE.hero;
    if ($('hEyebrow')) $('hEyebrow').value = h.eyebrow || '';
    if ($('hTitle')) $('hTitle').value = h.titleLine1 || '';
    if ($('hTitleEm')) $('hTitleEm').value = h.titleEmphasis || '';
    if ($('hSub')) $('hSub').value = h.subtitle || '';
    if ($('hRating')) $('hRating').value = h.rating || '';
    if ($('hImageUrl')) $('hImageUrl').value = (h.heroImage && h.heroImage.indexOf('data:') !== 0) ? h.heroImage : '';
    var preview = $('hImagePreview');
    if (preview) {
      if (h.heroImage && h.heroImage.indexOf('data:') === 0) { preview.src = h.heroImage; preview.parentElement.classList.remove('hidden'); }
      else { preview.removeAttribute('src'); preview.parentElement.classList.add('hidden'); }
    }
    pendingHeroImage = null;
  }

  var pendingHeroImage = null;

  function populateMarqueeForm() {
    var items = site.marquee || DEFAULT_SITE.marquee;
    if ($('mrqText')) $('mrqText').value = (items || []).join('\n');
  }

  function populateVisitForm() {
    var v = site.visit || DEFAULT_SITE.visit;
    if ($('vEyebrow')) $('vEyebrow').value = v.eyebrow || '';
    if ($('vTitle1')) $('vTitle1').value = v.titleLine1 || '';
    if ($('vTitleEm')) $('vTitleEm').value = v.titleEmphasis || '';
    if ($('vLede')) $('vLede').value = v.lede || '';
    if ($('vAddress')) $('vAddress').value = v.address || '';
    if ($('vPhone')) $('vPhone').value = v.phone || '';
    if ($('vPhoneHref')) $('vPhoneHref').value = v.phoneHref || '';
    if ($('vHours')) $('vHours').value = v.hours || '';
    if ($('vMapSrc')) $('vMapSrc').value = v.mapSrc || '';
    if ($('vInstagram')) $('vInstagram').value = v.instagram || '';
  }

  function renderReviewList() {
    var host = $('reviewList');
    if (!host) return;
    var list = (site.reviews || []).slice();
    if ($('reviewCount')) $('reviewCount').textContent = list.length + ' review(s) showing on the website';
    if (!list.length) { host.innerHTML = '<p class="shop-empty" style="text-align:left;">No reviews yet — add one using the button above.</p>'; return; }
    var pen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
    var trash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    host.innerHTML = list.map(function (r, i) {
      var starsText = '';
      for (var s = 0; s < 5; s++) starsText += s < (parseInt(r.stars, 10) || 5) ? '★' : '☆';
      return (
        '<div class="admin-row">' +
          '<div class="admin-row-info" style="min-width:220px"><h4>' + esc(r.name) + '</h4><p style="font-size:0.78rem;margin-top:2px;">' + esc(r.role || '') + ' · ' + starsText + '</p><p style="font-size:0.78rem;color:var(--ink-soft);margin-top:4px;">' + esc((r.quote || '').slice(0, 120)) + ((r.quote || '').length > 120 ? '…' : '') + '</p></div>' +
          '<div class="row-actions">' +
            '<button class="icon-btn" data-editrv="' + i + '" title="Edit">' + pen + '</button>' +
            '<button class="icon-btn danger" data-delrv="' + i + '" title="Delete">' + trash + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function resetReviewForm() {
    editingReviewIdx = null;
    if ($('rvName')) $('rvName').value = '';
    if ($('rvRole')) $('rvRole').value = '';
    if ($('rvQuote')) $('rvQuote').value = '';
    if ($('rvStars')) $('rvStars').value = '5';
    if ($('reviewForm')) $('reviewForm').classList.add('hidden');
    if ($('saveReviewBtn')) $('saveReviewBtn').textContent = 'Save review';
  }

  if ($('newReviewBtn')) $('newReviewBtn').addEventListener('click', function () {
    resetReviewForm();
    $('reviewForm').classList.remove('hidden');
    $('reviewForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  if ($('cancelReviewBtn')) $('cancelReviewBtn').addEventListener('click', resetReviewForm);

  if ($('reviewList')) $('reviewList').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-editrv]');
    if (ed) {
      var idx = parseInt(ed.getAttribute('data-editrv'), 10);
      var r = (site.reviews || [])[idx];
      if (!r) return;
      editingReviewIdx = idx;
      $('rvName').value = r.name || '';
      $('rvRole').value = r.role || '';
      $('rvQuote').value = r.quote || '';
      $('rvStars').value = String(parseInt(r.stars, 10) || 5);
      $('reviewForm').classList.remove('hidden');
      $('saveReviewBtn').textContent = 'Update review';
      $('reviewForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    var del = e.target.closest('[data-delrv]');
    if (del) {
      var di = parseInt(del.getAttribute('data-delrv'), 10);
      var dr = (site.reviews || [])[di];
      if (dr && confirm('Delete review by "' + dr.name + '"?')) {
        site.reviews.splice(di, 1);
        lsSet(SITE_KEY, site);
        renderReviewList();
        renderReviews();
        toast('Review deleted.', 'success');
      }
    }
  });

  if ($('reviewForm')) $('reviewForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = ($('rvName').value || '').trim();
    var quote = ($('rvQuote').value || '').trim();
    var stars = parseInt($('rvStars').value, 10) || 5;
    if (!name) { toast('Reviewer needs a name.', 'error'); return; }
    if (!quote) { toast('Add a short quote.', 'error'); return; }
    var entry = { name: name, role: ($('rvRole').value || '').trim(), quote: quote, stars: Math.max(1, Math.min(5, stars)) };
    if (!site.reviews) site.reviews = [];
    if (editingReviewIdx != null && editingReviewIdx < site.reviews.length) {
      site.reviews[editingReviewIdx] = entry;
      toast('Review updated.', 'success');
    } else {
      site.reviews.push(entry);
      toast('Review added.', 'success');
    }
    lsSet(SITE_KEY, site);
    resetReviewForm();
    renderReviewList();
    renderReviews();
  });

  /* Hero image file handling */
  var hFileInput = $('hImageFile');
  var hPreviewWrap = $('hImagePreviewWrap');
  var hPreview = $('hImagePreview');
  if (hFileInput) hFileInput.addEventListener('change', function () {
    var f = hFileInput.files && hFileInput.files[0];
    if (!f) return;
    if (f.type && f.type.indexOf('image/') !== 0) { toast('Please choose an image file.', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      pendingHeroImage = ev.target.result;
      hPreview.src = pendingHeroImage;
      hPreviewWrap.classList.remove('hidden');
      toast('Hero image loaded — press "Save hero" to apply it to the website.');
    };
    reader.onerror = function () { toast('Could not read that file.', 'error'); };
    reader.readAsDataURL(f);
  });
  if ($('hImageClear')) $('hImageClear').addEventListener('click', function () {
    pendingHeroImage = null;
    hPreview.removeAttribute('src');
    hPreviewWrap.classList.add('hidden');
    if (hFileInput) hFileInput.value = '';
  });

  if ($('heroForm')) $('heroForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!site.hero) site.hero = {};
    site.hero.eyebrow = ($('hEyebrow').value || '').trim();
    site.hero.titleLine1 = ($('hTitle').value || '').trim();
    site.hero.titleEmphasis = ($('hTitleEm').value || '').trim();
    site.hero.subtitle = ($('hSub').value || '').trim();
    site.hero.rating = ($('hRating').value || '').trim();
    var url = ($('hImageUrl').value || '').trim();
    if (pendingHeroImage) site.hero.heroImage = pendingHeroImage;
    else if (url) site.hero.heroImage = url;
    else if (!site.hero.heroImage) site.hero.heroImage = DEFAULT_SITE.hero.heroImage;
    lsSet(SITE_KEY, site);
    pendingHeroImage = null;
    renderSiteContent();
    toast('Hero updated.', 'success');
  });

  if ($('marqueeForm')) $('marqueeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = ($('mrqText').value || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    site.marquee = raw.length ? raw : DEFAULT_SITE.marquee.slice();
    lsSet(SITE_KEY, site);
    renderMarquee();
    toast('Marquee updated.', 'success');
  });

  if ($('visitForm')) $('visitForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!site.visit) site.visit = {};
    site.visit.eyebrow = ($('vEyebrow').value || '').trim();
    site.visit.titleLine1 = ($('vTitle1').value || '').trim();
    site.visit.titleEmphasis = ($('vTitleEm').value || '').trim();
    site.visit.lede = ($('vLede').value || '').trim();
    site.visit.address = ($('vAddress').value || '').trim();
    site.visit.phone = ($('vPhone').value || '').trim();
    site.visit.phoneHref = ($('vPhoneHref').value || '').trim();
    site.visit.hours = ($('vHours').value || '').trim();
    site.visit.mapSrc = ($('vMapSrc').value || '').trim();
    site.visit.instagram = ($('vInstagram').value || '').trim();
    lsSet(SITE_KEY, site);
    renderSiteContent();
    toast('Visit info & Instagram updated.', 'success');
  });

  /* """ Theme Form """ */
  function syncThemeInputs() {
    var theme = getCurrentTheme();
    var colorInputs = [
      ['themeBg', 'themeBgHex', 'bg'],
      ['themeBgSoft', 'themeBgSoftHex', 'bgSoft'],
      ['themeAccent', 'themeAccentHex', 'accent'],
      ['themeAccentDeep', 'themeAccentDeepHex', 'accentDeep'],
      ['themeAccentSoft', 'themeAccentSoftHex', 'accentSoft'],
      ['themeInk', 'themeInkHex', 'ink'],
      ['themeInkSoft', 'themeInkSoftHex', 'inkSoft'],
      ['themeInkFaint', 'themeInkFaintHex', 'inkFaint'],
      ['themeLine', 'themeLineHex', 'line'],
      ['themeGlassBg', 'themeGlassBgHex', 'glassBg'],
      ['themeGlassBorder', 'themeGlassBorderHex', 'glassBorder'],
      ['themeShadowRose', 'themeShadowRoseHex', 'shadowRose']
    ];
    colorInputs.forEach(function (pair) {
      var colorEl = $(pair[0]);
      var hexEl = $(pair[1]);
      var key = pair[2];
      if (colorEl && theme[key]) {
        colorEl.value = theme[key];
        if (hexEl) hexEl.value = theme[key];
      }
    });
  }

  function updateThemeFromInputs() {
    var theme = {};
    var colorInputs = [
      ['themeBg', 'themeBgHex', 'bg'],
      ['themeBgSoft', 'themeBgSoftHex', 'bgSoft'],
      ['themeAccent', 'themeAccentHex', 'accent'],
      ['themeAccentDeep', 'themeAccentDeepHex', 'accentDeep'],
      ['themeAccentSoft', 'themeAccentSoftHex', 'accentSoft'],
      ['themeInk', 'themeInkHex', 'ink'],
      ['themeInkSoft', 'themeInkSoftHex', 'inkSoft'],
      ['themeInkFaint', 'themeInkFaintHex', 'inkFaint'],
      ['themeLine', 'themeLineHex', 'line'],
      ['themeGlassBg', 'themeGlassBgHex', 'glassBg'],
      ['themeGlassBorder', 'themeGlassBorderHex', 'glassBorder'],
      ['themeShadowRose', 'themeShadowRoseHex', 'shadowRose']
    ];
    colorInputs.forEach(function (pair) {
      var colorEl = $(pair[0]);
      var hexEl = $(pair[1]);
      var key = pair[2];
      var val = (colorEl && colorEl.value) || (hexEl && hexEl.value) || '';
      if (val) theme[key] = val;
    });
    return theme;
  }

  // Sync color input <-> hex input
  ['themeBg', 'themeBgSoft', 'themeAccent', 'themeAccentDeep', 'themeAccentSoft', 'themeInk', 'themeInkSoft', 'themeInkFaint', 'themeLine', 'themeGlassBg', 'themeGlassBorder', 'themeShadowRose'].forEach(function (id) {
    var colorEl = $(id);
    var hexEl = $(id + 'Hex');
    if (colorEl && hexEl) {
      colorEl.addEventListener('input', function () {
        hexEl.value = colorEl.value;
        // Live preview
        var map = { themeBg: 'bg', themeBgSoft: 'bgSoft', themeAccent: 'accent', themeAccentDeep: 'accentDeep', themeAccentSoft: 'accentSoft', themeInk: 'ink', themeInkSoft: 'inkSoft', themeInkFaint: 'inkFaint', themeLine: 'line', themeGlassBg: 'glassBg', themeGlassBorder: 'glassBorder', themeShadowRose: 'shadowRose' };
        var t = {}; t[map[id]] = colorEl.value; applyTheme(t);
      });
      hexEl.addEventListener('input', function () {
        if (/^#[0-9A-Fa-f]{6}$/.test(hexEl.value) || /^rgba?\(/.test(hexEl.value)) {
          colorEl.value = hexEl.value;
          var map = { themeBg: 'bg', themeBgSoft: 'bgSoft', themeAccent: 'accent', themeAccentDeep: 'accentDeep', themeAccentSoft: 'accentSoft', themeInk: 'ink', themeInkSoft: 'inkSoft', themeInkFaint: 'inkFaint', themeLine: 'line', themeGlassBg: 'glassBg', themeGlassBorder: 'glassBorder', themeShadowRose: 'shadowRose' };
          var t = {}; t[map[id]] = hexEl.value; applyTheme(t);
        }
      });
    }
  });

  if ($('themeSaveBtn')) $('themeSaveBtn').addEventListener('click', function () {
    var theme = updateThemeFromInputs();
    applyTheme(theme);
    toast('Theme saved.', 'success');
    syncThemeInputs();
  });

  if ($('themeResetBtn')) $('themeResetBtn').addEventListener('click', function () {
    if (confirm('Reset all colors to defaults?')) {
      resetThemeToDefaults();
      syncThemeInputs();
      toast('Theme reset to defaults.', 'success');
    }
  });

  if ($('themeExportBtn')) $('themeExportBtn').addEventListener('click', function () {
    var theme = getCurrentTheme();
    var blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'candy-shop-theme-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Theme exported.', 'success');
  });

  if ($('themeImportBtn')) $('themeImportBtn').addEventListener('click', function () {
    var input = $('themeImportFile');
    if (input) input.click();
  });

  if ($('themeImportFile')) $('themeImportFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var theme = JSON.parse(ev.target.result);
        applyTheme(theme);
        syncThemeInputs();
        toast('Theme imported.', 'success');
      } catch (err) {
        toast('Invalid theme file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* """ Data Management """ */
  function updateStorageStats() {
    var stats = getStorageStats();
    var el = $('storageStats');
    if (el) {
      el.textContent = 'Storage used: ' + stats.totalKB + ' KB';
    }
  }

  if ($('dataExportBtn')) $('dataExportBtn').addEventListener('click', function () {
    exportAllData();
  });

  if ($('dataImportBtn')) $('dataImportBtn').addEventListener('click', function () {
    var input = $('dataImportFile');
    if (input) input.click();
  });

  if ($('dataImportFile')) $('dataImportFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    importAllData(file);
    e.target.value = '';
  });

  if ($('dataClearBtn')) $('dataClearBtn').addEventListener('click', function () {
    if (confirm('This will permanently delete ALL data: users, orders, products, settings, theme, everything. This cannot be undone. Are you absolutely sure?')) {
      if (confirm('Last chance: Type "DELETE" in the next prompt to confirm.')) {
        var typed = prompt('Type DELETE to confirm:');
        if (typed === 'DELETE') {
          clearAllData();
        } else {
          toast('Cancelled — text did not match.');
        }
      }
    }
  });

  /* Logo admin */
  if ($('lgFile')) $('lgFile').addEventListener('change', function () {
    var f = $('lgFile').files && $('lgFile').files[0];
    if (!f) return;
    if (f.type && f.type.indexOf('image/') !== 0) { toast('Please choose an image file.', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      pendingLogo = ev.target.result;
      $('lgPreview').src = pendingLogo;
      $('lgPreviewWrap').classList.remove('hidden');
      toast('Logo loaded — press "Save logo" to apply it to the website.');
    };
    reader.onerror = function () { toast('Could not read that file.', 'error'); };
    reader.readAsDataURL(f);
  });
  if ($('lgClear')) $('lgClear').addEventListener('click', function () {
    pendingLogo = null;
    $('lgPreview').removeAttribute('src');
    $('lgPreviewWrap').classList.add('hidden');
    if ($('lgFile')) $('lgFile').value = '';
  });
  if ($('logoForm')) $('logoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = ($('lgLogo').value || '').trim();
    var newSrc = pendingLogo || url || DEFAULT_SITE.logo;
    site.logo = newSrc;
    lsSet(SITE_KEY, site);
    pendingLogo = null;
    renderSiteContent();
    populateLogoForm();
    toast('Logo updated.', 'success');
  });

/* """"" Shared overlays & nav """"" */
  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var over = $(b.getAttribute('data-close'));
      if (over) over.classList.remove('open');
      syncScroll();
    });
  });

  // Switch between login/register modals
  document.querySelectorAll('[data-switch]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      var target = a.getAttribute('data-switch');
      var host = a.closest('.modal-overlay');
      if (host) host.classList.remove('open');
      openModal(target);
    });
  });

  // Click backdrop to close modal
  document.querySelectorAll('.modal-overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { ov.classList.remove('open'); syncScroll(); }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModalOverlays();
      closeCart();
      accountWrap.classList.remove('open');
      accountBtn.setAttribute('aria-expanded', 'false');
    }
  });

  
  if (adminBtn) adminBtn.addEventListener('click', openAdmin);

  // Expose for manual testing in console
  window.candyAdmin = window.candyAdmin || {};
  window.candyAdmin.openDashboard = openAdmin;
  window.candyOrders = orders;

  /* """"" Order notifications (owner + employee popups) """"" */
  function notifyNewOrder(order) {
    // 1) Persist notification locally for any tab on this browser
    var notifications = lsGet('candy_notifications', []);
    notifications.unshift({
      id: uid('n'),
      orderId: order.id,
      createdAt: order.createdAt,
      customerName: order.customerName,
      itemCount: order.items.length,
      total: order.subtotal
    });
    if (notifications.length > 50) notifications.length = 50;
    lsSet('candy_notifications', notifications);

    // 2) Cross-tab event for other open tabs (owner/employee)
    if (window.BroadcastChannel) {
      try {
        var ch = new BroadcastChannel('candy-shop-notifications');
        ch.postMessage({ type: 'NEW_ORDER', order: order });
        ch.close();
      } catch (e) {}
    }

    // 3) Browser Notification API (requires permission)
    requestNotificationPermission().then(function (granted) {
      if (granted) {
        var title = 'ðŸ¬ New Order #' + order.id.slice(-6).toUpperCase();
        var body = order.customerName + ' — ' + order.items.length + ' item(s) · ' + fmt(order.subtotal);
        var notif = new Notification(title, {
          body: body,
          icon: site.logo || DEFAULT_SITE.logo,
          tag: 'candy-order-' + order.id,
          requireInteraction: true
        });
        notif.onclick = function () {
          window.focus();
          notif.close();
        };
      }
    });

    // 4) On-screen popup in this tab (staff only: owner + employee)
    if (isStaff()) showOrderPopup(order);
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) { return p === 'granted'; });
  }

  function showOrderPopup(order) {
    var host = $('toastHost');
    if (!host) return;

    var itemsHtml = order.items.map(function (it) {
      return '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);">' +
        (it.image ? '<img src="' + esc(it.image) + '" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex:none;">' : '') +
        '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(it.name) + '</div>' +
        '<div style="font-size:0.75rem;opacity:0.7;">— ' + it.qty + ' · ' + fmt(it.price) + '</div></div>' +
        '<div style="font-weight:700;font-size:0.85rem;">' + fmt(it.price * it.qty) + '</div>' +
      '</div>';
    }).join('');

    var deliveryHtml = order.deliveryMode === 'pickup'
      ? 'Pickup at boutique — Boumerdès city centre'
      : 'Delivery — ' + (order.wilaya || '') + (order.baladia ? ' / ' + order.baladia : '') + (order.address ? ' / ' + order.address : '');

    var popup = document.createElement('div');
    popup.className = 'toast order-popup';
    popup.innerHTML =
      '<div style="display:flex;gap:10px;align-items:flex-start;">' +
        '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent-deep));display:grid;place-items:center;flex:none;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:20px;height:20px;">' +
            '<path d="M22 12h-4l-3 9-3-9H2"/><path d="M22 12V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6"/>' +
          '</svg>' +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">' +
            '<strong style="font-size:0.95rem;">New Order</strong>' +
            '<button class="order-popup-close" aria-label="Dismiss" style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.15);border:0;color:inherit;display:grid;place-items:center;cursor:pointer;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:14px;height:14px;"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>' +
          '</div>' +
          '<div style="font-size:0.8rem;opacity:0.85;margin-bottom:8px;">' + esc(order.customerName) + ' — ' + new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div>' +
          '<div style="max-height:180px;overflow-y:auto;padding-right:4px;">' + itemsHtml + '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15);font-size:0.85rem;">' +
            '<span style="opacity:0.8;">' + esc(deliveryHtml) + '</span>' +
            '<strong style="font-family:var(--serif);font-size:1.05rem;">' + fmt(order.subtotal) + '</strong>' +
          '</div>' +
          (order.note ? '<div style="margin-top:6px;font-size:0.75rem;opacity:0.75;">Note: ' + esc(order.note) + '</div>' : '') +
        '</div>' +
      '</div>';

    host.appendChild(popup);

    // Auto-dismiss after 15s
    var autoDismiss = setTimeout(function () { dismissPopup(popup); }, 15000);

    popup.querySelector('.order-popup-close').addEventListener('click', function () {
      clearTimeout(autoDismiss);
      dismissPopup(popup);
    });

    // Click anywhere on popup (except close) to focus
    popup.addEventListener('click', function (e) {
      if (!e.target.closest('.order-popup-close')) {
        window.focus();
      }
    });
  }

  function dismissPopup(el) {
    el.classList.add('out');
    setTimeout(function () { el.remove(); }, 420);
  }

  // Listen for cross-tab notifications
  if (window.BroadcastChannel) {
    try {
      var notifyChannel = new BroadcastChannel('candy-shop-notifications');
      notifyChannel.onmessage = function (ev) {
        if (ev.data && ev.data.type === 'NEW_ORDER' && ev.data.order) {
          showOrderPopup(ev.data.order);
        }
      };
    } catch (e) {}
  }

  // Restore persisted notifications on load (optional: show latest unread)
  // Currently just ensures localStorage key exists
  lsGet('candy_notifications', []);

  /* """"" Init """"" */
  buildAccountMenu();
  renderCartBadge();
  renderCart();
  renderFilters();
  renderShop();
  renderSiteContent();
  renderAdminProducts();
  renderAdminCategories();
  renderKeys();
})();

