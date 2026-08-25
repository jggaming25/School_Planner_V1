async function renderSubjects() {
  if (!currentUser) return;
  const el = document.getElementById('subjects-grid');
  if (subjects.length === 0) { el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Noch keine Fächer</h3></div>'; return; }
  el.innerHTML = subjects.map(s => `
    <div class="card" style="border-left:4px solid ${s.color || 'var(--accent)'}">
      <div class="flex-between mb-8"><div class="flex gap-12" style="align-items:center"><div class="color-dot" style="background:${s.color || 'var(--accent)'};width:16px;height:16px"></div><div><strong>${escapeHtml(s.name)}</strong><br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(s.short_name || '')}</span></div></div>
      ${profile.role !== 'student' ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="deleteSubject('${s.id}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/></svg></button>` : ''}</div>
      ${s.teacher || s.room ? `<div style="font-size:0.813rem;color:var(--text-secondary);margin-top:8px">${s.teacher ? 'Lehrer: ' + escapeHtml(s.teacher) : ''} ${s.room ? '&middot; Raum: ' + escapeHtml(s.room) : ''}</div>` : ''}
    </div>`).join('');
}

async function saveSubject() {
  const name = document.getElementById('sub-name').value;
  if (!name) { showToast('Name nötig', 'error'); return; }
  await dbInsert('subjects', {
    school_id: profile.school_id, user_id: currentUser.id, name,
    short_name: document.getElementById('sub-short').value || name.substring(0, 4).toUpperCase(),
    color: document.getElementById('sub-color').value,
    teacher: document.getElementById('sub-teacher').value, room: document.getElementById('sub-room').value
  });
  closeModal('subject-modal');
  showToast('Fach erstellt!', 'success');
  subjects = await dbGet('subjects', profile.school_id ? { school_id: profile.school_id } : {});
  renderSubjects();
  renderSubjectSelects();
}

async function deleteSubject(id) {
  if (!confirm('Fach löschen?')) return;
  await dbDelete('subjects', { id });
  showToast('Gelöscht', 'success');
  subjects = await dbGet('subjects', profile.school_id ? { school_id: profile.school_id } : {});
  renderSubjects();
  renderSubjectSelects();
}
