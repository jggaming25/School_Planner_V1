let adminRequests = [];
let adminHistory = [];
let adminAllUsers = [];
let adminAllSchools = [];
let adminCurrentTab = 'requests';
let adminAnnouncements = [];
let adminSecurityData = [];
let adminEmailLog = [];

const adminRoleLabels = { super_admin: 'CEO', ceo: 'CEO', head_admin: 'Head Admin', admin: 'Admin', supporter: 'Supporter', school_admin: 'Schulleiter', teacher: 'Lehrer', student: 'Schüler' };
const adminRoleBadges = { super_admin: 'badge-red', ceo: 'badge-red', head_admin: 'badge-red', admin: 'badge-orange', supporter: 'badge-blue', school_admin: 'badge-orange', teacher: 'badge-blue', student: 'badge-green' };

async function loadAdminData() {
  if (!currentProfile || !SYSTEM_ROLES.includes(currentProfile.role)) return;
  const [pending, history, users, schools, announcements, security, emailLog] = await Promise.all([
    dbGet('school_requests', { status: 'pending' }),
    dbGet('school_requests', { status: ['approved', 'rejected'] }),
    _sb.from('profiles').select('*').order('created_at', { ascending: false }),
    dbGet('schools'),
    dbGet('announcements'),
    _sb.from('login_security').select('*').order('last_attempt_at', { ascending: false }),
    _sb.from('email_log').select('*').order('created_at', { ascending: false }).limit(100)
  ]);
  adminRequests = pending;
  adminHistory = history;
  adminAllUsers = users.data || [];
  adminAllSchools = schools;
  adminAnnouncements = announcements;
  adminSecurityData = security.data || [];
  adminEmailLog = emailLog.data || [];
}

function renderAdminPanel() {
  if (!currentProfile || !SYSTEM_ROLES.includes(currentProfile.role)) return;
  adminCurrentTab = 'requests';
  loadAdminData().then(() => switchAdminTab('requests'));
}

function switchAdminTab(tab) {
  adminCurrentTab = tab;
  document.querySelectorAll('#admin-top-tabs .tab').forEach(t => t.classList.remove('active'));
  const tabs = document.querySelectorAll('#admin-top-tabs .tab');
  const idx = { requests: 0, users: 1, schools: 2, announcements: 3, invite: 4, security: 5 }[tab];
  if (tabs[idx]) tabs[idx].classList.add('active');
  const searchWrap = document.getElementById('admin-tab-search');
  const searchInput = document.getElementById('admin-search-input');
  if (tab === 'users') {
    searchWrap.style.display = '';
    searchInput.placeholder = 'Suche nach Name oder E-Mail...';
  } else {
    searchWrap.style.display = 'none';
    if (searchInput) searchInput.value = '';
  }
  renderAdminTabContent();
}

function renderAdminTabContent() {
  const el = document.getElementById('admin-tab-content');
  if (adminCurrentTab === 'requests') renderAdminRequestsSection(el);
  else if (adminCurrentTab === 'users') renderAllUsersSection(el);
  else if (adminCurrentTab === 'schools') renderAllSchoolsSection(el);
  else if (adminCurrentTab === 'announcements') renderAnnouncementsSection(el);
  else if (adminCurrentTab === 'invite') renderInviteSection(el);
  else if (adminCurrentTab === 'security') renderSecuritySection(el);
}

function adminSearchHandler(query) {
  if (adminCurrentTab === 'users') renderAllUsersSection(document.getElementById('admin-tab-content'), query);
}

