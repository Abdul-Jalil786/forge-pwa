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
function closeModal(id){
  document.getElementById(id)?.classList.remove('open');
  if(id==='modal-food')window._foodTargetDate=null;
}
document.querySelectorAll('.modal-bg').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m){m.classList.remove('open');if(m.id==='modal-food')window._foodTargetDate=null;}});
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
window._foodTargetDate=null; // when set, modal-food saves to this date instead of today

function openAddFoodForDate(date){
  window._foodTargetDate=date;
  openModal('modal-food');
}

function saveFood(){
  const name=document.getElementById('mf-name').value.trim();
  const cals=parseInt(document.getElementById('mf-cals').value)||0;
  const protein=parseInt(document.getElementById('mf-protein').value)||0;
  const carbs=parseInt(document.getElementById('mf-carbs').value)||0;
  const fat=parseInt(document.getElementById('mf-fat').value)||0;
  const time=document.getElementById('mf-time').value||fmtNow();
  if(!name){showToast('Name is required');return;}
  if(!cals&&!protein&&!carbs&&!fat){showToast('Enter calories or at least one macro');return;}
  const targetDate=window._foodTargetDate||todayStr();
  const entry={name,cals,protein,carbs,fat,time,loggedAt:new Date().toISOString()};
  saveFoodEntry(entry,targetDate);

  // Phase 39: low-GI flag (HbA1c context) + eating-window break warning
  if(targetDate===todayStr()){
    if(carbs>=20&&typeof estimateGI==='function'){
      const gi=estimateGI(name);
      if(gi&&gi.band==='high')setTimeout(()=>showToast('⚠️ Higher-GI food — consider a lower-GI swap (HbA1c 72)'),900);
    }
    const fh=parseInt(String(time).split(':')[0],10);
    if(!isNaN(fh)&&(fh<12||fh>=18))setTimeout(()=>showToast('⚠️ Logged outside your 12:00–18:00 window — fasting streak affected'),600);
  }

  // Offer to save as template
  const shouldSave=cals>0&&confirm(`Save "${name}" as a template for quick re-use?`);
  if(shouldSave)saveTemplate({name,cals,protein,carbs,fat});

  ['mf-name','mf-cals','mf-protein','mf-carbs','mf-fat'].forEach(id=>document.getElementById(id).value='');
  closeModal('modal-food');
  const dateLabel=targetDate===todayStr()?'':' ('+targetDate+')';
  window._foodTargetDate=null;
  showToast(`${name} logged${dateLabel} ✓`);
  // Refresh whichever view is open
  if(typeof renderFood==='function')renderFood();
  if(typeof renderToday==='function')renderToday();
  if(typeof renderDayDetail==='function'&&targetDate!==todayStr())renderDayDetail(targetDate);
}

// ---- TRAINING SET EDIT (for past dates) ----
let _setEdit = null; // { date, exId, exObj, sets: [{kg, reps, seconds, effort}], done }

function openSetEdit(date, exId){
  const allEx = [...WORKOUTS.upper.exercises, ...WORKOUTS.lower.exercises];
  const exObj = allEx.find(e => e.id === exId);
  if(!exObj){ showToast('Exercise not found'); return; }
  const exLog = STATE.exLog || {};
  const dayLog = exLog[date] || {};
  const existing = dayLog[exId] || {};
  const existingSets = Array.isArray(existing.sets) ? existing.sets : [];
  const timed = isTimeBased(exObj);
  // Use existing sets, or seed with `ex.sets` empty rows for new exercises
  const sets = existingSets.length > 0
    ? existingSets.map(s => ({
        kg: s.kg || '',
        reps: s.reps || '',
        seconds: s.seconds || '',
        effort: s.effort || '',
        done: s.done || false,
      }))
    : Array.from({length: exObj.sets || 3}).map(() => ({ kg:'', reps:'', seconds:'', effort:'', done:false }));
  _setEdit = { date, exId, exObj, timed, sets, done: !!existing.done };
  document.getElementById('set-title').textContent = exObj.name + (timed ? ' (timed)' : '');
  document.getElementById('set-date').textContent = date + ' · target ' + exObj.reps + (timed ? '' : ' reps');
  document.getElementById('set-done').checked = _setEdit.done;
  _renderSetRows();
  openModal('modal-set-edit');
}

