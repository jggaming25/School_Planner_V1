let profile = null;
let subjects = [];
let schoolClasses = [];
let schoolModules = {};
let currentPage = 'dashboard';
let allSchoolUsers = [];

const ROLE_LABELS = { super_admin: 'CEO', ceo: 'CEO', head_admin: 'Head Admin', admin: 'Admin', supporter: 'Supporter', school_admin: 'Schulleiter', teacher: 'Lehrer', student: 'Schüler' };
const SYSTEM_ROLES = ['super_admin','ceo','head_admin','admin','supporter'];
const STAFF_ROLES = [...SYSTEM_ROLES, 'school_admin','teacher'];

async function initApp() {
  const user = await initAuth();
  if (!user) { window.location.href = 'index.html'; return; }
  profile = currentProfile;
  if (!profile) { window.location.href = 'index.html'; return; }
  if (!profile.setup_complete && (profile.role === 'teacher' || profile.role === 'student')) {
    showSetupRequired();
    return;
  }
  updateUserUI();
  if (profile.school_id) {
    await Promise.all([loadAllData(), loadAllSchoolUsers(), loadSchoolSettings()]);
    applyModuleVisibility();
  }
  checkAnnouncements();
  const startPage = SYSTEM_ROLES.includes(profile.role) ? 'admin' : 'dashboard';
  navigateTo(startPage);
}

function showSetupRequired() {
  const el = document.querySelector('.main-content');
  el.innerHTML = `<div class="page-body" style="display:flex;align-items:center;justify-content:center;min-height:100vh">
    <div class="card" style="max-width:440px;text-align:center;padding:40px">
      <h2 class="mb-16">Profil einrichten</h2>
      <p class="mb-24" style="color:var(--text-secondary)">Bitte schließe dein Profil ab, um fortzufahren.</p>
      <div class="input-group" style="text-align:left"><label>Vollständiger Name</label><input type="text" class="input-field" id="setup-name" value="${escapeHtml(profile.full_name || '')}"></div>
      <div class="input-group" style="text-align:left"><label>E-Mail (Pflicht)</label><input type="email" class="input-field" id="setup-email" value="${escapeHtml(profile.email || currentUser?.email || '')}"></div>
      ${profile.role === 'student' ? '<div class="input-group" style="text-align:left"><label>Klasse (Pflicht)</label><input type="text" class="input-field" id="setup-class"></div>' : ''}
      <div class="input-group" style="text-align:left"><label>Adresse</label><input type="text" class="input-field" id="setup-address"></div>
      <div class="input-group" style="text-align:left"><label>Telefon</label><input type="tel" class="input-field" id="setup-phone"></div>
      <div class="input-group" style="text-align:left"><label>Neues Passwort (Pflicht)</label><input type="password" class="input-field" id="setup-password" placeholder="Min. 6 Zeichen"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="completeSetup()">Einrichtung abschließen</button>
    </div>
  </div>`;
}

