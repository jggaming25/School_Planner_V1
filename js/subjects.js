async function renderSubjects() {
  if (!currentUser) return;
  const el = document.getElementById('subjects-grid');
  if (subjects.length === 0) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Noch keine Fächer</h3><p>Erstelle dein erstes Fach</p></div>';
    return;
  }
  el.innerHTML = subjects.map(s => `
    <div class="card" style="border-left:4px solid ${s.color || 'var(--accent)'}">
      <div class="flex-between mb-8">
        <div class="flex gap-12" style="align-items:center">
          <div class="color-dot" style="background:${s.color || 'var(--accent)'};width:16px;height:16px"></div>
          <div>
            <strong style="font-size:1rem">${escapeHtml(s.name)}</strong>
            <br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(s.short_name || '')}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteSubject('${s.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      ${s.teacher || s.room ? `<div style="font-size:0.813rem;color:var(--text-secondary);margin-top:8px">${s.teacher ? 'Lehrer: ' + escapeHtml(s.teacher) : ''} ${s.room ? '&middot; Raum: ' + escapeHtml(s.room) : ''}</div>` : ''}
    </div>
  `).join('');
}

async function saveSubject() {
  const name = document.getElementById('sub-name').value;
  const shortName = document.getElementById('sub-short').value;
  if (!name) { showToast('Name ist nötig', 'error'); return; }
  const record = {
    user_id: currentUser.id,
    name,
    short_name: shortName || name.substring(0, 4).toUpperCase(),
    color: document.getElementById('sub-color').value,
    teacher: document.getElementById('sub-teacher').value,
    room: document.getElementById('sub-room').value
  };
  await dbInsert('subjects', record);
  closeModal('subject-modal');
  showToast('Fach erstellt!', 'success');
  document.getElementById('sub-name').value = '';
  document.getElementById('sub-short').value = '';
  document.getElementById('sub-teacher').value = '';
  document.getElementById('sub-room').value = '';
  subjects = await dbGet('subjects', currentUser.id);
  renderSubjects();
  renderSubjectSelects();
}

async function deleteSubject(id) {
  if (!confirm('Fach löschen?')) return;
  await dbDelete('subjects', id);
  showToast('Gelöscht', 'success');
  subjects = await dbGet('subjects', currentUser.id);
  renderSubjects();
  renderSubjectSelects();
}