function _renderSetRows(){
  const s = _setEdit;
  if(!s) return;
  const wrap = document.getElementById('set-rows');
  const efforts = ['', 'easy', 'solid', 'tough'];
  wrap.innerHTML = s.sets.map((row, i) => {
    if(s.timed){
      return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:10px;color:var(--text3);width:38px;flex-shrink:0;">SET ${i+1}</div>
        <input type="number" inputmode="numeric" value="${row.seconds||''}" placeholder="sec" oninput="_updateSetField(${i},'seconds',this.value)" style="flex:1;min-width:0;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;font-family:'Archivo Black',sans-serif;text-align:center;" />
        <select onchange="_updateSetField(${i},'effort',this.value)" style="flex:0 0 88px;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;">
          ${efforts.map(e=>`<option value="${e}"${row.effort===e?' selected':''}>${e||'effort'}</option>`).join('')}
        </select>
        <button onclick="_deleteSetFromEdit(${i})" style="flex:0 0 28px;background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:0;">×</button>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:10px;color:var(--text3);width:38px;flex-shrink:0;">SET ${i+1}</div>
      <input type="number" inputmode="decimal" step="0.25" value="${row.kg||''}" placeholder="kg" oninput="_updateSetField(${i},'kg',this.value)" style="flex:1;min-width:0;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;font-family:'Archivo Black',sans-serif;text-align:center;" />
      <div style="font-size:13px;color:var(--text3);flex-shrink:0;">×</div>
      <input type="number" inputmode="numeric" value="${row.reps||''}" placeholder="reps" oninput="_updateSetField(${i},'reps',this.value)" style="flex:1;min-width:0;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;font-family:'Archivo Black',sans-serif;text-align:center;" />
      <select onchange="_updateSetField(${i},'effort',this.value)" style="flex:0 0 76px;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;">
        ${efforts.map(e=>`<option value="${e}"${row.effort===e?' selected':''}>${e||'—'}</option>`).join('')}
      </select>
      <button onclick="_deleteSetFromEdit(${i})" style="flex:0 0 28px;background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:0;">×</button>
    </div>`;
  }).join('');
}

function _updateSetField(idx, field, value){
  if(!_setEdit) return;
  _setEdit.sets[idx][field] = value;
}

function _deleteSetFromEdit(idx){
  if(!_setEdit) return;
  _setEdit.sets.splice(idx, 1);
  _renderSetRows();
}

function addSetToEdit(){
  if(!_setEdit) return;
  _setEdit.sets.push({ kg:'', reps:'', seconds:'', effort:'', done:false });
  _renderSetRows();
}

async function saveSetEdit(){
  if(!_setEdit) return;
  const s = _setEdit;
  // Filter out empty sets (no kg/reps/seconds)
  const cleanedSets = s.sets.filter(r => r.kg || r.reps || r.seconds).map(r => ({
    kg: r.kg ? String(r.kg) : undefined,
    reps: r.reps ? String(r.reps) : undefined,
    seconds: r.seconds ? parseInt(r.seconds, 10) : undefined,
    effort: r.effort || undefined,
    done: true,
  }));
  const done = document.getElementById('set-done').checked || cleanedSets.length >= (s.exObj.sets || 3) * 0.66;
  const exLog = STATE.exLog || {};
  if(!exLog[s.date]) exLog[s.date] = {};
  exLog[s.date][s.exId] = { done, sets: cleanedSets };
  STATE.exLog = exLog;
  updateLocalCache();
  try{
    await saveFieldToServer(`/api/state/exLog/${s.date}`, { value: exLog[s.date] });
    showToast('Saved ✓');
    closeModal('modal-set-edit');
    _setEdit = null;
    if(typeof renderDayDetail === 'function') renderDayDetail(s.date);
  }catch(e){ showToast('Save failed'); }
}

async function deleteExerciseFromDay(){
  if(!_setEdit) return;
  if(!confirm('Remove this exercise from ' + _setEdit.date + '?')) return;
  const s = _setEdit;
  const exLog = STATE.exLog || {};
  if(exLog[s.date]) delete exLog[s.date][s.exId];
  STATE.exLog = exLog;
  updateLocalCache();
  try{
    await saveFieldToServer(`/api/state/exLog/${s.date}`, { value: exLog[s.date] || {} });
    showToast('Removed');
    closeModal('modal-set-edit');
    _setEdit = null;
    if(typeof renderDayDetail === 'function') renderDayDetail(s.date);
  }catch(e){ showToast('Delete failed'); }
}

function delFoodFromDayDetail(idx,date){
  if(!confirm('Delete this entry from '+date+'?'))return;
  deleteFoodEntry(idx,date);
  showToast('Removed');
  renderDayDetail(date);
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

// ---- WATER (legacy cup tracker — kept for backward compat) ----
function setWater(cups){saveWater(cups);renderMore();renderToday();showToast(`${cups} cups 💧`);}
function resetWater(){saveWater(0);renderMore();renderToday();}

// ---- WATER (Phase 39 — ml tracker) ----
function addWater(amount,type){
  addWaterEntry(todayStr(),amount,type);
  renderToday();renderMore();
  showToast(`+${amount}ml 💧`);
}
function addWaterCustom(){
  const v=prompt('Add water (ml):','');
  if(v==null)return;
  const ml=parseInt(v,10);
  if(!ml||ml<=0||ml>3000){showToast('Enter 1–3000ml');return;}
  addWaterEntry(todayStr(),ml,'custom');
  renderToday();renderMore();
  showToast(`+${ml}ml 💧`);
}
function undoWater(){
  const wl=getWaterLog(todayStr());
  if(!wl.entries||!wl.entries.length){showToast('Nothing to undo');return;}
  removeLastWaterEntry(todayStr());
  renderToday();renderMore();
  showToast('Last entry removed');
}

// ---- MOUNJARO MODE (Phase 39) ----
function toggleMounjaroInjected(){
  const today=todayStr();
  const cur=getMounjaroLog(today)||{};
  if(cur.injected)setMounjaroLog(today,{injected:false,injectionTime:null});
  else setMounjaroLog(today,{injected:true,injectionTime:fmtNow()});
  renderToday();
}
function toggleMounjaroSideEffect(effect){
  const today=todayStr();
  const cur=getMounjaroLog(today)||{};
  const set=new Set(cur.sideEffects||[]);
  if(set.has(effect))set.delete(effect);else set.add(effect);
  setMounjaroLog(today,{sideEffects:[...set]});
  renderToday();
}
function openNauseaMode(){
  setMounjaroLog(todayStr(),{nauseaMode:true});
  const items=(typeof MOUNJARO_PRIORITY_FOODS!=='undefined'?MOUNJARO_PRIORITY_FOODS:[]);
  const html=`<div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px;">Protein first, calories second. Small, cold, bland foods go down easiest. Ginger tea + Sidr honey settle the stomach.</div>`+
    items.map(f=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
      <div><div style="font-size:13px;font-weight:600;">${f.name}</div><div style="font-size:11px;color:var(--text3);">${f.note}</div></div>
      <div style="text-align:right;flex-shrink:0;"><div style="font-size:12px;color:var(--orange);font-weight:700;">${f.protein}g P</div><div style="font-size:11px;color:var(--text3);">${f.cals} cals</div></div>
    </div>`).join('');
  if(typeof _showInfoModal==='function')_showInfoModal('Nausea Mode — Priority Foods',html);
  else alert(items.map(f=>`${f.name} — ${f.protein}g protein, ${f.cals} cals`).join('\n'));
}

// ---- PERSONAL PROFILE (Phase 27) ----
function _personal(){
  return (STATE.profile && STATE.profile.personal) || {};
}

function loadPersonalProfileUI(){
  const p = _personal();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v != null ? v : ''; };
  set('pp-age', p.age);
  set('pp-height', p.heightCm);
  set('pp-sex', p.sex || '');
  set('pp-activity', p.activityLevel || '');
  set('pp-ethnicity', p.ethnicity || '');
  set('pp-phase', p.phase || '');
  set('pp-stretchlbm', p.targetLBMStretch != null ? p.targetLBMStretch : '');
}

async function savePersonalProfile(){
  const ageVal = parseInt(document.getElementById('pp-age').value, 10);
  const heightVal = parseInt(document.getElementById('pp-height').value, 10);
  const sex = document.getElementById('pp-sex').value;
  const activityLevel = document.getElementById('pp-activity').value;
  const ethnicity = document.getElementById('pp-ethnicity').value;
  const phase = document.getElementById('pp-phase').value;
  const stretchLBMVal = parseFloat(document.getElementById('pp-stretchlbm').value);
  const body = {};
  if (!isNaN(ageVal)) body.age = ageVal;
  if (!isNaN(heightVal)) body.heightCm = heightVal;
  if (sex) body.sex = sex;
  if (activityLevel) body.activityLevel = activityLevel;
  if (ethnicity) body.ethnicity = ethnicity;
  if (phase) body.phase = phase;
  if (!isNaN(stretchLBMVal)) body.targetLBMStretch = stretchLBMVal;
  const jwt = localStorage.getItem('forge_token');
  try {
    const res = await fetch('/api/state/profile/personal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
    if (!STATE.profile) STATE.profile = {};
    STATE.profile.personal = { ...body, updatedAt: new Date().toISOString() };
    updateLocalCache();
    showToast('Personal profile saved ✓');
  } catch (e) {
    showToast(e.message || 'Failed to save');
  }
}

// ---- SKIN CARE (Phase 35, owner-only) ----
let _skinEdit=null;

function openSkinProductEdit(id){
  _skinEdit={id};
  const p=id?getSkinProducts().find(x=>x.id===id):{};
  document.getElementById('skin-title').textContent=id?'Edit Skin Product':'Add Skin Product';
  document.getElementById('skin-name').value=p?.name||'';
  document.getElementById('skin-type').value=p?.type||'cleanser';
  document.getElementById('skin-conc').value=p?.concentration||'';
  document.getElementById('skin-slot').value=p?.slot||'am';
  document.getElementById('skin-freq').value=p?.frequency||'daily';
  document.getElementById('skin-started').value=p?.startedDate||new Date().toISOString().slice(0,10);
  document.getElementById('skin-notes').value=p?.notes||'';
  document.getElementById('skin-delete-btn').style.display=id?'block':'none';
  openModal('modal-skin-edit');
}

// When the product type changes, suggest a sensible slot + frequency.
// Only fires on user interaction (programmatic .value sets don't trigger onchange),
// so editing an existing product without touching the type keeps its saved values.
function onSkinTypeChange(){
  const type=document.getElementById('skin-type').value;
  const defaults={
    cleanser:    {slot:'both', freq:'daily'},
    'vitamin-c': {slot:'am',   freq:'daily'},
    retinol:     {slot:'pm',   freq:'every-4-days'},
    serum:       {slot:'pm',   freq:'daily'},
    moisturizer: {slot:'both', freq:'daily'},
    spf:         {slot:'am',   freq:'daily'},
    exfoliant:   {slot:'pm',   freq:'weekly'},
    other:       {slot:'am',   freq:'daily'},
  }[type];
  if(!defaults)return;
  document.getElementById('skin-slot').value=defaults.slot;
  document.getElementById('skin-freq').value=defaults.freq;
}

function saveSkinProduct(){
  if(!_skinEdit)return;
  const name=document.getElementById('skin-name').value.trim();
  if(!name){showToast('Name required');return;}
  const data={
    name,
    type:document.getElementById('skin-type').value,
    concentration:document.getElementById('skin-conc').value.trim(),
    slot:document.getElementById('skin-slot').value,
    frequency:document.getElementById('skin-freq').value,
    startedDate:document.getElementById('skin-started').value,
    notes:document.getElementById('skin-notes').value.trim(),
  };
  if(_skinEdit.id)updateSkinProduct(_skinEdit.id,data);
  else addSkinProduct(data);
  showToast(_skinEdit.id?'Saved ✓':'Product added ✓');
  closeModal('modal-skin-edit');
  _skinEdit=null;
  renderMore();renderToday();
}

function deleteSkinProductFromModal(){
  if(!_skinEdit||!_skinEdit.id)return;
  if(!confirm('Remove this product from your routine?'))return;
  deleteSkinProduct(_skinEdit.id);
  showToast('Removed');
  closeModal('modal-skin-edit');
  _skinEdit=null;
  renderMore();renderToday();
}

// Sunday weekly skin journal
let _skinJournalTrend=null;
function openSkinJournal(){
  _skinJournalTrend=null;
  const existing=getSkinWeeklyCheckIn(todayStr());
  document.getElementById('sj-score').value=existing?.score||7;
  document.getElementById('sj-score-val').textContent=existing?.score||7;
  document.getElementById('sj-notes').value=existing?.notes||'';
  if(existing?.trend)selectSkinTrend(existing.trend);
  else ['better','same','worse'].forEach(t=>{
    const b=document.getElementById('sj-trend-'+t);
    if(b){b.className='btn btn-ghost btn-sm';b.style.color='';b.style.borderColor='';}
  });
  openModal('modal-skin-journal');
}
function selectSkinTrend(trend){
  _skinJournalTrend=trend;
  ['better','same','worse'].forEach(t=>{
    const b=document.getElementById('sj-trend-'+t);
    if(!b)return;
    if(t===trend){b.className='btn btn-lime btn-sm';b.style.color='';b.style.borderColor='';}
    else{b.className='btn btn-ghost btn-sm';b.style.color='';b.style.borderColor='';}
  });
}
function submitSkinJournal(){
  const score=parseInt(document.getElementById('sj-score').value,10)||7;
  if(!_skinJournalTrend){showToast('Pick how it compares to last week');return;}
  const notes=document.getElementById('sj-notes').value.trim().slice(0,200);
  setSkinWeeklyCheckIn(todayStr(),{score,trend:_skinJournalTrend,notes});
  closeModal('modal-skin-journal');
  showToast('Weekly check-in saved ✓');
  renderToday();
}

async function advanceSkinPhase(nextPhase){
  if(!confirm(`Advance retinol to Phase ${nextPhase}? This increases your retinol frequency. Only do this if your skin has been calm.`))return;
  setSkinPhase(nextPhase);
  showToast(`Advanced to Phase ${nextPhase} ✓`);
  renderToday();
}

function toggleSkinItem(itemId){
  const today=todayStr();
  const log=getSkinCareLog(today);
  setSkinItemDone(today,itemId,!log[itemId]);
  renderToday();
}

function setTodaySkinIrritation(level){
  setSkinIrritation(todayStr(),level);
  renderToday();
  const msg={
    'none':'Logged — no reaction ✓',
    'mild-dryness':'Logged — mild dryness is normal',
    'peeling':'Logged — coach will hold your retinol frequency',
    'redness':'Logged — coach will ease off retinol',
    'burning':'Logged — rest retinol for 5 days. Coach will advise.',
  }[level]||'Logged ✓';
  showToast(msg);
}

// ---- BLOOD MARKERS (Phase 29a) ----
let _blmEdit = null;

function _bloodMarkers(){
  return (STATE.profile && Array.isArray(STATE.profile.bloodMarkers)) ? STATE.profile.bloodMarkers : [];
}

function _markerStatus(m){
  if(m.value == null) return 'unknown';
  if(m.refLow != null && m.value < m.refLow) return 'below';
  if(m.refHigh != null && m.value > m.refHigh) return 'above';
  return 'in-range';
}

function _markerColor(status){
  if(status === 'in-range') return 'var(--green)';
  if(status === 'below' || status === 'above') return 'var(--orange)';
  return 'var(--text3)';
}

function renderBloodMarkersList(){
  const markers = _bloodMarkers();
  const el = document.getElementById('blm-list');
  const dateEl = document.getElementById('blm-panel-date');
  if(!el) return;
  if(markers.length === 0){
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px 0;">No blood markers recorded</div>';
    if(dateEl) dateEl.textContent = '';
    return;
  }
  // Find latest panel date for header
  const latestDate = markers.reduce((d, m) => m.date && m.date > d ? m.date : d, '');
  if(dateEl && latestDate){
    const formatted = new Date(latestDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    dateEl.textContent = `Latest panel: ${formatted}`;
  }
  // Group by category, out-of-range first within each
  const byCategory = {};
  for(const m of markers){
    const cat = m.category || 'other';
    if(!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ ...m, _status: _markerStatus(m) });
  }
  const catOrder = ['diabetes', 'liver', 'hormones', 'cholesterol', 'vitamins', 'inflammation', 'kidney', 'thyroid', 'iron', 'fbc', 'prostate', 'gout', 'other'];
  const sortedCats = Object.keys(byCategory).sort((a, b) => {
    const ai = catOrder.indexOf(a), bi = catOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  el.innerHTML = sortedCats.map(cat => {
    const items = byCategory[cat].sort((a, b) => {
      if(a._status !== 'in-range' && b._status === 'in-range') return -1;
      if(a._status === 'in-range' && b._status !== 'in-range') return 1;
      return 0;
    });
    return `
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:10px 0 6px;">${cat}</div>
      ${items.map((m, idx) => {
        const i = markers.findIndex(x => x.id === m.id);
        const c = _markerColor(m._status);
        const refStr = m.refLow != null && m.refHigh != null ? `${m.refLow}–${m.refHigh}` : m.refLow != null ? `>${m.refLow}` : m.refHigh != null ? `<${m.refHigh}` : '';
        return `<div onclick="openBloodMarkerEdit(${i})" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-left:3px solid ${c};border-radius:6px;margin-bottom:4px;cursor:pointer;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:var(--text);">${_esc(m.name)}</div>
            ${refStr ? `<div style="font-size:10px;color:var(--text3);margin-top:1px;">ref ${refStr}${m.unit ? ' ' + _esc(m.unit) : ''}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:13px;color:${c};">${m.value != null ? m.value : '—'}${m.unit ? ` <span style="font-size:10px;color:var(--text3);font-family:inherit;font-weight:400;">${_esc(m.unit)}</span>` : ''}</div>
            ${m._status !== 'in-range' && m._status !== 'unknown' ? `<div style="font-size:9px;color:${c};text-transform:uppercase;letter-spacing:1px;font-weight:700;">${m._status}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    `;
  }).join('');
}

function openBloodMarkerEdit(idx){
  _blmEdit = { idx };
  const m = idx === null ? { name: '', value: '', unit: '', refLow: '', refHigh: '', date: new Date().toISOString().slice(0,10), category: '', notes: '' } : (_bloodMarkers()[idx] || {});
  document.getElementById('blm-title').textContent = idx === null ? 'Add Blood Marker' : 'Edit Blood Marker';
  document.getElementById('blm-name').value = m.name || '';
  document.getElementById('blm-value').value = m.value != null ? m.value : '';
  document.getElementById('blm-unit').value = m.unit || '';
  document.getElementById('blm-reflow').value = m.refLow != null ? m.refLow : '';
  document.getElementById('blm-refhigh').value = m.refHigh != null ? m.refHigh : '';
  document.getElementById('blm-date').value = m.date || new Date().toISOString().slice(0,10);
  document.getElementById('blm-category').value = m.category || '';
  document.getElementById('blm-notes').value = m.notes || '';
  document.getElementById('blm-delete-btn').style.display = idx === null ? 'none' : 'block';
  openModal('modal-blm-edit');
}

async function _saveBloodMarkersToServer(markers){
  const jwt = localStorage.getItem('forge_token');
  const res = await fetch('/api/state/profile/blood-markers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({ bloodMarkers: markers }),
  });
  if(!res.ok){ const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
}

async function saveBloodMarker(){
  if(!_blmEdit) return;
  const name = document.getElementById('blm-name').value.trim();
  if(!name){ showToast('Name required'); return; }
  const valueRaw = document.getElementById('blm-value').value.trim();
  const value = valueRaw === '' ? null : Number(valueRaw);
  if(value != null && !Number.isFinite(value)){ showToast('Value must be a number'); return; }
  const refLowRaw = document.getElementById('blm-reflow').value.trim();
  const refHighRaw = document.getElementById('blm-refhigh').value.trim();
  const refLow = refLowRaw === '' ? null : Number(refLowRaw);
  const refHigh = refHighRaw === '' ? null : Number(refHighRaw);
  const updated = {
    id: _blmEdit.idx !== null ? (_bloodMarkers()[_blmEdit.idx]?.id || ('blm_' + Date.now())) : ('blm_' + Date.now()),
    name,
    value,
    unit: document.getElementById('blm-unit').value.trim(),
    refLow: refLow != null && Number.isFinite(refLow) ? refLow : null,
    refHigh: refHigh != null && Number.isFinite(refHigh) ? refHigh : null,
    date: document.getElementById('blm-date').value,
    category: document.getElementById('blm-category').value,
    notes: document.getElementById('blm-notes').value.trim(),
  };
  const markers = [..._bloodMarkers()];
  if(_blmEdit.idx === null) markers.push(updated);
  else markers[_blmEdit.idx] = updated;
  try {
    await _saveBloodMarkersToServer(markers);
    if(!STATE.profile) STATE.profile = {};
    STATE.profile.bloodMarkers = markers;
    updateLocalCache();
    showToast(_blmEdit.idx === null ? 'Marker added ✓' : 'Saved ✓');
    closeModal('modal-blm-edit');
    _blmEdit = null;
    renderBloodMarkersList();
  } catch(e){ showToast(e.message || 'Save failed'); }
}

async function deleteBloodMarker(){
  if(!_blmEdit || _blmEdit.idx === null) return;
  if(!confirm('Remove this marker?')) return;
  const markers = [..._bloodMarkers()];
  markers.splice(_blmEdit.idx, 1);
  try {
    await _saveBloodMarkersToServer(markers);
    if(!STATE.profile) STATE.profile = {};
    STATE.profile.bloodMarkers = markers;
    updateLocalCache();
    showToast('Removed');
    closeModal('modal-blm-edit');
    _blmEdit = null;
    renderBloodMarkersList();
  } catch(e){ showToast(e.message || 'Delete failed'); }
}

// ---- MEDICATIONS (Phase 27) ----
let _medEdit = null; // { idx: number | null }

function _meds(){
  return (STATE.profile && Array.isArray(STATE.profile.medications)) ? STATE.profile.medications : [];
}

function renderMedsList(){
  const meds = _meds();
  const el = document.getElementById('meds-list');
  if (!el) return;
  if (meds.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px 0;">No medications recorded</div>';
    return;
  }
  el.innerHTML = meds.map((m, i) => `
    <div onclick="openMedEdit(${i})" style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);">${_esc(m.name)}${m.dose ? ` <span style="font-size:11px;color:var(--text3);font-weight:400;">${_esc(m.dose)}</span>` : ''}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${_esc(m.schedule || '—')}</div>
        ${m.notes ? `<div style="font-size:10px;color:var(--text3);margin-top:4px;line-height:1.4;">${_esc(m.notes.slice(0,80))}${m.notes.length > 80 ? '…' : ''}</div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text3);">✏️</div>
    </div>
  `).join('');
}

function openMedEdit(idx) {
  _medEdit = { idx };
  const m = idx === null ? { name: '', dose: '', schedule: '', notes: '' } : (_meds()[idx] || {});
  document.getElementById('med-title').textContent = idx === null ? 'Add Medication' : 'Edit Medication';
  document.getElementById('med-name').value = m.name || '';
  document.getElementById('med-dose').value = m.dose || '';
  document.getElementById('med-schedule').value = m.schedule || '';
  document.getElementById('med-notes').value = m.notes || '';
  document.getElementById('med-delete-btn').style.display = idx === null ? 'none' : 'block';
  openModal('modal-med-edit');
}

async function _saveMedsToServer(meds) {
  const jwt = localStorage.getItem('forge_token');
  const res = await fetch('/api/state/profile/medications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({ medications: meds }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
}

async function saveMedication() {
  if (!_medEdit) return;
  const name = document.getElementById('med-name').value.trim();
  if (!name) { showToast('Name required'); return; }
  const updated = {
    id: _medEdit.idx !== null ? (_meds()[_medEdit.idx]?.id || ('med_' + Date.now())) : ('med_' + Date.now()),
    name,
    dose: document.getElementById('med-dose').value.trim(),
    schedule: document.getElementById('med-schedule').value.trim(),
    notes: document.getElementById('med-notes').value.trim(),
  };
  const meds = [..._meds()];
  if (_medEdit.idx === null) meds.push(updated);
  else meds[_medEdit.idx] = updated;
  try {
    await _saveMedsToServer(meds);
    if (!STATE.profile) STATE.profile = {};
    STATE.profile.medications = meds;
    updateLocalCache();
    showToast(_medEdit.idx === null ? 'Added ✓' : 'Saved ✓');
    closeModal('modal-med-edit');
    _medEdit = null;
    renderMedsList();
  } catch (e) {
    showToast(e.message || 'Save failed');
  }
}

async function deleteMedication() {
  if (!_medEdit || _medEdit.idx === null) return;
  if (!confirm('Remove this medication?')) return;
  const meds = [..._meds()];
  meds.splice(_medEdit.idx, 1);
  try {
    await _saveMedsToServer(meds);
    if (!STATE.profile) STATE.profile = {};
    STATE.profile.medications = meds;
    updateLocalCache();
    showToast('Removed');
    closeModal('modal-med-edit');
    _medEdit = null;
    renderMedsList();
  } catch (e) {
    showToast(e.message || 'Delete failed');
  }
}

// ---- TRAINING SCHEDULE (Phase 38) ----
const _DOW_LABELS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function loadSessionTimesUI(){
  const grid=document.getElementById('session-times-grid');
  if(!grid)return;
  const times=(typeof getSessionTimes==='function')?getSessionTimes():{};
  const order=[1,2,3,4,5,6,0]; // Monday-first
  grid.innerHTML=order.map(d=>{
    const v=times[String(d)]||'';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;font-size:13px;font-weight:600;">${_DOW_LABELS[d]}</div>
      <input type="time" id="st-${d}" value="${v}" style="padding:6px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;" />
      <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;" onclick="document.getElementById('st-${d}').value='';">Clear</button>
    </div>`;
  }).join('');
}
function saveSessionTimesFromUI(){
  const out={};
  for(let d=0;d<7;d++){
    const el=document.getElementById('st-'+d);
    out[String(d)]=(el&&el.value)?el.value:null;
  }
  saveSessionTimes(out);
  showToast('Schedule saved ✓');
  renderToday();
}

// ---- INJURY MANAGEMENT (Phase 38) ----
let _injuryEdit=null; // { id: string | null }
function _allWorkoutExercises(){
  return [
    ...WORKOUTS.upper.exercises.map(e=>({id:e.id,name:e.name,session:'Upper'})),
    ...WORKOUTS.lower.exercises.map(e=>({id:e.id,name:e.name,session:'Lower'})),
  ];
}
function renderInjuryList(){
  const el=document.getElementById('injury-list');
  if(!el)return;
  const all=Object.values((typeof getInjuries==='function')?getInjuries():{});
  if(all.length===0){
    el.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px 0;">No injuries flagged</div>';
    return;
  }
  const sevColor={mild:'#ffc107',moderate:'var(--orange)',severe:'var(--red)'};
  const exList=_allWorkoutExercises();
  all.sort((a,b)=>(a.status==='resolved'?1:0)-(b.status==='resolved'?1:0));
  el.innerHTML=all.map(j=>{
    const resolved=j.status==='resolved';
    const exNames=(j.affectedExercises||[]).map(id=>{const e=exList.find(x=>x.id===id);return e?e.name:id;});
    return `<div onclick="openInjuryEdit('${j.id}')" style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;${resolved?'opacity:.55;':''}">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);">${_esc(j.name)} ${resolved?'<span style="font-size:10px;color:var(--green);">✓ resolved</span>':`<span style="font-size:10px;color:${sevColor[j.severity]||'#ffc107'};text-transform:uppercase;font-weight:700;">${_esc(j.severity)}</span>`}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${_esc(j.bodyPart||'—')}${exNames.length?` · ${exNames.length} lift${exNames.length>1?'s':''} affected`:''}</div>
        ${exNames.length?`<div style="font-size:10px;color:var(--text3);margin-top:3px;">${exNames.map(_esc).join(', ')}</div>`:''}
      </div>
      <div style="font-size:11px;color:var(--text3);">✏️</div>
    </div>`;
  }).join('');
}
function openInjuryEdit(id){
  _injuryEdit={id};
  const j=id?((typeof getInjuries==='function'?getInjuries():{})[id]):null;
  document.getElementById('injury-title').textContent=id?'Edit Injury':'Flag an Injury';
  document.getElementById('injury-name').value=j?.name||'';
  document.getElementById('injury-bodypart').value=j?.bodyPart||'';
  document.getElementById('injury-severity').value=j?.severity||'mild';
  document.getElementById('injury-notes').value=j?.notes||'';
  const affected=new Set(j?.affectedExercises||[]);
  document.getElementById('injury-exercises').innerHTML=_allWorkoutExercises().map(e=>`
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;cursor:pointer;">
      <input type="checkbox" class="injury-ex-cb" value="${e.id}" ${affected.has(e.id)?'checked':''} style="width:16px;height:16px;flex-shrink:0;" />
      <span>${_esc(e.name)} <span style="color:var(--text3);font-size:10px;">${e.session}</span></span>
    </label>`).join('');
  document.getElementById('injury-resolve-btn').style.display=(id&&j&&j.status!=='resolved')?'block':'none';
  document.getElementById('injury-delete-btn').style.display=id?'block':'none';
  openModal('modal-injury-edit');
}
function saveInjuryFromModal(){
  if(!_injuryEdit)return;
  const name=document.getElementById('injury-name').value.trim();
  if(!name){showToast('Name required');return;}
  const data={
    name,
    bodyPart:document.getElementById('injury-bodypart').value.trim(),
    severity:document.getElementById('injury-severity').value,
    notes:document.getElementById('injury-notes').value.trim(),
    affectedExercises:Array.from(document.querySelectorAll('.injury-ex-cb')).filter(c=>c.checked).map(c=>c.value),
  };
  if(_injuryEdit.id)updateInjury(_injuryEdit.id,data);
  else addInjury(data);
  showToast(_injuryEdit.id?'Injury updated ✓':'Injury flagged ✓');
  closeModal('modal-injury-edit');
  _injuryEdit=null;
  renderMore();
}
function resolveInjuryFromModal(){
  if(!_injuryEdit||!_injuryEdit.id)return;
  resolveInjury(_injuryEdit.id);
  showToast('Marked resolved ✓');
  closeModal('modal-injury-edit');
  _injuryEdit=null;
  renderMore();
}
function deleteInjuryFromModal(){
  if(!_injuryEdit||!_injuryEdit.id)return;
  if(!confirm('Delete this injury record permanently?'))return;
  deleteInjury(_injuryEdit.id);
  showToast('Deleted');
  closeModal('modal-injury-edit');
  _injuryEdit=null;
  renderMore();
}

// ---- FOOD PREFERENCES (Phase 24) ----
function _foodPrefs(){
  return (STATE.profile && STATE.profile.foodPrefs) || { excluded: [], notes: '', refreshCadence: 'weekly-sunday' };
}

function _renderFoodPrefsChips(){
  const list = _foodPrefs().excluded || [];
  const wrap = document.getElementById('food-prefs-excluded');
  if(!wrap)return;
  if(list.length === 0){
    wrap.innerHTML = '<div style="font-size:11px;color:var(--text3);">No exclusions yet</div>';
    return;
  }
  wrap.innerHTML = list.map((item,i)=>`
    <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:14px;font-size:11px;">
      <span>${_esc(item)}</span>
      <span onclick="removeFoodPrefExcluded(${i})" style="cursor:pointer;color:var(--text3);font-size:14px;line-height:1;padding:0 2px;" title="Remove">×</span>
    </div>`).join('');
}

function loadFoodPrefsUI(){
  const prefs = _foodPrefs();
  _renderFoodPrefsChips();
  const notes = document.getElementById('food-prefs-notes');
  if(notes) notes.value = prefs.notes || '';
  const cad = document.getElementById('food-prefs-cadence');
  if(cad) cad.value = prefs.refreshCadence || 'weekly-sunday';
}

function addFoodPrefExcluded(){
  const input = document.getElementById('food-prefs-add-input');
  if(!input)return;
  const val = input.value.trim().toLowerCase();
  if(!val)return;
  const prefs = _foodPrefs();
  const list = [...(prefs.excluded||[])];
  if(list.includes(val)){showToast('Already excluded');return;}
  if(list.length >= 50){showToast('Max 50 exclusions');return;}
  list.push(val);
  if(!STATE.profile) STATE.profile = {};
  STATE.profile.foodPrefs = { ...prefs, excluded: list };
  input.value = '';
  _renderFoodPrefsChips();
}

function removeFoodPrefExcluded(i){
  const prefs = _foodPrefs();
  const list = [...(prefs.excluded||[])];
  list.splice(i, 1);
  if(!STATE.profile) STATE.profile = {};
  STATE.profile.foodPrefs = { ...prefs, excluded: list };
  _renderFoodPrefsChips();
}

async function saveFoodPrefs(){
  const notes = (document.getElementById('food-prefs-notes')?.value || '').slice(0, 2000);
  const cad = document.getElementById('food-prefs-cadence')?.value || 'weekly-sunday';
  const prefs = _foodPrefs();
  const body = { excluded: prefs.excluded || [], notes, refreshCadence: cad };
  const jwt = localStorage.getItem('forge_token');
  try{
    const res = await fetch('/api/state/profile/food-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify(body),
    });
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Save failed');}
    if(!STATE.profile) STATE.profile = {};
    STATE.profile.foodPrefs = { ...body, updatedAt: new Date().toISOString() };
    updateLocalCache();
    showToast('Preferences saved ✓');
  }catch(e){
    showToast(e.message || 'Failed to save');
  }
}

// ---- AI COACH (BYOK) ----
function _esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function loadCoachKeyStatus(){
  const jwt=localStorage.getItem('forge_token');
  const status=document.getElementById('coach-status');
  const ctrls=document.getElementById('coach-controls');
  if(!status||!ctrls)return;
  try{
    const res=await fetch('/api/coach/key',{headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok)throw new Error();
    const data=await res.json();
    if(data.hasKey){
      const last=data.lastReportAt?new Date(data.lastReportAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'never';
      status.innerHTML=`<span style="color:var(--lime);">● Connected</span> · last report: ${_esc(last)}`;
      ctrls.innerHTML=`
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-lime btn-sm" style="flex:1;min-width:140px;" onclick="generateCoachReportNow()">Generate Report Now</button>
          <button class="btn btn-ghost btn-sm" onclick="testCoachKey()">Test</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);border-color:var(--red);" onclick="removeCoachKey()">Remove</button>
        </div>`;
    } else {
      status.innerHTML='<span style="color:var(--text3);">○ No key set</span>';
      ctrls.innerHTML=`
        <input id="coach-key-input" type="password" placeholder="sk-ant-..." autocomplete="off" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:monospace;font-size:12px;margin-bottom:8px;" />
        <button class="btn btn-lime btn-sm" style="width:100%;" onclick="saveCoachKey()">Save Key</button>`;
    }
  }catch{
    status.innerHTML='<span style="color:var(--red);">Failed to load coach status</span>';
    ctrls.innerHTML='';
  }
}

async function saveCoachKey(){
  const input=document.getElementById('coach-key-input');
  if(!input)return;
  const apiKey=input.value.trim();
  if(!apiKey.startsWith('sk-ant-')){showToast('Key must start with sk-ant-');return;}
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/coach/key',{
      method:'PUT',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},
      body:JSON.stringify({apiKey}),
    });
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Save failed');}
    input.value='';
    showToast('Key saved ✓');
    loadCoachKeyStatus();
  }catch(e){showToast(e.message||'Failed to save');}
}

async function removeCoachKey(){
  if(!confirm('Remove your Anthropic API key from Forge? Weekly reports will stop.'))return;
  const jwt=localStorage.getItem('forge_token');
  try{
    await fetch('/api/coach/key',{method:'DELETE',headers:{Authorization:'Bearer '+jwt}});
    showToast('Key removed');
    loadCoachKeyStatus();
  }catch{showToast('Failed to remove');}
}

async function testCoachKey(){
  const jwt=localStorage.getItem('forge_token');
  showToast('Testing key…');
  try{
    const res=await fetch('/api/coach/test',{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Test failed');}
    showToast('Key works ✓');
  }catch(e){showToast(e.message||'Key test failed');}
}

// ---- INGREDIENT EDIT / ADD / DELETE (Phase 26a) ----
let _iedit = null; // { mealId, ingIdx: number | null }

function openIngredientEdit(ingIdx){
  if(!_mds)return;
  _iedit = { mealId: _mds.mealId, ingIdx };
  const isNew = ingIdx === null;
  const ing = isNew ? { name: '', cals: 0, protein: 0, carbs: 0, fat: 0 } : (_mds.ingredients[ingIdx] || {});
  document.getElementById('ie-title').textContent = isNew ? 'Add Ingredient' : 'Edit Ingredient';
  document.getElementById('ie-name').value = ing.name || '';
  document.getElementById('ie-cals').value = ing.cals || 0;
  document.getElementById('ie-protein').value = ing.protein || 0;
  document.getElementById('ie-carbs').value = ing.carbs || 0;
  document.getElementById('ie-fat').value = ing.fat || 0;
  document.getElementById('ie-edited-note').style.display = isNew ? 'none' : 'block';
  document.getElementById('ie-delete-btn').style.display = isNew ? 'none' : 'block';
  openModal('modal-ing-edit');
}

async function _saveMealPlanToServer(){
  const jwt = localStorage.getItem('forge_token');
  if(!jwt)throw new Error('Not logged in');
  const res = await fetch('/api/state/meal-plan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({ mealPlan: STATE.mealPlan }),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Save failed');}
}

function _recomputeMealTotals(meal){
  if(!Array.isArray(meal.ingredients))return;
  meal.cals    = meal.ingredients.reduce((s,i)=>s+(+i.cals    ||0),0);
  meal.protein = meal.ingredients.reduce((s,i)=>s+(+i.protein ||0),0);
  meal.carbs   = meal.ingredients.reduce((s,i)=>s+(+i.carbs   ||0),0);
  meal.fat     = meal.ingredients.reduce((s,i)=>s+(+i.fat     ||0),0);
}

async function saveIngredientEdit(){
  if(!_iedit)return;
  const name = (document.getElementById('ie-name').value||'').trim();
  if(!name){showToast('Name required');return;}
  const cals    = Math.max(0, parseInt(document.getElementById('ie-cals').value,10)    || 0);
  const protein = Math.max(0, parseInt(document.getElementById('ie-protein').value,10) || 0);
  const carbs   = Math.max(0, parseInt(document.getElementById('ie-carbs').value,10)   || 0);
  const fat     = Math.max(0, parseInt(document.getElementById('ie-fat').value,10)     || 0);
  const mealId = _iedit.mealId;
  const plan = STATE.mealPlan;
  if(!plan || !plan.meals){showToast('No meal plan');return;}
  const meal = plan.meals.find(m=>m.id===mealId);
  if(!meal){showToast('Meal not found');return;}
  if(!Array.isArray(meal.ingredients)) meal.ingredients = [];
  const updated = { name, cals, protein, carbs, fat, edited: true };
  if(_iedit.ingIdx === null){
    meal.ingredients.push(updated);
  } else {
    meal.ingredients[_iedit.ingIdx] = { ...meal.ingredients[_iedit.ingIdx], ...updated };
  }
  _recomputeMealTotals(meal);
  updateLocalCache();
  try{
    await _saveMealPlanToServer();
    showToast(_iedit.ingIdx === null ? 'Added ✓' : 'Saved ✓');
    closeModal('modal-ing-edit');
    _iedit = null;
    openMealDetail(mealId); // refresh detail modal
  }catch(e){
    showToast(e.message || 'Save failed');
  }
}

async function deleteIngredient(){
  if(!_iedit || _iedit.ingIdx === null)return;
  if(!confirm('Remove this ingredient from the meal?'))return;
  const mealId = _iedit.mealId;
  const meal = STATE.mealPlan?.meals?.find(m=>m.id===mealId);
  if(!meal || !Array.isArray(meal.ingredients))return;
  meal.ingredients.splice(_iedit.ingIdx, 1);
  _recomputeMealTotals(meal);
  updateLocalCache();
  try{
    await _saveMealPlanToServer();
    showToast('Removed');
    closeModal('modal-ing-edit');
    _iedit = null;
    openMealDetail(mealId);
  }catch(e){
    showToast(e.message || 'Delete failed');
  }
}

async function recomputeMacrosNow(){
  if(!confirm('Ask AI Coach to compute exact per-ingredient macros for your current items? Costs ~$0.05–$0.15 of your Anthropic credit. Items will NOT change — only macros.'))return;
  const jwt = localStorage.getItem('forge_token');
  showToast('Computing macros… (10-20s)');
  try{
    const res = await fetch('/api/coach/recompute-macros', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt } });
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Recompute failed');}
    const data = await res.json();
    showToast(`Updated ${data.updated} ingredient${data.updated===1?'':'s'}${data.skipped?` · ${data.skipped} kept (your edits)`:''}`);
    await loadState();
    if(typeof renderFood==='function') renderFood();
  }catch(e){
    showToast(e.message || 'Failed to recompute');
  }
}