async function completeSetup() {
  const email = document.getElementById('setup-email').value;
  const password = document.getElementById('setup-password').value;
  if (!email || !password) { showToast('E-Mail und Passwort sind Pflicht', 'error'); return; }
  if (profile.role === 'student' && !document.getElementById('setup-class')?.value) {
    showToast('Klasse ist Pflicht für Schüler', 'error'); return;
  }
  try {
    if (password && password.length >= 6) {
      await _sb.auth.updateUser({ password });
    }
    await updateProfile(currentUser.id, {
      full_name: document.getElementById('setup-name').value,
      email: email,
      class_name: document.getElementById('setup-class')?.value || profile.class_name,
      address: document.getElementById('setup-address')?.value,
      phone: document.getElementById('setup-phone')?.value,
      setup_complete: true,
      force_email: false
    });
    if (currentUser.email !== email) {
      try { await _sb.auth.updateUser({ email }); } catch(e) { console.warn('Email update:', e.message); }
    }
    showToast('Profil eingerichtet!', 'success');
    location.reload();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

function hasSchool() {
  return profile && profile.school_id && typeof profile.school_id === 'string' && profile.school_id.length === 36;
}

function updateUserUI() {
  if (!profile) return;
  const initials = profile.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '?';
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent = profile.full_name || 'Unbekannt';
  const roleText = ROLE_LABELS[profile.role] || profile.role;
  const classText = profile.class_name ? ' · ' + profile.class_name : '';
  document.getElementById('user-role').textContent = roleText + classText;
  if (hasSchool()) {
    getSchool(profile.school_id).then(school => {
      if (school) {
        const roleEl = document.getElementById('user-role');
        roleEl.textContent = roleText + classText + ' · ' + school.name;
      }
    });
  }

  const inSchool = hasSchool();
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = SYSTEM_ROLES.includes(profile.role) ? 'block' : 'none');
  document.querySelectorAll('.school-admin-only').forEach(el => {
    const canManage = profile.role === 'school_admin' || (SYSTEM_ROLES.includes(profile.role) && inSchool);
    el.style.display = canManage ? 'block' : 'none';
  });
  document.querySelectorAll('.teacher-only').forEach(el => el.style.display = ['teacher','school_admin'].includes(profile.role) || SYSTEM_ROLES.includes(profile.role) ? 'block' : 'none');
  document.querySelectorAll('.student-only').forEach(el => el.style.display = profile.role ? 'block' : 'none');
  document.querySelectorAll('.has-school').forEach(el => {
    el.style.display = inSchool ? 'block' : 'none';
  });
}

async function loadAllSchoolUsers() {
  if (!profile?.school_id) { allSchoolUsers = []; return; }
  const users = await dbGet('profiles', { school_id: profile.school_id });
  allSchoolUsers = users || [];
}

async function loadAllData() {
  if (!currentUser) return;
  const filters = profile.school_id ? { school_id: profile.school_id } : {};
  [subjects, schoolClasses] = await Promise.all([
    dbGet('subjects', filters),
    dbGet('classes', filters)
  ]);
  renderSubjectSelects();
  if (SYSTEM_ROLES.includes(profile.role)) {
    const pending = await dbGet('school_requests', { status: 'pending' });
    const badge = document.getElementById('admin-badge');
    if (badge) { badge.textContent = pending.length; badge.style.display = pending.length > 0 ? 'inline' : 'none'; }
  }
}

function renderSubjectSelects() {
  const selects = ['tt-subject', 'hw-subject', 'gr-subject', 'ex-subject'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Fach wählen...</option>' +
      subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  });
  const classSelects = ['hw-class', 'ex-class'];
  classSelects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Klasse wählen...</option>' +
      schoolClasses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  });
  const grStudent = document.getElementById('gr-student');
  if (grStudent) {
    if (profile.role === 'student') {
      grStudent.innerHTML = `<option value="${currentUser.id}">${escapeHtml(profile.full_name)} (ich)</option>`;
    } else {
      const students = allSchoolUsers.filter(u => u.role === 'student');
      grStudent.innerHTML = '<option value="">Schüler wählen...</option>' +
        students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.class_name || '')})</option>`).join('');
    }
  }
}

function renderUserSelectOptions(selectId, filterFn, placeholder) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const filtered = filterFn ? allSchoolUsers.filter(filterFn) : allSchoolUsers;
  el.innerHTML = `<option value="">${placeholder || 'Person wählen...'}</option>` +
    filtered.map(u => `<option value="${u.id}">${escapeHtml(u.full_name)} (${ROLE_LABELS[u.role] || u.role}${u.class_name ? ', ' + u.class_name : ''})</option>`).join('');
}

function applyModuleVisibility() {
  if (!profile.school_id) return;
  getSchool(profile.school_id).then(school => {
    if (school?.modules) {
      schoolModules = school.modules;
      Object.entries(schoolModules).forEach(([key, enabled]) => {
        document.querySelectorAll('.mod-' + key).forEach(el => el.style.display = enabled ? 'block' : 'none');
      });
    }
  });
}

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('setup') === 'true') {
    showSetupRequired();
  }
}

function renderSubjectSelects() {
  const selects = ['tt-subject', 'hw-subject', 'gr-subject', 'ex-subject'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Fach wählen...</option>' +
      subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  });
  const classSelects = ['hw-class', 'ex-class'];
  classSelects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Klasse wählen...</option>' +
      schoolClasses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  });
  if (profile.role === 'student') {
    const grStudent = document.getElementById('gr-student');
    if (grStudent) {
      grStudent.innerHTML = `<option value="${currentUser.id}">${escapeHtml(profile.full_name)} (ich)</option>`;
    }
  } else if (['teacher','school_admin'].includes(profile.role)) {
    dbGet('profiles', { school_id: profile.school_id, role: 'student' }).then(students => {
      const grStudent = document.getElementById('gr-student');
      if (grStudent) {
        grStudent.innerHTML = '<option value="">Schüler wählen...</option>' +
          students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.class_name || '')})</option>`).join('');
      }
    });
  }
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('active');
  }
  renderPage(page);
}

function renderPage(page) {
  const schoolPages = ['dashboard','timetable','homework','grades','exams','tests','calendar','subjects','substitution','messages','attendance','absences'];
  if (schoolPages.includes(page) && !hasSchool()) {
    const el = document.getElementById('page-' + page);
    if (el) {
      const body = el.querySelector('.page-body');
      if (body) body.innerHTML = '<div class="empty-state"><h3>Kein Schulzugang</h3><p>Du bist keiner Schule zugeordnet.</p></div>';
    }
    return;
  }
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'admin': renderAdminPanel(); break;
    case 'school-admin': renderSchoolAdmin(); break;
    case 'support': renderSupportPanel(); break;
    case 'timetable': renderTimetable(); break;
    case 'homework': renderHomework(); break;
    case 'grades': renderGrades(); break;
    case 'exams': renderExams(); break;
    case 'tests': renderTests(); break;
    case 'calendar': renderCalendar(); break;
    case 'subjects': renderSubjects(); break;
    case 'substitution': renderSubstitution(); break;
    case 'messages': renderMessages(); break;
    case 'settings': renderSettings(); break;
    case 'attendance': renderAttendance(); break;
    case 'absences': renderAbsenceOrApprovals(); break;
  }
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
});

async function handleLogout() { await signOut(); }

document.addEventListener('DOMContentLoaded', () => { initTheme(); initApp(); });

function renderAbsenceOrApprovals() {
  if (profile.role === 'student') {
    renderAbsenceRequests();
  } else {
    renderAbsenceApprovals();
  }
}
