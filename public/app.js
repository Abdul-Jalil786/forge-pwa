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
  if(!val||val<40||val>400){showToast('Enter valid weight');return;}
  saveWeightEntry(val);
  closeModal('modal-weight');
  showToast(`${val}kg logged ✓`);
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

// ---- API KEY ----
function saveApiKey(){
  const key=document.getElementById('mk-key').value.trim();
  if(!key){showToast('Enter API key');return;}
  localStorage.setItem('forge_apikey',key);
  closeModal('modal-apikey');
  showToast('AI Coach enabled ✓');
  renderCoach();
}

// ---- AI ANALYSIS ----
async function runAI(days){
  const p=getActive(); if(!p)return;
  const apiKey=localStorage.getItem('forge_apikey');
  if(!apiKey){openModal('modal-apikey');return;}

  const el=document.getElementById('ai-output');
  if(!el)return;
  el.innerHTML=`<div class="ai-section"><div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div><span style="margin-left:4px;">Analysing your last ${days} days...</span></div></div>`;

  // Gather data
  const dates=[];
  for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().split('T')[0]);}

  const wl=getWeightLog().filter(e=>dates.includes(e.date));
  const stepsLog=getStepsLog();
  const foodLog=pGet('foods',{});
  const exLog=getExLog();
  const sleepLog=getSleepLog();
  const measLog=getMeasLog();
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];

  const weightSummary=wl.length>=2?`Start: ${wl[0].weight}kg, End: ${wl[wl.length-1].weight}kg, Change: ${(wl[wl.length-1].weight-wl[0].weight).toFixed(1)}kg`:`Current: ${getCurrentWeight()}kg`;

  const stepsDays=dates.filter(d=>(stepsLog[d]||0)>=10000).length;
  const avgSteps=Math.round(dates.reduce((s,d)=>s+(stepsLog[d]||0),0)/dates.length);

  const nutritionDays=dates.map(d=>{
    const foods=foodLog[d]||[];
    return{date:d,cals:foods.reduce((s,f)=>s+f.cals,0),protein:foods.reduce((s,f)=>s+(f.protein||0),0)};
  }).filter(d=>d.cals>0);
  const avgCals=nutritionDays.length?Math.round(nutritionDays.reduce((s,d)=>s+d.cals,0)/nutritionDays.length):0;
  const avgProtein=nutritionDays.length?Math.round(nutritionDays.reduce((s,d)=>s+d.protein,0)/nutritionDays.length):0;
  const proteinDaysHit=nutritionDays.filter(d=>d.protein>=p.proteinTarget*0.9).length;

  const gymDays=dates.filter(d=>{const el=exLog[d]||{};return Object.values(el).some(e=>e.done);}).length;

  const sleepDays=dates.map(d=>sleepLog[d]?.hours||0).filter(h=>h>0);
  const avgSleep=sleepDays.length?Math.round((sleepDays.reduce((a,b)=>a+b,0)/sleepDays.length)*10)/10:0;

  const liftingProgress=allEx.map(ex=>{
    const sessions=dates.map(d=>{
      const dl=exLog[d]||{};
      const exData=dl[ex.id];
      if(!exData?.sets?.length)return null;
      const maxKg=Math.max(...exData.sets.map(s=>parseFloat(s.kg)||0));
      return maxKg>0?{date:d,kg:maxKg}:null;
    }).filter(Boolean);
    if(sessions.length<2)return null;
    const change=sessions[sessions.length-1].kg-sessions[0].kg;
    return{name:ex.name,sessions:sessions.length,start:sessions[0].kg,end:sessions[sessions.length-1].kg,change};
  }).filter(Boolean);

  const latestMeas=measLog.length?measLog[measLog.length-1]:null;
  const prevMeas=measLog.length>=2?measLog[measLog.length-2]:null;

  const prompt=`You are an expert personal trainer and nutrition coach. Analyse this ${days}-day fitness data for ${p.name} and provide a detailed, honest, actionable coaching report.

PROFILE:
- Age: 52, Height: 180cm
- Start weight: ${p.startWeight}kg, Target: ${p.targetWeight}kg at 15% body fat
- Current body fat: ~34% (started)
- Daily calorie target: ${p.calsGym} (gym days), ${p.calsRest} (rest days)
- Protein target: ${p.proteinTarget}g daily
- Training: Upper/Lower split, 4x/week
- Goal: Fat loss while preserving muscle

DATA FOR LAST ${days} DAYS:
Weight: ${weightSummary}
Steps: ${stepsDays}/${days} days hit 10,000 target, average ${avgSteps.toLocaleString()} steps/day
Nutrition: ${nutritionDays.length} days logged, avg ${avgCals} kcal/day, avg ${avgProtein}g protein/day, protein target hit ${proteinDaysHit}/${nutritionDays.length} logged days
Training: ${gymDays} gym sessions completed
Sleep: Average ${avgSleep} hours (${sleepDays.length} nights logged)
${latestMeas&&prevMeas?`Measurements change: Waist ${prevMeas.waist||'?'}→${latestMeas.waist||'?'}cm`:''} 
Lifting progress: ${liftingProgress.length>0?liftingProgress.map(l=>`${l.name}: ${l.start}→${l.end}kg (${l.change>0?'+':''}${l.change}kg over ${l.sessions} sessions)`).join(', '):'Limited data'}

Write a coaching report with these sections using H3 headers:
1. Overall Assessment — honest summary of how this period went
2. Weight & Body Composition — is the rate of loss right, too fast, too slow?
3. Nutrition Analysis — calorie and protein adherence, what needs to improve
4. Training Performance — lifting progress, session frequency, what's working
5. Recovery & Lifestyle — sleep, steps, overall activity
6. Key Actions — exactly 3 specific things to do differently next week

Be direct, specific and use the actual numbers. Use <strong> for key figures. Use class="good" for positives, class="warn" for cautions, class="bad" for problems. Keep it under 500 words total.`;

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})
    });
    if(!res.ok){
      const err=await res.json();
      throw new Error(err.error?.message||'API error');
    }
    const data=await res.json();
    const text=data.content?.[0]?.text||'No response';
    const html=text
      .replace(/^###\s(.+)$/gm,'<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n\n/g,'<br><br>')
      .replace(/\n/g,'<br>');
    el.innerHTML=`<div class="ai-section"><div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;"><div style="font-family:'Archivo Black',sans-serif;font-size:16px;">AI Coaching Report</div><div style="font-size:10px;color:var(--text3);">Last ${days} days</div></div><div class="ai-report">${html}</div></div>`;
  }catch(e){
    el.innerHTML=`<div class="ai-section card warn"><div style="font-size:13px;color:var(--red);">Error: ${e.message}</div><div style="font-size:12px;color:var(--text2);margin-top:8px;">Check your API key is valid and has credits.</div></div>`;
  }
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