function getFilteredUsers(search) {
  let filtered = adminAllUsers;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(u => (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }
  return filtered;
}

function getFilteredUsersWithRoleFilter(search, roleFilter) {
  let filtered = getFilteredUsers(search);
  if (roleFilter) filtered = filtered.filter(u => u.role === roleFilter);
  return filtered;
}

function renderAdminRequestsSection(el, search) {
  const openCount = adminRequests.length;
  document.getElementById('admin-open-count').textContent = openCount;
  const requestTab = document.getElementById('admin-current-request-tab')?.value || 'open';
  const data = requestTab === 'open' ? adminRequests : adminHistory;
  let filtered = data;
  if (search) {
    const q = search.toLowerCase();
    filtered = data.filter(r => r.school_name.toLowerCase().includes(q) || r.contact_email.toLowerCase().includes(q) || r.contact_name.toLowerCase().includes(q));
  }
  el.innerHTML = `
    <div class="tabs mb-20" id="admin-request-subtabs">
      <button class="tab ${requestTab === 'open' ? 'active' : ''}" onclick="document.getElementById('admin-current-request-tab').value='open';renderAdminTabContent()">Offen <span class="badge badge-red" style="margin-left:4px">${openCount}</span></button>
      <button class="tab ${requestTab === 'history' ? 'active' : ''}" onclick="document.getElementById('admin-current-request-tab').value='history';renderAdminTabContent()">Historie</button>
    </div>
    <input type="hidden" id="admin-current-request-tab" value="${requestTab}">
    ${filtered.length === 0 ? `<div class="empty-state"><h3>${requestTab === 'open' ? 'Keine offenen Anfragen' : 'Keine Einträge'}</h3></div>` :
    filtered.map(r => `
      <div class="card mb-12" style="padding:20px">
        <div class="flex-between mb-12">
          <div>
            <h3 style="font-size:1rem">${escapeHtml(r.school_name)}</h3>
            <div style="font-size:0.813rem;color:var(--text-secondary)">
              ${escapeHtml(r.contact_name)} &middot; ${escapeHtml(r.contact_email)} ${r.phone ? '&middot; ' + escapeHtml(r.phone) : ''}
            </div>
          </div>
          <span class="badge ${r.status === 'pending' ? 'badge-yellow' : r.status === 'approved' ? 'badge-green' : 'badge-red'}">
            ${r.status === 'pending' ? 'Offen' : r.status === 'approved' ? 'Akzeptiert' : 'Abgelehnt'}
          </span>
        </div>
        <div style="font-size:0.813rem;color:var(--text-secondary);margin-bottom:8px">
          <strong>Schulart:</strong> ${escapeHtml(r.school_type)} ${r.address ? '&middot; <strong>Adresse:</strong> ' + escapeHtml(r.address) : ''}
        </div>
        ${r.message ? `<div style="font-size:0.813rem;color:var(--text-muted);font-style:italic;margin-bottom:12px">"${escapeHtml(r.message)}"</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-muted)">Anfrage vom ${formatDate(r.created_at)}</div>
        ${r.status === 'pending' ? `
          <div class="flex gap-8 mt-12">
            <button class="btn btn-primary btn-sm" onclick="approveRequest('${r.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Akzeptieren
            </button>
            <button class="btn btn-danger btn-sm" onclick="rejectRequest('${r.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Ablehnen
            </button>
          </div>
        ` : ''}
        ${r.rejection_reason ? `<div style="margin-top:8px;font-size:0.813rem;color:var(--danger)">Ablehnungsgrund: ${escapeHtml(r.rejection_reason)}</div>` : ''}
      </div>
    `).join('')}
  `;
}

function renderAllUsersSection(el, search) {
  const currentSearch = search || document.getElementById('admin-search-input')?.value || '';
  const roleFilter = document.getElementById('admin-role-filter')?.value || '';
  const schoolFilter = document.getElementById('admin-school-filter')?.value || '';
  let filtered = getFilteredUsersWithRoleFilter(currentSearch, roleFilter);
  if (schoolFilter) filtered = filtered.filter(u => u.school_id === schoolFilter);
  const schoolMap = {};
  adminAllSchools.forEach(s => schoolMap[s.id] = s.name);
  el.innerHTML = `
    <div class="flex-between mb-20">
      <div class="flex gap-8">
        <select class="input-field" id="admin-role-filter" onchange="renderAllUsersSection(document.getElementById('admin-tab-content'))" style="max-width:180px">
          <option value="">Alle Rollen</option>
          <option value="ceo" ${roleFilter === 'ceo' ? 'selected' : ''}>CEO</option>
          <option value="head_admin" ${roleFilter === 'head_admin' ? 'selected' : ''}>Head Admin</option>
          <option value="admin" ${roleFilter === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="supporter" ${roleFilter === 'supporter' ? 'selected' : ''}>Supporter</option>
          <option value="school_admin" ${roleFilter === 'school_admin' ? 'selected' : ''}>Schulleiter</option>
          <option value="teacher" ${roleFilter === 'teacher' ? 'selected' : ''}>Lehrer</option>
          <option value="student" ${roleFilter === 'student' ? 'selected' : ''}>Schüler</option>
        </select>
        <select class="input-field" id="admin-school-filter" onchange="renderAllUsersSection(document.getElementById('admin-tab-content'))" style="max-width:200px">
          <option value="">Alle Schulen</option>
          ${adminAllSchools.map(s => `<option value="${s.id}" ${document.getElementById('admin-school-filter')?.value === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <span style="font-size:0.813rem;color:var(--text-secondary)">${filtered.length} Nutzer</span>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Rolle</th>
          <th>Schule</th>
          <th>Status</th>
          <th style="text-align:right">Aktionen</th>
        </tr></thead>
        <tbody>${filtered.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">Keine Nutzer gefunden</td></tr>` :
        filtered.map(u => `
          <tr style="${!u.is_active && u.is_active !== undefined && u.is_active !== null ? 'opacity:0.55' : ''}">
            <td><strong>${escapeHtml(u.full_name || '-')}</strong></td>
            <td style="font-size:0.813rem">${escapeHtml(u.email || '-')}</td>
            <td><span class="badge ${adminRoleBadges[u.role] || 'badge-blue'}">${adminRoleLabels[u.role] || u.role}</span></td>
            <td style="font-size:0.813rem">${escapeHtml(schoolMap[u.school_id] || '—')}</td>
            <td><span class="badge ${u.is_active === false ? 'badge-red' : 'badge-green'}">${u.is_active === false ? 'Inaktiv' : 'Aktiv'}</span></td>
            <td style="text-align:right">
              <div class="flex gap-4" style="justify-content:flex-end">
                <button class="btn btn-ghost btn-sm" onclick="adminResetPassword('${u.id}', '${escapeHtml(u.full_name || u.email)}')" title="Passwort zurücksetzen">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="adminToggleActive('${u.id}', ${u.is_active === false ? 'true' : 'false'})" title="${u.is_active === false ? 'Aktivieren' : 'Deaktivieren'}">
                  ${u.is_active === false
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'}
                </button>
                <button class="btn btn-ghost btn-sm" onclick="adminDeleteUser('${u.id}', '${escapeHtml(u.full_name || u.email)}', '${u.role}')" title="Nutzer löschen">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

function renderAllSchoolsSection(el) {
  el.innerHTML = `
    <div class="flex-between mb-20">
      <span style="font-size:0.813rem;color:var(--text-secondary)">${adminAllSchools.length} Schulen</span>
    </div>
    ${adminAllSchools.length === 0 ? '<div class="empty-state"><h3>Keine Schulen vorhanden</h3></div>' :
    `<div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Name</th>
          <th>Typ</th>
          <th>Admin</th>
          <th>Adresse</th>
          <th>Nutzer</th>
          <th style="text-align:right">Aktion</th>
        </tr></thead>
        <tbody>${adminAllSchools.map(s => {
          const schoolUsers = adminAllSchools._usersCache || [];
          const userCount = adminAllUsers.filter(u => u.school_id === s.id).length;
          const adminProfile = adminAllUsers.find(u => u.school_id === s.id && u.role === 'school_admin');
          return `<tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td style="font-size:0.813rem">${escapeHtml(s.school_type || '-')}</td>
            <td style="font-size:0.813rem">${adminProfile ? escapeHtml(adminProfile.full_name) : '-'}</td>
            <td style="font-size:0.813rem">${escapeHtml(s.address || '-')}</td>
            <td><span class="badge badge-blue">${userCount}</span></td>
            <td style="text-align:right">
              <button class="btn btn-ghost btn-sm" onclick="adminShowSchoolDetail('${s.id}')" title="Details">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`}
  `;
}

function adminShowSchoolDetail(schoolId) {
  const school = adminAllSchools.find(s => s.id === schoolId);
  if (!school) return;
  const users = adminAllUsers.filter(u => u.school_id === schoolId);
  const admins = users.filter(u => u.role === 'school_admin');
  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const el = document.getElementById('admin-tab-content');
  const currentSearch = document.getElementById('admin-search-input')?.value || '';
  el.innerHTML = `
    <button class="btn btn-ghost btn-sm mb-20" onclick="switchAdminTab('schools')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Zurück
    </button>
    <div class="card mb-20" style="padding:24px">
      <h2 style="font-size:1.25rem;margin-bottom:4px">${escapeHtml(school.name)}</h2>
      <div style="font-size:0.813rem;color:var(--text-secondary);margin-bottom:16px">
        ${school.school_type ? escapeHtml(school.school_type) + ' · ' : ''}${school.address ? escapeHtml(school.address) : ''}
      </div>
      <div class="grid grid-3">
        <div class="card" style="padding:16px;text-align:center"><div style="font-size:1.5rem;font-weight:700">${users.length}</div><div style="font-size:0.813rem;color:var(--text-secondary)">Gesamtnutzer</div></div>
        <div class="card" style="padding:16px;text-align:center"><div style="font-size:1.5rem;font-weight:700">${teachers.length}</div><div style="font-size:0.813rem;color:var(--text-secondary)">Lehrer</div></div>
        <div class="card" style="padding:16px;text-align:center"><div style="font-size:1.5rem;font-weight:700">${students.length}</div><div style="font-size:0.813rem;color:var(--text-secondary)">Schüler</div></div>
      </div>
    </div>
    <h3 class="mb-12">Nutzer dieser Schule (${users.length})</h3>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td><strong>${escapeHtml(u.full_name || '-')}</strong></td>
            <td style="font-size:0.813rem">${escapeHtml(u.email || '-')}</td>
            <td><span class="badge ${adminRoleBadges[u.role] || 'badge-blue'}">${adminRoleLabels[u.role] || u.role}</span></td>
            <td><span class="badge ${u.is_active === false ? 'badge-red' : 'badge-green'}">${u.is_active === false ? 'Inaktiv' : 'Aktiv'}</span></td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

async function adminResetPassword(userId, displayName) {
  const newPass = prompt(`Neues Passwort für "${displayName}" eingeben (min. 6 Zeichen):`);
  if (!newPass) return;
  if (newPass.length < 6) {
    showToast('Passwort muss mindestens 6 Zeichen lang sein', 'error');
    return;
  }
  try {
    const { error } = await _sb.auth.admin.updateUserById(userId, { password: newPass });
    if (error) throw error;
    showToast(`Passwort für "${displayName}" zurückgesetzt!`, 'success');
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function adminToggleActive(userId, activate) {
  const activateBool = activate === 'true' || activate === true;
  try {
    await _sb.from('profiles').update({ is_active: activateBool }).eq('id', userId);
    showToast(activateBool ? 'Nutzer aktiviert' : 'Nutzer deaktiviert', 'success');
    await loadAdminData();
    renderAllUsersSection(document.getElementById('admin-tab-content'));
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function adminDeleteUser(userId, displayName, role) {
  if (userId === currentUser.id) {
    showToast('Du kannst dich nicht selbst löschen', 'error');
    return;
  }
  const confirmed = confirm(`Nutzer "${displayName}" wirklich löschen?\n\nRolle: ${adminRoleLabels[role] || role}\n\nDies kann nicht rückgängig gemacht werden.`);
  if (!confirmed) return;
  const doubleConfirm = prompt('Um die Löschung zu bestätigen, gib "LÖSCHEN" ein:');
  if (doubleConfirm !== 'LÖSCHEN') {
    showToast('Löschung abgebrochen', 'info');
    return;
  }
  try {
    await _sb.from('profiles').delete().eq('id', userId);
    const { error } = await _sb.auth.admin.deleteUser(userId);
    if (error) {
      showToast('Profil gelöscht, Auth-Benutzer konnte nicht entfernt werden: ' + error.message, 'info');
    } else {
      showToast(`Nutzer "${displayName}" gelöscht`, 'success');
    }
    await loadAdminData();
    renderAllUsersSection(document.getElementById('admin-tab-content'));
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function approveRequest(requestId) {
  const request = adminRequests.find(r => r.id === requestId);
  if (!request) return;
  try {
    const school = await dbInsert('schools', {
      name: request.school_name,
      address: request.address,
      school_type: request.school_type,
      admin_email: request.contact_email,
      phone: request.phone
    });
    const adminEmail = request.contact_email;
    const tempPass = 'Admin_' + Math.random().toString(36).substring(2, 10);
    const { data: authData } = await _sb.auth.signUp({
      email: adminEmail,
      password: tempPass,
      options: { data: { role: 'school_admin', school_id: school.id } }
    });
    if (authData?.user) {
      await _sb.from('profiles').upsert({
        id: authData.user.id,
        school_id: school.id,
        email: adminEmail,
        full_name: request.contact_name,
        role: 'school_admin',
        setup_complete: false,
        force_email: true
      });
    }
    await dbUpdate('school_requests', { id: requestId }, {
      status: 'approved',
      reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString()
    });
    await dbInsert('notifications', {
      school_id: school.id,
      user_id: null,
      title: 'Schule genehmigt',
      message: `${request.school_name} wurde genehmigt.`,
      type: 'approval'
    });
    showToast(`Schule "${request.school_name}" genehmigt! Admin: ${adminEmail} / Passwort: ${tempPass}`, 'success');
    await loadAdminData();
    renderAdminTabContent();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function rejectRequest(requestId) {
  const reason = prompt('Ablehnungsgrund (optional):');
  await dbUpdate('school_requests', { id: requestId }, {
    status: 'rejected',
    reviewed_by: currentUser.id,
    reviewed_at: new Date().toISOString(),
    rejection_reason: reason || null
  });
  showToast('Anfrage abgelehnt.', 'info');
  await loadAdminData();
  renderAdminTabContent();
}

function renderAnnouncementsSection(el) {
  const active = adminAnnouncements.filter(a => a.is_active);
  const inactive = adminAnnouncements.filter(a => !a.is_active);
  el.innerHTML = `
    <div class="flex-between mb-20">
      <h3>Wartungsmeldungen</h3>
      <button class="btn btn-primary btn-sm" onclick="showCreateAnnouncement()">+ Neue Meldung</button>
    </div>
    <div id="announcement-form-area"></div>
    ${active.length === 0 && inactive.length === 0 ? '<div class="empty-state"><h3>Keine Meldungen</h3></div>' : ''}
    ${active.length > 0 ? `<h4 class="mb-12">Aktive Meldungen</h4>${active.map(a => `
      <div class="card mb-12" style="padding:16px;border-left:4px solid var(--warning)">
        <div class="flex-between mb-8">
          <strong>${escapeHtml(a.title)}</strong>
          <button class="btn btn-danger btn-sm" onclick="toggleAnnouncement('${a.id}', false)">Deaktivieren</button>
        </div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin:0">${escapeHtml(a.message)}</p>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">Ziel: ${(a.target_roles || []).join(', ')} · Erstellt: ${formatDate(a.created_at)}</div>
      </div>
    `).join('')}` : ''}
    ${inactive.length > 0 ? `<h4 class="mb-12 mt-20">Deaktivierte Meldungen</h4>${inactive.map(a => `
      <div class="card mb-12" style="padding:16px;opacity:0.6">
        <div class="flex-between mb-8">
          <strong>${escapeHtml(a.title)}</strong>
          <button class="btn btn-secondary btn-sm" onclick="toggleAnnouncement('${a.id}', true)">Aktivieren</button>
        </div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin:0">${escapeHtml(a.message)}</p>
      </div>
    `).join('')}` : ''}`;
}

function showCreateAnnouncement() {
  const area = document.getElementById('announcement-form-area');
  area.innerHTML = `
    <div class="card mb-20" style="padding:20px">
      <h4 class="mb-12">Neue Wartungsmeldung</h4>
      <div class="input-group"><label>Titel</label><input type="text" class="input-field" id="ann-title" placeholder="z.B. Geplante Wartung"></div>
      <div class="input-group"><label>Nachricht</label><textarea class="input-field" id="ann-message" rows="3" placeholder="Meldungstext..."></textarea></div>
      <div class="input-group"><label>Zielgruppe</label>
        <div class="flex gap-12" style="flex-wrap:wrap;margin-top:4px">
          <label style="display:flex;align-items:center;gap:6px;font-size:0.875rem"><input type="checkbox" id="ann-target-sa" checked> Schulleitungen</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.875rem"><input type="checkbox" id="ann-target-te" checked> Lehrkräfte</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.875rem"><input type="checkbox" id="ann-target-st" checked> Schüler</label>
        </div>
      </div>
      <div class="flex gap-8 mt-12">
        <button class="btn btn-primary btn-sm" onclick="saveAnnouncement()">Senden</button>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('announcement-form-area').innerHTML=''">Abbrechen</button>
      </div>
    </div>`;
}

async function saveAnnouncement() {
  const title = document.getElementById('ann-title').value;
  const message = document.getElementById('ann-message').value;
  if (!title || !message) { showToast('Titel und Nachricht nötig', 'error'); return; }
  const targetRoles = [];
  if (document.getElementById('ann-target-sa').checked) targetRoles.push('school_admin');
  if (document.getElementById('ann-target-te').checked) targetRoles.push('teacher');
  if (document.getElementById('ann-target-st').checked) targetRoles.push('student');
  try {
    const ann = await dbInsert('announcements', {
      created_by: currentUser.id,
      title, message,
      is_active: true,
      target_roles: targetRoles
    });
    const targetUsers = adminAllUsers.filter(u => targetRoles.includes(u.role) && u.email);
    for (const u of targetUsers) {
      logAnnouncementEmail(ann.id, u.email, `Wartungsmeldung: ${title}`, `Hallo ${u.full_name || 'Nutzer'},\n\n${message}\n\n— School Planner Admin`);
    }
    showToast(`Meldung gesendet! (${targetUsers.length} Empfänger benachrichtigt)`, 'success');
    await loadAdminData();
    renderAnnouncementsSection(document.getElementById('admin-tab-content'));
  } catch (err) { showToast('Fehler: ' + err.message, 'error'); }
}

async function toggleAnnouncement(id, active) {
  await _sb.from('announcements').update({ is_active: active }).eq('id', id);
  showToast(active ? 'Meldung aktiviert' : 'Meldung deaktiviert', 'success');
  await loadAdminData();
  renderAnnouncementsSection(document.getElementById('admin-tab-content'));
}

function renderInviteSection(el) {
  el.innerHTML = `
    <div class="flex-between mb-20">
      <h3>Admins einladen</h3>
    </div>
    <div class="card" style="padding:20px;max-width:500px">
      <div class="input-group"><label>E-Mail-Adresse</label><input type="email" class="input-field" id="invite-email" placeholder="admin@beispiel.de"></div>
      <div class="input-group"><label>Rolle</label>
        <select class="input-field" id="invite-role">
          <option value="supporter">Supporter</option>
          <option value="admin">Admin</option>
          <option value="head_admin">Head Admin</option>
        </select>
      </div>
      <button class="btn btn-primary btn-sm mt-8" onclick="sendInvitation()">Einladung senden</button>
    </div>
    <div id="invite-result" class="mt-16"></div>`;
}

async function sendInvitation() {
  const email = document.getElementById('invite-email').value;
  const role = document.getElementById('invite-role').value;
  if (!email) { showToast('E-Mail nötig', 'error'); return; }
  const token = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
  try {
    await dbInsert('admin_invitations', {
      invited_by: currentUser.id,
      email, role, token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    document.getElementById('invite-result').innerHTML = `
      <div class="card" style="padding:16px;border-left:4px solid var(--success)">
        <strong>Einladung erstellt!</strong>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin:8px 0 0">Link für <strong>${escapeHtml(email)}</strong> (${ROLE_LABELS[role] || role}):</p>
        <code style="display:block;margin-top:8px;padding:8px;background:var(--bg-tertiary);border-radius:4px;font-size:0.813rem;word-break:break-all">${window.location.origin}/School_Planner_V1/index.html?invite=${token}</code>
        <button class="btn btn-ghost btn-sm mt-8" onclick="navigator.clipboard.writeText('${window.location.origin}/School_Planner_V1/index.html?invite=${token}');showToast('Kopiert!','success')">Kopieren</button>
      </div>`;
    showToast('Einladung erstellt!', 'success');
  } catch (err) { showToast('Fehler: ' + err.message, 'error'); }
}

function renderSecuritySection(el) {
  const locked = adminSecurityData.filter(s => s.locked_until && new Date(s.locked_until) > new Date());
  const recent = adminEmailLog.filter(e => e.event_type === 'account_locked');
  el.innerHTML = `
    <div class="flex-between mb-20">
      <h3>Sicherheit</h3>
    </div>
    <h4 class="mb-12">Gesperrte Accounts (${locked.length})</h4>
    ${locked.length === 0 ? '<div class="empty-state"><h3>Keine gesperrten Accounts</h3></div>' :
    `<div class="table-wrapper mb-24">
      <table>
        <thead><tr><th>E-Mail</th><th>Versuche</th><th>Gesperrt bis</th><th style="text-align:right">Aktion</th></tr></thead>
        <tbody>${locked.map(s => {
          const lockTime = new Date(s.locked_until);
          const remaining = Math.max(0, Math.round((lockTime - new Date()) / 3600000));
          return `<tr>
            <td><strong>${escapeHtml(s.email)}</strong></td>
            <td><span class="badge badge-red">${s.failed_attempts}/3</span></td>
            <td style="font-size:0.813rem">${lockTime.toLocaleString('de-DE')} (noch ~${remaining}h)</td>
            <td style="text-align:right">
              <button class="btn btn-primary btn-sm" onclick="adminResendSecurityEmail('${escapeHtml(s.email)}')">Sicherheits-E-Mail senden</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`}
    <h4 class="mb-12">Letzte Sicherheits-Events</h4>
    ${recent.length === 0 ? '<div class="empty-state"><h3>Keine Events</h3></div>' :
    `<div class="table-wrapper">
      <table>
        <thead><tr><th>E-Mail</th><th>Event</th><th>Zeitpunkt</th></tr></thead>
        <tbody>${recent.map(e => `
          <tr>
            <td>${escapeHtml(e.email)}</td>
            <td><span class="badge badge-red">Account gesperrt</span></td>
            <td style="font-size:0.813rem">${formatDate(e.created_at)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>`}
  `;
}

async function adminResendSecurityEmail(email) {
  try {
    const result = await resendSecurityEmail(email);
    if (result.success) {
      showToast(result.message, 'success');
      await loadAdminData();
      renderSecuritySection(document.getElementById('admin-tab-content'));
    } else {
      showToast(result.message, 'error');
    }
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}
