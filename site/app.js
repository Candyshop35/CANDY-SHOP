(() => {
  'use strict';
  const KEYS={accounts:'cs_accounts_v3',session:'cs_session_v3',business:'cs_business_v3',theme:'cs_theme_v3',products:'cs_products_v1',categories:'cs_categories_v1'};
    const DEFAULT_BUSINESS={name:'Candy Shop Boumerdès',category:'Confectionery Store',location:'QF44+WWC, Boumerdès, Algeria',phone:'0664 97 49 19',rating:'4.3 / 5',reviews:'17'};
  const DEFAULT_THEME={bg:'#f7f1eb',accent:'#d88d95',deep:'#b96c77',ink:'#2e2b28'};
  const $=id=>document.getElementById(id);
  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}};
  let accountCache=[];
  const accounts=()=>accountCache;
  const saveAccounts=()=>{};
  const api=async(path,options={})=>{const r=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d};
  const loadAccounts=async()=>{try{const d=await api('/api/admin/users');accountCache=Array.isArray(d.users)?d.users:[];return accountCache}catch{return accountCache=[]}};
  const initServerSession=async()=>{try{const d=await api('/api/auth/me');if(d.authenticated&&d.user)setCurrent(d.user);else sessionStorage.removeItem(KEYS.session);if(d.authenticated&&d.user.role==='owner')await loadAccounts();}catch{sessionStorage.removeItem(KEYS.session)}};
  const current=()=>{try{const v=JSON.parse(sessionStorage.getItem(KEYS.session));return v??null}catch{return null}};
  const setCurrent=a=>sessionStorage.setItem(KEYS.session,JSON.stringify({username:a.username,name:a.name,role:a.role}));
  // Real browser-style navigation for modals + scroll-position preserving body lock.
  let modalClosingFromHistory=false;
  let lockedScrollY=0;
  const visibleModal=()=>document.querySelector('.modal-overlay.show');
  const lockPage=()=>{
    if(document.body.classList.contains('lock')) return;
    lockedScrollY=window.scrollY||window.pageYOffset||0;
    document.body.style.setProperty('--lock-scroll-y',`-${lockedScrollY}px`);
    document.body.classList.add('lock');
  };
  const unlockPage=()=>{
    if(!document.body.classList.contains('lock')) return;
    document.body.classList.remove('lock');
    document.body.style.removeProperty('--lock-scroll-y');
    window.scrollTo(0,lockedScrollY);
  };
  const hideModal=id=>{
    const el=$(id);
    if(!el)return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden','true');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('opacity');
    el.style.removeProperty('pointer-events');
    el.style.removeProperty('z-index');
  };
  const closeModal=(id,{history=true}={})=>{
    hideModal(id);
    if(!visibleModal()) unlockPage();
    if(history && !modalClosingFromHistory && window.history.state?.candyModal===id){
      window.history.back();
    }
  };
  const openModal=(id,{history=true,replace=false}={})=>{
    const el=$(id);if(!el)return;
    document.querySelectorAll('.modal-overlay.show').forEach(x=>hideModal(x.id));
    el.classList.add('show');
    el.setAttribute('aria-hidden','false');
    lockPage();
    if(history){
      const state={...(window.history.state||{}),candyModal:id};
      if(replace) window.history.replaceState(state,'',window.location.href);
      else window.history.pushState(state,'',window.location.href);
    }
    requestAnimationFrame(()=>setTimeout(()=>el.querySelector('input,button')?.focus(),35));
  };
  const closeAllModalsFromHistory=()=>{
    modalClosingFromHistory=true;
    document.querySelectorAll('.modal-overlay.show').forEach(m=>hideModal(m.id));
    unlockPage();
    modalClosingFromHistory=false;
  };
  window.addEventListener('popstate',e=>{
    if(e.state?.candyModal){openModal(e.state.candyModal,{history:false});}
    else closeAllModalsFromHistory();
  });
  const setAccountLabel=()=>{const s=current();$('accountLabel').textContent=s?.role==='owner'?'Owner Dashboard':s?'My Account':'Account'};

  $('year').textContent=new Date().getFullYear();
  const nav=$('siteNav');window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>18),{passive:true});
  $('navToggle').onclick=()=>{const open=nav.classList.toggle('menu-open');$('navToggle').setAttribute('aria-expanded',open)};
  document.querySelectorAll('.nav-links a').forEach(a=>a.onclick=()=>{nav.classList.remove('menu-open');$('navToggle').setAttribute('aria-expanded','false')});

  // Account dropdown: the button and dropdown are intentionally separate for clean mobile layout.
  const accountWrap=$('accountWrap');
  const renderAccountDrop=()=>{const s=current();const drop=$('accountDrop');if(!s){drop.innerHTML='<button class="drop-item" data-action="login">Login</button><button class="drop-item" data-action="register">Create account</button>'}else{drop.innerHTML=`<div class="drop-user"><strong>${esc(s.name)}</strong><small>@${esc(s.username)} · ${esc(s.role)}</small></div>${s.role==='owner'?'<button class="drop-item" data-action="admin">Owner Dashboard</button>':''}<button class="drop-item" data-action="logout">Log out</button>`}};
  const toggleAccount=()=>{renderAccountDrop();accountWrap.classList.toggle('open');$('accountBtn').setAttribute('aria-expanded',accountWrap.classList.contains('open'))};
  $('accountBtn').onclick=e=>{e.stopPropagation();toggleAccount()};document.addEventListener('click',e=>{if(!accountWrap.contains(e.target)&&e.target!==$('accountBtn')){accountWrap.classList.remove('open');$('accountBtn').setAttribute('aria-expanded','false')}});
  $('accountDrop').onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;accountWrap.classList.remove('open');const a=b.dataset.action;if(a==='login')openModal('modalLogin');if(a==='register')openModal('modalRegister');if(a==='admin'){openModal('modalAdmin');configureDashboardForRole()}if(a==='logout'){try{await api('/api/auth/logout',{method:'POST'})}catch{}sessionStorage.removeItem(KEYS.session);setAccountLabel();renderAccountDrop()}};

  document.addEventListener('click',e=>{const b=e.target.closest?.('[data-close]');if(!b)return;e.preventDefault();e.stopPropagation();closeModal(b.dataset.close,{history:true});});
  document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id,{history:true})}));
  document.querySelectorAll('[data-switch]').forEach(a=>a.onclick=e=>{e.preventDefault();const currentModal=a.closest('.modal-overlay');closeModal(currentModal.id,{history:false});openModal(a.dataset.switch,{history:true,replace:true})});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=visibleModal();if(m)closeModal(m.id,{history:true});accountWrap.classList.remove('open')}});

  $('loginForm').onsubmit=async e=>{e.preventDefault();const u=$('loginUser').value.trim(),p=$('loginPass').value;try{const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:u,password:p})});setCurrent(d.user);$('loginError').textContent='';closeModal('modalLogin',{history:false});setAccountLabel();if(d.user.role==='owner'||d.user.role==='employee'){if(d.user.role==='owner')await loadAccounts();openModal('modalAdmin',{history:true,replace:true});configureDashboardForRole()}else toast('Welcome back. You can now place your order.')}catch(err){$('loginError').textContent=err.message||'Incorrect username or password.'}};
  $('registerForm').onsubmit=async e=>{e.preventDefault();const name=$('regName').value.trim(),u=$('regUser').value.trim(),p=$('regPass').value;if(p!==$('regPass2').value){$('registerError').textContent='Passwords do not match.';return}if(!/^[a-zA-Z0-9_.-]{3,24}$/.test(u)){$('registerError').textContent='Username must be 3–24 letters, numbers, dots, dashes or underscores.';return}try{const d=await api('/api/auth/register',{method:'POST',body:JSON.stringify({name,username:u,password:p,roleKey:($('regKey').value||'').trim()})});$('registerError').textContent='';$('registerSuccess').textContent=d.message||'Account created. You can now log in.';e.target.reset()}catch(err){$('registerError').textContent=err.message||'Registration failed.'}};

  // Admin
  document.querySelectorAll('.admin-tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.admin-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.admin-panel').forEach(x=>x.classList.remove('active'));tab.classList.add('active');$('panel-'+tab.dataset.tab).classList.add('active');if(tab.dataset.tab==='users')renderUsers();if(tab.dataset.tab==='products')renderProductsAdmin();if(tab.dataset.tab==='content')loadBusiness();if(tab.dataset.tab==='theme')loadTheme()});
  const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function renderUsers(){const a=accounts();$('userList').innerHTML=a.map((x,i)=>`<div class="admin-item"><div class="admin-item-main"><strong>${esc(x.name)}</strong><small>@${esc(x.username)}</small></div><span class="role-badge ${x.role}">${x.role}</span><span class="role-badge ${x.active===false?'employee':''}">${x.active===false?'disabled':'active'}</span><div class="admin-item-actions">${x.username==='INVYX'?'<small>Protected owner</small>':`<button data-user-action="role" data-i="${i}">${x.role==='employee'?'Make owner':'Make employee'}</button><button data-user-action="toggle" data-i="${i}">${x.active===false?'Enable':'Disable'}</button><button data-user-action="remove" data-i="${i}">Remove</button>`}</div></div>`).join('');$('statUsers').textContent=a.length;$('statEmployees').textContent=a.filter(x=>x.role==='employee').length}
  $('userList').onclick=async e=>{const b=e.target.closest('[data-user-action]');if(!b)return;const a=accounts(),i=Number(b.dataset.i),x=a[i];if(!x||x.username==='INVYX')return;try{if(b.dataset.userAction==='remove'){if(!confirm('Remove this account?'))return;await api('/api/admin/users/'+x.id,{method:'DELETE'})}else if(b.dataset.userAction==='role'){await api('/api/admin/users/'+x.id,{method:'PATCH',body:JSON.stringify({role:x.role==='employee'?'owner':'employee'})})}else if(b.dataset.userAction==='toggle'){await api('/api/admin/users/'+x.id,{method:'PATCH',body:JSON.stringify({active:x.active===false})})}await loadAccounts();renderUsers()}catch(err){alert(err.message)}};
  $('addEmployee').onclick=async()=>{const name=prompt('Employee full name:');if(!name)return;const username=prompt('Employee username:');if(!username)return;const password=prompt('Temporary password (6+ characters):');if(!password||password.length<6)return alert('Password must be at least 6 characters.');try{await api('/api/admin/users',{method:'POST',body:JSON.stringify({name,username,password})});await loadAccounts();renderUsers()}catch(err){alert(err.message)}};

  // Products & categories — owner-managed browser demo.
  const getProducts=()=>{const v=read(KEYS.products,[]);return Array.isArray(v)?v:[]};
  const getCategories=()=>{const v=read(KEYS.categories,[]);return Array.isArray(v)?v:[]};
  const saveProducts=v=>localStorage.setItem(KEYS.products,JSON.stringify(v));
  const saveCategories=v=>localStorage.setItem(KEYS.categories,JSON.stringify(v));
  const uid=()=>window.crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const money=v=>`${Number(v).toLocaleString('fr-DZ',{minimumFractionDigits:2,maximumFractionDigits:2})} DA`;
  const optimizeImage=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('Could not read image.'));r.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Invalid image.'));img.onload=()=>{const max=1200,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};img.src=r.result};r.readAsDataURL(file)});
  const renderCategoryChecks=(selected=[])=>{const cats=getCategories();$('productCategoryChecks').innerHTML=cats.length?cats.map(c=>`<label class="category-check"><input type="checkbox" value="${esc(c.id)}" ${selected.includes(c.id)?'checked':''}><span><strong>${esc(c.name)}</strong>${c.description?`<small>${esc(c.description)}</small>`:''}</span></label>`).join(''):'<span class="admin-note">Create a category first.</span>';};
  const resetProductForm=()=>{$('productForm').reset();$('productId').value='';$('productFormTitle').textContent='Add product';$('saveProductBtn').textContent='Add product';$('productImagePreview').innerHTML='<span>No picture selected</span>';$('productSaved').textContent='';$('productError').textContent='';renderCategoryChecks()};
  const renderCategorySelect=()=>{const cats=getCategories();$('bulkCategory').innerHTML='<option value="">Choose category…</option>'+cats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')};
  const renderCategoryList=()=>{const cats=getCategories(),products=getProducts();$('categoryList').innerHTML=cats.length?cats.map((c,i)=>{const count=products.filter(p=>(p.categoryIds||[]).includes(c.id)).length;return `<div class="category-item"><div><strong>${esc(c.name)}</strong>${c.description?`<small>${esc(c.description)}</small>`:''}<span>${count} product${count===1?'':'s'}</span></div><div class="category-item-actions"><button data-cat-action="rename" data-cat-id="${esc(c.id)}">Rename</button><button data-cat-action="delete" data-cat-id="${esc(c.id)}">Delete</button></div></div>`}).join(''):'<div class="admin-note empty-state">No categories yet. Create your first one above.</div>'};
  const renderProductsAdmin=()=>{const products=getProducts(),cats=getCategories();renderCategoryChecks($('productId').value?(products.find(p=>p.id===$('productId').value)?.categoryIds||[]):[]);renderCategorySelect();renderCategoryList();$('productAdminList').innerHTML=products.length?products.map(p=>{const names=(p.categoryIds||[]).map(id=>cats.find(c=>c.id===id)?.name).filter(Boolean);return `<article class="product-admin-item"><label class="product-select"><input type="checkbox" class="product-bulk-check" value="${esc(p.id)}"><span class="check-ui"></span></label><div class="product-admin-thumb">${p.image?`<img src="${p.image}" alt="">`:'<span>No image</span>'}</div><div class="product-admin-info"><div class="product-admin-title"><strong>${esc(p.name)}</strong><b>${money(p.price)}</b></div><p>${esc(p.info||'No additional information.')}</p><div class="product-category-pills">${names.length?names.map(n=>`<span>${esc(n)}</span>`).join(''):'<span class="uncategorized">No category</span>'}</div></div><div class="product-admin-actions"><button data-product-action="edit" data-product-id="${esc(p.id)}">Edit</button><button data-product-action="delete" data-product-id="${esc(p.id)}">Delete</button></div></article>`}).join(''):'<div class="admin-note empty-state">No products yet. Add your first product above.</div>';renderPublicProducts();};
  const renderPublicProducts=()=>{const products=getProducts(),cats=getCategories(),section=$('products'),nav=$('productsNav');section?.classList.remove('is-hidden');nav?.classList.remove('is-hidden');if(!products.length){$('publicProductCategories').innerHTML='<div class="shop-empty-state"><strong>No sweets added yet.</strong><span>The owner can add products from the Owner Dashboard. You can still create a gift box by price.</span></div>';return}const groups=cats.map(c=>({cat:c,items:products.filter(p=>(p.categoryIds||[]).includes(c.id))})).filter(g=>g.items.length);const assigned=new Set(groups.flatMap(g=>g.items.map(p=>p.id)));const orphan=products.filter(p=>!assigned.has(p.id));const html=groups.map(g=>`<section class="public-product-group"><div class="product-group-head"><span class="eyebrow"><span class="eyebrow-dot"></span>${esc(g.cat.name)}</span>${g.cat.description?`<p>${esc(g.cat.description)}</p>`:''}</div><div class="public-products-grid">${g.items.map(publicProductCard).join('')}</div></section>`).join('')+(orphan.length?`<section class="public-product-group"><div class="product-group-head"><span class="eyebrow"><span class="eyebrow-dot"></span>Products</span><p>Additional products added by the owner.</p></div><div class="public-products-grid">${orphan.map(publicProductCard).join('')}</div></section>`:'');$('publicProductCategories').innerHTML=html};
  const publicProductCard=p=>`<article class="public-product-card"><div class="public-product-media">${p.image?`<img loading="lazy" src="${p.image}" alt="${esc(p.name)}">`:'<span>Photo not added</span>'}</div><div class="public-product-copy"><div><h3>${esc(p.name)}</h3><strong>${money(p.price)}</strong></div>${p.info?`<p>${esc(p.info)}</p>`:''}<div class="product-card-actions"><button class="btn btn-primary btn-sm" data-cart-add="${esc(p.id)}">Add to cart</button><button class="btn btn-glass btn-sm" data-gift-add="${esc(p.id)}">🎁 Gift box</button></div></div></article>`;
  $('productImage').onchange=()=>{const f=$('productImage').files?.[0];if(!f)return;$('productError').textContent='';const url=URL.createObjectURL(f);$('productImagePreview').innerHTML=`<img src="${url}" alt="Selected product preview">`;setTimeout(()=>URL.revokeObjectURL(url),2000)};
  $('productForm').onsubmit=async e=>{e.preventDefault();$('productError').textContent='';$('productSaved').textContent='';const name=$('productName').value.trim(),price=Number($('productPrice').value),info=$('productInfo').value.trim(),id=$('productId').value,categories=[...document.querySelectorAll('#productCategoryChecks input:checked')].map(x=>x.value);if(!name||!Number.isFinite(price)||price<0){$('productError').textContent='Please enter a valid product name and price.';return}let products=getProducts(),existing=products.find(p=>p.id===id),image=existing?.image||'';const file=$('productImage').files?.[0];try{if(file)image=await optimizeImage(file)}catch(err){$('productError').textContent=err.message;return}const product={id:id||uid(),name,price,info,image,categoryIds:categories,updatedAt:new Date().toISOString()};if(existing)products=products.map(p=>p.id===id?product:p);else products.push(product);await saveProducts(products);$('productSaved').textContent=existing?'Product updated.':'Product added.';renderProductsAdmin();setTimeout(resetProductForm,500)};
  $('cancelProductEdit').onclick=resetProductForm;
  $('categoryForm').onsubmit=async e=>{e.preventDefault();$('categoryError').textContent='';const name=$('categoryName').value.trim(),description=$('categoryDescription').value.trim();if(!name)return;const cats=getCategories();if(cats.some(c=>c.name.toLowerCase()===name.toLowerCase())){$('categoryError').textContent='That category already exists.';return}cats.push({id:uid(),name,description});await saveCategories(cats);e.target.reset();$('categorySaved').textContent='Category created.';renderProductsAdmin();setTimeout(()=>$('categorySaved').textContent='',1200)};
  $('categoryList').onclick=async e=>{const b=e.target.closest('[data-cat-action]');if(!b)return;const id=b.dataset.catId,cats=getCategories();const c=cats.find(x=>x.id===id);if(!c)return;if(b.dataset.catAction==='rename'){const name=prompt('Category name:',c.name);if(!name?.trim())return;if(cats.some(x=>x.id!==id&&x.name.toLowerCase()===name.trim().toLowerCase()))return alert('That category already exists.');c.name=name.trim();const description=prompt('Category description (optional):',c.description||'');if(description!==null)c.description=description.trim();await saveCategories(cats);renderProductsAdmin()}else if(b.dataset.catAction==='delete'){if(!confirm(`Delete category “${c.name}”? Products will remain but will be removed from this category.`))return;await saveCategories(cats.filter(x=>x.id!==id));await saveProducts(getProducts().map(p=>({...p,categoryIds:(p.categoryIds||[]).filter(x=>x!==id)})));renderProductsAdmin()}};
  $('productAdminList').onclick=async e=>{const b=e.target.closest('[data-product-action]');if(!b)return;const id=b.dataset.productId,p=getProducts().find(x=>x.id===id);if(!p)return;if(b.dataset.productAction==='delete'){if(!confirm(`Delete “${p.name}”?`))return;await saveProducts(getProducts().filter(x=>x.id!==id));renderProductsAdmin();return}$('productId').value=p.id;$('productName').value=p.name;$('productPrice').value=p.price;$('productInfo').value=p.info||'';$('productImage').value='';$('productFormTitle').textContent='Edit product';$('saveProductBtn').textContent='Save changes';$('productImagePreview').innerHTML=p.image?`<img src="${p.image}" alt="Current product image">`:'<span>No picture selected</span>';renderCategoryChecks(p.categoryIds||[]);$('panel-products').scrollTo({top:0,behavior:'smooth'});$('productName').focus()};
  $('selectAllProducts').onchange=e=>document.querySelectorAll('.product-bulk-check').forEach(x=>x.checked=e.target.checked);
  const selectedProductIds=()=>[...document.querySelectorAll('.product-bulk-check:checked')].map(x=>x.value);
  $('bulkAssign').onclick=async()=>{const cat=$('bulkCategory').value,ids=selectedProductIds();if(!cat)return alert('Choose a category first.');if(!ids.length)return alert('Select at least one product.');await saveProducts(getProducts().map(p=>ids.includes(p.id)?{...p,categoryIds:[...new Set([...(p.categoryIds||[]),cat])]}:p));$('selectAllProducts').checked=false;renderProductsAdmin()};
  $('bulkRemove').onclick=async()=>{const cat=$('bulkCategory').value,ids=selectedProductIds();if(!cat)return alert('Choose a category first.');if(!ids.length)return alert('Select at least one product.');await saveProducts(getProducts().map(p=>ids.includes(p.id)?{...p,categoryIds:(p.categoryIds||[]).filter(x=>x!==cat)}:p));$('selectAllProducts').checked=false;renderProductsAdmin()};
  renderPublicProducts();

  function loadBusiness(){const b={...DEFAULT_BUSINESS,...read(KEYS.business,{})};[['bizName','name'],['bizCategory','category'],['bizLocation','location'],['bizPhone','phone'],['bizRating','rating'],['bizReviews','reviews']].forEach(([id,k])=>$(id).value=b[k]??'')}
  $('businessForm').onsubmit=async e=>{e.preventDefault();const b={name:$('bizName').value,category:$('bizCategory').value,location:$('bizLocation').value,phone:$('bizPhone').value,rating:$('bizRating').value,reviews:$('bizReviews').value};await persistShared(KEYS.business,b);$('bizSaved').textContent='Saved to the server database.'};loadBusiness();

  function applyTheme(t){document.documentElement.style.setProperty('--bg',t.bg);document.documentElement.style.setProperty('--accent',t.accent);document.documentElement.style.setProperty('--accent-deep',t.deep);document.documentElement.style.setProperty('--ink',t.ink)}
  function loadTheme(){const t={...DEFAULT_THEME,...read(KEYS.theme,{})};$('cBg').value=t.bg;$('cAccent').value=t.accent;$('cDeep').value=t.deep;$('cInk').value=t.ink;applyTheme(t)}
  $('saveTheme').onclick=async()=>{const t={bg:$('cBg').value,accent:$('cAccent').value,deep:$('cDeep').value,ink:$('cInk').value};await persistShared(KEYS.theme,t);applyTheme(t)};
  $('resetTheme').onclick=async()=>{localStorage.removeItem(KEYS.theme);if(window.CandyServer?.flush)await window.CandyServer.flush();loadTheme()};loadTheme();

  $('exportData').onclick=()=>{const data={accounts:accounts(),business:read(KEYS.business,DEFAULT_BUSINESS),theme:read(KEYS.theme,DEFAULT_THEME),products:getProducts(),categories:getCategories(),roleKeys:getRoleKeys(),orders:getOrders()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='candy-shop-boumerdes-backup.json';a.click();URL.revokeObjectURL(a.href)};
  $('importData').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{const d=JSON.parse(r.result);if(d.business)await persistShared(KEYS.business,d.business);if(d.theme)await persistShared(KEYS.theme,d.theme);if(Array.isArray(d.products))await saveProducts(d.products);if(Array.isArray(d.categories))await saveCategories(d.categories);loadTheme();loadBusiness();renderUsers();renderProductsAdmin();alert('Shop data imported and saved to the server. Accounts, role keys and orders remain server-managed.')}catch(err){alert(err?.message||'Invalid JSON backup.')}};r.readAsText(f);e.target.value=''};

  // Make the owner account available immediately; no auto-login.
  initServerSession().then(()=>{setAccountLabel();renderAccountDrop();if(current()?.role==='owner')renderUsers();});
})();

