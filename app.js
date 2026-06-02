// ========================================
//  LifeLog — app.js
//  Firebase Auth + Firestore backend
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- PASTE YOUR FIREBASE CONFIG HERE ----
// Get this from Firebase Console → Project Settings → Your apps → Web app
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// -----------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ========================================
//  AUTH
// ========================================

window.loginUser = async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) return showError('Please fill in all fields.');
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError(friendlyError(e.code));
  }
};

window.signupUser = async () => {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;
  if (!name || !email || !pass) return showError('Please fill in all fields.');
  if (pass.length < 6) return showError('Password must be at least 6 characters.');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
  } catch (e) {
    showError(friendlyError(e.code));
  }
};

window.loginWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    showError(friendlyError(e.code));
  }
};

window.logoutUser = async () => {
  await signOut(auth);
};

window.showSignup = () => {
  document.getElementById('login-form').style.display  = 'none';
  document.getElementById('signup-form').style.display = 'block';
  clearError();
};
window.showLogin = () => {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('login-form').style.display  = 'block';
  clearError();
};

function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}
function clearError() {
  const el = document.getElementById('auth-error');
  el.style.display = 'none';
}
function friendlyError(code) {
  const map = {
    'auth/user-not-found':      'No account found with this email.',
    'auth/wrong-password':      'Incorrect password. Try again.',
    'auth/email-already-in-use':'An account with this email already exists.',
    'auth/invalid-email':       'Please enter a valid email address.',
    'auth/weak-password':       'Password must be at least 6 characters.',
    'auth/popup-closed-by-user':'Sign-in window was closed.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user-display').textContent = user.displayName || user.email;
    currentUser = user;
    render();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    currentUser = null;
    data = {};
  }
});

// ========================================
//  DATA LAYER
// ========================================

let currentUser = null;
let data = {};
let saveTimer = null;

function docRef() {
  return doc(db, 'users', currentUser.uid, 'data', 'tracker');
}

async function loadData() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(docRef());
    data = snap.exists() ? (snap.data().tracker || {}) : {};
  } catch (e) {
    console.error('Load error:', e);
    data = {};
  }
}

async function saveData() {
  if (!currentUser) return;
  try {
    await setDoc(docRef(), { tracker: data }, { merge: true });
    showToast('Saved ✓');
  } catch (e) {
    console.error('Save error:', e);
    showToast('Save failed');
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveData, 800);
}

