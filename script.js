/*
  Многостраничный магазин: index / catalog / product / about / order.
  Каталог читается из Supabase (если настроен), иначе используются демо-товары.
  Корзина хранится в localStorage и сохраняется при переходах между страницами.
*/
const WORKER_URL = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";
const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("PASTE_");

const db = (hasSupabase && window.supabase) ? window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY) : null;
const page = document.body.dataset.page || "home";
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

const fallbackProducts = [
  {id:"clamps",name:"Струбцины для монтажа дверей",category:"mount",price:"Цена по запросу",tag:"Для монтажа",description:"Помогают фиксировать наличники и детали во время установки. Возможность комплектации уточняется.",image_url:null,active:true},
  {id:"tile-corners",name:"Уголки для плитки под 45°",category:"mount",price:"Цена по запросу",tag:"Отделка",description:"Аксессуары для аккуратной отделки внешних углов плитки с запилом под 45 градусов.",image_url:null,active:true},
  {id:"3d-print",name:"Изделия, напечатанные на 3D-принтере",category:"print",price:"Цена по запросу",tag:"3D-печать",description:"Детали и полезные аксессуары по готовой модели или по вашим размерам и задаче.",image_url:null,active:true},
  {id:"custom",name:"Другие собственные изделия",category:"custom",price:"Рассчитаем стоимость",tag:"Индивидуально",description:"Есть идея или нестандартная задача? Опишите её — обсудим конструкцию, сроки и изготовление.",image_url:null,active:true}
];

/* ---------- Корзина ---------- */
const CART_KEY = "store_cart_v1";
let cart = new Map();
try{
  const raw = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
  cart = new Map(Object.entries(raw).map(([id,v]) => [id,{qty:Math.max(1,+v.qty||1),name:String(v.name||"Изделие")}]));
}catch(e){}
let currentUser = null, syncTimer;
function saveCart(){
  try{localStorage.setItem(CART_KEY,JSON.stringify(Object.fromEntries(cart)));}catch(e){}
  if(currentUser&&db){clearTimeout(syncTimer);syncTimer=setTimeout(pushCart,500);}
}
function cartTotal(){return [...cart.values()].reduce((s,x)=>s+x.qty,0);}
function updateCartCount(){document.querySelectorAll(".cart-count").forEach(el=>el.textContent=cartTotal());}
let toastTimer;
function toast(text){
  let t=$("toast");
  if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");document.body.append(t);}
  t.innerHTML=`<span>${esc(text)}</span><a href="order.html">Перейти к заказу →</a>`;
  requestAnimationFrame(()=>t.classList.add("show"));
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),3800);
}
function addToCart(p){
  const id=String(p.id),cur=cart.get(id);
  cart.set(id,{qty:(cur?.qty||0)+1,name:p.name});
  saveCart();updateCartCount();toast("Добавлено в заказ: "+p.name);
}

/* ---------- Данные ---------- */
const categoryName = c => c==="print"?"3D-ПЕЧАТЬ":c==="custom"?"ИНДИВИДУАЛЬНЫЙ ЗАКАЗ":"МОНТАЖ";
async function loadProducts(){
  let items = fallbackProducts;
  if(db){
    try{
      const {data,error}=await db.from("products").select("id,name,category,price,tag,description,image_url,active").eq("active",true).order("created_at",{ascending:true});
      if(error)throw error;
      items=data||[];
    }catch(err){console.error("Supabase catalog error",err);items=fallbackProducts;}
  }
  return items.filter(p=>p.active!==false);
}
const productUrl = p => "product.html?id="+encodeURIComponent(p.id);

