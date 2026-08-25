let adminRequests = [];
let adminHistory = [];
let adminSearchQuery = '';

async function loadAdminData() {
  if (!currentProfile || !['super_admin','admin'].includes(currentProfile.role)) return;
  adminRequests = await dbGet('school_requests', { status: 'pending' });
  adminHistory = await dbGet('school_requests', { status: ['approved','rejected'] });
}

function renderAdminPanel() {
  if (!currentProfile || !['super_admin','admin'].includes(currentProfile.role)) {
    document.getElementById('page-admin').innerHTML = '<div class="page-body"><div class="empty-state"><h3>Kein Zugriff</h3></div></div>';
    return;
  }
  loadAdminData().then(() => renderAdminRequests('open'));
}

function renderAdminRequests(tab, search = '') {
  const data = tab === 'open' ? adminRequests : adminHistory;
  let filtered = data;
  if (search) {
    const q = search.toLowerCase();
    filtered = data.filter(r => r.school_name.toLowerCase().includes(q) || r.contact_email.toLowerCase().includes(q) || r.contact_name.toLowerCase().includes(q));
  }
  const el = document.getElementById('admin-requests-list');
  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state"><h3>${tab === 'open' ? 'Keine offenen Anfragen' : 'Keine历史记录'}</h3></div>`;
    return;
  }
  el.innerHTML = filtered.map(r => `
    <div class="card mb-12" style="padding:20px">
      <div class="flex-between mb-12">
        <div>
          <h3 style="font-size:1rem">${escapeHtml(r.school_name)}</h3>
          <div style="font-size:0.813rem;color:var(--text-secondary)">
            ${escapeHtml(r.contact_name)} &middot; ${escapeHtml(r.contact_email)} &middot; ${r.phone ? escapeHtml(r.phone) : ''}
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
  `).join('');
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
    const { data: authData } = await supabase.auth.signUp({
      email: adminEmail,
      password: tempPass,
      options: { data: { role: 'school_admin', school_id: school.id } }
    });
    if (authData?.user) {
      await supabase.from('profiles').upsert({
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
    renderAdminRequests('open');
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
  renderAdminRequests('open');
}

function searchAdminRequests(query) {
  const activeTab = document.querySelector('#page-admin .tab.active');
  const tab = activeTab?.textContent.includes('Offen') ? 'open' : 'history';
  renderAdminRequests(tab, query);
}
