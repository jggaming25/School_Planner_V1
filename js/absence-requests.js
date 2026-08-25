async function renderAbsenceRequests() {
  if (!currentUser || !profile) return;

  const el = document.getElementById('absences-content');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header flex-between">
      <div><h1>Fehlzeiten</h1><p class="subtitle">Fehlzeiten beantragen und verwalten</p></div>
      <button class="btn btn-primary btn-sm" onclick="openModal('absence-request-modal')">Fehlzeit beantragen</button>
    </div>
    <div class="page-body">
      <div id="absence-requests-list">
        <div class="empty-state"><p>Lade Anfragen...</p></div>
      </div>
    </div>
  `;

  loadAbsenceRequests();
}

async function loadAbsenceRequests() {
  const container = document.getElementById('absence-requests-list');
  if (!container) return;

  const requests = await dbGet('absence_requests', {
    school_id: profile.school_id,
    student_id: currentUser.id
  });

  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>Keine Fehlzeitanfragen</h3>
        <p>Du hast noch keine Fehlzeiten beantragt.</p>
      </div>
    `;
    return;
  }

  const statusConfig = {
    pending: { label: 'Ausstehend', class: 'badge-yellow' },
    approved: { label: 'Genehmigt', class: 'badge-green' },
    rejected: { label: 'Abgelehnt', class: 'badge-red' }
  };

  const reasonLabels = {
    Krankheit: 'Krankheit',
    Termin: 'Termin',
    Familie: 'Familie',
    Urlaub: 'Urlaub',
    Sonstiges: 'Sonstiges'
  };

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Meine Anfragen</h3><span class="text-muted" style="font-size:0.813rem">${requests.length} Anfrage${requests.length !== 1 ? 'n' : ''}</span></div>
      ${requests.map(r => {
        const sc = statusConfig[r.status] || statusConfig.pending;
        return `
          <div class="flex-between" style="padding:16px 0;border-bottom:1px solid var(--border-light)">
            <div>
              <div class="flex gap-8 mb-8" style="align-items:center">
                <strong style="font-size:0.938rem">${formatDate(r.date_from)} - ${formatDate(r.date_to)}</strong>
                <span class="badge ${sc.class}">${sc.label}</span>
                <span class="badge badge-blue">${reasonLabels[r.reason_type] || r.reason_type || 'Sonstiges'}</span>
              </div>
              ${r.reason ? `<div style="font-size:0.813rem;color:var(--text-secondary);margin-bottom:4px">${escapeHtml(r.reason)}</div>` : ''}
              ${r.review_note ? `<div style="font-size:0.813rem;color:var(--text-muted);font-style:italic">Kommentar: ${escapeHtml(r.review_note)}</div>` : ''}
              ${r.file_url ? `<a href="${r.file_url}" target="_blank" class="btn btn-ghost btn-sm mt-8" style="display:inline-flex">Anhang öffnen</a>` : ''}
            </div>
            ${r.status === 'pending' ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="cancelAbsenceRequest('${r.id}')" title="Abbrechen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function submitAbsenceRequest() {
  const dateFrom = document.getElementById('absence-date-from')?.value;
  const dateTo = document.getElementById('absence-date-to')?.value;
  const reasonType = document.getElementById('absence-reason-type')?.value;
  const reason = document.getElementById('absence-reason')?.value;
  const fileInput = document.getElementById('absence-file');

  if (!dateFrom || !dateTo) {
    showToast('Bitte Datumsbereich wählen', 'error');
    return;
  }

  if (new Date(dateFrom) > new Date(dateTo)) {
    showToast('Enddatum muss nach Startdatum liegen', 'error');
    return;
  }

  let fileUrl = null;

  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.size > 100 * 1024 * 1024) {
      showToast('Datei ist zu groß (max. 100MB)', 'error');
      return;
    }
    if (file.type !== 'application/pdf') {
      showToast('Nur PDF-Dateien erlaubt', 'error');
      return;
    }

    try {
      const filePath = `${profile.school_id}/${currentUser.id}/${Date.now()}_${file.name}`;
      const { data, error } = await _sb.storage.from('absence-files').upload(filePath, file);
      if (error) throw error;

      const { data: urlData } = _sb.storage.from('absence-files').getPublicUrl(filePath);
      fileUrl = urlData?.publicUrl || null;
    } catch (err) {
      showToast('Fehler beim Hochladen: ' + err.message, 'error');
      return;
    }
  }

  try {
    await dbInsert('absence_requests', {
      school_id: profile.school_id,
      student_id: currentUser.id,
      class_name: profile.class_name,
      date_from: dateFrom,
      date_to: dateTo,
      reason_type: reasonType,
      reason: reason || '',
      file_url: fileUrl,
      status: 'pending'
    });

    closeModal('absence-request-modal');
    showToast('Fehlzeit-Anfrage eingereicht!', 'success');

    document.getElementById('absence-date-from').value = '';
    document.getElementById('absence-date-to').value = '';
    document.getElementById('absence-reason-type').value = 'Krankheit';
    document.getElementById('absence-reason').value = '';
    if (fileInput) fileInput.value = '';

    loadAbsenceRequests();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function cancelAbsenceRequest(id) {
  if (!confirm('Anfrage wirklich abbrechen?')) return;
  try {
    await dbDelete('absence_requests', { id });
    showToast('Anfrage abgebrochen', 'success');
    loadAbsenceRequests();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function renderAbsenceApprovals() {
  if (!currentUser || !profile) return;
  if (!['teacher', 'school_admin', 'admin', 'super_admin'].includes(profile.role)) return;

  const el = document.getElementById('absences-content');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header flex-between">
      <div><h1>Fehlzeiten</h1><p class="subtitle">Fehlzeitanfragen verwalten</p></div>
    </div>
    <div class="page-body">
      <div class="tabs mb-20">
        <button class="tab active" onclick="loadAbsenceApprovalsTab('pending',this)">Ausstehend</button>
        <button class="tab" onclick="loadAbsenceApprovalsTab('approved',this)">Genehmigt</button>
        <button class="tab" onclick="loadAbsenceApprovalsTab('rejected',this)">Abgelehnt</button>
        <button class="tab" onclick="loadAbsenceApprovalsTab('all',this)">Alle</button>
      </div>
      <div id="absence-approvals-list">
        <div class="empty-state"><p>Lade Anfragen...</p></div>
      </div>
    </div>
  `;

  loadAbsenceApprovalsTab('pending');
}

let currentAbsenceFilter = 'pending';

async function loadAbsenceApprovalsTab(status, tabBtn) {
  currentAbsenceFilter = status;

  if (tabBtn) {
    tabBtn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabBtn.classList.add('active');
  }

  const container = document.getElementById('absence-approvals-list');
  if (!container) return;

  const filters = { school_id: profile.school_id };
  if (status !== 'pending' && status !== 'all') {
    filters.status = status;
  }

  const requests = await dbGet('absence_requests', filters);

  let filtered = requests;
  if (status === 'pending') {
    filtered = requests.filter(r => r.status === 'pending');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>Keine Anfragen</h3>
        <p>Keine ${status === 'all' ? '' : statusLabels[status] || ''} Fehlzeitanfragen vorhanden.</p>
      </div>
    `;
    return;
  }

  const studentIds = [...new Set(filtered.map(r => r.student_id))];
  const studentMap = {};

  if (studentIds.length > 0) {
    const students = await dbGet('profiles', { school_id: profile.school_id });
    students.forEach(s => { studentMap[s.id] = s; });
  }

  const statusConfig = {
    pending: { label: 'Ausstehend', class: 'badge-yellow' },
    approved: { label: 'Genehmigt', class: 'badge-green' },
    rejected: { label: 'Abgelehnt', class: 'badge-red' }
  };

  const reasonLabels = {
    Krankheit: 'Krankheit',
    Termin: 'Termin',
    Familie: 'Familie',
    Urlaub: 'Urlaub',
    Sonstiges: 'Sonstiges'
  };

  const isApprover = ['teacher', 'school_admin', 'admin', 'super_admin'].includes(profile.role);

  container.innerHTML = filtered.map(r => {
    const student = studentMap[r.student_id];
    const sc = statusConfig[r.status] || statusConfig.pending;
    const isPending = r.status === 'pending';

    return `
      <div class="card mb-16" style="padding:20px">
        <div class="flex-between mb-8">
          <div class="flex gap-12" style="align-items:center">
            <strong style="font-size:0.938rem">${escapeHtml(student?.full_name || 'Unbekannt')}</strong>
            <span class="badge badge-blue">${escapeHtml(student?.class_name || '')}</span>
            <span class="badge ${sc.class}">${sc.label}</span>
            <span class="badge badge-orange">${reasonLabels[r.reason_type] || r.reason_type || 'Sonstiges'}</span>
          </div>
          <span class="text-muted" style="font-size:0.813rem">${r.created_at ? formatDate(r.created_at.split('T')[0]) : ''}</span>
        </div>
        <div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:8px">
          Zeitraum: <strong>${formatDate(r.date_from)}</strong> bis <strong>${formatDate(r.date_to)}</strong>
        </div>
        ${r.reason ? `<div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:8px">Grund: ${escapeHtml(r.reason)}</div>` : ''}
        ${r.file_url ? `<div class="mb-8"><a href="${r.file_url}" target="_blank" class="btn btn-ghost btn-sm" style="display:inline-flex">Anhang öffnen (PDF)</a></div>` : ''}
        ${r.review_note ? `<div style="font-size:0.813rem;color:var(--text-muted);font-style:italic;margin-bottom:8px">Kommentar: ${escapeHtml(r.review_note)}</div>` : ''}
        ${isPending && isApprover ? `
          <div class="flex gap-8 mt-12">
            <button class="btn btn-primary btn-sm" onclick="approveAbsenceRequest('${r.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Genehmigen
            </button>
            <button class="btn btn-danger btn-sm" onclick="rejectAbsenceRequest('${r.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Ablehnen
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function approveAbsenceRequest(id) {
  const reviewNote = prompt('Kommentar (optional):');
  try {
    await dbUpdate('absence_requests', { id }, {
      status: 'approved',
      review_note: reviewNote || '',
      reviewed_by: currentUser.id
    });

    const request = (await dbGet('absence_requests', { id }))[0];
    if (request) {
      await markAbsenceForDates(request);
    }

    showToast('Anfrage genehmigt!', 'success');
    loadAbsenceApprovalsTab(currentAbsenceFilter);
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function rejectAbsenceRequest(id) {
  const reviewNote = prompt('Grund für Ablehnung (optional):');
  try {
    await dbUpdate('absence_requests', { id }, {
      status: 'rejected',
      review_note: reviewNote || '',
      reviewed_by: currentUser.id
    });
    showToast('Anfrage abgelehnt', 'success');
    loadAbsenceApprovalsTab(currentAbsenceFilter);
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function markAbsenceForDates(request) {
  if (!request) return;

  const startDate = new Date(request.date_from);
  const endDate = new Date(request.date_to);
  const maxPeriods = getMaxPeriods();

  const existing = await dbGet('attendance', {
    school_id: profile.school_id,
    student_id: request.student_id,
    class_name: request.class_name
  });

  const existingMap = {};
  existing.forEach(r => {
    const key = `${r.date}_${r.period}`;
    existingMap[key] = r;
  });

  const promises = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = current.toISOString().split('T')[0];
      for (let p = 1; p <= maxPeriods; p++) {
        const key = `${dateStr}_${p}`;
        if (!existingMap[key]) {
          promises.push(dbInsert('attendance', {
            school_id: profile.school_id,
            student_id: request.student_id,
            class_name: request.class_name,
            date: dateStr,
            period: p,
            status: 'absent',
            late_minutes: 0,
            marked_by: currentUser.id,
            notes: `Genehmigte Fehlzeit: ${request.reason_type || 'Sonstiges'}`
          }));
        }
      }
    }
    current.setDate(current.getDate() + 1);
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}