function showToast(msg) {
  let t = document.querySelector('.save-toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'save-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ========================================
//  STATE
// ========================================

const DAYS      = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

let weekOffset = 0;
let selectedDay = { gym: 0, water: 0, study: 0 };

function localDateStr(d) {
  // Format date as YYYY-MM-DD using LOCAL time (not UTC)
  // This avoids the timezone shift bug where toISOString() converts to UTC
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekDates(offset) {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = now.getDate() - dow + (dow === 0 ? -6 : 1); // shift to Monday
  const mon = new Date(now);
  mon.setDate(diff + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return localDateStr(d); // ✅ use local time, not UTC
  });
}

function getWeekKey(offset) { return getWeekDates(offset)[0]; }

function fmt(iso) {
  // Parse date parts directly to avoid timezone shifts
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d); // local time constructor
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getDayData(section, dayIdx) {
  const wk = getWeekKey(weekOffset);
  if (!data[wk]) data[wk] = {};
  if (!data[wk][section]) data[wk][section] = {};
  if (!data[wk][section][dayIdx]) {
    data[wk][section][dayIdx] = section === 'gym'
      ? { workouts: [], note: '' }
      : section === 'water'
        ? { cups: 0, goal: 8 }
        : { sessions: [], note: '' };
  }
  return data[wk][section][dayIdx];
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ========================================
//  NAVIGATION
// ========================================

window.changeWeek = async (dir) => {
  weekOffset += dir;
  selectedDay = { gym: 0, water: 0, study: 0 };
  await loadData();
  render();
};

window.switchTab = (tab) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`sec-${tab}`).classList.add('active');
  if (tab === 'overview') renderOverview();
  else if (tab === 'gym')  renderGym();
  else if (tab === 'water') renderWater();
  else if (tab === 'study') renderStudy();
};

async function render() {
  await loadData();
  const dates = getWeekDates(weekOffset);
  const label = weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `${weekOffset < 0 ? weekOffset : '+'+weekOffset} weeks`;
  document.getElementById('week-label').textContent = label;
  document.getElementById('week-range').textContent = fmt(dates[0]) + ' – ' + fmt(dates[6]);

  const activeTab = document.querySelector('.tab.active');
  const tab = activeTab ? activeTab.dataset.tab : 'overview';
  if (tab === 'overview') renderOverview();
  else if (tab === 'gym')  renderGym();
  else if (tab === 'water') renderWater();
  else if (tab === 'study') renderStudy();
}

// ========================================
//  DAY GRID
// ========================================

function renderDayGrid(containerId, section) {
  const dates = getWeekDates(weekOffset);
  const today = localDateStr(new Date()); // ✅ local date
  const el = document.getElementById(containerId);
  el.innerHTML = dates.map((date, i) => {
    const dd = getDayData(section, i);
    const hasData = section === 'gym' ? dd.workouts.length > 0
      : section === 'water' ? dd.cups > 0
      : dd.sessions.length > 0;
    const isSel = selectedDay[section] === i;
    const isToday = date === today;
    const selCls = isSel ? `sel-${section}` : '';
    const hasCls = hasData ? 'has-data' : '';
    const todayCls = isToday ? 'today' : '';
    return `<button class="day-btn ${selCls} ${hasCls} ${todayCls}" onclick="selDay('${section}',${i})">
      <span class="day-name">${DAYS[i]}</span>
      <span class="day-num">${(() => { const [y,m,d] = date.split('-').map(Number); return new Date(y,m-1,d).getDate(); })()}</span>
      <div class="day-dot"></div>
    </button>`;
  }).join('');
}

window.selDay = (section, i) => {
  selectedDay[section] = i;
  if (section === 'gym')   renderGym();
  if (section === 'water') renderWater();
  if (section === 'study') renderStudy();
};

// ========================================
//  GYM
// ========================================

function renderGym() {
  renderDayGrid('gym-days', 'gym');
  const i = selectedDay.gym;
  const dd = getDayData('gym', i);
  const dates = getWeekDates(weekOffset);
  document.getElementById('gym-day-label').textContent = DAYS_FULL[i];
  document.getElementById('gym-date-label').textContent = (() => { const [y,m,d] = dates[i].split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); })();

  const el = document.getElementById('gym-content');
  let html = '';

  if (dd.workouts.length === 0) {
    html += `<div class="empty-state"><i class="ti ti-barbell"></i>No workouts logged for ${DAYS_FULL[i]}.<br>Add one below.</div>`;
  } else {
    html += '<ul class="workout-list">';
    dd.workouts.forEach((w, wi) => {
      const detail = [w.sets ? w.sets+'×'+w.reps : w.reps, w.weight ? w.weight+'kg' : ''].filter(Boolean).join(' @ ');
      html += `<li class="workout-item" id="gi-${wi}">
        <span class="tag tag-${esc(w.type)}">${esc(w.type)}</span>
        <span class="workout-name">${esc(w.name)}</span>
        <span class="workout-detail">${esc(detail)}</span>
        <div class="row-actions">
          <button class="act-btn" onclick="editGym(${wi})" title="Edit"><i class="ti ti-pencil"></i></button>
          <button class="act-btn danger" onclick="delGym(${wi})" title="Delete"><i class="ti ti-trash"></i></button>
        </div>
      </li>`;
    });
    html += '</ul>';
  }

  html += `<div class="add-section">
    <div class="add-section-label">Add workout</div>
    <div class="form-row">
      <select id="g-type" class="form-input w110">
        <option value="strength">Strength</option>
        <option value="cardio">Cardio</option>
        <option value="hiit">HIIT</option>
        <option value="flexibility">Flexibility</option>
      </select>
      <input id="g-name" class="form-input flex2" placeholder="Exercise name" />
      <input id="g-sets" class="form-input w60" placeholder="Sets" />
      <input id="g-reps" class="form-input w60" placeholder="Reps" />
      <input id="g-weight" class="form-input w60" placeholder="kg" />
      <button class="btn-add btn-add-gym" onclick="addGym()"><i class="ti ti-plus"></i> Add</button>
    </div>
    <textarea class="note-area" placeholder="Session notes…" onchange="saveGymNote(this.value)">${esc(dd.note||'')}</textarea>
  </div>`;

  el.innerHTML = html;
  const nameEl = el.querySelector('#g-name');
  if (nameEl) nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') addGym(); });
}