/* ---------- Отрисовка карточек ---------- */
const ART = {
  print:'<div class="print-ring"></div><div class="print-hub"></div><div class="print-blade b1"></div><div class="print-blade b2"></div><div class="print-blade b3"></div><div class="print-blade b4"></div><div class="print-blade b5"></div><div class="print-blade b6"></div>',
  custom:'<span>?</span><i></i><i></i><i></i>',
  corner:'<div></div><div></div><div></div>',
  clamp:'<div class="clamp-bar"></div><div class="clamp-jaw"></div><div class="clamp-foot"></div>'
};
function artKind(p,i){return p.category==="print"?"print":p.category==="custom"?"custom":i%2?"corner":"clamp";}
function buildVisual(p,i,linkTo){
  const kind=artKind(p,i);
  const visual=document.createElement("div");
  visual.className="product-visual visual-"+kind;
  const tag=document.createElement("span");tag.className="product-tag";tag.textContent=p.tag||"Изделие";
  if(linkTo){const a=document.createElement("a");a.className="visual-link";a.href=linkTo;a.setAttribute("aria-label",p.name);visual.append(a);}
  if(p.image_url){
    const img=document.createElement("img");img.src=p.image_url;img.alt=p.name;img.loading="lazy";img.className="product-photo";
    img.onerror=()=>{img.remove();const art=document.createElement("div");art.className=kind+"-art";art.innerHTML=ART[kind];visual.prepend(art);};
    visual.prepend(img);
  }else{
    const art=document.createElement("div");art.className=kind+"-art";art.innerHTML=ART[kind];visual.prepend(art);
  }
  const caption=document.createElement("span");caption.className="visual-caption";caption.textContent=categoryName(p.category);
  visual.append(tag,caption);
  return visual;
}
function buildCard(p,i){
  const card=document.createElement("article");
  card.className="product-card";card.dataset.category=p.category||"custom";card.dataset.id=p.id;
  const url=productUrl(p);
  const info=document.createElement("div");info.className="product-info";
  info.innerHTML=`<p class="product-type">${String(i+1).padStart(2,"0")} / ${esc(categoryName(p.category))}</p><h3><a href="${url}">${esc(p.name)}</a></h3><p>${esc(p.description)}</p><div class="product-bottom"><span class="price">${esc(p.price||"Цена по запросу")}</span><button class="btn btn-small add-to-cart" type="button">В заказ <span>＋</span></button></div>`;
  info.querySelector(".add-to-cart").addEventListener("click",()=>addToCart(p));
  card.append(buildVisual(p,i,url),info);
  return card;
}
function fillGrid(grid,items,allItems){
  grid.innerHTML="";
  if(!items.length){grid.innerHTML='<p class="empty-note">В этой категории пока нет изделий.</p>';return;}
  items.forEach(p=>grid.append(buildCard(p,allItems.indexOf(p))));
}

/* ---------- Меню ---------- */
(function initNav(){
  const toggle=$("menuToggle"),nav=$("mainNav");
  if(!toggle||!nav)return;
  toggle.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
  const here=location.pathname.split("/").pop()||"index.html";
  nav.querySelectorAll("a").forEach(a=>{
    const target=a.getAttribute("href").split("?")[0];
    if(target===here||(here==="product.html"&&target==="catalog.html"))a.classList.add("current");
  });
  updateCartCount();
})();