// Phase 33: AI session brief (Haiku 4.5, auto on workout open)
async function requestSessionBrief(sessionType, prescriptions, cacheKey){
  const jwt = localStorage.getItem('forge_token');
  if(!jwt) return;
  // Skip if no API key — silently
  const hasKey = STATE.profile?.foodPrefs ? true : null;
  try {
    const res = await fetch('/api/coach/session-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ sessionType, prescriptions }),
    });
    if(!res.ok){
      // Hide loading slot silently — no toast, brief is supplementary
      const slot = document.getElementById('ai-brief-slot');
      if(slot) slot.style.display = 'none';
      return;
    }
    const data = await res.json();
    if(!data.brief) return;
    // Cache the brief
    if(!STATE.sessionBriefs) STATE.sessionBriefs = {};
    STATE.sessionBriefs[cacheKey] = data.brief;
    updateLocalCache();
    // Render the strategy
    const slot = document.getElementById('ai-brief-slot');
    if(slot && typeof _renderBriefHTML === 'function'){
      slot.outerHTML = _renderBriefHTML(data.brief);
    }
    // Render per-exercise cues
    for(const item of (data.brief.perExercise || [])){
      const el = document.getElementById('cue-' + item.exId);
      if(el && item.cue){
        el.textContent = item.cue;
        el.style.display = 'block';
      }
    }
  } catch(e){
    const slot = document.getElementById('ai-brief-slot');
    if(slot) slot.style.display = 'none';
  }
}

