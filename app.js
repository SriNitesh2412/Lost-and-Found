import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,updateProfile} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,query,where,orderBy,limit,startAfter,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getStorage,ref,uploadBytes,getDownloadURL} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {firebaseConfig} from "./firebase-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),st=getStorage(app);
const $=s=>document.querySelector(s),A=$("#app");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=m=>{const t=$("#toast");t.textContent=m;t.className="show";setTimeout(()=>t.className="",2800)};
const fmt=t=>t?.toDate?t.toDate().toLocaleDateString():"";
const DEF_CATS=["Electronics","Books","ID / Cards","Keys","Clothing","Bags","Accessories","Other"];
let me=null,profile=null,cats=DEF_CATS,page={cursor:null,all:[]};
const isAdmin=()=>profile?.role==="admin";
const snap=async q=>(await getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
const notify=(uid,text,link)=>addDoc(collection(db,"notifications"),{uid,text,link,read:false,createdAt:serverTimestamp()});
const busy=(b,on)=>{b.disabled=on;b.dataset.t=b.dataset.t||b.textContent;b.textContent=on?"Please wait…":b.dataset.t};
const guard=async(e,fn)=>{e.preventDefault();const b=e.target.querySelector("[type=submit]")||e.submitter;b&&busy(b,true);try{await fn()}catch(x){toast(x.message.replace("Firebase: ",""))}b&&busy(b,false)};

/* theme */
document.documentElement.dataset.theme=localStorage.theme||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
window.toggleTheme=()=>{const t=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=t;localStorage.theme=t};

/* nav */
async function nav(){
  let n=0;if(me)try{n=(await snap(query(collection(db,"notifications"),where("uid","==",me.uid),where("read","==",false)))).length}catch{}
  $("#nav").innerHTML=`<a class="logo" href="#/">🔎 CampusFind</a><a href="#/browse">Browse</a>`+(me?
  `<a href="#/dashboard">Dashboard</a><a href="#/report/lost">Report Lost</a><a href="#/report/found">Report Found</a><a href="#/mine">My Reports</a><a href="#/claims">My Claims</a><a href="#/notifications">🔔${n?` (${n})`:""}</a>${isAdmin()?'<a href="#/admin">Admin</a>':""}<a href="#/profile">Profile</a><a href="#" id="lo">Logout</a>`
  :`<a href="#/login">Login</a><a class="btn" href="#/register">Register</a>`)+`<a href="#" onclick="toggleTheme();return false">🌓</a>`;
  $("#lo")?.addEventListener("click",e=>{e.preventDefault();signOut(auth)});
}

/* router */
const routes={"":home,login,register,browse,dashboard,mine,claims,profile,admin,notifications,"report":reportForm,"item":itemPage};
async function route(){
  const [p,arg]=location.hash.replace("#/","").split("/");
  const protectedR=!["","login","register","browse"].includes(p);
  if(protectedR&&!me){location.hash="#/login";return}
  A.innerHTML='<div class="load">Loading…</div>';
  try{await (routes[p]||home)(arg)}catch(e){A.innerHTML=`<div class="empty">⚠️ ${esc(e.message)}<br><br><button class="btn" onclick="location.reload()">Retry</button></div>`}
  nav();
}
addEventListener("hashchange",route);
onAuthStateChanged(auth,async u=>{
  me=u;profile=null;
  if(u){const d=await getDoc(doc(db,"users",u.uid));profile=d.exists()?d.data():null;
    try{const c=await snap(query(collection(db,"categories"),orderBy("name")));if(c.length)cats=c.map(x=>x.name)}catch{}}
  route();
});

/* cards */
const card=i=>`<div class="card item"><img src="${esc(i.image)||""}" alt="" onerror="this.outerHTML='<div class=ph></div>'"><div>
<span class="badge ${i.status==="returned"?"returned":i.type}">${i.status==="returned"?"RETURNED":i.type.toUpperCase()}</span>
<h3 style="margin:8px 0 4px">${esc(i.name)}</h3><div class="mut">${esc(i.category)} · ${esc(i.location)}<br>${esc(i.date)}</div>
<p><a class="btn" href="#/item/${i.id}">View Details</a></p></div></div>`;

/* pages */
function home(){
  A.innerHTML=`<section class="hero"><h1>Lost Something? Find It Here!</h1><p>The smart way for students to report, find and return belongings on campus.</p>
  <p><a class="btn" href="#/report/lost">I lost something</a> <a class="btn alt" style="color:#fff;border-color:#fff" href="#/report/found">I found something</a></p></section>
  <h2>Recently added</h2><div id="rec" class="load">Loading…</div>`;
  if(!me){$("#rec").innerHTML='<div class="empty"><a href="#/login">Login</a> to see recent items.</div>';return}
  snap(query(collection(db,"items"),orderBy("createdAt","desc"),limit(8))).then(l=>{
    l=l.filter(i=>i.status!=="removed");$("#rec").className=l.length?"grid":"empty";$("#rec").innerHTML=l.length?l.map(card).join(""):"No items yet."})
}
function authForm(kind){
  const reg=kind==="register";
  A.innerHTML=`<h1>${reg?"Student Registration":"Login"}</h1><form id="f">
  ${reg?'<label>Full name<input name="name" required minlength="2"></label><label>Phone (private)<input name="phone" pattern="[0-9+ ]{8,15}" required></label>':""}
  <label>Email<input name="email" type="email" required></label><label>Password<input name="pw" type="password" minlength="6" required></label>
  <button class="btn" type="submit">${reg?"Create account":"Login"}</button>
  ${reg?"":'<a href="#" id="fp">Forgot password?</a>'}</form>`;
  $("#fp")?.addEventListener("click",async e=>{e.preventDefault();const m=$("[name=email]").value;if(!m)return toast("Enter your email first");try{await sendPasswordResetEmail(auth,m);toast("Reset email sent")}catch(x){toast(x.message)}});
  $("#f").onsubmit=e=>guard(e,async()=>{const f=Object.fromEntries(new FormData(e.target));
    if(reg){const c=await createUserWithEmailAndPassword(auth,f.email,f.pw);await updateProfile(c.user,{displayName:f.name});
      await setDoc(doc(db,"users",c.user.uid),{name:f.name,email:f.email,phone:f.phone,role:"student",createdAt:serverTimestamp()});profile={name:f.name,email:f.email,phone:f.phone,role:"student"}}
    else await signInWithEmailAndPassword(auth,f.email,f.pw);
    location.hash="#/dashboard"});
}
function login(){authForm("login")}function register(){authForm("register")}

function reportForm(type){
  if(!["lost","found"].includes(type))type="lost";
  A.innerHTML=`<h1>Report ${type} item</h1><form id="f">
  <label>Item name<input name="name" required minlength="2" maxlength="60"></label>
  <label>Category<select name="category">${cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select></label>
  <label>Description<textarea name="desc" required minlength="10" maxlength="500" rows="3"></textarea></label>
  <label>Date ${type}<input name="date" type="date" required max="${new Date().toISOString().slice(0,10)}"></label>
  <label>Location ${type}<input name="location" required></label>
  <label>Photograph (max 3 MB)<input name="img" type="file" accept="image/*"></label>
  <label>Contact details (kept private)<input name="contact" required value="${esc(profile?.phone||"")}"></label>
  <button class="btn" type="submit">Submit report</button></form>`;
  $("#f").onsubmit=e=>guard(e,async()=>{
    const f=Object.fromEntries(new FormData(e.target)),file=$("[name=img]").files[0];
    if(file&&file.size>3*1024*1024)throw new Error("Image must be under 3 MB");
    const dup=await snap(query(collection(db,"items"),where("ownerId","==",me.uid),where("name","==",f.name.trim()),where("date","==",f.date)));
    if(dup.length)throw new Error("You already reported this item for that date");
    let image="";if(file){const r=ref(st,`items/${me.uid}/${Date.now()}_${file.name.replace(/\W/g,"_")}`);await uploadBytes(r,file);image=await getDownloadURL(r)}
    const d=await addDoc(collection(db,"items"),{type,name:f.name.trim(),nameLower:f.name.trim().toLowerCase(),category:f.category,description:f.desc.trim(),date:f.date,location:f.location.trim(),image,status:"active",ownerId:me.uid,ownerName:profile?.name||me.displayName,createdAt:serverTimestamp()});
    await setDoc(doc(db,"items",d.id,"private","contact"),{contact:f.contact.trim()});
    toast("Report submitted!");location.hash="#/item/"+d.id});
}

async function browse(){
  page={cursor:null,all:[],done:false};
  A.innerHTML=`<h1>Browse Items</h1><div class="filters card">
  <input id="q" placeholder="Search by item name"><select id="c"><option value="">All categories</option>${cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
  <input id="l" placeholder="Location"><input id="d" type="date"><select id="t"><option value="">Lost & Found</option><option value="lost">Lost</option><option value="found">Found</option></select>
  <select id="s"><option value="new">Newest first</option><option value="old">Oldest first</option></select></div>
  <div id="list" class="grid"></div><div id="more" class="row" style="justify-content:center"></div>`;
  if(!me){A.innerHTML+='<div class="empty"><a href="#/login">Login</a> to browse items.</div>';return}
  const draw=()=>{
    const v=id=>$("#"+id).value.toLowerCase();
    let l=page.all.filter(i=>i.status!=="removed"&&(!v("q")||i.nameLower.includes(v("q")))&&(!v("c")||i.category.toLowerCase()===v("c"))&&(!v("l")||i.location.toLowerCase().includes(v("l")))&&(!v("d")||i.date===$("#d").value)&&(!v("t")||i.type===v("t")));
    if(v("s")==="old")l=[...l].reverse();
    $("#list").innerHTML=l.length?l.map(card).join(""):'<div class="empty" style="grid-column:1/-1">No items match your search.</div>'};
  const fetchMore=async()=>{
    const q=query(collection(db,"items"),orderBy("createdAt","desc"),...(page.cursor?[startAfter(page.cursor)]:[]),limit(12));
    const s=await getDocs(q);page.cursor=s.docs.at(-1)||page.cursor;page.all.push(...s.docs.map(d=>({id:d.id,...d.data()})));
    $("#more").innerHTML=s.size===12?'<button class="btn alt" id="lm">Load more</button>':"";$("#lm")?.addEventListener("click",fetchMore);draw()};
  document.querySelectorAll(".filters input,.filters select").forEach(e=>e.oninput=draw);
  await fetchMore();
}

async function itemPage(id){
  const s=await getDoc(doc(db,"items",id));if(!s.exists()||s.data().status==="removed"){A.innerHTML='<div class="empty">Item not found.</div>';return}
  const i={id,...s.data()},mineI=i.ownerId===me.uid;
  const sim=(await snap(query(collection(db,"items"),where("category","==",i.category),orderBy("createdAt","desc"),limit(6)))).filter(x=>x.id!==id&&x.status!=="removed"&&x.type!==i.type).slice(0,3);
  const myClaim=(await snap(query(collection(db,"claims"),where("claimantId","==",me.uid),where("itemId","==",id)))).at(0);
  A.innerHTML=`<div class="detail"><div>${i.image?`<img src="${esc(i.image)}" alt="">`:'<div class="ph" style="height:260px;border-radius:18px"></div>'}</div><div>
  <span class="badge ${i.status==="returned"?"returned":i.type}">${i.status==="returned"?"RETURNED":i.type.toUpperCase()}</span><h1>${esc(i.name)}</h1>
  <p>${esc(i.description)}</p><p class="mut">${esc(i.category)} · ${esc(i.location)} · ${esc(i.date)}<br>Posted by ${esc(i.ownerName)}</p>
  <div class="row">
  ${mineI?(i.status!=="returned"?'<button class="btn ok" id="ret">Mark as returned</button>':"")+'<button class="btn bad" id="del">Delete</button>':
    myClaim?`<span class="badge ${myClaim.status==="accepted"?"found":"returned"}">Claim ${esc(myClaim.status)}</span>`:i.status==="returned"?"":'<button class="btn" id="cl">Submit claim request</button>'}
  ${mineI?"":'<button class="btn alt" id="rp">Report listing</button>'}</div></div></div>
  ${mineI?'<h2>Claim requests</h2><div id="claims"></div>':""}
  <h2>Similar items</h2><div class="grid">${sim.map(card).join("")||'<div class="empty">No similar items.</div>'}</div>`;
  $("#ret")?.addEventListener("click",async()=>{await updateDoc(doc(db,"items",id),{status:"returned"});toast("Marked as returned");itemPage(id)});
  $("#del")?.addEventListener("click",async()=>{if(confirm("Delete this report?")){await deleteDoc(doc(db,"items",id));location.hash="#/mine"}});
  $("#cl")?.addEventListener("click",async()=>{const m=prompt("Describe proof this item is yours (e.g. unique marks):");if(!m||m.trim().length<10)return toast("Please give at least 10 characters");
    await addDoc(collection(db,"claims"),{itemId:id,itemTitle:i.name,ownerId:i.ownerId,claimantId:me.uid,claimantName:profile?.name||me.displayName,message:m.trim(),status:"pending",createdAt:serverTimestamp()});
    await notify(i.ownerId,`New claim on "${i.name}"`,"#/item/"+id);toast("Claim sent");itemPage(id)});
  $("#rp")?.addEventListener("click",async()=>{const r=prompt("Why is this listing inappropriate or fake?");if(!r)return;
    await addDoc(collection(db,"reports"),{itemId:id,itemName:i.name,reason:r.slice(0,300),reporterId:me.uid,createdAt:serverTimestamp()});toast("Thanks, admins will review it")});
  if(mineI)renderOwnerClaims(id,i);
}
async function renderOwnerClaims(id,i){
  const l=await snap(query(collection(db,"claims"),where("itemId","==",id),where("ownerId","==",me.uid)));
  $("#claims").innerHTML=l.length?l.map(c=>`<div class="card" style="margin:8px 0"><b>${esc(c.claimantName)}</b> <span class="badge returned">${esc(c.status)}</span><p>${esc(c.message)}</p>
  ${c.status==="pending"?`<button class="btn ok" data-a="${c.id}">Accept</button> <button class="btn bad" data-r="${c.id}">Reject</button>`:""}${c.status==="accepted"?thread(c.id):""}</div>`).join(""):'<div class="empty">No claims yet.</div>';
  document.querySelectorAll("[data-a]").forEach(b=>b.onclick=async()=>{
    const c=(await getDoc(doc(db,"items",id,"private","contact"))).data();
    await updateDoc(doc(db,"claims",b.dataset.a),{status:"accepted",ownerContact:c.contact});
    const cl=l.find(x=>x.id===b.dataset.a);await notify(cl.claimantId,`Your claim for "${i.name}" was accepted`,"#/claims");renderOwnerClaims(id,i)});
  document.querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{
    await updateDoc(doc(db,"claims",b.dataset.r),{status:"rejected"});const cl=l.find(x=>x.id===b.dataset.r);await notify(cl.claimantId,`Your claim for "${i.name}" was rejected`,"#/claims");renderOwnerClaims(id,i)});
  l.filter(c=>c.status==="accepted").forEach(c=>wireThread(c));
}
const thread=id=>`<div id="t${id}"></div><div class="row"><input id="m${id}" placeholder="Secure message…" style="flex:1"><button class="btn" id="s${id}">Send</button></div>`;
async function wireThread(c){
  const load=async()=>{const m=await snap(query(collection(db,"messages"),where("claimId","==",c.id),where("participants","array-contains",me.uid),orderBy("createdAt")));
    const el=$("#t"+c.id);if(el)el.innerHTML=m.map(x=>`<div class="msg"><b>${esc(x.fromName)}:</b> ${esc(x.text)}</div>`).join("")};
  $("#s"+c.id).onclick=async()=>{const t=$("#m"+c.id).value.trim();if(!t)return;
    await addDoc(collection(db,"messages"),{claimId:c.id,from:me.uid,fromName:profile?.name||"Me",text:t.slice(0,500),participants:[c.ownerId,c.claimantId],createdAt:serverTimestamp()});
    await notify(me.uid===c.ownerId?c.claimantId:c.ownerId,"New message about "+c.itemTitle,"#/claims");$("#m"+c.id).value="";load()};
  try{await load()}catch{}
}