/* ---------- Страницы ---------- */
async function initHome(){
  const grid=$("productGrid");if(!grid)return;
  const items=await loadProducts();
  fillGrid(grid,items.slice(0,4),items);
}
async function initCatalog(){
  const grid=$("productGrid");
  const items=await loadProducts();
  const params=new URLSearchParams(location.search);
  let filter=params.get("cat")||"all";
  const buttons=[...document.querySelectorAll(".filter")];
  if(!buttons.some(b=>b.dataset.filter===filter))filter="all";
  function apply(f){
    buttons.forEach(b=>b.classList.toggle("active",b.dataset.filter===f));
    fillGrid(grid,f==="all"?items:items.filter(p=>(p.category||"custom")===f),items);
  }
  buttons.forEach(b=>b.addEventListener("click",()=>{
    const f=b.dataset.filter;apply(f);
    try{history.replaceState(null,"",f==="all"?"catalog.html":"catalog.html?cat="+f);}catch(e){}
  }));
  apply(filter);
}
async function initProduct(){
  const root=$("productPage");
  const id=new URLSearchParams(location.search).get("id");
  const items=await loadProducts();
  const idx=items.findIndex(p=>String(p.id)===String(id));
  if(idx<0){
    root.innerHTML='<p class="empty-note">Такое изделие не найдено — возможно, оно скрыто или удалено.</p><p><a class="btn btn-yellow" href="catalog.html">Вернуться в каталог</a></p>';
    document.title="Изделие не найдено — Мастерская";return;
  }
  const p=items[idx];
  document.title=p.name+" — Мастерская";
  const desc=document.querySelector('meta[name="description"]');if(desc)desc.content=(p.description||"").slice(0,160);
  const crumbs=$("crumbName");if(crumbs)crumbs.textContent=p.name;
  const titleEl=$("heroTitle");if(titleEl)titleEl.textContent=p.name;

  const wrap=document.createElement("div");wrap.className="pd-visual-wrap";
  wrap.append(buildVisual(p,idx,null));
  const info=document.createElement("div");info.className="pd-info";
  const custom=p.category==="custom";
  info.innerHTML=`<p class="product-type">${String(idx+1).padStart(2,"0")} / ${esc(categoryName(p.category))}</p>
    <h2>${esc(p.name)}</h2>
    <p class="pd-desc">${esc(p.description)}</p>
    <div class="pd-price"><small>ЦЕНА</small><b>${esc(p.price||"Цена по запросу")}</b></div>
    <div class="pd-actions"><button class="btn btn-yellow" id="pdAdd" type="button">${custom?"Обсудить":"Добавить в заказ"} <span>＋</span></button><a class="btn btn-ghost" href="order.html">Перейти к заказу</a></div>
    <ul class="pd-steps"><li><span class="mini-icon">01</span>Добавьте изделие в заказ</li><li><span class="mini-icon">02</span>Опишите размеры, количество и пожелания</li><li><span class="mini-icon">03</span>Мы подтвердим стоимость и сроки</li></ul>`;
  const layout=document.createElement("div");layout.className="pd";layout.append(wrap,info);
  root.innerHTML="";root.append(layout);
  $("pdAdd").addEventListener("click",()=>addToCart(p));

  const others=items.filter((_,i)=>i!==idx).slice(0,3);
  if(others.length){
    const rel=document.createElement("div");rel.className="related";
    rel.innerHTML='<h3>Другие изделия</h3><div class="product-grid" id="relatedGrid"></div>';
    root.append(rel);
    fillGrid($("relatedGrid"),others,items);
  }
}
function renderCart(){
  const box=$("selectedItems");if(!box)return;
  box.innerHTML="";
  if(!cart.size){box.innerHTML='<span class="empty-cart">Пока ничего не выбрано — <a href="catalog.html" style="text-decoration:underline">добавьте изделие из каталога</a>.</span>';updateCartCount();return;}
  for(const [id,item] of cart){
    const row=document.createElement("div");row.className="selected-line";
    const name=document.createElement("a");name.href="product.html?id="+encodeURIComponent(id);name.textContent=item.name;
    const ctrl=document.createElement("span");ctrl.className="qty";
    const minus=document.createElement("button");minus.type="button";minus.textContent="−";minus.setAttribute("aria-label","Меньше");
    const q=document.createElement("b");q.textContent=item.qty;
    const plus=document.createElement("button");plus.type="button";plus.textContent="+";plus.setAttribute("aria-label","Больше");
    const remove=document.createElement("button");remove.type="button";remove.textContent="Убрать";remove.style.cssText="width:auto;border:0;background:transparent;color:#8b6f00;font-weight:800;font-size:16px;padding:0 4px";
    minus.addEventListener("click",()=>{if(item.qty>1){item.qty--;}else{cart.delete(id);}saveCart();renderCart();});
    plus.addEventListener("click",()=>{item.qty++;saveCart();renderCart();});
    remove.addEventListener("click",()=>{cart.delete(id);saveCart();renderCart();});
    ctrl.append(minus,q,plus,remove);
    row.append(name,ctrl);box.append(row);
  }
  updateCartCount();
}
async function initOrder(){
  const form=$("orderForm"),statusBox=$("formStatus");
  await authReady;
  renderCart();
  const hint=$("accountHint");
  if(currentUser){
    const nm=form.elements.name,em=form.elements.email;
    if(nm&&!nm.value)nm.value=currentUser.user_metadata?.name||"";
    if(em&&!em.value)em.value=currentUser.email||"";
    if(hint)hint.innerHTML="Вы вошли как <b>"+esc(currentUser.email)+"</b>. Заказ сохранится в вашей <a href=\"account.html\">истории заказов</a>.";
  }else if(hint&&db){
    hint.innerHTML='<a href="account.html">Войдите или зарегистрируйтесь</a>, чтобы заказ сохранился в истории, а корзина — на всех устройствах. Можно и без аккаунта.';
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();statusBox.className="form-status";statusBox.textContent="";
    if(!cart.size){statusBox.classList.add("error");statusBox.textContent="Сначала добавьте хотя бы одно изделие в заказ.";return;}
    if(!WORKER_URL.startsWith("https://")||WORKER_URL.includes("PASTE_")){
      statusBox.classList.add("error");statusBox.textContent="Отправка в Telegram ещё не подключена. Завершите настройку Worker по инструкции README.";return;
    }
    const data=new FormData(form);
    const order={name:String(data.get("name")||"").trim(),contact:String(data.get("contact")||"").trim(),email:String(data.get("email")||"").trim(),comment:String(data.get("comment")||"").trim(),items:[...cart.values()].map(x=>({name:x.name,quantity:x.qty})),consent:data.get("consent")==="on"};
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent="Отправляем заявку…";
    try{
      const response=await fetch(WORKER_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(order)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok)throw new Error(result.error||"Не удалось отправить заявку.");
      let saved=false;
      if(currentUser&&db){
        const {error:dbErr}=await db.from("orders").insert({name:order.name,contact:order.contact,email:order.email,comment:order.comment,items:[...cart.entries()].map(([id,x])=>({id,name:x.name,quantity:x.qty}))});
        if(dbErr)console.error("Order history save error",dbErr);else saved=true;
      }
      statusBox.classList.add("success");
      statusBox.innerHTML="Заявка отправлена! Мы получили её в Telegram. Спасибо."+(saved?' Заказ сохранён в <a href="account.html" style="text-decoration:underline">истории заказов</a>.':"");
      form.reset();cart.clear();saveCart();renderCart();
    }catch(error){statusBox.classList.add("error");statusBox.textContent="Не получилось отправить заявку. Попробуйте позже. "+(error.message||"");}
    finally{submit.disabled=false;submit.innerHTML='Отправить заявку в Telegram <span>↗</span>';}
  });
}


