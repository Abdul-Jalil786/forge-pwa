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
    STATE.weightLog = [{date: todayStr(), weight: obData.startWeight, source: 'manual'}];
    STATE.planStartDate = todayStr();
    STATE.trainingStartDate = todayStr();
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
  openMealDetail(mealId);
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

// ---- SUPPLEMENTS (Phase 19) ----
function _populateSuppMealDropdown(){
  const sel=document.getElementById('msupp-meal');
  if(!sel)return;
  const meals=(STATE.mealPlan&&STATE.mealPlan.meals)||[];
  sel.innerHTML='<option value="">No linked meal</option>'+meals.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
}

function openAddSupplement(){
  document.getElementById('supp-modal-title').textContent='Add Supplement';
  ['msupp-name','msupp-dose','msupp-time','msupp-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('msupp-edit-id').value='';
  _populateSuppMealDropdown();
  document.getElementById('msupp-meal').value='';
  openModal('modal-supp');
}

function openEditSupplement(id){
  const s=getSupplements().find(x=>x.id===id);
  if(!s)return;
  document.getElementById('supp-modal-title').textContent='Edit Supplement';
  document.getElementById('msupp-name').value=s.name;
  document.getElementById('msupp-dose').value=s.dose||'';
  document.getElementById('msupp-time').value=s.time||'';
  document.getElementById('msupp-notes').value=s.notes||'';
  document.getElementById('msupp-edit-id').value=id;
  _populateSuppMealDropdown();
  document.getElementById('msupp-meal').value=s.mealId||'';
  openModal('modal-supp');
}

function saveSuppNew(){
  const name=document.getElementById('msupp-name').value.trim();
  const dose=document.getElementById('msupp-dose').value.trim();
  const time=document.getElementById('msupp-time').value.trim();
  const mealId=document.getElementById('msupp-meal').value;
  const notes=document.getElementById('msupp-notes').value.trim();
  if(!name){showToast('Enter supplement name');return;}
  const editId=document.getElementById('msupp-edit-id').value;
  if(editId){
    updateSupplement(editId,{name,dose,time,mealId,notes});
    showToast(`${name} updated ✓`);
  } else {
    addSupplement({name,dose,time,mealId,notes});
    showToast(`${name} added ✓`);
  }
  closeModal('modal-supp');
  renderMore();renderToday();
}

function confirmDeleteSupplement(id,name){
  if(!confirm(`Delete ${name}? Historical adherence data is preserved.`))return;
  deleteSupplement(id);
  showToast(`${name} deleted`);
  renderMore();renderToday();
}

// ---- WATER ----
function setWater(cups){saveWater(cups);renderMore();renderToday();showToast(`${cups} cups 💧`);}
function resetWater(){saveWater(0);renderMore();renderToday();}

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

// ---- OURA ----
async function loadOuraStatus(){
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/oura/status',{headers:{Authorization:'Bearer '+jwt}});
    const data=await res.json();
    const statusEl=document.getElementById('oura-status');
    const ctrlEl=document.getElementById('oura-controls');
    if(!statusEl||!ctrlEl)return;
    if(data.connected){
      const last=data.lastSync?new Date(data.lastSync).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Never';
      statusEl.innerHTML=`Connected · Last sync: <strong style="color:var(--text);">${last}</strong><br>Daily auto-sync at 8am pulls sleep, steps, HRV.`;
      ctrlEl.innerHTML=`
        <button class="btn btn-ghost btn-sm" style="flex:1;min-width:120px;" onclick="syncOuraNow()">Sync Now</button>
        <button class="btn btn-red btn-sm" style="flex:1;min-width:120px;" onclick="disconnectOura()">Disconnect</button>
      `;
    } else {
      statusEl.innerHTML='Connect your Oura ring to auto-sync sleep, steps and recovery data daily. Generate a Personal Access Token at <strong style="color:var(--text);">cloud.ouraring.com</strong>.';
    }
  }catch(e){console.error(e);}
}

async function connectOura(){
  const token=prompt('Paste your Oura Personal Access Token:');
  if(!token||!token.trim())return;
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/oura/token',{
      method:'PUT',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},
      body:JSON.stringify({token:token.trim()})
    });
    if(!res.ok){showToast('Failed to save token');return;}
    showToast('Oura connected');
    syncOuraNow();
  }catch(e){showToast('Failed');}
}