window.addGym = () => {
  const name = document.getElementById('g-name').value.trim();
  if (!name) { document.getElementById('g-name').focus(); return; }
  const dd = getDayData('gym', selectedDay.gym);
  dd.workouts.push({
    type:   document.getElementById('g-type').value,
    name,
    sets:   document.getElementById('g-sets').value.trim(),
    reps:   document.getElementById('g-reps').value.trim(),
    weight: document.getElementById('g-weight').value.trim()
  });
  scheduleSave();
  renderGym();
  renderDayGrid('gym-days', 'gym');
};

window.delGym = (wi) => {
  const dd = getDayData('gym', selectedDay.gym);
  dd.workouts.splice(wi, 1);
  scheduleSave();
  renderGym();
  renderDayGrid('gym-days', 'gym');
};

window.editGym = (wi) => {
  const dd = getDayData('gym', selectedDay.gym);
  const w = dd.workouts[wi];
  const li = document.getElementById(`gi-${wi}`);
  li.outerHTML = `<div class="edit-row" id="gi-${wi}">
    <select id="ew-type" class="edit-input" style="width:105px">
      <option value="strength"${w.type==='strength'?' selected':''}>Strength</option>
      <option value="cardio"${w.type==='cardio'?' selected':''}>Cardio</option>
      <option value="hiit"${w.type==='hiit'?' selected':''}>HIIT</option>
      <option value="flexibility"${w.type==='flexibility'?' selected':''}>Flexibility</option>
    </select>
    <input id="ew-name" class="edit-input" value="${esc(w.name)}" placeholder="Name" style="flex:2;min-width:90px" />
    <input id="ew-sets" class="edit-input" value="${esc(w.sets||'')}" placeholder="Sets" style="width:55px" />
    <input id="ew-reps" class="edit-input" value="${esc(w.reps||'')}" placeholder="Reps" style="width:55px" />
    <input id="ew-weight" class="edit-input" value="${esc(w.weight||'')}" placeholder="kg" style="width:55px" />
    <button class="btn-save" onclick="saveGym(${wi})">Save</button>
    <button class="btn-cancel" onclick="renderGym()">Cancel</button>
  </div>`;
};

window.saveGym = (wi) => {
  const dd = getDayData('gym', selectedDay.gym);
  dd.workouts[wi] = {
    type:   document.getElementById('ew-type').value,
    name:   document.getElementById('ew-name').value.trim(),
    sets:   document.getElementById('ew-sets').value.trim(),
    reps:   document.getElementById('ew-reps').value.trim(),
    weight: document.getElementById('ew-weight').value.trim()
  };
  scheduleSave();
  renderGym();
};

window.saveGymNote = (val) => {
  getDayData('gym', selectedDay.gym).note = val;
  scheduleSave();
};

// ========================================
//  WATER
// ========================================

function renderWater() {
  renderDayGrid('water-days', 'water');
  const i = selectedDay.water;
  const dd = getDayData('water', i);
  document.getElementById('water-day-label').textContent = DAYS_FULL[i];

  const goal = dd.goal || 8;
  const pct = Math.min(100, Math.round((dd.cups / goal) * 100));

  let cups = '';
  for (let c = 0; c < goal; c++) {
    const filled = c < dd.cups;
    cups += `<div class="cup${filled?' filled':''}" onclick="toggleCup(${c})" title="Glass ${c+1}">
      <i class="ti ti-${filled?'droplet-filled':'droplet'}"></i>
    </div>`;
  }

  document.getElementById('water-content').innerHTML = `<div class="content-body">
    <div class="water-goal-row">
      <i class="ti ti-target" style="font-size:16px"></i>
      Daily goal:
      <input type="number" class="form-input water-focus" value="${goal}" min="1" max="20" style="width:58px" onchange="setWaterGoal(this.value)" />
      glasses
    </div>
    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-label">${dd.cups} of ${goal} glasses — ${pct}%</div>
    </div>
    <div class="cup-grid">${cups}</div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn-add btn-add-water" onclick="adjustCups(-1)"><i class="ti ti-minus"></i> Remove</button>
      <button class="btn-add btn-add-water" onclick="adjustCups(1)"><i class="ti ti-plus"></i> Add glass</button>
    </div>
  </div>`;
}