async function dashboard(){
  const [items,cl]=await Promise.all([snap(query(collection(db,"items"),where("ownerId","==",me.uid))),snap(query(collection(db,"claims"),where("claimantId","==",me.uid)))]);
  const inc=await snap(query(collection(db,"claims"),where("ownerId","==",me.uid)));
  const act=[...items.map(x=>({t:x.createdAt,s:`Reported ${x.type}: ${x.name}`})),...cl.map(x=>({t:x.createdAt,s:`Claimed ${x.itemTitle} (${x.status})`}))].sort((a,b)=>(b.t?.seconds||0)-(a.t?.seconds||0)).slice(0,6);
  const S=[["Total reports",items.length],["Lost",items.filter(i=>i.type==="lost").length],["Found",items.filter(i=>i.type==="found").length],["Active claims",[...cl,...inc].filter(c=>c.status==="pending").length],["Returned",items.filter(i=>i.status==="returned").length]];
  A.innerHTML=`<h1>Hi, ${esc(profile?.name||"student")} 👋</h1><div class="stats">${S.map(([a,b])=>`<div class="card"><b>${b}</b>${a}</div>`).join("")}</div>
  <h2>Recent activity</h2>${act.map(a=>`<div class="card" style="margin:6px 0">${esc(a.s)} <span class="mut">${fmt(a.t)}</span></div>`).join("")||'<div class="empty">Nothing yet. Report your first item!</div>'}`;
}
async function mine(){
  const l=await snap(query(collection(db,"items"),where("ownerId","==",me.uid),orderBy("createdAt","desc")));
  A.innerHTML=`<h1>My Reports</h1>${l.length?`<div class="grid">${l.map(card).join("")}</div>`:'<div class="empty">You have not reported anything yet.</div>'}`;
}
async function claims(){
  const l=await snap(query(collection(db,"claims"),where("claimantId","==",me.uid),orderBy("createdAt","desc")));
  A.innerHTML=`<h1>My Claims</h1>${l.map(c=>`<div class="card" style="margin:8px 0"><b>${esc(c.itemTitle)}</b> <span class="badge ${c.status==="accepted"?"found":c.status==="rejected"?"lost":"returned"}">${esc(c.status)}</span>
  <p class="mut">${esc(c.message)}</p>${c.status==="accepted"?`<p>Owner contact: <b>${esc(c.ownerContact)}</b></p>${thread(c.id)}`:""}<a href="#/item/${c.itemId}">View item</a></div>`).join("")||'<div class="empty">No claims yet.</div>'}`;
  l.filter(c=>c.status==="accepted").forEach(wireThread);
}
async function notifications(){
  const l=await snap(query(collection(db,"notifications"),where("uid","==",me.uid),orderBy("createdAt","desc"),limit(30)));
  A.innerHTML=`<h1>Notifications</h1>${l.map(n=>`<a class="card" style="display:block;margin:6px 0;color:inherit;text-decoration:none;${n.read?"opacity:.6":""}" href="${esc(n.link)}">${esc(n.text)} <span class="mut">${fmt(n.createdAt)}</span></a>`).join("")||'<div class="empty">You are all caught up.</div>'}`;
  await Promise.all(l.filter(n=>!n.read).map(n=>updateDoc(doc(db,"notifications",n.id),{read:true})));
}
function profilePage(){
  A.innerHTML=`<h1>Profile</h1><form id="f"><label>Name<input name="name" value="${esc(profile?.name)}" required></label><label>Phone<input name="phone" value="${esc(profile?.phone)}" required pattern="[0-9+ ]{8,15}"></label><label>Email<input value="${esc(me.email)}" disabled></label><button class="btn" type="submit">Save</button></form>`;
  $("#f").onsubmit=e=>guard(e,async()=>{const f=Object.fromEntries(new FormData(e.target));await updateDoc(doc(db,"users",me.uid),f);profile={...profile,...f};await updateProfile(me,{displayName:f.name});toast("Profile saved")});
}
routes.profile=profilePage;

