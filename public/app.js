// ============================================================
// APP CONTROLLER
// ============================================================

// ---- ONBOARDING ----
let obData={};
async function obStep(step){
  if(step===1){
    const name=document.getElementById('ob-name').value.trim();
    if(!name){showToast('Enter your name');return;}
    obData.name=name;
  } else if(step===2){
    const w=parseFloat(document.getElementById('ob-sw').value);
    if(!w||w<40||w>400){showToast('Enter valid weight');return;}
    obData.startWeight=w;
  } else if(step===3){
    const tw=parseFloat(document.getElementById('ob-tw').value);
    if(!tw){showToast('Enter target weight');return;}
    obData.targetWeight=tw;
    obData.targetBF=parseFloat(document.getElementById('ob-bf').value)||15;
  } else if(step===4){
    const cg=parseInt(document.getElementById('ob-cg').value);
    const cr=parseInt(document.getElementById('ob-cr').value);
    const pr=parseInt(document.getElementById('ob-pr').value);
    if(!cg||!cr||!pr){showToast('Fill all fields');return;}
    obData.calsGym=cg; obData.calsRest=cr; obData.proteinTarget=pr;
    STATE.profile = {
      name: obData.name, startWeight: obData.startWeight,
      targetWeight: obData.targetWeight, targetBF: obData.targetBF,
      calsGym: obData.calsGym, calsRest: obData.calsRest,
      proteinTarget: obData.proteinTarget,
    };
    STATE.weightLog = [{date: todayStr(), weight: obData.startWeight}];
    await saveStateNow();
    document.getElementById('onboarding').style.display='none';
    document.getElementById('app').style.display='flex';
    renderProfilePills(); renderAll();
    return;
  }
  document.getElementById('obs'+(step)).classList.remove('active');
  document.getElementById('obs'+(step+1)).classList.add('active');
}

function addProfile(){
  obData={};
  ['ob-name','ob-sw','ob-tw','ob-bf','ob-cg','ob-cr','ob-pr'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));
  document.getElementById('obs1').classList.add('active');
  document.getElementById('onboarding').style.display='flex';
  document.getElementById('app').style.display='none';
}

function renderProfilePills(){
  const p = STATE.profile;
  if (!p) return;
  document.getElementById('profilePills').innerHTML = `<button class="ppill active">${p.name.split(' ')[0]}</button>`;
}

function switchProfile(id){setActive(id);renderProfilePills();renderAll();nav('today');}

// ---- NAVIGATION ----
const PAGES=['today','workout','food','track','body','coach','more'];
function nav(page){
  PAGES.forEach(p=>{
    document.getElementById('page-'+p)?.classList.remove('active');
    document.getElementById('nb-'+p)?.classList.remove('active');
  });
  document.getElementById('page-'+page)?.classList.add('active');
  document.getElementById('nb-'+page)?.classList.add('active');
  document.getElementById('scrollArea').scrollTop=0;
  if(page==='today')renderToday();
  if(page==='workout')renderWorkout();
  if(page==='food')renderFood();
  if(page==='track')renderTrack();
  if(page==='body')renderBody();
  if(page==='coach')renderCoach();
  if(page==='more')renderMore();
}

// ---- MODALS ----
function openModal(id){
  document.getElementById(id)?.classList.add('open');
  if(id==='modal-food'){
    document.getElementById('mf-time').value=fmtNow();
    renderFoodTemplatesModal();
  }
  if(id==='modal-weight'){
    document.getElementById('mw-val').value='';
  }
}
function closeModal(id){document.getElementById(id)?.classList.remove('open');}
document.querySelectorAll('.modal-bg').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});
});

// ---- WEIGHT ----
function saveWeight(){
  const val=parseFloat(document.getElementById('mw-val').value);
  const bf=parseFloat(document.getElementById('mw-bf').value);
  if(!val||val<40||val>400){showToast('Enter valid weight');return;}
  saveWeightEntry(val);
  if(bf&&bf>0&&bf<60)saveBfEntry(bf);
  document.getElementById('mw-val').value='';
  document.getElementById('mw-bf').value='';
  closeModal('modal-weight');
  showToast(`${val}kg${bf?' + '+bf+'% BF':''} logged ✓`);
  renderToday(); renderTrack();
}

// ---- FOOD ----
let selectedSleepQ=3;
function saveFood(){
  const name=document.getElementById('mf-name').value.trim();
  const cals=parseInt(document.getElementById('mf-cals').value)||0;
  const protein=parseInt(document.getElementById('mf-protein').value)||0;
  const carbs=parseInt(document.getElementById('mf-carbs').value)||0;
  const fat=parseInt(document.getElementById('mf-fat').value)||0;
  const time=document.getElementById('mf-time').value||fmtNow();
  if(!name||!cals){showToast('Name and calories required');return;}
  const entry={name,cals,protein,carbs,fat,time};
  saveFoodEntry(entry);

  // Offer to save as template
  const shouldSave=cals>0&&confirm(`Save "${name}" as a template for quick re-use?`);
  if(shouldSave)saveTemplate({name,cals,protein,carbs,fat});

  ['mf-name','mf-cals','mf-protein','mf-carbs','mf-fat'].forEach(id=>document.getElementById(id).value='');
  closeModal('modal-food');
  showToast(`${name} logged ✓`);
  renderFood(); renderToday();
}