window.toggleCup = (idx) => {
  const dd = getDayData('water', selectedDay.water);
  dd.cups = idx < dd.cups ? idx : idx + 1;
  scheduleSave();
  renderWater();
  renderDayGrid('water-days', 'water');
};

window.adjustCups = (d) => {
  const dd = getDayData('water', selectedDay.water);
  dd.cups = Math.max(0, Math.min(dd.goal||8, dd.cups + d));
  scheduleSave();
  renderWater();
  renderDayGrid('water-days', 'water');
};

window.setWaterGoal = (val) => {
  const dd = getDayData('water', selectedDay.water);
  dd.goal = Math.max(1, parseInt(val)||8);
  dd.cups = Math.min(dd.cups, dd.goal);
  scheduleSave();
  renderWater();
};

// ========================================
//  STUDY
// ========================================

function renderStudy() {
  renderDayGrid('study-days', 'study');
  const i = selectedDay.study;
  const dd = getDayData('study', i);
  const dates = getWeekDates(weekOffset);
  document.getElementById('study-day-label').textContent = DAYS_FULL[i];
  document.getElementById('study-date-label').textContent = (() => { const [y,m,d] = dates[i].split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); })();

  const el = document.getElementById('study-content');
  let html = '';

  if (dd.sessions.length === 0) {
    html += `<div class="empty-state"><i class="ti ti-book"></i>No study sessions logged for ${DAYS_FULL[i]}.</div>`;
  } else {
    const total = dd.sessions.reduce((s, x) => s + parseFloat(x.hours||0), 0);
    html += `<div style="padding:8px 18px 0;font-size:12px;color:var(--c-text-2)">Total: <strong style="color:var(--c-study)">${total.toFixed(1)}h</strong></div>`;
    html += '<ul class="study-list">';
    dd.sessions.forEach((s, si) => {
      html += `<li class="study-item" id="si-${si}">
        <i class="ti ti-books" style="color:var(--c-study);font-size:16px;flex-shrink:0"></i>
        <span class="study-subject">${esc(s.subject)}</span>
        <span class="study-topic">${esc(s.topic||'')}</span>
        <span class="study-hours">${s.hours}h</span>
        <div class="row-actions">
          <button class="act-btn" onclick="editStudy(${si})" title="Edit"><i class="ti ti-pencil"></i></button>
          <button class="act-btn danger" onclick="delStudy(${si})" title="Delete"><i class="ti ti-trash"></i></button>
        </div>
      </li>`;
    });
    html += '</ul>';
  }

  html += `<div class="add-section">
    <div class="add-section-label">Add study session</div>
    <div class="form-row">
      <input id="s-subject" class="form-input flex2 study-focus" placeholder="Subject / Course" />
      <input id="s-topic"   class="form-input flex2 study-focus" placeholder="Topic (optional)" />
      <input id="s-hours"   class="form-input w70 study-focus" type="number" placeholder="Hours" min="0.25" max="24" step="0.25" />
      <button class="btn-add btn-add-study" onclick="addStudy()"><i class="ti ti-plus"></i> Add</button>
    </div>
    <textarea class="note-area" placeholder="Study notes…" onchange="saveStudyNote(this.value)">${esc(dd.note||'')}</textarea>
  </div>`;

  el.innerHTML = html;
  const subEl = el.querySelector('#s-subject');
  if (subEl) subEl.addEventListener('keydown', e => { if (e.key === 'Enter') addStudy(); });
}

window.addStudy = () => {
  const subject = document.getElementById('s-subject').value.trim();
  const hours   = parseFloat(document.getElementById('s-hours').value);
  if (!subject) { document.getElementById('s-subject').focus(); return; }
  if (!hours)   { document.getElementById('s-hours').focus(); return; }
  const dd = getDayData('study', selectedDay.study);
  dd.sessions.push({ subject, topic: document.getElementById('s-topic').value.trim(), hours: +hours.toFixed(2) });
  scheduleSave();
  renderStudy();
  renderDayGrid('study-days', 'study');
};

