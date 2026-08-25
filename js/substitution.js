async function renderSubstitution() {
  if (!currentUser) return;
  const data = await dbGet('substitutions', currentUser.id);
  data.sort((a, b) => {
    if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
    return a.period - b.period;
  });

  const el = document.getElementById('substitution-list');
  if (data.length === 0) {
    el.innerHTML = '<div class="empty-state"><h3>Keine Vertretungen</h3><p>Noch keine Einträge vorhanden</p></div>';
    return;
  }

  const grouped = {};
  data.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });

  const statusLabels = { substituted: 'Vertretung', cancelled: 'Entfällt', room_change: 'Raumänderung', free: 'Freistunde' };
  const statusColors = { substituted: 'badge-blue', cancelled: 'badge-red', room_change: 'badge-yellow', free: 'badge-green' };

  el.innerHTML = Object.entries(grouped).map(([date, entries]) => `
    <div class="card mb-16">
      <div class="card-header">
        <h3>${isToday(date) ? 'Heute' : formatDate(date)}${isToday(date) ? ' <span class="badge badge-orange" style="margin-left:8px">Heute</span>' : ''}</h3>
        <span class="text-muted" style="font-size:0.813rem">${getDayName(new Date(date).getDay() - 1)}</span>
      </div>
      ${entries.map(s => `
        <div class="sub-entry" style="padding:10px 0;border-top:1px solid var(--border-light)">
          <div class="flex-between">
            <div class="flex gap-12" style="align-items:center">
              <div style="min-width:50px;font-weight:600;color:var(--text-secondary)">${s.period}. Std.</div>
              <div>
                <strong>${escapeHtml(s.substitute_subject || s.original_subject || '')}</strong>
                <div style="font-size:0.813rem;color:var(--text-secondary)">
                  ${escapeHtml(s.original_teacher || '')} ${s.substitute_teacher ? '→ ' + escapeHtml(s.substitute_teacher) : ''}
                  ${s.original_room ? '&middot; ' + escapeHtml(s.original_room) : ''}
                  ${s.substitute_room ? '→ ' + escapeHtml(s.substitute_room) : ''}
                </div>
                ${s.note ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;font-style:italic">${escapeHtml(s.note)}</div>` : ''}
              </div>
            </div>
            <div class="flex gap-8" style="align-items:center">
              <span class="badge ${statusColors[s.status] || 'badge-blue'}">${statusLabels[s.status] || s.status}</span>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteSubstitution('${s.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

async function saveSubstitution() {
  const date = document.getElementById('sub-date').value;
  const period = document.getElementById('sub-period').value;
  if (!date) { showToast('Datum ist nötig', 'error'); return; }
  const record = {
    user_id: currentUser.id,
    date,
    period: parseInt(period),
    original_subject: document.getElementById('sub-subject').value,
    original_teacher: document.getElementById('sub-teacher').value,
    substitute_teacher: document.getElementById('sub-sub-teacher').value,
    substitute_room: document.getElementById('sub-room').value,
    status: document.getElementById('sub-status').value,
    note: document.getElementById('sub-note').value
  };
  await dbInsert('substitutions', record);
  closeModal('substitution-modal');
  showToast('Vertretung eingetragen!', 'success');
  renderSubstitution();
}

async function deleteSubstitution(id) {
  if (!confirm('Löschen?')) return;
  await dbDelete('substitutions', id);
  showToast('Gelöscht', 'success');
  renderSubstitution();
}