async function admin(){
  if(!isAdmin()){A.innerHTML='<div class="empty">Admins only.</div>';return}
  const [items,users,reps,cl]=await Promise.all([snap(query(collection(db,"items"),orderBy("createdAt","desc"))),snap(collection(db,"users")),snap(collection(db,"reports")),snap(collection(db,"claims"))]);
  A.innerHTML=`<h1>Admin Dashboard</h1><div class="stats">${[["Items",items.length],["Users",users.length],["Claims",cl.length],["Returned",items.filter(i=>i.status==="returned").length],["Reports",reps.length]].map(([a,b])=>`<div class="card"><b>${b}</b>${a}</div>`).join("")}</div>
  <h2>Reported content</h2>${reps.map(r=>`<div class="card row" style="margin:6px 0"><span style="flex:1"><b>${esc(r.itemName)}</b>: ${esc(r.reason)}</span><button class="btn bad" data-rm="${r.itemId}" data-rp="${r.id}">Remove item</button><button class="btn alt" data-dis="${r.id}">Dismiss</button></div>`).join("")||'<div class="empty">No reports.</div>'}
  <h2>All items</h2>${items.map(i=>`<div class="card row" style="margin:6px 0"><span style="flex:1">${esc(i.name)} <span class="mut">${i.type} · ${esc(i.status)}</span></span><a href="#/item/${i.id}">Open</a><button class="btn bad" data-rm="${i.id}">Remove</button></div>`).join("")}
  <h2>Users</h2>${users.map(u=>`<div class="card row" style="margin:6px 0"><span style="flex:1">${esc(u.name)} <span class="mut">${esc(u.email)} · ${esc(u.role)}</span></span>${u.role!=="admin"?`<button class="btn alt" data-adm="${u.id}">Make admin</button>`:""}</div>`).join("")}
  <h2>Categories</h2><div class="row">${cats.map(c=>`<span class="badge returned">${esc(c)}</span>`).join("")}</div><form id="cf" style="margin-top:10px;display:flex"><input name="c" placeholder="New category" required><button class="btn" type="submit">Add</button></form>`;
  const re=()=>admin();
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this post?"))return;await updateDoc(doc(db,"items",b.dataset.rm),{status:"removed"});if(b.dataset.rp)await deleteDoc(doc(db,"reports",b.dataset.rp));re()});
  document.querySelectorAll("[data-dis]").forEach(b=>b.onclick=async()=>{await deleteDoc(doc(db,"reports",b.dataset.dis));re()});
  document.querySelectorAll("[data-adm]").forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,"users",b.dataset.adm),{role:"admin"});re()});
  $("#cf").onsubmit=e=>guard(e,async()=>{const n=e.target.c.value.trim();await addDoc(collection(db,"categories"),{name:n});if(cats===DEF_CATS)await Promise.all(DEF_CATS.filter(x=>x!==n).map(x=>addDoc(collection(db,"categories"),{name:x})));cats=[...new Set([...cats,n])];re()});
}
