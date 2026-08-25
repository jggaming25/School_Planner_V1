let schoolUsers = [];
let schoolModules = {};

async function loadSchoolAdminData() {
  if (!currentProfile?.school_id) return;
  const [users, classes, school] = await Promise.all([
    dbGet('profiles', { school_id: currentProfile.school_id }),
    dbGet('classes', { school_id: currentProfile.school_id }),
    getSchool(currentProfile.school_id)
  ]);
  schoolUsers = users;
  schoolClasses = classes;
  if (school) schoolModules = school.modules || {};
}

function renderSchoolAdmin() {
  if (!currentProfile || !['school_admin','admin'].includes(currentProfile.role)) return;
  loadSchoolAdminData().then(() => renderSchoolAdminTab('users'));
}

function renderSchoolAdminTab(tab) {
  const el = document.getElementById('school-admin-content');
  if (tab === 'users') renderSchoolUsersList(el);
  else if (tab === 'classes') renderSchoolClassesList(el);
  else if (tab === 'modules') renderSchoolModules(el);
  else if (tab === 'codes') renderAccessCodesInfo(el);
}

function renderSchoolUsersList(el) {
  const search = document.getElementById('school-user-search')?.value?.toLowerCase() || '';
  let filtered = schoolUsers;
  if (search) filtered = filtered.filter(u => u.full_name?.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search));
  const roleLabels = { school_admin: 'Schulleiter', teacher: 'Lehrer', student: 'Schüler' };
  const roleColors = { school_admin: 'badge-orange', teacher: 'badge-blue', student: 'badge-green' };
  el.innerHTML = `
    <div class="flex-between mb-20">
      <div class="flex gap-8">
        <input type="text" class="input-field" id="school-user-search" placeholder="Suche nach Name oder E-Mail..." oninput="renderSchoolUsersList(document.getElementById('school-admin-content'))" style="max-width:300px">
        <select class="input-field" id="user-role-filter" onchange="renderSchoolUsersList(document.getElementById('school-admin-content'))" style="max-width:150px">
          <option value="">Alle Rollen</option>
          <option value="school_admin">Schulleiter</option>
          <option value="teacher">Lehrer</option>
          <option value="student">Schüler</option>
        </select>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary btn-sm" onclick="openCreateUserModal('teacher')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Lehrer anlegen
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openCreateUserModal('student')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Schüler anlegen
        </button>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Klasse</th><th>Fach</th><th>Status</th><th></th></tr></thead>
        <tbody>${filtered.map(u => `
          <tr>
            <td><strong>${escapeHtml(u.full_name)}</strong></td>
            <td style="font-size:0.813rem">${escapeHtml(u.email || '-')}</td>
            <td><span class="badge ${roleColors[u.role] || 'badge-blue'}">${roleLabels[u.role] || u.role}</span></td>
            <td>${escapeHtml(u.class_name || u.class_teacher_of || '-')}</td>
            <td style="font-size:0.813rem">${u.subjects ? u.subjects.join(', ') : '-'}</td>
            <td><span class="badge ${u.setup_complete ? 'badge-green' : 'badge-yellow'}">${u.setup_complete ? 'Aktiv' : 'Setup ausstehend'}</span></td>
            <td>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="editUser('${u.id}')" title="Bearbeiten">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>`;
}

function renderSchoolClassesList(el) {
  el.innerHTML = `
    <div class="flex-between mb-20">
      <h3>Klassen (${schoolClasses.length})</h3>
      <button class="btn btn-primary btn-sm" onclick="openCreateClassModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Neue Klasse
      </button>
    </div>
    <div class="grid grid-3">${schoolClasses.map(c => {
      const teacher = schoolUsers.find(u => u.id === c.class_teacher_id);
      return `<div class="card">
        <div class="flex-between mb-8">
          <h3 style="font-size:1.25rem">${escapeHtml(c.name)}</h3>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteClass('${c.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>
        <div style="font-size:0.813rem;color:var(--text-secondary)">
          ${c.grade_level ? 'Stufe ' + c.grade_level : ''}
          ${teacher ? '<br>Klassenlehrer: ' + escapeHtml(teacher.full_name) : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
}

function renderSchoolModules(el) {
  const moduleList = [
    { key: 'timetable', name: 'Stundenplan', icon: 'calendar' },
    { key: 'substitution', name: 'Vertretungsplan', icon: 'repeat' },
    { key: 'homework', name: 'Hausaufgaben', icon: 'check-square' },
    { key: 'exams', name: 'Klassenarbeiten', icon: 'file-text' },
    { key: 'tests', name: 'Online-Tests', icon: 'edit-3' },
    { key: 'grades', name: 'Noten', icon: 'bar-chart-2' },
    { key: 'calendar', name: 'Kalender', icon: 'calendar' },
    { key: 'messages', name: 'Nachrichten', icon: 'message-circle' },
    { key: 'subjects', name: 'Fächer', icon: 'book' },
    { key: 'classbook', name: 'Klassenbuch', icon: 'book-open' }
  ];
  el.innerHTML = `
    <h3 class="mb-20">Module verwalten</h3>
    <p style="font-size:0.813rem;color:var(--text-secondary);margin-bottom:20px">Aktiviere oder deaktiviere Module für deine Schule. Alle Nutzer sehen nur aktive Module.</p>
    <div class="grid grid-2">${moduleList.map(m => `
      <div class="card flex-between" style="padding:16px 20px">
        <div><strong>${m.name}</strong></div>
        <label class="toggle-switch">
          <input type="checkbox" ${schoolModules[m.key] ? 'checked' : ''} onchange="toggleModule('${m.key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('')}</div>`;
}

async function toggleModule(key, enabled) {
  schoolModules[key] = enabled;
  await _sb.from('schools').update({ modules: schoolModules }).eq('id', currentProfile.school_id);
  showToast(`${key} ${enabled ? 'aktiviert' : 'deaktiviert'}`, 'success');
}

function renderAccessCodesInfo(el) {
  const pendingUsers = schoolUsers.filter(u => !u.access_code_used && u.access_code);
  el.innerHTML = `
    <h3 class="mb-12">Zugangscodes</h3>
    <p style="font-size:0.813rem;color:var(--text-secondary);margin-bottom:20px">Codes werden bei der Erstellung von Lehrer/Schüler-Konten generiert. Jeder Code ist einmalig gültig (2 Fehlversuche).</p>
    <h4 class="mb-12">Ausstehende Codes (${pendingUsers.length})</h4>
    ${pendingUsers.length === 0 ? '<div class="text-muted" style="font-size:0.875rem">Keine ausstehenden Codes</div>' :
    `<div class="table-wrapper"><table>
      <thead><tr><th>Name</th><th>Rolle</th><th>Code</th><th>E-Mail</th><th></th></tr></thead>
      <tbody>${pendingUsers.map(u => `<tr>
        <td>${escapeHtml(u.full_name)}</td>
        <td><span class="badge ${u.role === 'teacher' ? 'badge-blue' : 'badge-green'}">${u.role === 'teacher' ? 'Lehrer' : 'Schüler'}</span></td>
        <td><code style="background:var(--bg-tertiary);padding:4px 10px;border-radius:4px;font-weight:700;letter-spacing:2px;font-size:0.938rem">${escapeHtml(u.access_code)}</code></td>
        <td style="font-size:0.813rem">${escapeHtml(u.email)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="copyCode('${u.access_code}')">Kopieren</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`}`;
}

function copyCode(code) {
  navigator.clipboard.writeText(code);
  showToast('Code kopiert!', 'success');
}

function openCreateUserModal(role) {
  document.getElementById('create-user-role').value = role;
  document.getElementById('create-user-title').textContent = role === 'teacher' ? 'Lehrer anlegen' : 'Schüler anlegen';
  const classSelect = document.getElementById('create-user-class');
  classSelect.innerHTML = '<option value="">Keine Klasse</option>' + schoolClasses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (role === 'teacher') {
    document.getElementById('create-user-class-label').textContent = 'Klasse (Klassenlehrer, optional)';
    document.getElementById('create-user-subjects-group').style.display = 'block';
  } else {
    document.getElementById('create-user-class-label').textContent = 'Klasse (Pflicht)';
    document.getElementById('create-user-subjects-group').style.display = 'none';
  }
  openModal('create-user-modal');
}

async function createUser() {
  const role = document.getElementById('create-user-role').value;
  const name = document.getElementById('create-user-name').value;
  const email = document.getElementById('create-user-email').value;
  if (!name || !email) { showToast('Name und E-Mail nötig', 'error'); return; }
  if (role === 'student' && !document.getElementById('create-user-class').value) {
    showToast('Schüler benötigen eine Klasse', 'error'); return;
  }
  const code = generateAccessCode();
  const subjects = role === 'teacher' ?
    (document.getElementById('create-user-subjects').value.split(',').map(s => s.trim()).filter(Boolean)) : null;
  const record = {
    school_id: currentProfile.school_id,
    email,
    full_name: name,
    role,
    class_name: document.getElementById('create-user-class').selectedOptions[0]?.text || null,
    class_teacher_of: role === 'teacher' ? document.getElementById('create-user-class').selectedOptions[0]?.text : null,
    subjects,
    access_code: code,
    access_code_attempts: 0,
    access_code_used: false,
    setup_complete: false,
    force_email: true
  };
  const classId = document.getElementById('create-user-class').value;
  if (role === 'teacher' && classId) {
    record.class_teacher_of = schoolClasses.find(c => c.id === classId)?.name;
  }
  await dbInsert('profiles', record);
  closeModal('create-user-modal');
  showToast(`${role === 'teacher' ? 'Lehrer' : 'Schüler'} erstellt! Code: ${code}`, 'success');
  document.getElementById('create-user-name').value = '';
  document.getElementById('create-user-email').value = '';
  document.getElementById('create-user-subjects').value = '';
  await loadSchoolAdminData();
  renderSchoolAdminTab('users');
}

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function editUser(userId) {
  const user = schoolUsers.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('edit-user-id').value = userId;
  document.getElementById('edit-user-name').value = user.full_name || '';
  document.getElementById('edit-user-email').value = user.email || '';
  document.getElementById('edit-user-phone').value = user.phone || '';
  document.getElementById('edit-user-address').value = user.address || '';
  document.getElementById('edit-user-birthdate').value = user.birth_date || '';
  const classSelect = document.getElementById('edit-user-class');
  classSelect.innerHTML = '<option value="">Keine</option>' + schoolClasses.map(c => `<option value="${c.name}" ${user.class_name === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('edit-user-subjects').value = user.subjects ? user.subjects.join(', ') : '';
  openModal('edit-user-modal');
}

async function saveUserEdit() {
  const userId = document.getElementById('edit-user-id').value;
  const updates = {
    full_name: document.getElementById('edit-user-name').value,
    email: document.getElementById('edit-user-email').value,
    phone: document.getElementById('edit-user-phone').value,
    address: document.getElementById('edit-user-address').value,
    birth_date: document.getElementById('edit-user-birthdate').value || null,
    class_name: document.getElementById('edit-user-class').value || null,
    subjects: document.getElementById('edit-user-subjects').value.split(',').map(s => s.trim()).filter(Boolean)
  };
  await _sb.from('profiles').update(updates).eq('id', userId);
  closeModal('edit-user-modal');
  showToast('Benutzer aktualisiert!', 'success');
  await loadSchoolAdminData();
  renderSchoolAdminTab('users');
}

function openCreateClassModal() {
  document.getElementById('create-class-grade').innerHTML = '<option value="">Keine</option>' +
    Array.from({length: 13}, (_, i) => `<option value="${i}">${i}. Klasse</option>`).join('');
  const teacherSelect = document.getElementById('create-class-teacher');
  teacherSelect.innerHTML = '<option value="">Keiner</option>' +
    schoolUsers.filter(u => u.role === 'teacher').map(u => `<option value="${u.id}">${escapeHtml(u.full_name)}</option>`).join('');
  openModal('create-class-modal');
}

async function createClass() {
  const name = document.getElementById('create-class-name').value;
  if (!name) { showToast('Name nötig', 'error'); return; }
  await dbInsert('classes', {
    school_id: currentProfile.school_id,
    name,
    grade_level: parseInt(document.getElementById('create-class-grade').value) || null,
    class_teacher_id: document.getElementById('create-class-teacher').value || null
  });
  closeModal('create-class-modal');
  showToast('Klasse erstellt!', 'success');
  await loadSchoolAdminData();
  renderSchoolAdminTab('classes');
}

async function deleteClass(id) {
  if (!confirm('Klasse löschen?')) return;
  await dbDelete('classes', { id });
  showToast('Gelöscht', 'success');
  await loadSchoolAdminData();
  renderSchoolAdminTab('classes');
}
