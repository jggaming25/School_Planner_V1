async function renderSubstitution() {
  if (!currentUser) return;
  const data = await dbGet('substitutions', profile.school_id ? { school_id: profile.school_id } : {});
  data.sort((a, b) => b.date !== a.date ? new Date(b.date) - new Date(a.date) : a.period - b.period);
  const el = document.getElementById('substitution-list');
  if (data.length === 0) { el.innerHTML = '<div class="empty-state"><h3>Keine Vertretungen</h3></div>'; return; }
  const grouped = {};
  data.forEach(s => { if (!grouped[s.date]) grouped[s.date] = []; grouped[s.date].push(s); });
  const sl = { substituted: 'Vertretung', cancelled: 'Entfällt', room_change: 'Raumänderung', free: 'Freistunde' };
  const sc = { substituted: 'badge-blue', cancelled: 'badge-red', room_change: 'badge-yellow', free: 'badge-green' };
  el.innerHTML = Object.entries(grouped).map(([date, entries]) => `
    <div class="card mb-16"><div class="card-header"><h3>${isToday(date) ? 'Heute' : formatDate(date)}</h3></div>
    ${entries.map(s => `<div style="padding:10px 0;border-top:1px solid var(--border-light)"><div class="flex-between">
      <div class="flex gap-12" style="align-items:center"><div style="min-width:50px;font-weight:600;color:var(--text-secondary)">${s.period}. Std.</div>
      <div><strong>${escapeHtml(s.substitute_subject || s.original_subject || '')}</strong>
      <div style="font-size:0.813rem;color:var(--text-secondary)">${escapeHtml(s.original_teacher || '')} ${s.substitute_teacher ? '→ ' + escapeHtml(s.substitute_teacher) : ''} ${s.original_room ? '&middot; ' + escapeHtml(s.original_room) : ''} ${s.substitute_room ? '→ ' + escapeHtml(s.substitute_room) : ''}</div>
      ${s.note ? `<div style="font-size:0.75rem;color:var(--text-muted);font-style:italic">${escapeHtml(s.note)}</div>` : ''}</div></div>
      <div class="flex gap-8" style="align-items:center"><span class="badge ${sc[s.status] || 'badge-blue'}">${sl[s.status] || s.status}</span>
      ${profile.role !== 'student' ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="deleteSubstitution('${s.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/></svg></button>` : ''}</div></div></div>`).join('')}</div>`).join('');
}

async function saveSubstitution() {
  const date = document.getElementById('sub-date').value;
  if (!date) { showToast('Datum nötig', 'error'); return; }
  await dbInsert('substitutions', {
    school_id: profile.school_id, user_id: currentUser.id, date,
    period: parseInt(document.getElementById('sub-period').value),
    original_subject: document.getElementById('sub-subject').value,
    original_teacher: document.getElementById('sub-teacher').value,
    substitute_teacher: document.getElementById('sub-sub-teacher').value,
    substitute_room: document.getElementById('sub-room').value,
    status: document.getElementById('sub-status').value,
    note: document.getElementById('sub-note').value
  });
  closeModal('substitution-modal');
  showToast('Vertretung eingetragen!', 'success');
  renderSubstitution();
}

async function deleteSubstitution(id) {
  if (!confirm('Löschen?')) return;
  await dbDelete('substitutions', { id }); showToast('Gelöscht', 'success'); renderSubstitution();
}
