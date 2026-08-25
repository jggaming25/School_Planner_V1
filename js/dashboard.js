let chartInstance = null;

function renderDashboard() {
  const hour = new Date().getHours();
  let greeting = 'Guten Morgen';
  if (hour >= 12 && hour < 18) greeting = 'Guten Tag';
  else if (hour >= 18) greeting = 'Guten Abend';
  document.getElementById('greeting').textContent = `${greeting}, ${profile?.full_name || ''}!`;
  document.getElementById('greeting-sub').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  loadDashboardData();
}

async function loadDashboardData() {
  if (!currentUser) return;
  const [hw, exams, grades, tt] = await Promise.all([
    dbGet('homework', currentUser.id),
    dbGet('exams', currentUser.id),
    dbGet('grades', currentUser.id),
    dbGet('timetable', currentUser.id)
  ]);

  const openHw = hw.filter(h => !h.completed);
  const upcomingExams = exams.filter(e => new Date(e.exam_date) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date));
  const avg = calculateGradeAverage(grades);
  const today = new Date().getDay() - 1;
  const todayClasses = tt.filter(t => t.day_of_week === today).sort((a, b) => a.period_start - b.period_start);

  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><div class="stat-info"><h4>${openHw.length}</h4><p>Offene Hausaufgaben</p></div></div>
    <div class="stat-card"><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="stat-info"><h4>${upcomingExams.length}</h4><p>Nächste Klausuren</p></div></div>
    <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div><div class="stat-info"><h4>${avg > 0 ? avg.toFixed(1) : '-'}</h4><p>Notendurchschnitt</p></div></div>
    <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div class="stat-info"><h4>${todayClasses.length}</h4><p>Heutige Stunden</p></div></div>
  `;

  const hwHtml = openHw.length === 0 ? '<div class="empty-state"><p>Keine offenen Hausaufgaben</p></div>' :
    openHw.slice(0, 5).map(h => {
      const sub = subjects.find(s => s.id === h.subject_id);
      const days = daysUntil(h.due_date);
      let dueClass = '';
      if (days < 0) dueClass = 'text-danger';
      else if (days === 0) dueClass = 'text-warning';
      else if (days <= 2) dueClass = 'text-accent';
      return `<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-light)">
        <div class="flex gap-12" style="align-items:center">
          <div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>
          <div><strong style="font-size:0.875rem">${escapeHtml(h.title)}</strong><br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(sub?.short_name || sub?.name || '')}</span></div>
        </div>
        <span class="${dueClass}" style="font-size:0.813rem;font-weight:500">${formatDateShort(h.due_date)}</span>
      </div>`;
    }).join('');
  document.getElementById('dashboard-homework-list').innerHTML = hwHtml;

  const examHtml = upcomingExams.length === 0 ? '<div class="empty-state"><p>Keine anstehenden Klausuren</p></div>' :
    upcomingExams.slice(0, 5).map(e => {
      const sub = subjects.find(s => s.id === e.subject_id);
      const days = daysUntil(e.exam_date);
      return `<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-light)">
        <div class="flex gap-12" style="align-items:center">
          <div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>
          <div><strong style="font-size:0.875rem">${escapeHtml(e.title)}</strong><br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(sub?.short_name || sub?.name || '')}</span></div>
        </div>
        <span style="font-size:0.813rem;font-weight:500;color:${days <= 3 ? 'var(--danger)' : 'var(--text-secondary)'}">in ${days} ${days === 1 ? 'Tag' : 'Tagen'}</span>
      </div>`;
    }).join('');
  document.getElementById('dashboard-exams-list').innerHTML = examHtml;

  const ttHtml = todayClasses.length === 0 ? '<div class="empty-state"><p>Heute keine Stunden</p></div>' :
    todayClasses.map(t => {
      const sub = subjects.find(s => s.id === t.subject_id);
      return `<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-light)">
        <div class="flex gap-12" style="align-items:center">
          <div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>
          <div><strong style="font-size:0.875rem">${escapeHtml(sub?.short_name || sub?.name || '')}</strong><br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(t.teacher || '')} &middot; ${escapeHtml(t.room || '')}</span></div>
        </div>
        <span style="font-size:0.813rem;font-weight:600;color:var(--text-secondary)">${t.period_start}${t.period_start !== t.period_end ? '-' + t.period_end : ''}. Std.</span>
      </div>`;
    }).join('');
  document.getElementById('dashboard-timetable').innerHTML = ttHtml;

  renderDashboardGradeSection(grades);
}

function renderDashboardGradeSection(grades) {
  const el = document.getElementById('dashboard-grades');
  if (grades.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>Noch keine Noten eingetragen</p></div>';
    return;
  }
  const subjectGrades = {};
  grades.forEach(g => {
    if (!subjectGrades[g.subject_id]) subjectGrades[g.subject_id] = [];
    subjectGrades[g.subject_id].push(g);
  });
  const rows = Object.entries(subjectGrades).map(([sid, gs]) => {
    const sub = subjects.find(s => s.id === sid);
    const avg = calculateGradeAverage(gs);
    return `<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-light)">
      <div class="flex gap-12" style="align-items:center">
        <div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>
        <span style="font-size:0.875rem;font-weight:500">${escapeHtml(sub?.short_name || sub?.name || 'Unbekannt')}</span>
      </div>
      <span style="font-size:0.938rem;font-weight:700;color:${getGradeColor(avg)}">${avg.toFixed(1)}</span>
    </div>`;
  }).join('');
  const overall = calculateGradeAverage(grades);
  el.innerHTML = rows + `<div class="flex-between" style="padding:14px 0 0;margin-top:8px;border-top:2px solid var(--border)">
    <strong style="font-size:0.938rem">Gesamtdurchschnitt</strong>
    <strong style="font-size:1.125rem;color:${getGradeColor(overall)}">${overall.toFixed(1)}</strong>
  </div>`;
}