async function syncOuraNow(){
  const jwt=localStorage.getItem('forge_token');
  showToast('Syncing Oura...');
  try{
    const res=await fetch('/api/oura/sync',{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    const data=await res.json();
    if(data.error){showToast('Sync error: '+data.error);return;}
    showToast(`Synced ${data.updated} entries`);
    await loadState();
    renderAll();
    loadOuraStatus();
  }catch(e){showToast('Sync failed');}
}

async function disconnectOura(){
  if(!confirm('Disconnect Oura? Existing data stays, but auto-sync stops.'))return;
  const jwt=localStorage.getItem('forge_token');
  try{
    await fetch('/api/oura/token',{method:'DELETE',headers:{Authorization:'Bearer '+jwt}});
    showToast('Oura disconnected');
    loadOuraStatus();
  }catch(e){showToast('Failed');}
}

// ---- WITHINGS ----
async function loadWithingsStatus(){
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/withings/status',{headers:{Authorization:'Bearer '+jwt}});
    const data=await res.json();
    const statusEl=document.getElementById('withings-status');
    const ctrlEl=document.getElementById('withings-controls');
    if(!statusEl||!ctrlEl)return;
    if(data.connected){
      const last=data.lastSync?new Date(data.lastSync).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Never';
      statusEl.innerHTML=`Connected · Last sync: <strong style="color:var(--text);">${last}</strong><br>Daily auto-sync at 8:15am pulls weight, body fat, muscle mass.`;
      ctrlEl.innerHTML=`
        <button class="btn btn-ghost btn-sm" style="flex:1;min-width:120px;" onclick="syncWithingsNow()">Sync Now</button>
        <button class="btn btn-red btn-sm" style="flex:1;min-width:120px;" onclick="disconnectWithings()">Disconnect</button>
      `;
    } else {
      statusEl.innerHTML='Connect your Withings scale to auto-sync weight, body fat, muscle mass and visceral fat daily.';
    }
  }catch(e){console.error(e);}
}

async function connectWithings(){
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/withings/auth-url',{headers:{Authorization:'Bearer '+jwt}});
    const data=await res.json();
    if(data.authUrl){window.location.href=data.authUrl;}
    else showToast('Failed to start Withings auth');
  }catch(e){showToast('Failed');}
}

async function syncWithingsNow(){
  const jwt=localStorage.getItem('forge_token');
  showToast('Syncing Withings...');
  try{
    const res=await fetch('/api/withings/sync',{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    const data=await res.json();
    if(data.error){showToast('Sync error: '+data.error);return;}
    showToast(`Synced ${data.updated} entries`);
    await loadState();
    renderAll();
    loadWithingsStatus();
  }catch(e){showToast('Sync failed');}
}

async function disconnectWithings(){
  if(!confirm('Disconnect Withings? Existing data stays, but auto-sync stops.'))return;
  const jwt=localStorage.getItem('forge_token');
  try{
    await fetch('/api/withings/disconnect',{method:'DELETE',headers:{Authorization:'Bearer '+jwt}});
    showToast('Withings disconnected');
    loadWithingsStatus();
  }catch(e){showToast('Failed');}
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
    ['weightLog','foods','stepsLog','exLog','measLog','sleepLog','swimLog','supps','suppDone','water','foodTemplates','supplements','supplementLog'].forEach(k=>{
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
  // Migrate: ensure planStartDate + trainingStartDate exist for existing users
  if(STATE.profile && STATE.profile.name && (!STATE.planStartDate || !STATE.trainingStartDate)){
    const earliest = (STATE.weightLog||[]).length
      ? STATE.weightLog.reduce((m,e)=>e.date<m?e.date:m, STATE.weightLog[0].date)
      : todayStr();
    if(!STATE.planStartDate) STATE.planStartDate = earliest;
    if(!STATE.trainingStartDate) STATE.trainingStartDate = earliest;
    saveStateNow();
  }
  // Phase 19: pre-populate supplements for Jay if empty
  if(STATE.profile && !STATE.supplements){
    if(STATE.profile.email==='jay@afjltd.co.uk' || (STATE.profile.name && STATE.profile.name.toLowerCase().startsWith('jay'))){
      STATE.supplements=[
        {id:'vit-d',name:'Vitamin D',dose:'4000 IU',time:'12:00',mealId:'breakfast',notes:''},
        {id:'omega-3',name:'Omega 3',dose:'2 caps',time:'12:00',mealId:'breakfast',notes:''},
        {id:'metformin-am',name:'Metformin',dose:'1000mg',time:'12:00',mealId:'breakfast',notes:'With first meal'},
        {id:'statin-pm',name:'Statin',dose:'20mg',time:'17:50',mealId:'last-meal',notes:'With last meal'},
        {id:'creatine',name:'Creatine',dose:'5g',time:'17:15',mealId:'post-workout-shake',notes:'In post-workout shake'},
      ];
      saveStateNow();
    } else {
      STATE.supplements=[];
      saveStateNow();
    }
  }

  // Phase 20: migrate time-based exercise sets
  runPhase20Migration();

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
