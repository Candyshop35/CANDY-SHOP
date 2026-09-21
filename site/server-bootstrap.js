(function () {
  'use strict';

  // Only non-sensitive public website configuration is synchronized through
  // localStorage. Accounts, sessions, role keys and orders stay server-side.
  const SHARED_KEYS = new Set([
    'cs_business_v3',
    'cs_theme_v3',
    'cs_products_v1',
    'cs_categories_v1'
  ]);
  const PRIVATE_KEYS = new Set(['candy_cart_v1','candy_delivery_cache_v1','cs_session_v3']);

  const original = {
    setItem: Storage.prototype.setItem,
    removeItem: Storage.prototype.removeItem,
    clear: Storage.prototype.clear
  };
  let saveTimer = null;
  const pending = new Map();
  let serverOnline = false;

  function isSharedStorage(storage, key) { return storage === window.localStorage && SHARED_KEYS.has(key); }

  async function saveKey(key, value, deleted) {
    try {
      const response = await fetch('/api/state/key', {
        method: 'PATCH', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({key, value: deleted ? null : value, deleted: !!deleted})
      });
      if (!response.ok) throw new Error((await response.json().catch(()=>({}))).error || 'Server rejected save');
      serverOnline = true;
    } catch (error) {
      serverOnline = false;
      console.warn('[Candy Server] Could not save', key, error);
    }
  }
  function queueSave(key, value, deleted) {
    pending.set(key, {value, deleted});
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => flush(), 150);
  }
  let flushing = false;
  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      clearTimeout(saveTimer);
      saveTimer = null;
      while (pending.size) {
        const batch=[...pending.entries()];
        pending.clear();
        for (const [k,item] of batch) await saveKey(k,item.value,item.deleted);
      }
    } finally { flushing=false; }
  }
  function installPersistence() {
    Storage.prototype.setItem=function(key,value){
      const result=original.setItem.call(this,key,value);
      if(isSharedStorage(this,key)) queueSave(String(key),String(value),false);
      return result;
    };
    Storage.prototype.removeItem=function(key){
      const result=original.removeItem.call(this,key);
      if(isSharedStorage(this,key)) queueSave(String(key),null,true);
      return result;
    };
    Storage.prototype.clear=function(){
      const hadShared=this===window.localStorage;
      const result=original.clear.call(this);
      if(hadShared) for(const key of SHARED_KEYS) queueSave(key,null,true);
      return result;
    };
  }
  async function hydrate() {
    try {
      const response=await fetch('/api/public-state',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok) throw new Error('Server unavailable');
      const data=await response.json();
      const state=data&&typeof data.state==='object'?data.state:{};
      for(const key of SHARED_KEYS) if(Object.prototype.hasOwnProperty.call(state,key)) original.setItem.call(window.localStorage,key,String(state[key]));
      serverOnline=true;
    } catch(error) {
      console.warn('[Candy Server] Could not hydrate public data:',error);
      serverOnline=false;
    }
    installPersistence();
    window.CandyServer=Object.freeze({online:()=>serverOnline,sharedKeys:[...SHARED_KEYS],privateKeys:[...PRIVATE_KEYS],flush});
  }
  window.CandyServerReady=hydrate();
})();