window.delStudy = (si) => {
  const dd = getDayData('study', selectedDay.study);
  dd.sessions.splice(si, 1);
  scheduleSave();
  renderStudy();
  renderDayGrid('study-days', 'study');
};

window.editStudy = (si) => {
  const dd = getDayData('study', selectedDay.study);
  const s = dd.sessions[si];
  const li = document.getElementById(`si-${si}`);
  li.outerHTML = `<div class="edit-row" id="si-${si}">
    <input id="es-subject" class="edit-input" value="${esc(s.subject)}" placeholder="Subject" style="flex:1.5;min-width:80px" />
    <input id="es-topic"   class="edit-input" value="${esc(s.topic||'')}" placeholder="Topic" style="flex:2;min-width:80px" />
    <input id="es-hours"   class="edit-input" type="number" value="${s.hours}" min="0.25" step="0.25" style="width:65px" />
    <button class="btn-save" onclick="saveStudy(${si})">Save</button>
    <button class="btn-cancel" onclick="renderStudy()">Cancel</button>
  </div>`;
};

window.saveStudy = (si) => {
  const dd = getDayData('study', selectedDay.study);
  dd.sessions[si] = {
    subject: document.getElementById('es-subject').value.trim(),
    topic:   document.getElementById('es-topic').value.trim(),
    hours:   +parseFloat(document.getElementById('es-hours').value).toFixed(2)
  };
  scheduleSave();
  renderStudy();
};

window.saveStudyNote = (val) => {
  getDayData('study', selectedDay.study).note = val;
  scheduleSave();
};

// ========================================
//  OVERVIEW
// ========================================

function renderOverview() {
  let gymDays = 0, totalCups = 0, cupDays = 0, totalStudy = 0;
  for (let i = 0; i < 7; i++) {
    const g = getDayData('gym', i);
    const w = getDayData('water', i);
    const s = getDayData('study', i);
    if (g.workouts.length > 0) gymDays++;
    if (w.cups > 0) { totalCups += w.cups; cupDays++; }
    totalStudy += s.sessions.reduce((sum, x) => sum + parseFloat(x.hours||0), 0);
  }

  document.getElementById('ov-gym').textContent   = gymDays;
  document.getElementById('ov-water').textContent  = cupDays > 0 ? Math.round(totalCups/cupDays) : 0;
  document.getElementById('ov-study').textContent  = totalStudy.toFixed(1)+'h';

  let rows = `<div class="ov-header">
    <span></span>
    <span style="color:var(--c-gym)"><i class="ti ti-barbell" style="font-size:13px"></i> Gym</span>
    <span style="color:var(--c-water)"><i class="ti ti-droplet" style="font-size:13px"></i> Water</span>
    <span style="color:var(--c-study)"><i class="ti ti-book" style="font-size:13px"></i> Study</span>
  </div>`;

  const dates = getWeekDates(weekOffset);
  const today = localDateStr(new Date()); // ✅ local date
  for (let i = 0; i < 7; i++) {
    const g = getDayData('gym', i);
    const w = getDayData('water', i);
    const s = getDayData('study', i);
    const isToday = dates[i] === today;

    const gymV  = g.workouts.length > 0
      ? `<span class="ov-val-gym">${g.workouts.length} exercise${g.workouts.length>1?'s':''}</span>`
      : `<span class="ov-empty">—</span>`;
    const waterV = w.cups > 0
      ? `<span class="ov-val-water">${w.cups}/${w.goal||8} glasses</span>`
      : `<span class="ov-empty">—</span>`;
    const studyHrs = s.sessions.reduce((sum, x) => sum + parseFloat(x.hours||0), 0);
    const studyV = studyHrs > 0
      ? `<span class="ov-val-study">${studyHrs.toFixed(1)}h</span>`
      : `<span class="ov-empty">—</span>`;

    rows += `<div class="ov-row">
      <span class="ov-day" style="${isToday?'color:var(--c-accent)':''}">${DAYS[i]}</span>
      ${gymV}${waterV}${studyV}
    </div>`;
  }
  document.getElementById('ov-table').innerHTML = rows;
}
