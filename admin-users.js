(() => {
  const $ = id => document.getElementById(id);
  const panel = $("usersPanel");
  if (!panel || !window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  let users = [], selectedId = null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {dateStyle:"medium",timeStyle:"short"}) : "—";
  const say = (message, kind="") => { $("usersStatus").textContent=message; $("usersStatus").className="status "+kind; };
  async function api(action, extra={}) {
    const {data:{session}} = await db.auth.getSession();
    if (!session) throw new Error("Войдите в админку заново.");
    const response = await fetch(window.SUPABASE_URL + "/functions/v1/admin-users", {
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":window.SUPABASE_ANON_KEY,"Authorization":"Bearer "+session.access_token},
      body:JSON.stringify({action,...extra})
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
    return data;
  }
  function renderList() {
    const q=$("userSearch").value.trim().toLowerCase();
    const filtered=users.filter(u=>[u.email,u.name,u.id].some(v=>String(v||"").toLowerCase().includes(q)));
    $("usersCount").textContent=users.length;
    $("usersFiltered").textContent=filtered.length===users.length?"":"Найдено: "+filtered.length;
    const root=$("usersList"); root.replaceChildren();
    if(!filtered.length){root.innerHTML='<p class="muted">Пользователи не найдены.</p>';return;}
    filtered.forEach(u=>{
      const b=document.createElement("button");b.type="button";b.className="user-row"+(u.id===selectedId?" active":"");
      const banned=u.banned_until&&new Date(u.banned_until)>new Date();
      b.innerHTML='<span class="user-row-main"><b>'+esc(u.name||u.email||"Без имени")+'</b><small>'+esc(u.email)+'</small><small>Регистрация: '+esc(fmt(u.created_at))+'</small></span><span class="user-row-meta"><b>'+u.cart_items_count+' шт.</b><small>в корзине</small><small>'+u.order_count+' заказов</small><small>'+(banned?"Заблокирован":"Активен")+'</small></span>';
      b.addEventListener("click",()=>loadDetail(u.id));root.append(b);
    });
  }
  async function loadUsers() {
    $("refreshUsersBtn").disabled=true;say("Загружаем список пользователей…");
    try {const data=await api("list");users=data.users||[];renderList();say("Зарегистрировано пользователей: "+data.total,"success");if(selectedId&&users.some(u=>u.id===selectedId))await loadDetail(selectedId,true);}
    catch(e){say(e.message,"error");}
    finally{$("refreshUsersBtn").disabled=false;}
  }
  async function loadDetail(id, quiet=false) {
    selectedId=id;renderList();$("userDetail").innerHTML='<p class="muted">Загрузка профиля…</p>';
    try {
      const data=await api("detail",{userId:id}),u=data.user,items=data.cart.items||[],orders=data.orders||[];
      const banned=u.banned_until&&new Date(u.banned_until)>new Date();
      const cartHtml=items.length?'<ul class="user-cart-items">'+items.map(i=>'<li>'+(i.product?.image_url?'<img src="'+esc(i.product.image_url)+'" alt="">':'')+'<span><b>'+esc(i.product?.name||i.name)+'</b><small>Количество: '+i.quantity+(i.product?.price?' · Цена сейчас: '+esc(i.product.price):'')+'</small><small>ID товара: '+esc(i.id)+'</small></span></li>').join("")+'</ul>':'<p class="muted">Корзина пуста или ещё не синхронизирована. Корзина гостя хранится в браузере и здесь не видна.</p>';
      const priceValues=items.map(i=>{const p=String(i.product?.price||"").trim();if(!p||/от|запрос|договор|уточн/i.test(p))return null;const digits=p.replace(/[^0-9]/g,"");return digits?Number(digits):null;});
      const cartSummary=items.length&&priceValues.every(v=>v!==null)?'<p class="cart-total"><b>Итого по текущим ценам:</b> '+items.reduce((sum,item,i)=>sum+item.quantity*priceValues[i],0).toLocaleString("ru-RU")+'</p>':'<p class="muted">Итог не рассчитан: цены текстовые или указаны «по запросу».</p>';
      const ordersHtml=orders.length?orders.map(o=>'<article class="user-order"><div><b>Заказ '+esc(String(o.id).slice(0,8).toUpperCase())+'</b><small>'+esc(fmt(o.created_at))+' · '+esc(o.status)+'</small></div><p><b>Имя:</b> '+esc(o.name)+' · <b>Email:</b> '+esc(o.email)+'</p><p><b>Контакт:</b> '+esc(o.contact)+'</p>'+(o.comment?'<p><b>Комментарий:</b> '+esc(o.comment)+'</p>':'')+'<ul>'+((o.items||[]).map(i=>'<li>'+esc(i.name)+' × '+esc(i.quantity)+'</li>').join(""))+'</ul></article>').join(""):'<p class="muted">Заказов нет.</p>';
      $("userDetail").innerHTML='<div class="user-detail-head"><div><p class="eyebrow">ПРОФИЛЬ ПОКУПАТЕЛЯ</p><h3>'+esc(u.name||"Без имени")+'</h3><p>'+esc(u.email)+'</p><small>ID: '+esc(u.id)+'</small></div><span class="status-pill">'+(banned?"ЗАБЛОКИРОВАН":"АКТИВЕН")+'</span></div><div class="user-facts"><div><small>Регистрация</small><b>'+esc(fmt(u.created_at))+'</b></div><div><small>Последний вход</small><b>'+esc(fmt(u.last_sign_in_at))+'</b></div><div><small>Корзина обновлена</small><b>'+esc(fmt(data.cart.updated_at))+'</b></div><div><small>Товаров в корзине</small><b>'+items.reduce((n,i)=>n+i.quantity,0)+'</b></div><div><small>Заказов</small><b>'+orders.length+'</b></div></div><div class="user-actions"><button class="btn btn-outline" id="toggleBanBtn">'+(banned?"Разблокировать":"Заблокировать")+'</button><button class="btn btn-danger" id="deleteUserBtn">Удалить аккаунт</button></div><h3>Корзина покупателя</h3>'+cartHtml+cartSummary+'<h3>История заказов ('+orders.length+')</h3>'+ordersHtml;
      $("toggleBanBtn").addEventListener("click",async()=>{if(!confirm(banned?"Разблокировать пользователя?":"Заблокировать вход для этого пользователя?"))return;try{await api(banned?"unban":"ban",{userId:id});say(banned?"Аккаунт разблокирован.":"Аккаунт заблокирован.","success");await loadUsers();await loadDetail(id,true);}catch(e){say(e.message,"error");}});
      $("deleteUserBtn").addEventListener("click",async()=>{if(!confirm("Удалить аккаунт, корзину И ВСЕ заказы этого пользователя? Это действие необратимо."))return;try{await api("delete",{userId:id});selectedId=null;$("userDetail").innerHTML='<p class="muted">Аккаунт удалён.</p>';say("Аккаунт, корзина и заказы удалены.","success");await loadUsers();}catch(e){say(e.message,"error");}});
      if(!quiet)say("Профиль загружен.","success");
    } catch(e) {$("userDetail").innerHTML='<p class="status error">'+esc(e.message)+'</p>';say(e.message,"error");}
  }
  async function checkAccess() {
    try {const {data:{session}}=await db.auth.getSession();if(!session){panel.hidden=true;return;}const {data,error}=await db.rpc("is_store_admin");panel.hidden=!!error||data!==true;if(!panel.hidden)await loadUsers();}
    catch(_){panel.hidden=true;}
  }
  $("refreshUsersBtn").addEventListener("click",loadUsers);
  $("userSearch").addEventListener("input",renderList);
  db.auth.onAuthStateChange(()=>{setTimeout(checkAccess,0);});
  checkAccess();
})();