let homeworkData = [];
let hwFilter = 'all';

async function renderHomework() {
  if (!currentUser) return;
  const filters = { school_id: profile.school_id };
  if (profile.role === 'student') filters.class_name = profile.class_name;
  homeworkData = await dbGet('homework', filters);
  renderHwFilters();
  renderHomeworkList();
}

function renderHwFilters() {
  const el = document.getElementById('hw-filters');
  const filters = [{ key: 'all', label: 'Alle' }, { key: 'open', label: 'Offen' }, { key: 'done', label: 'Erledigt' }, { key: 'high', label: 'Dringend' }];
  el.innerHTML = filters.map(f => `<button class="chip ${hwFilter === f.key ? 'active' : ''}" onclick="setHwFilter('${f.key}')">${f.label}</button>`).join('');
}

function setHwFilter(f) { hwFilter = f; renderHwFilters(); renderHomeworkList(); }

function renderHomeworkList() {
  let filtered = [...homeworkData];
  if (hwFilter === 'open') filtered = filtered.filter(h => !h.completed);
  else if (hwFilter === 'done') filtered = filtered.filter(h => h.completed);
  else if (hwFilter === 'high') filtered = filtered.filter(h => h.priority === 'high' && !h.completed);
  filtered.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const el = document.getElementById('homework-list');
  if (filtered.length === 0) { el.innerHTML = '<div class="empty-state"><h3>Keine Hausaufgaben</h3></div>'; return; }
  const isStudent = profile.role === 'student';
  el.innerHTML = filtered.map(h => {
    const sub = subjects.find(s => s.id === h.subject_id);
    const days = daysUntil(h.due_date);
    let dueText = days < 0 ? `<span class="text-danger">Überfällig</span>` : days === 0 ? `<span class="text-warning">Heute fällig</span>` : `<span class="text-muted">in ${days} Tag${days !== 1 ? 'en' : ''}</span>`;
    return `<div class="card mb-8" style="padding:16px 20px;opacity:${h.completed ? '0.6' : '1'}">
      <div class="flex-between">
        <div class="flex gap-16" style="align-items:flex-start">
          ${isStudent ? `<input type="checkbox" ${h.completed ? 'checked' : ''} onchange="toggleHomework('${h.id}', this.checked)" style="margin-top:4px;width:18px;height:18px;accent-color:var(--accent);cursor:pointer">` : ''}
          <div>
            <div class="flex gap-8" style="align-items:center;margin-bottom:4px">
              <strong style="font-size:0.938rem;${h.completed ? 'text-decoration:line-through;' : ''}">${escapeHtml(h.title)}</strong>
              <div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>
              <span class="badge badge-${h.priority === 'high' ? 'red' : h.priority === 'low' ? 'green' : 'yellow'}" style="font-size:0.688rem">${h.priority === 'high' ? 'Dringend' : ''}</span>
            </div>
            <div style="font-size:0.813rem;color:var(--text-secondary)">${escapeHtml(sub?.short_name || sub?.name || '')} &middot; Fällig: ${formatDate(h.due_date)} ${dueText}</div>
            ${h.description ? `<div style="font-size:0.813rem;color:var(--text-muted);margin-top:6px">${escapeHtml(h.description)}</div>` : ''}
          </div>
        </div>
        ${!isStudent ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="deleteHomework('${h.id}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function saveHomework() {
  const title = document.getElementById('hw-title').value;
  const due = document.getElementById('hw-due').value;
  if (!title || !due) { showToast('Titel & Fälligkeitsdatum nötig', 'error'); return; }
  await dbInsert('homework', {
    school_id: profile.school_id, user_id: currentUser.id, subject_id: document.getElementById('hw-subject').value || null,
    class_id: document.getElementById('hw-class').value || null, title, description: document.getElementById('hw-desc').value,
    due_date: due, priority: document.getElementById('hw-priority').value, completed: false
  });
  closeModal('homework-modal');
  showToast('Hausaufgabe erstellt!', 'success');
  document.getElementById('hw-title').value = '';
  renderHomework();
}

async function toggleHomework(id, completed) {
  await dbUpdate('homework', { id }, { completed });
  renderHomework();
}

async function deleteHomework(id) {
  if (!confirm('Löschen?')) return;
  await dbDelete('homework', { id });
  showToast('Gelöscht', 'success');
  renderHomework();
}