/* ---------- Аккаунт ---------- */
let recovery = location.hash.includes("type=recovery");
async function pushCart(){
  if(!currentUser||!db)return;
  try{await db.from("carts").upsert({user_id:currentUser.id,items:Object.fromEntries(cart),updated_at:new Date().toISOString()});}
  catch(e){console.error("Cart sync error",e);}
}
async function pullCart(merge){
  const {data,error}=await db.from("carts").select("items").eq("user_id",currentUser.id).maybeSingle();
  if(error){console.error("Cart load error",error);return;}
  if(!data){if(cart.size)await pushCart();return;}
  if(!merge)cart=new Map();
  for(const [id,v] of Object.entries(data.items||{})){
    const qty=Math.max(1,+v.qty||1),cur=cart.get(id);
    cart.set(id,{qty:Math.max(qty,cur?.qty||0),name:String(v.name||cur?.name||"Изделие")});
  }
  saveCart();updateCartCount();
}
function updateNavAccount(){
  const a=$("navAccount");if(!a)return;
  a.textContent=currentUser?"Кабинет":"Войти";
  a.hidden=!db;
}
async function initAuth(){
  if(!db){updateNavAccount();return;}
  db.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY"){recovery=true;if(page==="account")renderAccount();}});
  try{
    const {data:{session}}=await db.auth.getSession();
    currentUser=session?.user||null;
    if(currentUser)await pullCart(false);
  }catch(e){console.error("Auth init error",e);}
  updateNavAccount();updateCartCount();
}
const authReady=initAuth();
async function afterSignIn(user){
  currentUser=user;await pullCart(true);updateNavAccount();updateCartCount();
}
async function signOut(){
  try{await db.auth.signOut();}catch(e){}
  currentUser=null;cart=new Map();
  try{localStorage.removeItem(CART_KEY);}catch(e){}
  updateNavAccount();updateCartCount();
}
const say=(el,text,kind)=>{el.className="form-status"+(kind?" "+kind:"");el.textContent=text;};
const ORDER_STATUS={new:"Заявка отправлена"};
function renderAccount(){
  const root=$("accountRoot");if(!root)return;
  if(!db){root.innerHTML='<p class="empty-note">Личный кабинет пока недоступен: не подключена база данных (supabase-config.js).</p>';return;}
  if(recovery&&currentUser){
    root.innerHTML=`<form class="order-form acc-form" id="recForm"><h3>Новый пароль</h3><label>Новый пароль<input type="password" name="p" minlength="6" required autocomplete="new-password"></label><button class="btn btn-yellow submit-btn" type="submit">Сохранить пароль</button><p class="form-status" id="recStatus" role="status"></p></form>`;
    $("recForm").addEventListener("submit",async e=>{
      e.preventDefault();const st=$("recStatus");
      const {error}=await db.auth.updateUser({password:e.target.p.value});
      if(error)return say(st,"Не удалось изменить пароль: "+error.message,"error");
      recovery=false;history.replaceState(null,"","account.html");renderAccount();
    });
    return;
  }
  if(!currentUser){
    root.innerHTML=`<div class="acc-tabs"><button class="filter active" data-tab="login" type="button">Вход</button><button class="filter" data-tab="register" type="button">Регистрация</button></div>
    <form class="order-form acc-form" id="loginForm"><h3>Войти в кабинет</h3>
      <label>Email<input type="email" name="email" required autocomplete="email"></label>
      <label>Пароль<input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn btn-yellow submit-btn" type="submit">Войти <span>↗</span></button>
      <button class="link-btn" id="forgotBtn" type="button">Забыли пароль?</button>
      <p class="form-status" id="loginStatus" role="status"></p></form>
    <form class="order-form acc-form" id="regForm" hidden><h3>Создать аккаунт</h3>
      <label>Имя<input name="name" autocomplete="name" maxlength="100" placeholder="Как к вам обращаться"></label>
      <label>Email *<input type="email" name="email" required autocomplete="email"></label>
      <label>Пароль * (минимум 6 символов)<input type="password" name="password" minlength="6" required autocomplete="new-password"></label>
      <label>Повторите пароль *<input type="password" name="password2" minlength="6" required autocomplete="new-password"></label>
      <button class="btn btn-yellow submit-btn" type="submit">Зарегистрироваться <span>↗</span></button>
      <p class="form-status" id="regStatus" role="status"></p></form>`;
    const tabs=[...root.querySelectorAll(".acc-tabs .filter")],lf=$("loginForm"),rf=$("regForm");
    tabs.forEach(t=>t.addEventListener("click",()=>{tabs.forEach(x=>x.classList.toggle("active",x===t));lf.hidden=t.dataset.tab!=="login";rf.hidden=t.dataset.tab!=="register";}));
    lf.addEventListener("submit",async e=>{
      e.preventDefault();const st=$("loginStatus");say(st,"Входим…");
      const {data,error}=await db.auth.signInWithPassword({email:lf.email.value.trim(),password:lf.password.value});
      if(error)return say(st,"Не удалось войти. Проверьте email и пароль. Если вы только что зарегистрировались — подтвердите почту по ссылке из письма.","error");
      await afterSignIn(data.user);renderAccount();
    });
    $("forgotBtn").addEventListener("click",async()=>{
      const st=$("loginStatus"),email=lf.email.value.trim();
      if(!email)return say(st,"Введите email выше, и мы отправим ссылку для смены пароля.","error");
      const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:new URL("account.html",location.href).href});
      if(error)return say(st,"Не удалось отправить письмо: "+error.message,"error");
      say(st,"Если такой аккаунт есть, мы отправили письмо со ссылкой для смены пароля.","success");
    });
    rf.addEventListener("submit",async e=>{
      e.preventDefault();const st=$("regStatus");
      if(rf.password.value!==rf.password2.value)return say(st,"Пароли не совпадают.","error");
      say(st,"Создаём аккаунт…");
      const {data,error}=await db.auth.signUp({email:rf.email.value.trim(),password:rf.password.value,options:{data:{name:rf.name.value.trim()},emailRedirectTo:new URL("account.html",location.href).href}});
      if(error)return say(st,"Не удалось зарегистрироваться: "+error.message,"error");
      if(data.session){await afterSignIn(data.user);renderAccount();}
      else say(st,"Мы отправили письмо на "+rf.email.value.trim()+". Перейдите по ссылке в письме, чтобы подтвердить почту, затем войдите.","success");
    });
    return;
  }
  const name=currentUser.user_metadata?.name;
  root.innerHTML=`<div class="acc-grid"><aside class="acc-side"><p class="eyebrow dark">АККАУНТ</p><h3>${esc(name||"Мой кабинет")}</h3><p class="acc-mail">${esc(currentUser.email)}</p>
    <a class="btn btn-yellow" href="order.html">Моя корзина: <span class="cart-count">${cartTotal()}</span></a>
    <button class="btn btn-ghost" id="logoutBtn" type="button">Выйти</button></aside>
    <div class="acc-orders"><h3>История заказов</h3><div id="ordersList"><p class="empty-note">Загружаем…</p></div></div></div>`;
  $("logoutBtn").addEventListener("click",async()=>{await signOut();renderAccount();});
  loadOrders();
}
async function loadOrders(){
  const box=$("ordersList");
  const {data,error}=await db.from("orders").select("id,items,comment,status,created_at").order("created_at",{ascending:false}).limit(50);
  if(error){console.error(error);box.innerHTML='<p class="empty-note">Не удалось загрузить историю заказов. Проверьте, что выполнен supabase-accounts.sql.</p>';return;}
  if(!data.length){box.innerHTML='<p class="empty-note">Заказов пока нет. <a href="catalog.html" style="text-decoration:underline">Выбрать изделие</a></p>';return;}
  box.innerHTML="";
  data.forEach(o=>{
    const el=document.createElement("article");el.className="order-card";
    const items=(o.items||[]).map(it=>`<li>${it.id?`<a href="product.html?id=${encodeURIComponent(it.id)}">${esc(it.name)}</a>`:esc(it.name)} × ${esc(it.quantity)}</li>`).join("");
    el.innerHTML=`<div class="order-card-head"><b>Заказ №${esc(String(o.id).slice(0,8).toUpperCase())}</b><span class="order-status">${esc(ORDER_STATUS[o.status]||o.status)}</span></div><p class="order-date">${esc(new Date(o.created_at).toLocaleString("ru-RU",{dateStyle:"long",timeStyle:"short"}))}</p><ul>${items}</ul>${o.comment?`<p class="order-comment">${esc(o.comment)}</p>`:""}`;
    box.append(el);
  });
}
async function initAccount(){await authReady;renderAccount();}

if(page==="home")initHome();
else if(page==="catalog")initCatalog();
else if(page==="product")initProduct();
else if(page==="order")initOrder();
else if(page==="account")initAccount();