function logPlannedMeal(mealId){
  const plan=STATE.mealPlan;
  if(!plan)return;
  const meal=plan.meals.find(m=>m.id===mealId);
  if(!meal){showToast('Meal not found');return;}
  const todayFoods=getFoods();
  const existing=todayFoods.findIndex(f=>f.name===meal.name);
  if(existing>=0){
    deleteFoodEntry(existing);
    showToast(`${meal.name} unlogged`);
  } else {
    saveFoodEntry({
      name:meal.name,
      cals:meal.cals||0,
      protein:meal.protein||0,
      carbs:meal.carbs||0,
      fat:meal.fat||0,
      time:meal.time||fmtNow()
    });
    showToast(`${meal.name} logged ✓`);
  }
  renderFood(); renderToday();
}

// ---- MEASUREMENTS ----
function saveMeas(){
  const entry={
    waist:parseFloat(document.getElementById('mm-waist').value)||null,
    chest:parseFloat(document.getElementById('mm-chest').value)||null,
    larm:parseFloat(document.getElementById('mm-larm').value)||null,
    rarm:parseFloat(document.getElementById('mm-rarm').value)||null,
    lthigh:parseFloat(document.getElementById('mm-lthigh').value)||null,
    rthigh:parseFloat(document.getElementById('mm-rthigh').value)||null,
    neck:parseFloat(document.getElementById('mm-neck').value)||null,
  };
  saveMeasEntry(entry);
  closeModal('modal-meas');
  showToast('Measurements saved ✓');
  renderBody();
}

// ---- SLEEP ----
function selectSleepQ(q){
  selectedSleepQ=q;
  document.querySelectorAll('.sq-btn').forEach((b,i)=>{
    b.classList.toggle('selected',i+1===q);
  });
}
function saveSleep(){
  const hours=parseFloat(document.getElementById('ms-hours').value);
  if(!hours||hours<0||hours>24){showToast('Enter valid hours');return;}
  saveSleepEntry(hours,selectedSleepQ);
  closeModal('modal-sleep');
  showToast(`${hours}h sleep logged ✓`);
  renderToday(); renderBody();
}

// ---- SWIM ----
function saveSwim(){
  const mins=parseInt(document.getElementById('msw-mins').value);
  const laps=parseInt(document.getElementById('msw-laps').value)||null;
  const feel=document.getElementById('msw-feel').value;
  if(!mins||mins<1){showToast('Enter duration');return;}
  saveSwimEntry({mins,laps,feel});
  closeModal('modal-swim');
  showToast(`${mins} min swim logged ✓`);
  renderBody(); renderToday();
}

// ---- SUPPLEMENTS ----
function saveSupp(){
  const name=document.getElementById('msupp-name').value.trim();
  const dose=document.getElementById('msupp-dose').value.trim();
  const time=document.getElementById('msupp-time').value.trim();
  if(!name){showToast('Enter supplement name');return;}
  const supps=getSupps(); supps.push({name,dose,time}); pSet('supps',supps);
  closeModal('modal-supp');
  showToast(`${name} added ✓`);
  renderCoach();
}
function deleteSupp(i){const s=getSupps();s.splice(i,1);pSet('supps',s);renderCoach();}
function toggleSupp(i){toggleSuppDone(i);renderCoach();}

// ---- WATER ----
function setWater(cups){saveWater(cups);renderMore();renderToday();showToast(`${cups} cups 💧`);}
function resetWater(){saveWater(0);renderMore();renderToday();}

// ---- PHOTOS ----
function handlePhoto(event){
  const file=event.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    savePhoto(e.target.result);
    renderBody();
    showToast('Photo saved ✓');
  };
  reader.readAsDataURL(file);
}

// ---- ACCESS TOKENS ----
async function generateAccessToken(){
  const name=prompt('Token name (e.g. "Cowork"):')||'Cowork';
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/tokens',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},
      body:JSON.stringify({name})
    });
    if(!res.ok)throw new Error('Failed');
    const data=await res.json();
    const url=window.location.origin;
    const msg=`Token created. Save these — token only shown once:\n\nURL: ${url}\n\nToken: ${data.token}`;
    prompt('Copy your token (Cmd/Ctrl+C):',data.token);
    alert(msg);
    renderMore();
  }catch(e){
    showToast('Failed to create token');
  }
}

