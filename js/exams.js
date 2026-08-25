let examsData = [];
let examsFilter = 'upcoming';

async function renderExams() {
  if (!currentUser) return;
  const filters = profile.school_id ? { school_id: profile.school_id } : {};
  if (profile.role === 'student') filters.class_name = profile.class_name;
  examsData = await dbGet('exams', filters);
  renderExamList();
}

function filterExams(f, btn) { examsFilter = f; document.querySelectorAll('#page-exams .tab').forEach(t => t.classList.remove('active')); if (btn) btn.classList.add('active'); renderExamList(); }

function renderExamList() {
  let filtered = [...examsData];
  if (examsFilter === 'upcoming') filtered = filtered.filter(e => new Date(e.exam_date) >= new Date(new Date().toDateString()));
  else if (examsFilter === 'past') filtered = filtered.filter(e => new Date(e.exam_date) < new Date(new Date().toDateString()));
  filtered.sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date));
  const el = document.getElementById('exam-list');
  if (filtered.length === 0) { el.innerHTML = '<div class="empty-state"><h3>Keine Klausuren</h3></div>'; return; }
  el.innerHTML = '<div class="grid grid-2">' + filtered.map(e => {
    const sub = subjects.find(s => s.id === e.subject_id);
    const days = daysUntil(e.exam_date);
    const isPast = days < 0;
    return `<div class="card" style="opacity:${isPast ? '0.6' : '1'}">
      <div class="flex-between mb-8"><div class="flex gap-8" style="align-items:center"><div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div><strong>${escapeHtml(e.title)}</strong></div>
      ${profile.role !== 'student' ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="deleteExam('${e.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/></svg></button>` : ''}
      </div>
      <div style="font-size:0.813rem;color:var(--text-secondary)">${escapeHtml(sub?.name || '')} ${e.room ? '&middot; ' + escapeHtml(e.room) : ''}</div>
      <div class="flex-between" style="margin-top:12px"><span class="badge ${isPast ? 'badge-blue' : days <= 7 ? 'badge-red' : 'badge-green'}">${formatDate(e.exam_date)}</span>${e.duration_minutes ? `<span class="text-muted" style="font-size:0.75rem">${e.duration_minutes} Min.</span>` : ''}</div>
      ${e.topic ? `<div style="margin-top:10px;font-size:0.813rem;color:var(--text-muted);background:var(--bg-tertiary);padding:8px 12px;border-radius:var(--radius-sm)">${escapeHtml(e.topic)}</div>` : ''}
    </div>`;
  }).join('') + '</div>';
}

async function saveExam() {
  const title = document.getElementById('ex-title').value;
  const date = document.getElementById('ex-date').value;
  if (!title || !date) { showToast('Titel & Datum nötig', 'error'); return; }
  await dbInsert('exams', {
    school_id: profile.school_id, user_id: currentUser.id, subject_id: document.getElementById('ex-subject').value || null,
    class_id: document.getElementById('ex-class').value || null, title, exam_date: date,
    duration_minutes: parseInt(document.getElementById('ex-duration').value) || null,
    room: document.getElementById('ex-room').value, topic: document.getElementById('ex-topic').value
  });
  closeModal('exam-modal');
  showToast('Klausur erstellt!', 'success');
  renderExams();
}

async function deleteExam(id) {
  if (!confirm('Löschen?')) return;
  await dbDelete('exams', { id }); showToast('Gelöscht', 'success'); renderExams();
}
