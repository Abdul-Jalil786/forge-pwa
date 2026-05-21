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

// ---- WATER ----
function setWater(cups){saveWater(cups);renderMore();renderToday();showToast(`${cups} cups 💧`);}
function resetWater(){saveWater(0);renderMore();renderToday();}

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

function toggleSkinItem(itemId){
  const today=todayStr();
  const log=getSkinCareLog(today);
  setSkinItemDone(today,itemId,!log[itemId]);
  renderToday();
}

function setTodaySkinIrritation(level){
  setSkinIrritation(todayStr(),level);
  renderToday();
  showToast(level==='irritated'?'Logged — AI will ramp slower':'Logged ✓');
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