// Post-session reflection: 1-sentence acknowledgement, runs on workout exit
async function requestSessionReflection(sessionType, completedSession){
  const jwt = localStorage.getItem('forge_token');
  if(!jwt) return;
  try {
    const res = await fetch('/api/coach/session-reflection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ sessionType, completedSession }),
    });
    if(!res.ok) return;
    const data = await res.json();
    if(data.reflection){
      // Show as a longer toast (5s)
      _showLongToast('🧠 ' + data.reflection, 6000);
    }
  } catch {}
}

function _showLongToast(msg, durationMs){
  const t = document.createElement('div');
  t.className = 'toast show';
  t.style.cssText = 'position:fixed;bottom:calc(var(--safe-bottom)+76px);left:50%;transform:translateX(-50%);background:var(--s2);border:1px solid var(--lime);color:var(--text);font-size:12px;font-weight:600;padding:12px 20px;border-radius:16px;z-index:999;max-width:90vw;text-align:center;line-height:1.5;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, durationMs || 5000);
}

async function askCoachMaxLBM(){
  if(!confirm('Ask AI Coach to compute your realistic LBM ceiling? Uses ~$0.10–$0.20 of your Anthropic credit. Opus 4.7 will analyze your demographics, blood markers, medications, training history.'))return;
  const jwt=localStorage.getItem('forge_token');
  showToast('Analysing your data… (20-40s)');
  try{
    const res=await fetch('/api/coach/max-lbm',{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Failed');}
    const data=await res.json();
    const p=data.projection;
    const html=`<div style="line-height:1.6;">
      <div style="font-size:14px;font-family:'Archivo Black',sans-serif;margin-bottom:14px;">Realistic LBM Ceiling Analysis</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;text-align:center;">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Conservative</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--text);">${p.conservativeLBM}<span style="font-size:10px;color:var(--text3);">kg LBM</span></div>
          <div style="font-size:11px;color:var(--text2);">= ${p.conservativeWeightAt15}kg @ 15%</div>
        </div>
        <div style="padding:10px;background:var(--bg2);border:1px solid var(--lime);border-radius:8px;text-align:center;">
          <div style="font-size:9px;color:var(--lime);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Realistic</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--lime);">${p.realisticLBM}<span style="font-size:10px;color:var(--text3);">kg LBM</span></div>
          <div style="font-size:11px;color:var(--text2);">= ${p.realisticWeightAt15}kg @ 15%</div>
        </div>
        <div style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;text-align:center;">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Optimistic</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--text);">${p.optimisticLBM}<span style="font-size:10px;color:var(--text3);">kg LBM</span></div>
          <div style="font-size:11px;color:var(--text2);">= ${p.optimisticWeightAt15}kg @ 15%</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Timeline · Phase Plan</div>
      <div style="font-size:13px;color:var(--text);margin-bottom:10px;">~${p.timelineMonths} months. ${_esc(p.phaseSequence)}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Why</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px;">${_esc(p.rationale)}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Key Constraints</div>
      <ul style="margin:0 0 14px 18px;padding:0;font-size:12px;color:var(--text2);">
        ${(p.keyConstraints||[]).map(c=>`<li style="margin-bottom:4px;">${_esc(c)}</li>`).join('')}
      </ul>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="_setStretchFromAI(${p.realisticLBM})">Set Stretch LBM Target to ${p.realisticLBM}kg</button>
    </div>`;
    _showInfoModal('AI Coach Analysis', html);
  }catch(e){showToast(e.message||'Failed to compute');}
}

function _setStretchFromAI(lbm){
  const el=document.getElementById('pp-stretchlbm');
  if(el)el.value=lbm;
  closeModal('modal-info');
  showToast('Stretch LBM set — tap Save Personal Profile to confirm');
}

function _showInfoModal(title, htmlBody){
  let m = document.getElementById('modal-info');
  if(!m){
    m = document.createElement('div');
    m.id = 'modal-info';
    m.className = 'modal-bg';
    m.innerHTML = `<div class="modal" style="max-height:85vh;overflow-y:auto;">
      <div class="modal-hdr"><div class="modal-title" id="modal-info-title">Info</div><button class="modal-close" onclick="closeModal('modal-info')">✕</button></div>
      <div id="modal-info-body"></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if(e.target === m) closeModal('modal-info'); });
  }
  document.getElementById('modal-info-title').textContent = title;
  document.getElementById('modal-info-body').innerHTML = htmlBody;
  openModal('modal-info');
}

async function regeneratePlanNow(){
  if(!confirm('Regenerate your meal plan with AI Coach? Costs ~$0.50–$1 of your Anthropic credit. Respects your Food Preferences.'))return;
  const jwt=localStorage.getItem('forge_token');
  showToast('Generating plan… (20-40s)');
  try{
    const res=await fetch('/api/coach/regenerate-plan',{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Generation failed');}
    const data=await res.json();
    showToast(`Plan: ${data.name} · ${data.meals} meals ✓`);
    await loadState();
    if(typeof renderFood==='function') renderFood();
  }catch(e){showToast(e.message||'Failed to generate plan');}
}

async function generateCoachReportNow(){
  if(!confirm('Generate a report now? Uses ~$0.25–$0.75 of your Anthropic credit.'))return;
  const jwt=localStorage.getItem('forge_token');
  showToast('Generating report… (10-30s)');
  try{
    const res=await fetch('/api/coach/generate-now',{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Generation failed');}
    const data=await res.json();
    showToast(`Report ready · ${data.suggestions} suggestion${data.suggestions===1?'':'s'}`);
    // Refresh state so the new report is visible
    await loadState();
    loadCoachKeyStatus();
  }catch(e){showToast(e.message||'Failed to generate');}
}

async function applyCoachSuggestion(rid,sid){
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch(`/api/coaching-reports/${rid}/apply/${sid}`,{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Apply failed');}
    const data=await res.json();
    if(data.state)STATE={...STATE,...data.state};
    showToast('Applied ✓');
    renderCoach();
  }catch(e){showToast(e.message||'Failed to apply');}
}

async function dismissCoachSuggestion(rid,sid){
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch(`/api/coaching-reports/${rid}/dismiss/${sid}`,{method:'POST',headers:{Authorization:'Bearer '+jwt}});
    if(!res.ok)throw new Error();
    // Locally mark dismissed
    const rep=(STATE.coachingReports||[]).find(r=>r.id===rid);
    if(rep){const s=(rep.suggestions||[]).find(x=>x.id===sid);if(s)s.dismissed=true;}
    showToast('Dismissed');
    renderCoach();
  }catch{showToast('Failed');}
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
    ['weightLog','foods','stepsLog','exLog','measLog','sleepLog','swimLog','supps','suppDone','water','foodTemplates','supplements','supplementLog',
     'waterLog','fastingLog','mounjaroLog','notifications'].forEach(k=>{
      STATE[k] = Array.isArray(STATE[k]) ? [] : {};
    });
    // Phase 40: also clear wearable connections (encrypted tokens)
    delete STATE.ouraToken; delete STATE.ouraLastSync; delete STATE.withings; delete STATE.oura;
    const jwt=localStorage.getItem('forge_token');
    if(jwt){
      fetch('/api/oura/token',{method:'DELETE',headers:{Authorization:'Bearer '+jwt}}).catch(()=>{});
      fetch('/api/withings/disconnect',{method:'DELETE',headers:{Authorization:'Bearer '+jwt}}).catch(()=>{});
    }
    saveStateNow();
    renderAll();
    showToast('Data cleared — reconnect Oura & Withings in More settings');
  }
}

// ============================================================
// PHASE 41o — DEXA SCAN LOG
// ============================================================
function openDexaEdit(id){
  const existing=id?getDexaScans().find(s=>s.id===id):null;
  const set=(elId,v)=>{const el=document.getElementById(elId);if(el)el.value=v==null?'':v;};
  document.getElementById('dexa-title').textContent=existing?'Edit DEXA Scan':'Add DEXA Scan';
  document.getElementById('dexa-id').value=id||'';
  set('dexa-date',existing?existing.date:todayStr());
  set('dexa-provider',existing?existing.provider:'BodyView Edgbaston');
  set('dexa-weight',existing?existing.weight:'');
  set('dexa-bf',existing?existing.bodyFatPct:'');
  set('dexa-fat',existing?existing.fatMass:'');
  set('dexa-lean',existing?existing.leanMass:'');
  set('dexa-bone',existing?existing.boneMass:'');
  set('dexa-vat',existing?existing.vatCm2:'');
  set('dexa-bmd',existing?existing.bmdTotal:'');
  set('dexa-tscore',existing?existing.tScore:'');
  set('dexa-zscore',existing?existing.zScore:'');
  set('dexa-lmi',existing?existing.lmi:'');
  set('dexa-almi',existing?existing.almi:'');
  set('dexa-fmi',existing?existing.fmi:'');
  set('dexa-symm',existing?existing.muscleSymmetryPct:'');
  set('dexa-android',existing?existing.androidFatPct:'');
  set('dexa-gynoid',existing?existing.gynoidFatPct:'');
  set('dexa-longevity',existing?existing.longevityIndex:'');
  set('dexa-notes',existing?existing.notes:'');
  document.getElementById('dexa-delete-btn').style.display=id?'block':'none';
  openModal('modal-dexa');
}
function saveDexaScan(){
  const id=document.getElementById('dexa-id').value;
  const val=elId=>{const v=document.getElementById(elId).value;return v===''?null:v;};
  const data={
    date:document.getElementById('dexa-date').value||todayStr(),
    provider:document.getElementById('dexa-provider').value.trim(),
    weight:val('dexa-weight'),
    bodyFatPct:val('dexa-bf'),
    fatMass:val('dexa-fat'),
    leanMass:val('dexa-lean'),
    boneMass:val('dexa-bone'),
    vatCm2:val('dexa-vat'),
    bmdTotal:val('dexa-bmd'),
    tScore:val('dexa-tscore'),
    zScore:val('dexa-zscore'),
    lmi:val('dexa-lmi'),
    almi:val('dexa-almi'),
    fmi:val('dexa-fmi'),
    muscleSymmetryPct:val('dexa-symm'),
    androidFatPct:val('dexa-android'),
    gynoidFatPct:val('dexa-gynoid'),
    longevityIndex:val('dexa-longevity'),
    notes:document.getElementById('dexa-notes').value.trim(),
  };
  if(!data.bodyFatPct&&!data.leanMass&&!data.fatMass){showToast('Enter at least body fat %, lean or fat mass');return;}
  if(id&&typeof updateDexaScan==='function')updateDexaScan(id,data);
  else if(typeof addDexaScan==='function')addDexaScan(data);
  closeModal('modal-dexa');
  showToast(id?'Scan updated ✓':'Scan saved ✓');
  if(typeof renderTrack==='function')renderTrack();
}
function deleteDexaScanFromModal(){
  const id=document.getElementById('dexa-id').value;
  if(!id)return;
  if(!confirm('Delete this DEXA scan? This cannot be undone.'))return;
  if(typeof deleteDexaScan==='function')deleteDexaScan(id);
  closeModal('modal-dexa');
  showToast('Scan deleted');
  if(typeof renderTrack==='function')renderTrack();
}
function showDexaHistory(){
  const scans=getDexaScans();
  if(scans.length<2){showToast('Only one scan logged');return;}
  const sorted=[...scans].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const html=sorted.map(s=>{
    const vatBand=getDexaVATBand(s.vatCm2);
    const tBand=getDexaTScoreBand(s.tScore);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeModal('modal-info');setTimeout(()=>openDexaEdit('${_esc(s.id)}'),120);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-size:13px;font-weight:600;">${fmtDate(s.date)}</div>
        <div style="font-size:11px;color:var(--text3);">${_esc(s.provider||'')}</div>
      </div>
      <div style="font-size:11px;color:var(--text2);margin-top:4px;display:flex;gap:14px;flex-wrap:wrap;">
        ${s.bodyFatPct!=null?`<span>BF ${s.bodyFatPct.toFixed(1)}%</span>`:''}
        ${s.leanMass!=null?`<span>Lean ${s.leanMass.toFixed(1)}kg</span>`:''}
        ${s.vatCm2!=null?`<span style="color:${vatBand?vatBand.color:'var(--text2)'};">VAT ${s.vatCm2}cm²</span>`:''}
        ${s.tScore!=null?`<span style="color:${tBand?tBand.color:'var(--text2)'};">T ${s.tScore.toFixed(1)}</span>`:''}
      </div>
    </div>`;
  }).join('');
  if(typeof _showInfoModal==='function')_showInfoModal('DEXA History',html);
}

// ============================================================
// PHASE 41l — BLOOD PRESSURE LOGGING
// ============================================================
function openBPEdit(){
  document.getElementById('bp-date').value=todayStr();
  document.getElementById('bp-time').value=fmtNow();
  document.getElementById('bp-systolic').value='';
  document.getElementById('bp-diastolic').value='';
  document.getElementById('bp-pulse').value='';
  document.getElementById('bp-arm').value='left';
  document.getElementById('bp-position').value='sitting';
  document.getElementById('bp-notes').value='';
  openModal('modal-bp');
  setTimeout(()=>{const el=document.getElementById('bp-systolic');if(el)el.focus();},100);
}
function saveBPReading(){
  const sys=parseInt(document.getElementById('bp-systolic').value,10);
  const dia=parseInt(document.getElementById('bp-diastolic').value,10);
  if(!sys||sys<60||sys>250){showToast('Enter systolic 60–250');return;}
  if(!dia||dia<30||dia>200){showToast('Enter diastolic 30–200');return;}
  const pulse=parseInt(document.getElementById('bp-pulse').value,10);
  const reading={
    date:document.getElementById('bp-date').value||todayStr(),
    time:document.getElementById('bp-time').value||fmtNow(),
    systolic:sys,
    diastolic:dia,
    pulse:(pulse&&pulse>=30&&pulse<=220)?pulse:null,
    arm:document.getElementById('bp-arm').value||'left',
    position:document.getElementById('bp-position').value||'sitting',
    notes:document.getElementById('bp-notes').value.trim(),
  };
  if(typeof addBPReading==='function')addBPReading(reading);
  closeModal('modal-bp');
  const band=(typeof getBPBand==='function')?getBPBand(sys,dia):null;
  showToast(`Logged ${sys}/${dia}${band?' · '+band.label:''} ✓`);
  // Crisis warning
  if(sys>=180||dia>=120){
    setTimeout(()=>alert('⚠️ HYPERTENSIVE CRISIS RANGE\n\nReading ≥180 systolic OR ≥120 diastolic = medical emergency.\n\nSit quietly 5 min · re-check.\nIf still in this range or you have chest pain, shortness of breath, vision changes: call 999 / NHS 111 immediately.'),500);
  }
  if(typeof renderTrack==='function')renderTrack();
}
function delBPReading(id){
  if(!confirm('Delete this BP reading?'))return;
  if(typeof deleteBPReading==='function')deleteBPReading(id);
  if(typeof renderTrack==='function')renderTrack();
}

// ============================================================
// PHASE 41j — ADMIN STATS (owner-only)
// ============================================================
async function loadAdminStats(){
  const el=document.getElementById('admin-stats-body');
  if(!el)return;
  el.innerHTML='<span style="color:var(--text3);">Loading…</span>';
  const jwt=localStorage.getItem('forge_token');
  try{
    const res=await fetch('/api/admin/stats',{headers:{Authorization:'Bearer '+jwt}});
    if(res.status===403){el.innerHTML='<span style="color:var(--red);">Owner only</span>';return;}
    if(!res.ok){const e=await res.json().catch(()=>({}));el.innerHTML='<span style="color:var(--red);">Error: '+_esc(e.error||res.status)+'</span>';return;}
    const d=await res.json();
    const fmt=v=>v==null?'—':String(v);
    const dateOnly=s=>s?String(s).slice(0,10):'—';
    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;">
        <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Total users</div><div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:var(--lime);">${fmt(d.total)}</div></div>
        <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Active 7d</div><div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:var(--green);">${fmt(d.active7d)}</div></div>
        <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Active 30d</div><div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:var(--text);">${fmt(d.active30d)}</div></div>
        <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Push devices</div><div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:var(--text);">${fmt(d.pushDevices)}<span style="font-size:11px;color:var(--text3);"> · ${fmt(d.usersWithPush)}u</span></div></div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:12px;padding-top:10px;border-top:1px solid var(--border);line-height:1.6;">
        🧠 BYOK coaching keys: <strong style="color:var(--text2);">${fmt(d.hasCoachingKey)}</strong> ·
        💍 Oura: <strong style="color:var(--text2);">${fmt(d.hasOura)}</strong> ·
        ⚖️ Withings: <strong style="color:var(--text2);">${fmt(d.hasWithings)}</strong>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px;">First signup: ${dateOnly(d.firstSignup)} · Latest: ${dateOnly(d.latestSignup)}</div>
      ${d.users&&d.users.length?`
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Users (sorted by recent activity)</div>
          ${d.users.map(u=>`<div style="font-size:11px;padding:6px 0;display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--border);">
            <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;min-width:0;">${_esc(u.email)}</span>
            <span style="color:var(--text3);flex-shrink:0;">${u.daysSinceUpdate===0?'today':u.daysSinceUpdate+'d ago'}${u.hasKey?' 🧠':''}${u.hasOura?' 💍':''}${u.hasWithings?' ⚖️':''}</span>
          </div>`).join('')}
        </div>`:''}
      <div style="font-size:9px;color:var(--text3);margin-top:10px;text-align:right;">Generated ${new Date(d.generatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
    `;
  }catch(e){
    el.innerHTML='<span style="color:var(--red);">Error: '+_esc(e.message||'network')+'</span>';
  }
}

// ============================================================
// PHASE 41i — CARDIO LOG
// ============================================================
let _cardioEffort=null;
function selectCardioEffort(effort){
  _cardioEffort=effort;
  document.querySelectorAll('.cardio-effort-btn').forEach(b=>{
    if(b.dataset.effort===effort){b.style.background='var(--lime)';b.style.color='var(--bg)';b.style.fontWeight='700';}
    else{b.style.background='';b.style.color='';b.style.fontWeight='';}
  });
}
function openCardioLog(date){
  date=date||todayStr();
  const existing=getCardioLog(date)||{};
  document.getElementById('cardio-date').value=date;
  document.getElementById('cardio-title').textContent=existing.duration?'Edit Cardio Session':'Log Cardio Session';
  document.getElementById('cardio-type').value=existing.type||'zone-2';
  document.getElementById('cardio-duration').value=existing.duration||'';
  document.getElementById('cardio-hr').value=existing.avgHr||'';
  document.getElementById('cardio-notes').value=existing.notes||'';
  _cardioEffort=existing.perceivedEffort||null;
  // reset all buttons then highlight selected
  document.querySelectorAll('.cardio-effort-btn').forEach(b=>{b.style.background='';b.style.color='';b.style.fontWeight='';});
  if(_cardioEffort)selectCardioEffort(_cardioEffort);
  openModal('modal-cardio');
}
function saveCardioLog(){
  const date=document.getElementById('cardio-date').value||todayStr();
  const duration=parseInt(document.getElementById('cardio-duration').value,10);
  if(!duration||duration<5){showToast('Enter duration ≥5 min');return;}
  const hr=parseInt(document.getElementById('cardio-hr').value,10);
  const entry={
    type:document.getElementById('cardio-type').value,
    duration:Math.min(180,duration),
    avgHr:(hr&&hr>=60&&hr<=200)?hr:null,
    perceivedEffort:_cardioEffort||null,
    notes:document.getElementById('cardio-notes').value.trim().slice(0,200),
    date,
  };
  setCardioLog(date,entry);
  closeModal('modal-cardio');
  _cardioEffort=null;
  showToast(`Cardio logged ✓ ${duration} min`);
  if(typeof renderWorkout==='function')renderWorkout();
}

// ============================================================
// PHASE 41 — GUIDED STRETCH MODE (owner-only)
// ============================================================
let sm = { active:false, type:null, idx:0, side:null, repCount:0, sideStartedAt:0, totalStartedAt:0, timerInterval:null, paused:false };

function _smRoutine(){ return (typeof STRETCH_ROUTINES!=='undefined')?STRETCH_ROUTINES[sm.type]:null; }
function _smCurrent(){ const r=_smRoutine(); return r?r.stretches[sm.idx]:null; }

function _smClearTimer(){ if(sm.timerInterval){clearInterval(sm.timerInterval);sm.timerInterval=null;} }
function _smClose(){
  _smClearTimer();
  document.getElementById('stretchMode').style.display='none';
  sm.active=false;
  if(typeof renderWorkout==='function')renderWorkout();
  if(typeof renderToday==='function')renderToday();
  if(typeof renderMore==='function')renderMore();
}

function startStretchMode(type){
  if(typeof isStretchUser!=='function'||!isStretchUser()){showToast('Not available');return;}
  if(!STRETCH_ROUTINES[type]){showToast('Unknown routine');return;}
  sm = {active:true, type, idx:0, side:null, repCount:0, sideStartedAt:0, totalStartedAt:Date.now(), timerInterval:null, paused:false};
  document.getElementById('stretchMode').style.display='block';
  renderSmOutline();
}

function renderSmOutline(){
  _smClearTimer();
  const r=_smRoutine(); if(!r)return _smClose();
  const today=todayStr();
  const log=getStretchLog(today)[sm.type]||{};
  const done=log.completedStretches||[];
  const skipped=log.skippedStretches||[];
  document.getElementById('smContent').innerHTML=`
    <button onclick="_smClose()" style="background:none;border:none;color:var(--text2);font-size:24px;cursor:pointer;float:right;margin-top:-4px;">✕</button>
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">${sm.type==='morning'?'🌅 Morning':'🌙 Evening'}</div>
    <div style="font-family:'Archivo Black',sans-serif;font-size:22px;margin:4px 0 4px;letter-spacing:-.3px;">${r.title}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">${r.subtitle}</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:20px;">${r.totalMinutes} min · ${r.stretches.length} stretches · best time: ${r.bestTime}</div>
    <div style="margin-bottom:20px;">
      ${r.stretches.map((s,i)=>{
        const did=done.includes(s.id), skp=skipped.includes(s.id);
        const dot=did?'✓':skp?'↷':String(i+1);
        const color=did?'var(--green)':skp?'var(--text3)':'var(--text2)';
        const dur=s.unit==='seconds'?Math.round(s.duration)+'s':s.duration+' '+s.unit;
        const sided=s.sides?' · L+R':'';
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="width:28px;height:28px;border-radius:50%;background:${did?'var(--green)':'var(--s2)'};color:${did?'var(--bg)':color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;">${dot}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:${did?'var(--text)':skp?'var(--text3)':'var(--text)'};${skp?'text-decoration:line-through;':''}">${s.name}</div>
            <div style="font-size:10px;color:var(--text3);">${dur}${sided}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-lime btn-full" style="padding:14px;font-size:15px;" onclick="smBeginSession()">${done.length+skipped.length>0?'Continue session →':'Begin session →'}</button>
  `;
}

function smBeginSession(){
  const today=todayStr();
  const log=getStretchLog(today)[sm.type]||{};
  const done=log.completedStretches||[];
  const skipped=log.skippedStretches||[];
  const r=_smRoutine();
  // resume at first undone/unskipped stretch
  sm.idx=r.stretches.findIndex(s=>!done.includes(s.id)&&!skipped.includes(s.id));
  if(sm.idx<0){ smShowDone(); return; }
  renderSmActive();
}

function renderSmActive(){
  _smClearTimer();
  const s=_smCurrent(); if(!s)return smShowDone();
  const r=_smRoutine();
  const isTimed=s.unit==='seconds';
  const isReps=!isTimed;
  if(s.sides && !sm.side) sm.side='left';
  if(!s.sides) sm.side=null;
  sm.repCount=0;
  sm.sideStartedAt=Date.now();

  const sideLabel=s.sides?`<div style="font-family:'Archivo Black',sans-serif;font-size:28px;color:var(--lime);letter-spacing:1px;margin-bottom:8px;">${sm.side==='left'?'LEFT SIDE':'RIGHT SIDE'}</div>`:'';

  const timerHtml=isTimed?`
    <div style="text-align:center;padding:24px 0;">
      <div id="sm-timer" style="font-family:'Archivo Black',sans-serif;font-size:80px;letter-spacing:-3px;color:var(--blue);line-height:1;">${s.duration}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">seconds</div>
    </div>
    <button class="btn btn-ghost btn-full" style="margin-bottom:10px;" onclick="smPauseToggle()">⏸ Pause</button>
  `:`
    <div style="text-align:center;padding:24px 0;">
      <div id="sm-reps" style="font-family:'Archivo Black',sans-serif;font-size:80px;letter-spacing:-3px;color:var(--lime);line-height:1;">0<span style="font-size:30px;color:var(--text3);">/${s.duration}</span></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">${s.unit}</div>
    </div>
    <button class="btn btn-lime btn-full" style="margin-bottom:10px;padding:16px;font-size:16px;" onclick="smIncrementRep()">+ Rep</button>
  `;

  document.getElementById('smContent').innerHTML=`
    <button onclick="_smClose()" style="background:none;border:none;color:var(--text2);font-size:24px;cursor:pointer;float:right;margin-top:-4px;">✕</button>
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">${sm.idx+1} of ${r.stretches.length}</div>
    <div style="font-family:'Archivo Black',sans-serif;font-size:24px;margin:4px 0 8px;letter-spacing:-.5px;">${s.name}</div>
    ${sideLabel}
    <div style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:14px;">${_esc(s.instructions)}</div>
    <div style="font-size:11px;color:var(--text2);background:var(--s2);border-left:3px solid var(--lime);padding:10px 12px;border-radius:6px;margin-bottom:10px;line-height:1.5;">${_esc(s.benefit)}</div>
    <div style="font-size:11px;color:var(--lime);font-style:italic;margin-bottom:14px;line-height:1.5;">💡 ${_esc(s.cue)}</div>
    ${s.injury_note?`<div style="font-size:11px;color:#ffc107;background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.3);padding:8px 12px;border-radius:6px;margin-bottom:14px;">⚕️ ${_esc(s.injury_note)}</div>`:''}
    ${timerHtml}
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="smPrevStretch()" ${sm.idx===0?'disabled':''}>← Back</button>
      <button class="btn btn-ghost btn-sm" style="flex:1;color:var(--text3);" onclick="smSkipStretch()">Skip</button>
    </div>
  `;

  if(isTimed){
    sm.paused=false;
    let remaining=s.duration;
    sm.timerInterval=setInterval(()=>{
      if(sm.paused)return;
      remaining--;
      const t=document.getElementById('sm-timer');
      if(t)t.textContent=Math.max(0,remaining);
      if(remaining<=0){
        _smClearTimer();
        if(t){t.style.color='var(--green)';}
        if(navigator.vibrate)navigator.vibrate(180);
        setTimeout(_smAdvanceFromTimer,500);
      }
    },1000);
  }
}

function smPauseToggle(){ sm.paused=!sm.paused; showToast(sm.paused?'Paused':'Resumed'); }

function smIncrementRep(){
  const s=_smCurrent(); if(!s)return;
  sm.repCount++;
  const el=document.getElementById('sm-reps');
  if(el)el.innerHTML=`${sm.repCount}<span style="font-size:30px;color:var(--text3);">/${s.duration}</span>`;
  if(sm.repCount>=s.duration){
    if(navigator.vibrate)navigator.vibrate(180);
    setTimeout(_smAdvanceFromTimer,300);
  }
}

function _smAdvanceFromTimer(){
  const s=_smCurrent(); if(!s)return;
  if(s.sides && sm.side==='left'){
    // switch sides
    sm.side='right';
    showToast('Switch to right side');
    renderSmActive();
    return;
  }
  smCompleteStretch();
}

function smCompleteStretch(){
  _smClearTimer();
  const s=_smCurrent(); if(!s)return;
  markStretchDone(todayStr(),sm.type,s.id);
  sm.side=null;
  const r=_smRoutine();
  if(sm.idx>=r.stretches.length-1){ smShowDone(); return; }
  renderSmRest(r.stretches[sm.idx+1]);
}

function smSkipStretch(){
  _smClearTimer();
  const s=_smCurrent(); if(!s)return;
  markStretchSkipped(todayStr(),sm.type,s.id);
  sm.side=null;
  const r=_smRoutine();
  if(sm.idx>=r.stretches.length-1){ smShowDone(); return; }
  renderSmRest(r.stretches[sm.idx+1]);
}

function smPrevStretch(){
  _smClearTimer();
  if(sm.idx===0)return;
  sm.idx--;
  sm.side=null;
  renderSmActive();
}

function renderSmRest(next){
  _smClearTimer();
  const REST=10;
  document.getElementById('smContent').innerHTML=`
    <button onclick="_smClose()" style="background:none;border:none;color:var(--text2);font-size:24px;cursor:pointer;float:right;margin-top:-4px;">✕</button>
    <div style="text-align:center;margin-top:60px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;font-weight:700;">Next up</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:24px;margin:8px 0 16px;">${_esc(next.name)}</div>
      <div id="sm-rest" style="font-family:'Archivo Black',sans-serif;font-size:64px;color:var(--lime);">${REST}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">rest</div>
    </div>
    <button class="btn btn-lime btn-full" style="margin-top:30px;" onclick="smSkipRest()">Skip rest →</button>
  `;
  let r=REST;
  sm.timerInterval=setInterval(()=>{
    r--;
    const el=document.getElementById('sm-rest');
    if(el)el.textContent=Math.max(0,r);
    if(r<=0){ _smClearTimer(); smSkipRest(); }
  },1000);
}

function smSkipRest(){
  _smClearTimer();
  sm.idx++;
  renderSmActive();
}

function smShowDone(){
  _smClearTimer();
  const today=todayStr();
  const log=getStretchLog(today)[sm.type]||{};
  const r=_smRoutine();
  const done=(log.completedStretches||[]).length;
  const skipped=(log.skippedStretches||[]).length;
  const totalMin=Math.max(1,Math.round((Date.now()-sm.totalStartedAt)/60000));
  // streak preview (will be re-saved properly in smSaveFeel)
  const projectedStreak=getStretchStreak(sm.type)+(isRoutineComplete(today,sm.type)?0:1);
  document.getElementById('smContent').innerHTML=`
    <button onclick="_smClose()" style="background:none;border:none;color:var(--text2);font-size:24px;cursor:pointer;float:right;margin-top:-4px;">✕</button>
    <div style="text-align:center;margin-top:30px;">
      <div style="font-size:50px;margin-bottom:8px;">✨</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:24px;margin-bottom:6px;">${r.title} complete</div>
      <div style="font-size:13px;color:var(--text2);">${done} of ${r.stretches.length} stretches · ${totalMin} min${skipped?` · ${skipped} skipped`:''}</div>
      <div style="font-size:12px;color:var(--lime);margin-top:8px;">🔥 Day ${projectedStreak} of streak</div>
    </div>
    <div style="margin-top:30px;">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px;text-align:center;">How are you feeling?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <button class="btn btn-ghost btn-sm" style="padding:14px 0;" onclick="smSaveFeel('better')">Better</button>
        <button class="btn btn-ghost btn-sm" style="padding:14px 0;" onclick="smSaveFeel('same')">Same</button>
        <button class="btn btn-ghost btn-sm" style="padding:14px 0;" onclick="smSaveFeel('unsure')">Unsure</button>
      </div>
    </div>
    <button class="btn btn-lime btn-full" style="margin-top:20px;" onclick="smSaveFeel(null)">Save & close</button>
  `;
}

function smSaveFeel(feel){
  saveStretchSession(todayStr(),sm.type,feel);
  showToast(`${sm.type==='morning'?'Morning':'Evening'} routine saved ✓`);
  _smClose();
}
const NOTIF_AREA_ICON={food:'🍳',training:'🏋️',supplements:'💊',skin:'🧴',water:'💧'};
function _gapRowHtml(g){
  const ic=NOTIF_AREA_ICON[g.area]||'•';
  return `<button data-area="${_esc(g.area)}" data-date="${_esc(g.date)}" onclick="notifAction(this)" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-top:6px;cursor:pointer;color:var(--text);font-family:inherit;">
    <span style="font-size:14px;">${ic}</span>
    <span style="flex:1;font-size:12px;line-height:1.4;">${_esc(g.label)}</span>
    <span style="font-size:10px;color:var(--text3);flex-shrink:0;">Fix →</span>
  </button>`;
}
function openNotifications(){
  const list=(typeof getNotifications==='function')?getNotifications():[];
  let html;
  if(!list.length){
    html='<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0;">No notifications</div>';
  }else{
    const icon={medication:'💊',training:'🏋️',nutrition:'🥗',coach:'🧠','morning-recap':'🌅'};
    html=list.map(n=>{
      const gapsHtml=Array.isArray(n.gaps)&&n.gaps.length?n.gaps.map(_gapRowHtml).join(''):'';
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border);${n.read?'opacity:.65;':''}">
        <div style="font-size:13px;font-weight:600;color:var(--text);">${icon[n.type]||'🔔'} ${_esc(n.title)}</div>
        ${gapsHtml?'':`<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-top:3px;">${_esc(n.message||'')}</div>`}
        ${gapsHtml}
        <div style="font-size:10px;color:var(--text3);margin-top:6px;">${_esc(n.date||'')}</div>
      </div>`;
    }).join('');
  }
  if(typeof _showInfoModal==='function')_showInfoModal('Notifications',html);
  if(typeof markAllNotificationsRead==='function')markAllNotificationsRead();
  setTimeout(()=>{if(typeof renderToday==='function'&&document.getElementById('page-today').classList.contains('active'))renderToday();},150);
}
function notifAction(btn){
  const area=btn.dataset.area, date=btn.dataset.date;
  if(typeof closeModal==='function')closeModal('modal-info');
  setTimeout(()=>{
    switch(area){
      case 'food':
        if(typeof setFoodViewDate==='function'){setFoodViewDate(date);if(typeof nav==='function')nav('food');}
        break;
      case 'training':
        if(typeof renderDayDetail==='function')renderDayDetail(date);
        else showToast('Open the Track page to edit this date');
        break;
      case 'supplements': openSupplementBackfill(date); break;
      case 'skin': openSkinBackfill(date); break;
      case 'water': openWaterBackfill(date); break;
    }
  },120);
}

// ---- BACKFILL MODALS (Phase 41) ----
function _fmtDateUK(date){
  try{return new Date(date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});}
  catch{return date;}
}
function openSupplementBackfill(date){
  const supps=(typeof getSupplements==='function')?getSupplements():[];
  if(!supps.length){showToast('No supplements configured');return;}
  const log=(typeof getSupplementLog==='function')?getSupplementLog(date):{};
  const dow=new Date(date+'T12:00:00').getDay();
  const due=supps.filter(s=>!(s.frequency==='weekly-wednesday'&&dow!==3));
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  const html=`<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">${_fmtDateUK(date)} — tick what you actually took</div>`+
    due.map(s=>{
      const on=log[s.id]===true;
      return `<div onclick="toggleSuppBackfill('${date}','${_esc(s.id)}',${!on})" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;min-height:42px;">
        <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--lime)':s.critical?'var(--orange)':'var(--border)'};background:${on?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:${on?'var(--text)':'var(--text2)'};">${_esc(s.name)}${s.critical&&!on?' <span style="color:var(--orange);font-size:11px;">⚠️</span>':''}</div>
          <div style="font-size:11px;color:var(--text3);">${_esc(s.dose||'')}</div>
        </div>
      </div>`;
    }).join('');
  if(typeof _showInfoModal==='function')_showInfoModal('Backfill supplements',html);
}
function toggleSuppBackfill(date,id,taken){
  if(typeof setSupplementTaken==='function')setSupplementTaken(date,id,taken);
  openSupplementBackfill(date);
}
function openSkinBackfill(date){
  if(typeof isOwner!=='function'||!isOwner()){showToast('Not available');return;}
  if(typeof getSkinVisibleItems!=='function'){showToast('Skin care not configured');return;}
  const v=getSkinVisibleItems(date);
  const items=[...(v.am||[]),...(v.pm||[])];
  if(!items.length){showToast('No skin items due that day');return;}
  const log=(typeof getSkinCareLog==='function')?getSkinCareLog(date):{};
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  const html=`<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">${_fmtDateUK(date)} — backfill what you actually did</div>`+
    items.map(it=>{
      const on=log[it.itemId]===true;
      return `<div onclick="toggleSkinBackfill('${date}','${_esc(it.itemId)}',${!on})" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;min-height:42px;">
        <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--lime)':'var(--border)'};background:${on?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
        <div style="flex:1;font-size:13px;color:${on?'var(--text)':'var(--text2)'};">${_esc(it.product.name)} <span style="font-size:10px;color:var(--text3);text-transform:uppercase;">${_esc(it.slot)}</span></div>
      </div>`;
    }).join('');
  if(typeof _showInfoModal==='function')_showInfoModal('Backfill skin care',html);
}
function toggleSkinBackfill(date,itemId,done){
  if(typeof setSkinItemDone==='function')setSkinItemDone(date,itemId,done);
  openSkinBackfill(date);
}
function openWaterBackfill(date){
  const v=prompt(`Add water for ${_fmtDateUK(date)} (ml):`,'');
  if(v==null)return;
  const ml=parseInt(v,10);
  if(!ml||ml<=0||ml>5000){showToast('Enter 1–5000ml');return;}
  if(typeof addWaterEntry==='function')addWaterEntry(date,ml,'backfill');
  showToast(`+${ml}ml logged for ${date}`);
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
    const data=await res.json().catch(()=>null);
    if(data&&data.user&&data.user.email){
      window._forgeUserEmail=data.user.email;
      localStorage.setItem('forge_email',data.user.email);
    }
    return true;
  }catch{return true;} // offline = let them in (cached forge_email still works)
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
  // Phase 19 + 39: pre-populate supplements for Jay if empty (canonical 9 with timing/critical)
  if(STATE.profile && !STATE.supplements){
    if(STATE.profile.email==='jay@afjltd.co.uk' || (STATE.profile.name && STATE.profile.name.toLowerCase().startsWith('jay'))){
      STATE.supplements=JAY_SUPPLEMENTS_V39();
      saveStateNow();
    } else {
      STATE.supplements=[];
      saveStateNow();
    }
  }

  // Phase 22a: populate progress baseline for Jay (client-side fallback)
  if(STATE.profile && !STATE.profile.progressMigrationApplied){
    if(STATE.profile.email==='jay@afjltd.co.uk' || (STATE.profile.name && STATE.profile.name.toLowerCase().startsWith('jay'))){
      STATE.profile.startDate='2026-05-11';
      STATE.profile.startWeight=113.5;
      STATE.profile.startBF=32.1;
      STATE.profile.startLBM=Math.round(113.5*(1-32.1/100)*100)/100;
      STATE.profile.targetWeight=90;
      STATE.profile.targetBF=15;
      STATE.profile.targetLBM=Math.round(90*(1-15/100)*100)/100;
      STATE.profile.targetVisceralFat=10;
      STATE.profile.progressMigrationApplied=true;
      saveStateNow();
    }
  }

  // Phase 20: migrate time-based exercise sets
  runPhase20Migration();

  // Phase 39: water migration + dynamic calorie targets
  if(typeof migrateWaterCups==='function')migrateWaterCups();
  // Phase 40: prune expired notifications
  if(typeof dismissExpiredNotifications==='function')dismissExpiredNotifications();
  if(STATE.profile && typeof applyDynamicTargets==='function'){
    const dt=STATE.profile.dynamicTargets;
    if(!dt||dt.calculatedFrom!==getCurrentWeight())applyDynamicTargets();
    if(STATE.profile.dynamicTargets&&STATE.profile.dynamicTargets.milestoneJustHit){
      const mc=STATE.profile.dynamicTargets.milestoneCount;
      setTimeout(()=>showToast(`🎉 ${mc*5}kg milestone! Targets recalculated for your new weight.`),1200);
    }
  }

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
