(() => {
const configured = window.SUPABASE_URL?.startsWith("https://") &&
  !window.SUPABASE_URL.includes("PASTE_") &&
  window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes("PASTE_");
const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const warning = document.getElementById("setupWarning");
const loginStatus = document.getElementById("loginStatus");
const editorStatus = document.getElementById("editorStatus");
if (!configured || !window.supabase) { warning.hidden = false; return; }

const db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let products = [];
let selectedId = null;
let pendingPhoto = null;
const $ = id => document.getElementById(id);
const say = (el, message, kind="") => { el.textContent = message; el.className = "status " + kind; };

async function refreshAuth() {
  const {data:{session}} = await db.auth.getSession();
  let isAdmin = false;
  if (session) {
    const {data} = await db.rpc("is_store_admin");
    isAdmin = data === true;
    if (!isAdmin) say(loginStatus,"Этот аккаунт не имеет прав администратора. Войдите под администратором.","error");
  }
  loginPanel.hidden = isAdmin;
  dashboard.hidden = !isAdmin;
  $("authLabel").textContent = isAdmin ? "Вы вошли как администратор" : "Требуется авторизация";
  if (isAdmin) await loadProducts();
}
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault(); say(loginStatus,"Выполняется вход…");
  const {error} = await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if (error) return say(loginStatus,"Не удалось войти. Проверьте email, пароль и настройки Supabase.","error");
  say(loginStatus,"Вход выполнен.","success"); await refreshAuth();
});
$("logoutBtn").addEventListener("click", async () => { await db.auth.signOut(); selectedId=null; await refreshAuth(); });

async function loadProducts() {
  const {data,error} = await db.from("products").select("*").order("created_at",{ascending:true});
  if (error) { say(editorStatus,"Не удалось загрузить товары. Проверьте SQL-настройку и права доступа.","error"); return; }
  products = data || []; renderList();
  if (selectedId && products.some(p=>p.id===selectedId)) fillEditor(products.find(p=>p.id===selectedId));
  else if (products.length) fillEditor(products[0]);
  else clearEditor();
}
function renderList() {
  const root=$("productList"); root.innerHTML="";
  products.forEach(p=>{
    const button=document.createElement("button"); button.type="button"; button.className="product-row"+(p.id===selectedId?" active":"");
    const img=document.createElement(p.image_url?"img":"span");
    if(p.image_url){img.src=p.image_url;img.alt="";} else img.className="thumb";
    const text=document.createElement("span"); const title=document.createElement("b"); title.textContent=p.name;
    const meta=document.createElement("small"); meta.textContent=p.active?"Опубликован":"Скрыт";
    text.append(title,meta);button.append(img,text);button.addEventListener("click",()=>fillEditor(p));root.append(button);
  });
}
function clearEditor() {
 selectedId=null;pendingPhoto=null;$("productId").value="";$("pName").value="";$("pCategory").value="mount";$("pPrice").value="";$("pTag").value="";$("pDescription").value="";$("pImageUrl").value="";$("pActive").checked=true;$("pPhoto").value="";$("photoPreview").hidden=true;$("editorTitle").textContent="Новый товар";$("deleteBtn").hidden=true;renderList();
}
function fillEditor(p) {
 selectedId=p.id;pendingPhoto=null;$("productId").value=p.id;$("pName").value=p.name||"";$("pCategory").value=p.category||"custom";$("pPrice").value=p.price||"";$("pTag").value=p.tag||"";$("pDescription").value=p.description||"";$("pImageUrl").value=p.image_url||"";$("pActive").checked=p.active!==false;$("pPhoto").value="";$("editorTitle").textContent=p.name;$("deleteBtn").hidden=false;
 const img=$("photoPreview");if(p.image_url){img.src=p.image_url;img.hidden=false;}else img.hidden=true;renderList();say(editorStatus,"");
}
$("newBtn").addEventListener("click",clearEditor);
$("pPhoto").addEventListener("change",e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){say(editorStatus,"Разрешены только JPG, PNG и WebP.","error");e.target.value="";return;}
 if(file.size>5*1024*1024){say(editorStatus,"Файл больше 5 МБ. Выберите изображение поменьше.","error");e.target.value="";return;}
 pendingPhoto=file;$("photoPreview").src=URL.createObjectURL(file);$("photoPreview").hidden=false;
});
async function uploadPhoto(file) {
 const ext = file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
 const path=`${crypto.randomUUID()}.${ext}`;
 const {error}=await db.storage.from("product-photos").upload(path,file,{contentType:file.type,upsert:false});
 if(error) throw error;
 const {data}=db.storage.from("product-photos").getPublicUrl(path);
 return data.publicUrl;
}
$("productForm").addEventListener("submit",async e=>{
 e.preventDefault();const save=$("saveBtn");save.disabled=true;say(editorStatus,"Сохраняем товар…");
 try {
   let imageUrl=$("pImageUrl").value.trim();
   if(pendingPhoto) imageUrl=await uploadPhoto(pendingPhoto);
   const payload={name:$("pName").value.trim(),category:$("pCategory").value,price:$("pPrice").value.trim(),tag:$("pTag").value.trim(),description:$("pDescription").value.trim(),image_url:imageUrl||null,active:$("pActive").checked,updated_at:new Date().toISOString()};
   let result;
   if(selectedId) result=await db.from("products").update(payload).eq("id",selectedId).select().single();
   else result=await db.from("products").insert(payload).select().single();
   if(result.error)throw result.error;
   selectedId=result.data.id;pendingPhoto=null;say(editorStatus,"Сохранено. Обновите публичный каталог, чтобы проверить отображение.","success");await loadProducts();
 } catch(err) { console.error(err);say(editorStatus,"Не удалось сохранить. Проверьте подключение, права доступа и настройки Storage.","error"); }
 finally {save.disabled=false;}
});
$("deleteBtn").addEventListener("click",async()=>{
 if(!selectedId||!confirm("Удалить этот товар из каталога?"))return;
 say(editorStatus,"Удаляем…");const {error}=await db.from("products").delete().eq("id",selectedId);
 if(error){say(editorStatus,"Не удалось удалить товар. Проверьте права доступа.","error");return;}
 selectedId=null;await loadProducts();say(editorStatus,"Товар удалён.","success");
});
db.auth.onAuthStateChange((_event,session)=>{loginPanel.hidden=!!session;dashboard.hidden=!session;if(session)loadProducts();});
refreshAuth();
})();