/* =========================================================
   Premium motion controller
   ========================================================= */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // Reading progress. Keep the interface clean: no cursor trails, rings, or mouse-following lines.
  const progress = document.createElement('div');
  progress.className = 'page-progress';
  document.body.appendChild(progress);
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener('scroll', updateProgress, {passive:true});
  window.addEventListener('resize', updateProgress, {passive:true});
  updateProgress();

  // Reveal content as it enters the viewport.
  const revealItems = document.querySelectorAll('.section-head,.shop-card,.rating-big,.review-note,.visit-info,.visit-map,.footer,.hero-card');
  revealItems.forEach((el,i)=>{
    if (el.classList.contains('shop-card')) el.style.setProperty('--i', i % 3);
    el.classList.add(el.classList.contains('shop-card') ? 'reveal-scale' : 'reveal');
  });
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(entries => entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('in-view');io.unobserve(entry.target)}
    }), {threshold:.12,rootMargin:'0px 0px -50px'});
    revealItems.forEach(el=>io.observe(el));
  } else revealItems.forEach(el=>el.classList.add('in-view'));

  // Hero title character animation, generated from its text so the HTML stays maintainable.
  const title = document.querySelector('.hero-title');
  if (title && !reduce) {
    const parts = [];
    [...title.childNodes].forEach(node=>{
      if(node.nodeType===3){
        const span=document.createElement('span');span.className='word';
        [...node.textContent].forEach(ch=>{const c=document.createElement('span');c.className='char';c.textContent=ch;c.style.setProperty('--i',parts.length);parts.push(c);span.appendChild(c)});
        node.replaceWith(span);
      } else if(node.nodeType===1){
        const wrap=document.createElement('span');wrap.className='word';
        [...node.textContent].forEach(ch=>{const c=document.createElement('span');c.className='char';c.textContent=ch;c.style.setProperty('--i',parts.length);parts.push(c);wrap.appendChild(c)});
        node.replaceWith(wrap);
      }
    });
  }

  // Instant mouse + finger/touch feedback for every interactive control.
  document.addEventListener('pointerdown', e=>{
    const el=e.target.closest('button,a,[role=button],.chip,.tab,.category-pill,.product-card,.order-card,.stat-card,.admin-card,.panel');
    if(!el) return;
    el.classList.add('is-pressed');
  },{passive:true});
  const clearPress=e=>{const el=e.target.closest?.('button,a,[role=button],.chip,.tab,.category-pill,.product-card,.order-card,.stat-card,.admin-card,.panel');if(el)el.classList.remove('is-pressed')};
  document.addEventListener('pointerup',clearPress,{passive:true});
  document.addEventListener('pointercancel',clearPress,{passive:true});
  document.addEventListener('pointerleave',clearPress,{passive:true});

  // Active section in navigation.
  const links=[...document.querySelectorAll('.nav-links a[href^="#"]')];
  const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if('IntersectionObserver' in window){
    const navIO=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+entry.target.id))}
    }),{rootMargin:'-38% 0px -52% 0px',threshold:0});
    sections.forEach(s=>navIO.observe(s));
  }


  // =========================================================
  // CART + GIFT BOXES
  // =========================================================
  const CART_KEY='candy_cart_v1';
  const DELIVERY_CACHE='candy_delivery_2026_v1';
  const WILAYAS_69=[
    [1,'Adrar','أدرار'],[2,'Chlef','الشلف'],[3,'Laghouat','الأغواط'],[4,'Oum El Bouaghi','أم البواقي'],[5,'Batna','باتنة'],[6,'Béjaïa','بجاية'],[7,'Biskra','بسكرة'],[8,'Béchar','بشار'],[9,'Blida','البليدة'],[10,'Bouira','البويرة'],[11,'Tamanrasset','تمنراست'],[12,'Tébessa','تبسة'],[13,'Tlemcen','تلمسان'],[14,'Tiaret','تيارت'],[15,'Tizi Ouzou','تيزي وزو'],[16,'Alger','الجزائر'],[17,'Djelfa','الجلفة'],[18,'Jijel','جيجل'],[19,'Sétif','سطيف'],[20,'Saïda','سعيدة'],[21,'Skikda','سكيكدة'],[22,'Sidi Bel Abbès','سيدي بلعباس'],[23,'Annaba','عنابة'],[24,'Guelma','قالمة'],[25,'Constantine','قسنطينة'],[26,'Médéa','المدية'],[27,'Mostaganem','مستغانم'],[28,'M’Sila','المسيلة'],[29,'Mascara','معسكر'],[30,'Ouargla','ورقلة'],[31,'Oran','وهران'],[32,'El Bayadh','البيض'],[33,'Illizi','إليزي'],[34,'Bordj Bou Arréridj','برج بوعريريج'],[35,'Boumerdès','بومرداس'],[36,'El Tarf','الطارف'],[37,'Tindouf','تندوف'],[38,'Tissemsilt','تيسمسيلت'],[39,'El Oued','الوادي'],[40,'Khenchela','خنشلة'],[41,'Souk Ahras','سوق أهراس'],[42,'Tipaza','تيبازة'],[43,'Mila','ميلة'],[44,'Aïn Defla','عين الدفلى'],[45,'Naâma','النعامة'],[46,'Aïn Témouchent','عين تموشنت'],[47,'Ghardaïa','غرداية'],[48,'Relizane','غليزان'],[49,'Timimoun','تيميمون'],[50,'Bordj Badji Mokhtar','برج باجي مختار'],[51,'Ouled Djellal','أولاد جلال'],[52,'Béni Abbès','بني عباس'],[53,'In Salah','عين صالح'],[54,'In Guezzam','عين قزام'],[55,'Touggourt','تقرت'],[56,'Djanet','جانت'],[57,'El M’Ghair','المغير'],[58,'El Meniaa','المنيعة'],[59,'Aflou','أفلو'],[60,'Barika','بريكة'],[61,'El Kantara','القنطرة'],[62,'Bir El Ater','بئر العاتر'],[63,'El Aricha','العريشة'],[64,'Ksar Chellala','قصر الشلالة'],[65,'Aïn Ouessara','عين وسارة'],[66,'Messaad','مسعد'],[67,'Ksar El Boukhari','قصر البخاري'],[68,'Bou Saâda','بوسعادة'],[69,'El Abiodh Sidi Cheikh','الأبيض سيدي الشيخ']
  ];
  const COMMUNES_URL='https://raw.githubusercontent.com/riadh2002/algeria-69-wilayas-1541-communes/refs/heads/main/data/communes.json';
  const getCart=()=>{const v=read(CART_KEY,[]);return Array.isArray(v)?v:[]};
  const saveCart=v=>localStorage.setItem(CART_KEY,JSON.stringify(v));
  const cartCount=()=>getCart().reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0);
  const cartTotal=()=>getCart().reduce((n,x)=>n+(Number(x.price)||0)*(Number(x.quantity)||1),0);
  function updateCartBadge(){const n=cartCount();['cartCount','cartCountSecondary','giftCtaCartCount','giftOpenCartCount'].forEach(id=>{const el=$(id);if(el)el.textContent=n});document.getElementById('cartBtn')?.classList.toggle('has-items',n>0)}
  function addToCart(productId,quantity=1){const p=getProducts().find(x=>x.id===productId);if(!p)return;const cart=getCart(),item=cart.find(x=>x.productId===productId);if(item)item.quantity+=Math.max(1,quantity);else cart.push({productId:p.id,productName:p.name,price:p.price,image:p.image||'',quantity:Math.max(1,quantity)});saveCart(cart);updateCartBadge();toast(`${p.name} added to cart.`);}
  function renderCart(){const cart=getCart(),box=$('cartItems'),empty=$('cartEmpty'),form=$('cartCheckoutForm');if(!box||!empty||!form)return;box.innerHTML=cart.map(x=>`<article class="cart-item"><div class="cart-item-media">${x.image?`<img src="${x.image}" alt="">`:`<img class="ai-inline-icon" src="assets/ai/ai-candy-detail.jpg" alt="">`}</div><div class="cart-item-main"><strong>${esc(x.productName)}</strong><span>${money(x.price)} each</span>${x.isGiftBox&&x.giftSummary?`<small class="cart-gift-summary">${esc(x.giftSummary)}</small>`:''}<div class="qty-control">${x.isGiftBox?`<b class="gift-fixed-qty">1</b>`:`<button type="button" data-cart-qty="${esc(x.productId)}" data-delta="-1" aria-label="Decrease quantity">−</button><b>${x.quantity}</b><button type="button" data-cart-qty="${esc(x.productId)}" data-delta="1" aria-label="Increase quantity">+</button>`}</div></div><strong class="cart-line-total">${money(x.price*x.quantity)}</strong><button type="button" class="cart-remove" data-cart-remove="${esc(x.productId)}" aria-label="Remove ${esc(x.productName)}">×</button></article>`).join('');empty.classList.toggle('is-hidden',cart.length>0);form.classList.toggle('is-hidden',cart.length===0);$('cartTotal').textContent=money(cartTotal());updateCartBadge();updateAccountCheckoutNotes();}
  const openCandyCart=()=>{const modal=$('modalCart');if(!modal)return false;renderCart();modal.classList.add('show');modal.setAttribute('aria-hidden','false');modal.style.display='grid';modal.style.opacity='1';modal.style.pointerEvents='auto';modal.style.zIndex='99999';document.body.classList.add('lock');updateAccountCheckoutNotes();return true;};
  window.__openCandyCart=openCandyCart;window.__renderCandyCart=renderCart;
  // One cart opener only: the cart is a fixed modal over the current viewport.
  $('cartBtn')?.addEventListener('click',e=>{e.preventDefault();openModal('modalCart');renderCart();});
  $('giftCtaCartButton')?.addEventListener('click',e=>{e.preventDefault();openModal('modalCart');renderCart();});
  $('giftOpenCartBtn')?.addEventListener('click',e=>{e.preventDefault();openModal('modalCart');renderCart();});

  $('cartItems').onclick=e=>{const qty=e.target.closest('[data-cart-qty]'),rem=e.target.closest('[data-cart-remove]');if(qty){const cart=getCart(),i=cart.findIndex(x=>x.productId===qty.dataset.cartQty);if(i<0)return;cart[i].quantity+=Number(qty.dataset.delta);if(cart[i].quantity<=0)cart.splice(i,1);saveCart(cart);renderCart()}else if(rem){saveCart(getCart().filter(x=>x.productId!==rem.dataset.cartRemove));renderCart()}};

  function fillWilayaSelect(id){const s=$(id);if(!s)return;s.innerHTML='<option value="">Select your wilaya</option>'+WILAYAS_69.map(([code,name])=>`<option value="${code}">${String(code).padStart(2,'0')} · ${esc(name)}</option>`).join('');s.value='';}
  const DELIVERY_BY_WILAYA={};
  const DELIVERY_URLS=code=>{const n=String(code).padStart(2,'0');return [`https://cdn.jsdelivr.net/gh/el-amin-dev/algeria-wilayas-communes@main/data/by-wilaya/${n}.json`,`https://raw.githubusercontent.com/riadh2002/algeria-69-wilayas-1541-communes/refs/heads/main/data/communes.json`]};
  const DELIVERY_ALL_URL='https://cdn.jsdelivr.net/gh/el-amin-dev/algeria-wilayas-communes@main/data/communes.json';
  function normalizeCommunes(payload,code){let arr=Array.isArray(payload)?payload:(payload?.communes||payload?.data||payload?.wilaya?.communes||[]);if(!Array.isArray(arr))arr=[];return arr.map(x=>{const n=x.name||x.nom_fr||x.name_fr||x.nom_en||x.name_en||x.commune||x.nom||'';const ar=x.name_ar||x.nom_ar||x.ar||'';const wc=x.wilaya_code??x.wilayaCode??x.wilaya_code_num??code;return {name:n,name_ar:ar,wilaya_code:Number(wc)}}).filter(x=>x.name&&Number(x.wilaya_code)===Number(code));}
  function renderBaladiaOptions(selectId,code,list){const s=$(selectId);if(!s)return;s.innerHTML='<option value="">Select your baladia</option>'+list.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}${x.name_ar?` — ${esc(x.name_ar)}`:''}</option>`).join('');s.disabled=!list.length;s.dataset.ready=list.length?'1':'0';if(!list.length)s.innerHTML='<option value="">No baladiya data loaded</option>';}
  async function loadBaladiyas(code,selectId){const s=$(selectId);if(!s)return;code=Number(code);if(!code){s.innerHTML='<option value="">Select wilaya first</option>';s.disabled=true;return}if(DELIVERY_BY_WILAYA[code]){renderBaladiaOptions(selectId,code,DELIVERY_BY_WILAYA[code]);return}s.disabled=true;s.innerHTML='<option value="">Loading baladiyat…</option>';let list=[];
    for(const url of DELIVERY_URLS(code)){try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)continue;const d=await r.json();list=normalizeCommunes(d,code);if(list.length)break}catch(e){/* try next source */}}
    if(!list.length){try{const cached=read(DELIVERY_CACHE,null);if(Array.isArray(cached))list=normalizeCommunes(cached,code)}catch(e){}}
    DELIVERY_BY_WILAYA[code]=list;renderBaladiaOptions(selectId,code,list);
  }
  async function loadDeliveryData(){fillWilayaSelect('cartWilaya');try{const cached=read(DELIVERY_CACHE,null);if(Array.isArray(cached)&&cached.length){window.__communes=cached;cached.forEach(x=>{const c=Number(x.wilaya_code);if(!DELIVERY_BY_WILAYA[c])DELIVERY_BY_WILAYA[c]=[];DELIVERY_BY_WILAYA[c].push({name:x.name||x.nom_fr||x.name_fr||x.nom_en||x.name_en||'',name_ar:x.name_ar||x.nom_ar||''})});return}const r=await fetch(DELIVERY_ALL_URL,{cache:'force-cache'});if(!r.ok)throw new Error('full delivery dataset unavailable');const d=await r.json();const arr=Array.isArray(d)?d:(d?.communes||d?.data||[]);if(!Array.isArray(arr)||!arr.length)throw new Error('empty delivery dataset');window.__communes=arr;localStorage.setItem(DELIVERY_CACHE,JSON.stringify(arr));arr.forEach(x=>{const c=Number(x.wilaya_code);if(!DELIVERY_BY_WILAYA[c])DELIVERY_BY_WILAYA[c]=[];DELIVERY_BY_WILAYA[c].push({name:x.name||x.nom_fr||x.name_fr||x.nom_en||x.name_en||'',name_ar:x.name_ar||x.nom_ar||''})});const selected=$('cartWilaya')?.value;if(selected)renderBaladiaOptions('cartBaladia',selected,DELIVERY_BY_WILAYA[Number(selected)]||[])}catch(err){console.warn('Delivery dataset will load per wilaya',err)}}
  $('cartWilaya')?.addEventListener('change',e=>{loadBaladiyas(e.target.value,'cartBaladia')});
  loadDeliveryData();

  function isLoggedIn(){return !!current()}
  function requireAccount(modalId,errorId){if(isLoggedIn())return true;if(errorId&&$(errorId))$(errorId).textContent='Please log in or create an account before placing an order.';closeModal(modalId,{history:false});openModal('modalLogin');return false}
  function updateAccountCheckoutNotes(){const locked=!isLoggedIn();['cartAccountNote'].forEach(id=>{const el=$(id);if(el)el.classList.toggle('is-hidden',!locked)});['cartCheckoutBtn'].forEach(id=>{const el=$(id);if(el)el.title=locked?'Login required to order':''})}
  $('cartCheckoutBtn')?.addEventListener('click',e=>{if(!isLoggedIn()){e.preventDefault();e.stopPropagation();requireAccount('modalCart','cartError')}});
  $('cartCheckoutForm').onsubmit=async e=>{e.preventDefault();if(!requireAccount('modalCart','cartError'))return;const cart=getCart();if(!cart.length)return;const name=$('cartName').value.trim(),phone=$('cartPhone').value.trim(),wilaya=$('cartWilaya').value,baladia=$('cartBaladia').value,address=$('cartAddress').value.trim();if(!name||!phone||!wilaya||!baladia||!address){$('cartError').textContent='Please complete your name, phone, wilaya, baladia and delivery address.';return}const o={id:uid(),type:'cart',items:cart,total:cartTotal(),customerName:name,phone,wilayaCode:Number(wilaya),wilaya:WILAYAS_69.find(x=>x[0]===Number(wilaya))?.[1]||'',baladia,address,note:$('cartNote').value.trim(),status:'new',createdAt:Date.now(),account:current()?.username||''};try{await api('/api/orders',{method:'POST',body:JSON.stringify(o)});saveCart([]);renderCart();$('cartSuccess').textContent='Cart order sent to the shop.';e.target.reset();$('cartBaladia').disabled=true;updateAccountCheckoutNotes();setTimeout(()=>closeModal('modalCart'),900)}catch(err){$('cartError').textContent=err.message||'Could not send order.'}};

  const giftState={mode:'random',items:[],budget:0};
  const giftModes=['random','manual','budget'];
  function setGiftMode(mode){
    if(!giftModes.includes(mode)) return false;
    giftState.mode=mode;
    document.querySelectorAll('.gift-mode').forEach(b=>b.classList.toggle('active',b.dataset.giftMode===mode));
    document.querySelectorAll('.gift-mode-panel').forEach(p=>p.classList.toggle('active',p.id==='giftMode'+mode.charAt(0).toUpperCase()+mode.slice(1)));
    renderGiftManualProducts();
    renderGiftPreview();
    const active=document.querySelector('.gift-mode.active');
    if(active){
      document.querySelectorAll('.gift-mode').forEach(b=>b.setAttribute('aria-selected',b===active?'true':'false'));
    }
    return true;
  }
  // Bulletproof gift-mode controls: handle pointer input before other page
  // handlers, while still supporting keyboard activation through click.
  let lastGiftPointerMode = '';
  let lastGiftPointerAt = 0;
  const activateGiftMode=(mode,e)=>{
    if(e){e.preventDefault();e.stopImmediatePropagation();}
    const ok=setGiftMode(mode);
    if(ok){lastGiftPointerMode=mode;lastGiftPointerAt=Date.now();}
    return ok;
  };
  window.CandyShopGiftMode=(mode,e)=>activateGiftMode(mode,e);
  document.addEventListener('pointerdown',e=>{
    const b=e.target.closest?.('.gift-mode[data-gift-mode]');
    if(!b)return;
    activateGiftMode(b.dataset.giftMode,e);
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('.gift-mode[data-gift-mode]');
    if(!b)return;
    // Pointerdown already handled mouse/touch. Click remains for keyboard.
    if(lastGiftPointerMode===b.dataset.giftMode && Date.now()-lastGiftPointerAt<700){
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    activateGiftMode(b.dataset.giftMode,e);
  },true);
  function openGift(){giftState.mode='random';giftState.items=[];giftState.budget=0;document.querySelectorAll('.gift-mode').forEach(b=>b.classList.toggle('active',b.dataset.giftMode==='random'));document.querySelectorAll('.gift-mode-panel').forEach(p=>p.classList.toggle('active',p.id==='giftModeRandom'));$('giftRandomBudget').value='';$('giftBudgetOnly').value='';$('giftRandomPreview').innerHTML='<div class="gift-placeholder">Choose a budget and let the box surprise you.</div>';$('giftManualTotal').textContent=money(0);$('giftManualItems').innerHTML='';$('giftError').textContent='';$('giftSuccess').textContent='';renderGiftManualProducts();openModal('modalGiftBox')}
  function renderGiftManualProducts(){const box=$('giftManualProducts');if(!box)return;const products=getProducts();box.innerHTML=products.length?products.map(p=>{const item=giftState.items.find(x=>x.productId===p.id);return `<button type="button" class="gift-picker-card ${item?'selected':''}" data-gift-picker="${esc(p.id)}"><span class="gift-picker-image">${p.image?`<img src="${p.image}" alt="">`:`<img class="ai-inline-icon" src="assets/ai/ai-candy-detail.jpg" alt="">`}</span><span><strong>${esc(p.name)}</strong><small>${money(p.price)}</small></span><b>${item?`×${item.quantity}`:'+'}</b></button>`}).join(''):'<div class="gift-placeholder">No products have been added by the owner yet.</div>'}
  function giftTotal(){return giftState.items.reduce((n,x)=>n+x.price*x.quantity,0)}
  function renderGiftPreview(){const box=$('giftRandomPreview');if(!box)return;if(giftState.mode!=='random')return;if(!giftState.items.length){box.innerHTML='<div class="gift-placeholder">Your random selection will appear here.</div>';return}box.innerHTML=`<div class="gift-result"><div><strong>Your surprise box</strong><span>${giftState.items.reduce((n,x)=>n+x.quantity,0)} item${giftState.items.reduce((n,x)=>n+x.quantity,0)===1?'':'s'}</span></div>${giftState.items.map(x=>`<div class="gift-result-row"><span>${esc(x.productName)} × ${x.quantity}</span><b>${money(x.price*x.quantity)}</b></div>`).join('')}<div class="gift-result-total"><span>Box value</span><strong>${money(giftTotal())}</strong></div></div>`}
  function renderGiftManual(){const total=giftTotal();$('giftManualTotal').textContent=money(total);$('giftManualItems').innerHTML=giftState.items.length?giftState.items.map(x=>`<div><span>${esc(x.productName)} × ${x.quantity}</span><b>${money(x.price*x.quantity)}</b></div>`).join(''):'<span class="gift-placeholder">Add products above.</span>'}
  function randomizeGift(){const budget=Math.max(0,Number($('giftRandomBudget').value));const products=getProducts().filter(p=>Number(p.price)>0).map(p=>({...p}));if(!budget){$('giftError').textContent='Choose a budget first.';return}if(!products.length){$('giftError').textContent='There are no priced products available yet.';return}const shuffled=products.sort(()=>Math.random()-.5);let remaining=budget,items=[];for(const p of shuffled){if(p.price<=remaining){const max=Math.floor(remaining/p.price);const q=Math.min(max,Math.random()<.35?1:Math.max(1,Math.floor(Math.random()*max)+1));items.push({productId:p.id,productName:p.name,price:Number(p.price),quantity:q});remaining-=p.price*q}}if(!items.length){const cheapest=Math.min(...products.map(p=>Number(p.price)));$('giftError').textContent=`The smallest available product costs ${money(cheapest)}. Increase the budget.`;return}giftState.items=items;giftState.budget=budget;$('giftError').textContent='';renderGiftPreview()}
  window.__openCandyGift=openGift;
  $('openGiftBox')?.addEventListener('click',e=>{e.preventDefault();openGift()});
  $('giftCtaButton')?.addEventListener('click',e=>{e.preventDefault();openGift()});
  document.addEventListener('click',e=>{const add=e.target.closest('[data-cart-add]'),gift=e.target.closest('[data-gift-add]');if(add)addToCart(add.dataset.cartAdd);if(gift){openGift();setTimeout(()=>{setGiftMode('manual');const p=getProducts().find(x=>x.id===gift.dataset.giftAdd);if(p)toggleGiftProduct(p.id)},0)}});
  $('randomizeGift').onclick=randomizeGift;
  function toggleGiftProduct(id){const p=getProducts().find(x=>x.id===id);if(!p)return;const i=giftState.items.findIndex(x=>x.productId===id);if(i>=0)giftState.items.splice(i,1);else giftState.items.push({productId:p.id,productName:p.name,price:Number(p.price),quantity:1});renderGiftManualProducts();renderGiftManual()}
  $('giftManualProducts').onclick=e=>{const b=e.target.closest('[data-gift-picker]');if(b){e.preventDefault();toggleGiftProduct(b.dataset.giftPicker)}};
  function addGiftBoxToCart(){
    let items=giftState.items.map(x=>({...x})), total=giftTotal(), mode=giftState.mode;
    if(mode==='budget'){
      const budget=Math.max(0,Number($('giftBudgetOnly').value));
      if(!budget){$('giftError').textContent='Choose a gift box price first.';return false}
      total=budget;items=[];
    }else if(mode==='random' && !items.length){$('giftError').textContent='Generate a surprise box first.';return false}
    else if(mode==='manual' && !items.length){$('giftError').textContent='Add at least one product to the gift box.';return false}
    const id='gift_'+uid();
    const summary=items.length?items.map(x=>`${x.productName} × ${x.quantity}`).join(' · '):(mode==='budget'?'Shop-selected surprise box':'Surprise selection');
    const cart=getCart();
    cart.push({productId:id,productName:`🎁 Gift Box — ${mode==='random'?'Surprise':mode==='manual'?'Custom':'Price Only'}`,price:total,image:'assets/ai/ai-gift-box.jpg',quantity:1,isGiftBox:true,giftMode:mode,giftItems:items,giftSummary:summary});
    saveCart(cart);updateCartBadge();renderCart();$('giftSuccess').textContent='Gift box added to your cart.';toast('Gift box added to cart.');setTimeout(()=>closeModal('modalGiftBox'),650);return true;
  }
  $('giftAddToCartBtn')?.addEventListener('click',e=>{e.preventDefault();addGiftBoxToCart()});
  $('giftOpenCartBtn')?.addEventListener('click',e=>{e.preventDefault();closeModal('modalGiftBox');openCandyCart()});
  function toggleGiftProduct(id){const p=getProducts().find(x=>x.id===id);if(!p)return;const i=giftState.items.findIndex(x=>x.productId===id);if(i>=0)giftState.items.splice(i,1);else giftState.items.push({productId:p.id,productName:p.name,price:Number(p.price),quantity:1});renderGiftManualProducts();renderGiftManual()}
  $('giftManualProducts').onclick=e=>{const b=e.target.closest('[data-gift-picker]');if(b){e.preventDefault();toggleGiftProduct(b.dataset.giftPicker)}};
  updateCartBadge();

  // ROLE KEYS + CUSTOMER ORDERS
  // =========================================================
  const ROLE_KEYS_KEY='candy_role_keys_v1', ORDERS_KEY='candy_orders_v1';
  let roleKeysCache=[], ordersCache=[];
  const getRoleKeys=()=>roleKeysCache, saveRoleKeys=()=>{};
  const getOrders=()=>ordersCache, saveOrders=()=>{};
  const loadRoleKeys=async()=>{try{const d=await api('/api/admin/role-keys');roleKeysCache=Array.isArray(d.keys)?d.keys:[];return roleKeysCache}catch{return roleKeysCache=[]}};
  const loadOrders=async()=>{try{const d=await api('/api/orders');ordersCache=Array.isArray(d.orders)?d.orders:[];return ordersCache}catch{return ordersCache=[]}};
  const roleKey=role=>`${role.toUpperCase()}-${crypto.getRandomValues(new Uint32Array(3)).join('-')}`;
  async function configureDashboardForRole(){
    const s=current(); const owner=s?.role==='owner';
    document.querySelector('#modalAdmin .admin-head h2').textContent=owner?'Owner Dashboard':'Employee Orders';
    const badge=document.querySelector('#modalAdmin .admin-head .role-badge'); badge.textContent=owner?'Owner — INVYX':'Employee'; badge.className='role-badge '+(owner?'owner':'employee');
    // Employees are strictly order-viewing staff. Every other dashboard area is owner-only.
    document.querySelectorAll('#modalAdmin .admin-tab').forEach(x=>{
      const isOrders=x.dataset.tab==='orders';
      x.classList.toggle('is-hidden',!owner && !isOrders);
      x.disabled=!owner && !isOrders;
    });
    document.querySelectorAll('#modalAdmin .admin-panel').forEach(x=>{
      const isOrders=x.id==='panel-orders';
      x.classList.toggle('is-hidden',!owner && !isOrders);
    });
    document.querySelectorAll('.owner-only').forEach(x=>x.classList.toggle('is-hidden',!owner));
    if(!owner){
      document.querySelectorAll('#modalAdmin .admin-tab').forEach(x=>x.classList.remove('active'));
      document.querySelector('[data-tab="orders"]')?.classList.add('active');
      document.querySelectorAll('#modalAdmin .admin-panel').forEach(x=>x.classList.remove('active'));
      document.querySelector('#panel-orders')?.classList.add('active');
    }
    await loadOrders(); if(owner) await loadRoleKeys(); renderOrders(); if(owner) renderKeys();
  }
  const origOpenModal=window.openModal;
  // Existing function is lexical, so dashboard initialization is also triggered on direct dashboard opens.
  document.querySelector('[data-tab="orders"]').addEventListener('click',async()=>{await loadOrders();renderOrders()});
  document.querySelector('[data-tab="keys"]').addEventListener('click',async()=>{await loadRoleKeys();renderKeys()});
  $('refreshOrders').addEventListener('click',async()=>{await loadOrders();renderOrders()});

  function renderOrders(){
    const orders=getOrders().sort((a,b)=>b.createdAt-a.createdAt), box=$('orderList');
    box.innerHTML=orders.length?orders.map(o=>{const label=o.type==='gift_box'?'🎁 Gift Box':o.type==='cart'?'🛒 Cart':`${esc(o.productName)} × ${o.quantity}`;const details=o.items?.length?`<p>${o.items.map(x=>`${esc(x.productName)} × ${x.quantity}`).join(' · ')}</p>`:'';return `<article class="admin-item order-item"><div class="order-top"><div><strong>${label}</strong><small>${esc(o.customerName)} · ${esc(o.phone)}${o.address?' · '+esc(o.address):''}</small></div><span class="order-status ${esc(o.status)}">${esc(o.status)}</span></div><div class="order-meta"><span>${money(o.total)}</span><span>${new Date(o.createdAt).toLocaleString()}</span></div>${details}${o.note?`<p>${esc(o.note)}</p>`:''}${o.giftMessage?`<p>Gift message: ${esc(o.giftMessage)}</p>`:''}${current()?.role==='owner'?`<div class="admin-item-actions"><button data-order-action="status" data-order-id="${esc(o.id)}">${o.status==='new'?'Mark preparing':o.status==='preparing'?'Mark ready':'Mark new'}</button><button data-order-action="delete" data-order-id="${esc(o.id)}">Delete</button></div>`:''}</article>`}).join(''):'<div class="admin-note empty-state">No customer orders yet.</div>';
  }
  $('orderList').addEventListener('click',async e=>{
    const b=e.target.closest('[data-order-action]');if(!b)return;
    if(current()?.role!=='owner'){return;}
    const id=b.dataset.orderId;
    try{if(b.dataset.orderAction==='delete'){if(!confirm('Delete this order?'))return;await api('/api/orders/'+encodeURIComponent(id),{method:'DELETE'})}else{const o=getOrders().find(x=>x.id===id);if(!o)return;const status=o.status==='new'?'preparing':o.status==='preparing'?'ready':'new';await api('/api/orders/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})})}await loadOrders();renderOrders()}catch(err){alert(err.message)}
  });

  function localDateTimeValue(ms){const d=new Date(ms-Date.getTimezoneOffset()*60000);return d.toISOString().slice(0,16)}
  function formatExactDate(ms){return new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeStyle:'short'}).format(new Date(ms))}
  function renderKeys(){const box=$('keyList');if(!box)return;const now=Date.now();const keys=getRoleKeys().filter(k=>!k.used&&k.expiresAt>now);saveRoleKeys(keys);box.innerHTML=keys.length?keys.map(k=>`<article class="admin-item key-item"><div><strong>${esc(k.key)}</strong><small><span class="key-role ${esc(k.role)}">${esc(k.role)}</span> · expires ${esc(formatExactDate(k.expiresAt))}</small></div><div class="admin-item-actions"><button data-key-revoke="${esc(k.key)}">Revoke</button></div></article>`).join(''):'<div class="admin-note empty-state">No active role keys.</div>'}
  const expiryInput=$('keyExpiry'), expiryPreview=$('expiryPreview');
  if(expiryInput){expiryInput.value=localDateTimeValue(Date.now()+24*3600000);const updatePreview=()=>{const ms=expiryInput.value?new Date(expiryInput.value).getTime():NaN;if(!Number.isFinite(ms)){expiryPreview.innerHTML='<span class="expiry-dot"></span><span>Choose a valid expiration time.</span>';return}expiryPreview.innerHTML=ms<=Date.now()?'<span class="expiry-dot expired"></span><span>This expiration time has already passed.</span>':`<span class="expiry-dot"></span><span>Key will expire <strong>${esc(formatExactDate(ms))}</strong></span>`};expiryInput.addEventListener('input',updatePreview);updatePreview()}
  $('keyForm').addEventListener('submit',async e=>{e.preventDefault();const role=$('keyRole').value;const ms=expiryInput?new Date(expiryInput.value).getTime():NaN;const err=$('keyError');if(err)err.textContent='';if(!Number.isFinite(ms)){if(err)err.textContent='Please choose a valid expiration date and time.';return}if(ms<=Date.now()){if(err)err.textContent='Expiration must be in the future.';return}try{const d=await api('/api/admin/role-keys',{method:'POST',body:JSON.stringify({role,expiresAt:ms})});await loadRoleKeys();renderKeys();$('keySaved').textContent=`Generated ${role} key: ${d.key.key} · expires ${formatExactDate(d.key.expiresAt)}`;setTimeout(()=>$('keySaved').textContent='',7000)}catch(e){if(err)err.textContent=e.message}});
  $('keyList').addEventListener('click',async e=>{const b=e.target.closest('[data-key-revoke]');if(!b)return;try{await api('/api/admin/role-keys/'+encodeURIComponent(b.dataset.key),{method:'DELETE'});await loadRoleKeys();renderKeys()}catch(err){alert(err.message)}});

  function openOrder(productId){const p=getProducts().find(x=>x.id===productId);if(!p)return;$('orderProductId').value=p.id;$('orderProductLabel').textContent=`${p.name} · ${money(p.price)}`;$('orderError').textContent='';$('orderSuccess').textContent='';$('orderQty').value=1;openModal('modalOrder');}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-order-product]');if(b)openOrder(b.dataset.orderProduct)});
  $('orderForm').addEventListener('submit',async e=>{e.preventDefault();if(!requireAccount('modalOrder','orderError'))return;const p=getProducts().find(x=>x.id===$('orderProductId').value);if(!p)return;const q=Math.max(1,Number($('orderQty').value));const o={id:uid(),productId:p.id,productName:p.name,price:p.price,quantity:q,total:p.price*q,customerName:$('orderName').value.trim(),phone:$('orderPhone').value.trim(),note:$('orderNote').value.trim(),status:'new',createdAt:Date.now()};if(!o.customerName||!o.phone){$('orderError').textContent='Please enter your name and phone number.';return}try{await api('/api/orders',{method:'POST',body:JSON.stringify(o)});$('orderSuccess').textContent='Order sent to the shop.';e.target.reset();$('orderQty').value=1;setTimeout(()=>closeModal('modalOrder'),900)}catch(err){$('orderError').textContent=err.message||'Could not send order.'}});
  // =========================================================
  // ELITE UX POLISH — lightweight, dependency-free
  // =========================================================
  const toastRoot=document.createElement('div');
  toastRoot.className='toast-stack';
  toastRoot.setAttribute('aria-live','polite');
  toastRoot.setAttribute('aria-atomic','true');
  document.body.appendChild(toastRoot);
  const toast=(message,type='success')=>{
    const el=document.createElement('div');
    el.className=`toast toast-${type}`;
    el.innerHTML=`<span class="toast-icon" aria-hidden="true">${type==='error'?'!':'✓'}</span><span>${esc(message)}</span>`;
    toastRoot.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),220)},2600);
  };

  // Replace native success messages with a polished toast while retaining inline feedback.
  const observeSuccess=(id)=>{
    const target=$(id); if(!target||!window.MutationObserver)return;
    let last='';
    new MutationObserver(()=>{
      const text=target.textContent.trim();
      if(text&&text!==last){last=text;toast(text,'success')}
    }).observe(target,{childList:true,subtree:true,characterData:true});
  };
  ['registerSuccess','orderSuccess','productSaved','categorySaved','bizSaved','keySaved'].forEach(observeSuccess);

  // Accessible modal focus containment. Escape/close behavior remains handled by the existing system.
  let lastFocused=null;
  document.addEventListener('click',e=>{
    const opener=e.target.closest('[data-action="login"],[data-action="register"],[data-open]');
    if(opener) lastFocused=opener;
  },true);
  document.addEventListener('focusin',e=>{
    const modal=visibleModal();
    if(!modal||!modal.contains(e.target))return;
    modal.dataset.lastFocus=e.target.id||'';
  });
  document.addEventListener('keydown',e=>{
    const modal=visibleModal();
    if(!modal||e.key!=='Tab')return;
    const focusables=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);
    if(!focusables.length)return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });

  // Prevent accidental double submissions while preserving normal form behavior.
  document.querySelectorAll('form').forEach(form=>{
    form.addEventListener('submit',()=>{
      const button=form.querySelector('button[type="submit"],button:not([type])');
      if(!button)return;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy','true');
      setTimeout(()=>{button.classList.remove('is-loading');button.removeAttribute('aria-busy')},900);
    });
  });

  // Make external links safe and consistent without changing destinations.
  document.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel=a.rel.includes('noopener')?a.rel:'noopener noreferrer');

  // Give the document a deterministic loading state, avoiding flashes on slower devices.
  document.documentElement.classList.add('app-ready');

  // If an owner/employee opens the dashboard through the account menu, apply the correct permissions.
  const dashBtn=document.querySelector('[data-action="admin"]'); if(dashBtn)dashBtn.addEventListener('click',()=>setTimeout(configureDashboardForRole,0));
  document.querySelectorAll('[data-open="modalAdmin"]').forEach(x=>x.addEventListener('click',()=>setTimeout(configureDashboardForRole,0)));

})();

/* =========================================================
   V13.1 social-link safety + interaction polish
   ========================================================= */
(() => {
  'use strict';
  // Official shop Instagram supplied by the owner.
  const INSTAGRAM_URL='https://www.instagram.com/candy_shop_35/';
  document.querySelectorAll('.social-instagram').forEach(link=>{link.href=INSTAGRAM_URL;link.target='_blank';link.rel='noopener noreferrer';link.classList.add('is-configured')});

  // Micro-feedback on interactive controls without a heavy animation library.
  document.addEventListener('click', e => {
    const el = e.target.closest?.('.btn,.nav-cart-btn,.nav-ig,.account-btn,.modal-close');
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate([{transform:'scale(1)'},{transform:'scale(.985)'},{transform:'scale(1)'}],{duration:150,easing:'cubic-bezier(.22,1,.36,1)'});
  }, {passive:true});
})();

/* V16 — silky micro-interactions */
(function(){
  'use strict';
  function bootMotion(){
    if(document.querySelector('.motion-progress')) return;
    var progress=document.createElement('div');
    progress.className='motion-progress';
    document.body.appendChild(progress);

    var ticking=false;
    function update(){
      ticking=false;
      var max=document.documentElement.scrollHeight-window.innerHeight;
      progress.style.transform='scaleX('+(max>0?Math.min(1,Math.max(0,window.scrollY/max)):0)+')';
    }
    window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
    update();

    /* Pointer light follows instantly, while visual work stays GPU-friendly. */
    var fine=window.matchMedia('(pointer:fine)').matches;
    if(fine){
      document.body.classList.add('has-pointer-glow');
      window.addEventListener('pointermove',function(e){
        document.documentElement.style.setProperty('--mx',e.clientX+'px');
        document.documentElement.style.setProperty('--my',e.clientY+'px');
      },{passive:true});
    }

    /* Tiny tactile ripple on buttons. */
    document.addEventListener('pointerdown',function(e){
      var el=e.target.closest('button,.btn,.gift-mode,.admin-tab');
      if(!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if(getComputedStyle(el).position==='static') el.style.position='relative';
      var r=document.createElement('span'),rect=el.getBoundingClientRect();
      var size=Math.max(rect.width,rect.height)*.55;
      r.className='motion-ripple';
      r.style.width=r.style.height=size+'px';
      r.style.left=(e.clientX-rect.left-size/2)+'px';
      r.style.top=(e.clientY-rect.top-size/2)+'px';
      el.appendChild(r);
      setTimeout(function(){r.remove()},700);
    },{passive:true});

    /* Stagger visible cards for a more editorial entrance. */
    if('IntersectionObserver' in window){
      var items=document.querySelectorAll('.card,.product-card,.visit-item,.stat-card,.gift-cta-card,.gift-callout,.review-summary');
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(!entry.isIntersecting) return;
          var el=entry.target;
          if(!el.dataset.motionSeen){
            el.dataset.motionSeen='1';
            el.animate([
              {opacity:.15,transform:'translate3d(0,18px,0) scale(.985)'},
              {opacity:1,transform:'translate3d(0,0,0) scale(1)'}
            ],{duration:650,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
          }
          io.unobserve(el);
        });
      },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
      items.forEach(function(el){io.observe(el)});
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootMotion); else bootMotion();
})();
