'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const SITE_DIR = path.join(ROOT, 'site');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'candy-shop.sqlite');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer','employee','owner')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS role_keys (
  key TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('employee','owner')),
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  account_username TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);
`);

const DEFAULT_BUSINESS = {name:'Candy Shop Boumerdès',category:'Confectionery Store',location:'QF44+WWC, Boumerdès, Algeria',phone:'0664 97 49 19',rating:'4.3 / 5',reviews:'17'};
const DEFAULT_THEME = {bg:'#f7f1eb',accent:'#d88d95',deep:'#b96c77',ink:'#2e2b28'};
const PUBLIC_KEYS = new Set(['cs_business_v3','cs_theme_v3','cs_products_v1','cs_categories_v1']);
const sessions = new Map();

function now(){ return Date.now(); }
function uid(){ return crypto.randomUUID(); }
function hashPassword(password){
  const salt=crypto.randomBytes(16).toString('hex');
  const N=16384,r=8,p=1;
  const hash=crypto.scryptSync(password,salt,64,{N,r,p,maxmem:32*1024*1024}).toString('hex');
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}
function verifyPassword(password, encoded){
  try{
    const [,Ns,rs,ps,salt,hex]=String(encoded).split('$');
    const N=Number(Ns),r=Number(rs),p=Number(ps);
    const actual=crypto.scryptSync(password,salt,64,{N,r,p,maxmem:32*1024*1024}).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(hex,'hex'));
  }catch{return false;}
}
function setState(key,value){
  db.prepare('INSERT INTO app_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
}
function getState(key,fallback){
  const row=db.prepare('SELECT value FROM app_state WHERE key=?').get(key);
  if(!row) return fallback;
  try{return JSON.parse(row.value)}catch{return fallback;}
}
function deleteState(key){db.prepare('DELETE FROM app_state WHERE key=?').run(key);}

if(!getState('cs_business_v3',null)) setState('cs_business_v3',DEFAULT_BUSINESS);
if(!getState('cs_theme_v3',null)) setState('cs_theme_v3',DEFAULT_THEME);
if(!getState('cs_products_v1',null)) setState('cs_products_v1',[]);
if(!getState('cs_categories_v1',null)) setState('cs_categories_v1',[]);

// One-time migration from the previous JSON-backed server, if it exists.
const LEGACY_FILE = path.join(DATA_DIR, 'candy-shop-state.json');
if (fs.existsSync(LEGACY_FILE)) {
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8')) || {};
    const hasAccounts = db.prepare('SELECT COUNT(*) AS c FROM accounts').get().c > 0;
    if (!hasAccounts && typeof legacy.cs_accounts_v3 === 'string') {
      const oldAccounts = JSON.parse(legacy.cs_accounts_v3);
      if (Array.isArray(oldAccounts)) for (const a of oldAccounts) {
        if (!a?.username || !a?.password) continue;
        try { db.prepare('INSERT INTO accounts(name,username,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)').run(String(a.name||a.username),String(a.username),hashPassword(String(a.password)),['customer','employee','owner'].includes(a.role)?a.role:'customer',a.active===false?0:1,now()); } catch {}
      }
    }
    for (const key of ['cs_business_v3','cs_theme_v3','cs_products_v1','cs_categories_v1']) {
      if (legacy[key] && !db.prepare('SELECT 1 FROM app_state WHERE key=?').get(key)) {
        try { setState(key, JSON.parse(legacy[key])); } catch {}
      }
    }
    if (typeof legacy.candy_role_keys_v1 === 'string' && db.prepare('SELECT COUNT(*) AS c FROM role_keys').get().c===0) {
      const keys=JSON.parse(legacy.candy_role_keys_v1); if(Array.isArray(keys)) for(const k of keys) if(k?.key && k?.role) try{db.prepare('INSERT INTO role_keys(key,role,expires_at,used,created_at) VALUES(?,?,?,?,?)').run(String(k.key),k.role,Number(k.expiresAt)||0,k.used?1:0,Number(k.createdAt)||now())}catch{}
    }
    if (typeof legacy.candy_orders_v1 === 'string' && db.prepare('SELECT COUNT(*) AS c FROM orders').get().c===0) {
      const orders=JSON.parse(legacy.candy_orders_v1); if(Array.isArray(orders)) for(const o of orders) if(o?.id) try{db.prepare('INSERT INTO orders(id,account_username,payload,status,created_at) VALUES(?,?,?,?,?)').run(String(o.id),String(o.account||''),JSON.stringify(o),String(o.status||'new'),Number(o.createdAt)||now())}catch{}
    }
    fs.renameSync(LEGACY_FILE, LEGACY_FILE + '.migrated');
    console.log('Migrated legacy JSON data into SQLite.');
  } catch (e) { console.warn('Legacy migration skipped:', e.message); }
}

const owner=db.prepare('SELECT id FROM accounts WHERE username=?').get('INVYX');
if(!owner){
  db.prepare('INSERT INTO accounts(name,username,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)')
    .run('Candy Shop Owner','INVYX',hashPassword(process.env.CANDY_OWNER_PASSWORD || '2705'),'owner',1,now());
}

function accountPublic(row){ return {id:row.id,name:row.name,username:row.username,role:row.role,active:!!row.active,createdAt:row.created_at}; }
function cookie(name,value,maxAge){
  const secure=process.env.NODE_ENV==='production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function parseCookies(req){
  const out={};
  for(const part of String(req.headers.cookie||'').split(';')){ const i=part.indexOf('='); if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim()); }
  return out;
}
function auth(req){
  const token=parseCookies(req).candy_session;
  if(!token) return null;
  const s=sessions.get(token);
  if(!s || s.expiresAt<now()){sessions.delete(token);return null;}
  const row=db.prepare('SELECT * FROM accounts WHERE id=?').get(s.userId);
  if(!row || !row.active){sessions.delete(token);return null;}
  s.expiresAt=now()+1000*60*60*24*7;
  return row;
}
function requireAuth(req,res,roles){
  const user=auth(req);
  if(!user){sendJson(res,401,{ok:false,error:'Authentication required.'});return null;}
  if(roles && !roles.includes(user.role)){sendJson(res,403,{ok:false,error:'Not authorized.'});return null;}
  return user;
}
function sendJson(res,status,data,extra={}){
  const body=JSON.stringify(data);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body),...extra});
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let body='',size=0,done=false;
    req.setEncoding('utf8');
    req.on('data',chunk=>{if(done)return;size+=Buffer.byteLength(chunk);if(size>25*1024*1024){done=true;reject(new Error('Request too large'));req.destroy();return;}body+=chunk;});
    req.on('end',()=>{if(done)return;try{resolve(body?JSON.parse(body):{});}catch{reject(new Error('Invalid JSON'));}});
    req.on('error',reject);
  });
}
function publicState(){return {
  'cs_business_v3':JSON.stringify(getState('cs_business_v3',DEFAULT_BUSINESS)),
  'cs_theme_v3':JSON.stringify(getState('cs_theme_v3',DEFAULT_THEME)),
  'cs_products_v1':JSON.stringify(getState('cs_products_v1',[])),
  'cs_categories_v1':JSON.stringify(getState('cs_categories_v1',[]))
};}
function makeOrder(payload,user){
  if(!payload || typeof payload!=='object') throw new Error('Invalid order.');
  const id=String(payload.id||uid()).slice(0,100);
  const safe={...payload,id,account:user.username,status:'new',createdAt:Number(payload.createdAt)||now()};
  db.prepare('INSERT INTO orders(id,account_username,payload,status,created_at) VALUES(?,?,?,?,?)').run(id,user.username,JSON.stringify(safe),'new',safe.createdAt);
  return safe;
}

async function handle(req,res){
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(req.method==='GET' && url.pathname==='/api/health') return sendJson(res,200,{ok:true,database:'sqlite',time:new Date().toISOString()});
  if(req.method==='GET' && url.pathname==='/api/public-state') return sendJson(res,200,{state:publicState(),updatedAt:new Date().toISOString()});
  if(req.method==='GET' && url.pathname==='/api/state') return sendJson(res,200,{state:publicState(),updatedAt:new Date().toISOString()});

  if(req.method==='PATCH' && url.pathname==='/api/state/key'){
    const user=requireAuth(req,res,['owner']); if(!user)return;
    try{const b=await readBody(req);if(!PUBLIC_KEYS.has(b.key))return sendJson(res,400,{ok:false,error:'Invalid public state key.'});if(b.deleted)deleteState(b.key);else{if(typeof b.value!=='string')return sendJson(res,400,{ok:false,error:'State value must be a string.'});JSON.parse(b.value);db.prepare('INSERT INTO app_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(b.key,b.value);}return sendJson(res,200,{ok:true});}
    catch(e){return sendJson(res,400,{ok:false,error:e.message||'Save failed.'});}
  }

  if(req.method==='GET' && url.pathname==='/api/auth/me'){
    const user=auth(req); return sendJson(res,200,{authenticated:!!user,user:user?accountPublic(user):null});
  }
  if(req.method==='POST' && url.pathname==='/api/auth/login'){
    try{const b=await readBody(req),u=String(b.username||'').trim(),p=String(b.password||'');const row=db.prepare('SELECT * FROM accounts WHERE username=?').get(u);if(!row||!row.active||!verifyPassword(p,row.password_hash))return sendJson(res,401,{ok:false,error:'Incorrect username or password.'});const token=uid()+crypto.randomBytes(18).toString('hex');sessions.set(token,{userId:row.id,expiresAt:now()+1000*60*60*24*7});return sendJson(res,200,{ok:true,user:accountPublic(row)},{'Set-Cookie':cookie('candy_session',token,60*60*24*7)});}catch(e){return sendJson(res,400,{ok:false,error:e.message});}
  }
  if(req.method==='POST' && url.pathname==='/api/auth/logout'){
    const token=parseCookies(req).candy_session;if(token)sessions.delete(token);return sendJson(res,200,{ok:true},{'Set-Cookie':cookie('candy_session','',0)});
  }
  if(req.method==='POST' && url.pathname==='/api/auth/register'){
    try{
      const b=await readBody(req),name=String(b.name||'').trim(),username=String(b.username||'').trim(),password=String(b.password||''),roleKey=String(b.roleKey||'').trim();
      if(name.length<1||name.length>80)throw new Error('Please enter a valid name.');
      if(!/^[a-zA-Z0-9_.-]{3,24}$/.test(username))throw new Error('Username must be 3–24 letters, numbers, dots, dashes or underscores.');
      if(password.length<6)throw new Error('Password must be at least 6 characters.');
      if(db.prepare('SELECT id FROM accounts WHERE username=?').get(username))throw new Error('That username is already in use.');
      let role='customer', keyRow=null;
      if(roleKey){keyRow=db.prepare('SELECT * FROM role_keys WHERE key=? AND used=0 AND expires_at>?').get(roleKey,now());if(!keyRow)throw new Error('That role key is invalid or expired.');role=keyRow.role;}
      const info=db.prepare('INSERT INTO accounts(name,username,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)').run(name,username,hashPassword(password),role,1,now());
      if(keyRow)db.prepare('UPDATE role_keys SET used=1 WHERE key=?').run(roleKey);
      return sendJson(res,200,{ok:true,user:{name,username,role,active:true},message:`Account created as ${role}. You can now log in.`});
    }catch(e){return sendJson(res,400,{ok:false,error:e.message||'Registration failed.'});}
  }

  if(req.method==='GET' && url.pathname==='/api/admin/users'){
    const user=requireAuth(req,res,['owner']);if(!user)return;const rows=db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all();return sendJson(res,200,{ok:true,users:rows.map(accountPublic)});
  }
  if(req.method==='PATCH' && url.pathname.startsWith('/api/admin/users/')){
    const user=requireAuth(req,res,['owner']);if(!user)return;const id=Number(url.pathname.split('/').pop());const target=db.prepare('SELECT * FROM accounts WHERE id=?').get(id);if(!target)return sendJson(res,404,{ok:false,error:'Account not found.'});if(target.username==='INVYX')return sendJson(res,400,{ok:false,error:'Protected owner account.'});try{const b=await readBody(req);if(b.role!==undefined && !['customer','employee','owner'].includes(b.role))return sendJson(res,400,{ok:false,error:'Invalid role.'});if(b.active!==undefined)db.prepare('UPDATE accounts SET active=? WHERE id=?').run(b.active?1:0,id);if(b.role!==undefined)db.prepare('UPDATE accounts SET role=? WHERE id=?').run(b.role,id);return sendJson(res,200,{ok:true});}catch(e){return sendJson(res,400,{ok:false,error:e.message});}
  }
  if(req.method==='DELETE' && url.pathname.startsWith('/api/admin/users/')){
    const user=requireAuth(req,res,['owner']);if(!user)return;const id=Number(url.pathname.split('/').pop());const target=db.prepare('SELECT * FROM accounts WHERE id=?').get(id);if(!target)return sendJson(res,404,{ok:false,error:'Account not found.'});if(target.username==='INVYX')return sendJson(res,400,{ok:false,error:'Protected owner account.'});db.prepare('DELETE FROM accounts WHERE id=?').run(id);return sendJson(res,200,{ok:true});
  }
  if(req.method==='POST' && url.pathname==='/api/admin/users'){
    const user=requireAuth(req,res,['owner']);if(!user)return;try{const b=await readBody(req),name=String(b.name||'').trim(),username=String(b.username||'').trim(),password=String(b.password||'');if(!name||!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)||password.length<6)throw new Error('Invalid employee details.');if(db.prepare('SELECT id FROM accounts WHERE username=?').get(username))throw new Error('Username already exists.');db.prepare('INSERT INTO accounts(name,username,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)').run(name,username,hashPassword(password),'employee',1,now());return sendJson(res,200,{ok:true});}catch(e){return sendJson(res,400,{ok:false,error:e.message});}
  }

  if(req.method==='GET' && url.pathname==='/api/admin/role-keys'){
    const user=requireAuth(req,res,['owner']);if(!user)return;const rows=db.prepare('SELECT * FROM role_keys WHERE used=0 AND expires_at>? ORDER BY expires_at ASC').all(now());return sendJson(res,200,{ok:true,keys:rows.map(x=>({key:x.key,role:x.role,expiresAt:x.expires_at,used:!!x.used,createdAt:x.created_at}))});
  }
  if(req.method==='POST' && url.pathname==='/api/admin/role-keys'){
    const user=requireAuth(req,res,['owner']);if(!user)return;try{const b=await readBody(req),role=b.role,expiresAt=Number(b.expiresAt);if(!['employee','owner'].includes(role)||!Number.isFinite(expiresAt)||expiresAt<=now())throw new Error('Invalid role or expiration.');const key=`${role.toUpperCase()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;db.prepare('INSERT INTO role_keys(key,role,expires_at,used,created_at) VALUES(?,?,?,?,?)').run(key,role,expiresAt,0,now());return sendJson(res,200,{ok:true,key:{key,role,expiresAt,used:false,createdAt:now()}});}catch(e){return sendJson(res,400,{ok:false,error:e.message});}
  }
  if(req.method==='DELETE' && url.pathname.startsWith('/api/admin/role-keys/')){
    const user=requireAuth(req,res,['owner']);if(!user)return;const key=decodeURIComponent(url.pathname.slice('/api/admin/role-keys/'.length));db.prepare('DELETE FROM role_keys WHERE key=?').run(key);return sendJson(res,200,{ok:true});
  }

  if(req.method==='POST' && url.pathname==='/api/orders'){
    const user=requireAuth(req,res);if(!user)return;try{const b=await readBody(req),o=makeOrder(b,user);return sendJson(res,201,{ok:true,order:o});}catch(e){return sendJson(res,400,{ok:false,error:e.message});}
  }
  if(req.method==='GET' && url.pathname==='/api/orders'){
    const user=requireAuth(req,res,['owner','employee']);if(!user)return;const rows=db.prepare('SELECT payload FROM orders ORDER BY created_at DESC').all();return sendJson(res,200,{ok:true,orders:rows.map(r=>JSON.parse(r.payload))});
  }
  if(req.method==='PATCH' && url.pathname.startsWith('/api/orders/')){
    const user=requireAuth(req,res,['owner']);if(!user)return;const id=decodeURIComponent(url.pathname.slice('/api/orders/'.length));const row=db.prepare('SELECT payload FROM orders WHERE id=?').get(id);if(!row)return sendJson(res,404,{ok:false,error:'Order not found.'});try{const b=await readBody(req),o=JSON.parse(row.payload);if(b.status && ['new','preparing','ready'].includes(b.status))o.status=b.status;db.prepare('UPDATE orders SET payload=?,status=? WHERE id=?').run(JSON.stringify(o),o.status,id);return sendJson(res,200,{ok:true,order:o});}catch(e){return sendJson(res,400,{ok:false,error:e.message});}
  }
  if(req.method==='DELETE' && url.pathname.startsWith('/api/orders/')){
    const user=requireAuth(req,res,['owner']);if(!user)return;const id=decodeURIComponent(url.pathname.slice('/api/orders/'.length));db.prepare('DELETE FROM orders WHERE id=?').run(id);return sendJson(res,200,{ok:true});
  }

  if(req.method!=='GET' && req.method!=='HEAD') return sendJson(res,405,{ok:false,error:'Method not allowed.'});
  let relative=decodeURIComponent(url.pathname);if(relative==='/')relative='/index.html';
  const filePath=path.resolve(SITE_DIR,'.'+relative),siteRoot=path.resolve(SITE_DIR);
  if(!filePath.startsWith(siteRoot+path.sep)&&filePath!==siteRoot)return sendJson(res,403,{ok:false,error:'Forbidden.'});
  try{const stat=await fs.promises.stat(filePath);if(!stat.isFile())throw new Error('Not a file');const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};const type=MIME[path.extname(filePath).toLowerCase()]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':relative.startsWith('/assets/')?'public, max-age=86400':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(filePath).pipe(res);}catch{sendJson(res,404,{ok:false,error:'Not found.'});}
}

const server=http.createServer((req,res)=>handle(req,res).catch(e=>{console.error(e);if(!res.headersSent)sendJson(res,500,{ok:false,error:'Server error.'});else res.end();}));
server.listen(PORT,HOST,()=>console.log(`Candy Shop production server running on http://localhost:${PORT}\nSQLite database: ${DB_FILE}`));
function shutdown(signal){console.log(`\n${signal}: shutting down...`);server.close(()=>{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();process.exit(0);});}
process.on('SIGINT',()=>shutdown('SIGINT'));process.on('SIGTERM',()=>shutdown('SIGTERM'));