async function revokeAccessToken(id){
  if(!confirm('Revoke this token? Cowork will lose access.'))return;
  const jwt=localStorage.getItem('forge_token');
  try{
    await fetch('/api/tokens/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+jwt}});
    renderMore();
    showToast('Token revoked');
  }catch(e){showToast('Failed');}
}

async function loadAccessTokens(){
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/tokens',{headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok)return [];
    const data=await res.json();
    return data.tokens||[];
  }catch{return [];}
}

// ---- PUSH NOTIFICATIONS ----
async function enableReminders(){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)){
    showToast("Push not supported on this browser");
    return;
  }
  try{
    const reg=await navigator.serviceWorker.ready;
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){
      showToast("Notification permission denied");
      return;
    }
    const keyRes=await fetch("/api/push/public-key");
    const{publicKey}=await keyRes.json();
    const sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlB64ToUint8Array(publicKey),
    });
    const jwt=localStorage.getItem("forge_token");
    await fetch("/api/push/subscribe",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+jwt},
      body:JSON.stringify({
        endpoint:sub.endpoint,
        keys:sub.toJSON().keys,
        name:navigator.userAgent.slice(0,100),
      }),
    });
    showToast("Reminders enabled ✓");
    renderCoach();
  }catch(e){
    console.error(e);
    showToast("Failed to enable reminders");
  }
}

async function disableReminders(){
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub){
      const jwt=localStorage.getItem("forge_token");
      await fetch("/api/push/subscribe",{
        method:"DELETE",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+jwt},
        body:JSON.stringify({endpoint:sub.endpoint}),
      });
      await sub.unsubscribe();
    }
    showToast("Reminders disabled");
    renderCoach();
  }catch(e){
    showToast("Failed to disable");
  }
}

async function testReminder(){
  const jwt=localStorage.getItem("forge_token");
  const res=await fetch("/api/push/test",{
    method:"POST",
    headers:{Authorization:"Bearer "+jwt},
  });
  const data=await res.json();
  showToast(data.sent?`Test sent to ${data.sent} device(s)`:"No subscriptions");
}

async function isReminderEnabled(){
  if(!("serviceWorker" in navigator))return false;
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    return!!sub;
  }catch{return false;}
}

function urlB64ToUint8Array(base64){
  const padding="=".repeat((4-base64.length%4)%4);
  const base64Safe=(base64+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64Safe);
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}

// ---- ACCOUNT ----
function logOut(){
  Object.keys(localStorage)
    .filter(k => k.startsWith('forge_'))
    .forEach(k => localStorage.removeItem(k));
  window.location.href='/login.html';
}

async function deleteAccount(){
  if(!confirm('Permanently delete your account? This cannot be undone.'))return;
  const token=localStorage.getItem('forge_token');
  try{
    await fetch('/api/auth/account',{method:'DELETE',headers:{Authorization:'Bearer '+token}});
  }catch{}
  localStorage.clear();
  window.location.href='/login.html';
}

// ---- SETTINGS ----
function editProfile(){
  const p=getActive(); if(!p)return;
  const cg=prompt(`Gym day calories (current: ${p.calsGym}):`);
  if(cg&&!isNaN(cg))p.calsGym=parseInt(cg);
  const cr=prompt(`Rest day calories (current: ${p.calsRest}):`);
  if(cr&&!isNaN(cr))p.calsRest=parseInt(cr);
  const pr=prompt(`Protein target g (current: ${p.proteinTarget}):`);
  if(pr&&!isNaN(pr))p.proteinTarget=parseInt(pr);
  saveProfiles();
  renderAll();
  showToast('Profile updated ✓');
}

function confirmReset(){
  if(confirm('Delete ALL data for this profile? This cannot be undone.')){
    ['weightLog','foods','stepsLog','exLog','measLog','sleepLog','swimLog','supps','suppDone','water','photos','foodTemplates'].forEach(k=>{
      STATE[k] = Array.isArray(STATE[k]) ? [] : {};
    });
    saveStateNow();
    renderAll();
    showToast('Data cleared');
  }
}

// ---- TOAST ----
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2500);
}

// ---- RENDER ALL ----
function renderAll(){
  renderToday();
  // Others render on demand
}

// ---- AUTH CHECK ----
async function checkAuth(){
  const token=localStorage.getItem('forge_token');
  if(!token){window.location.href='/login.html';return false;}
  try{
    const res=await fetch('/api/auth/me',{headers:{Authorization:'Bearer '+token}});
    if(!res.ok){localStorage.removeItem('forge_token');window.location.href='/login.html';return false;}
    return true;
  }catch{return true;} // offline = let them in
}

// ---- INIT ----
async function init(){
  if(!await checkAuth())return;
  await loadState();
  if(STATE.profile && STATE.profile.name){
    document.getElementById('onboarding').style.display='none';
    document.getElementById('app').style.display='flex';
    renderProfilePills();
    renderAll();
  } else {
    document.getElementById('onboarding').style.display='flex';
    document.getElementById('app').style.display='none';
  }
}

init();
