let gradesData = [];

async function renderGrades() {
  if (!currentUser) return;
  gradesData = await dbGet('grades', currentUser.id);
  renderGradeStats();
  renderGradeSubjects();
  renderGradeChart();
  renderGradeTable();
}

function renderGradeStats() {
  const avg = calculateGradeAverage(gradesData);
  const best = gradesData.length > 0 ? Math.min(...gradesData.map(g => g.grade)) : 0;
  const worst = gradesData.length > 0 ? Math.max(...gradesData.map(g => g.grade)) : 0;
  document.getElementById('grade-stats').innerHTML = `
    <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div><div class="stat-info"><h4 style="color:${getGradeColor(avg)}">${avg > 0 ? avg.toFixed(2) : '-'}</h4><p>Gesamtdurchschnitt</p></div></div>
    <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg></div><div class="stat-info"><h4 style="color:var(--success)">${best > 0 ? best.toFixed(1) : '-'}</h4><p>Beste Note</p></div></div>
    <div class="stat-card"><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg></div><div class="stat-info"><h4 style="color:var(--danger)">${worst > 0 ? worst.toFixed(1) : '-'}</h4><p>Schlechteste Note</p></div></div>
  `;
}

function renderGradeSubjects() {
  const subjectGrades = {};
  gradesData.forEach(g => {
    if (!subjectGrades[g.subject_id]) subjectGrades[g.subject_id] = [];
    subjectGrades[g.subject_id].push(g);
  });
  const el = document.getElementById('grade-subject-list');
  const entries = Object.entries(subjectGrades);
  if (entries.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>Noch keine Noten</p></div>';
    return;
  }
  el.innerHTML = entries.map(([sid, gs]) => {
    const sub = subjects.find(s => s.id === sid);
    const avg = calculateGradeAverage(gs);
    return `<div class="flex-between" style="padding:12px 0;border-bottom:1px solid var(--border-light)">
      <div class="flex gap-12" style="align-items:center">
        <div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>
        <div>
          <strong style="font-size:0.875rem">${escapeHtml(sub?.name || 'Unbekannt')}</strong>
          <br><span class="text-muted" style="font-size:0.75rem">${gs.length} Note${gs.length !== 1 ? 'n' : ''}</span>
        </div>
      </div>
      <span style="font-size:1.125rem;font-weight:700;color:${getGradeColor(avg)}">${avg.toFixed(1)}</span>
    </div>`;
  }).join('');
}

function renderGradeChart() {
  const ctx = document.getElementById('grade-chart');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  const subjectGrades = {};
  gradesData.forEach(g => {
    if (!subjectGrades[g.subject_id]) subjectGrades[g.subject_id] = [];
    subjectGrades[g.subject_id].push(g);
  });
  const labels = [];
  const data = [];
  const colors = [];
  Object.entries(subjectGrades).forEach(([sid, gs]) => {
    const sub = subjects.find(s => s.id === sid);
    labels.push(sub?.short_name || sub?.name || '?');
    data.push(calculateGradeAverage(gs));
    colors.push(sub?.color || '#F97316');
  });
  if (data.length === 0) return;
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.map(c => c + '80'), borderColor: colors, borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 6, reverse: true, grid: { color: 'var(--border-light)' }, ticks: { color: 'var(--text-muted)' } },
        x: { grid: { display: false }, ticks: { color: 'var(--text-secondary)' } }
      }
    }
  });
}

function renderGradeTable() {
  const el = document.getElementById('grade-table-wrapper');
  if (gradesData.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>Noch keine Noten eingetragen</p></div>';
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th>Fach</th><th>Note</th><th>Gewichtung</th><th>Typ</th><th>Datum</th><th></th></tr></thead>
    <tbody>${gradesData.map(g => {
      const sub = subjects.find(s => s.id === g.subject_id);
      const typeLabels = { oral: 'Mündlich', written: 'Schriftlich', exam: 'Klausur', participation: 'Mitarbeit', homework: 'HA' };
      return `<tr>
        <td><div class="flex gap-8" style="align-items:center"><div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>${escapeHtml(sub?.short_name || sub?.name || '')}</div></td>
        <td><strong style="color:${getGradeColor(g.grade)}">${g.grade.toFixed(1)}</strong></td>
        <td>${g.weight}x</td>
        <td><span class="badge badge-blue">${typeLabels[g.type] || g.type}</span></td>
        <td>${formatDate(g.date)}</td>
        <td><button class="btn btn-ghost btn-icon btn-sm" onclick="deleteGrade('${g.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function saveGrade() {
  const subjectId = document.getElementById('gr-subject').value;
  if (!subjectId) { showToast('Bitte Fach wählen', 'error'); return; }
  const record = {
    user_id: currentUser.id,
    subject_id: subjectId,
    grade: parseFloat(document.getElementById('gr-grade').value),
    weight: parseFloat(document.getElementById('gr-weight').value),
    type: document.getElementById('gr-type').value,
    title: document.getElementById('gr-title').value,
    date: document.getElementById('gr-date').value || new Date().toISOString().split('T')[0],
    comment: document.getElementById('gr-comment').value
  };
  await dbInsert('grades', record);
  closeModal('grade-modal');
  showToast('Note eingetragen!', 'success');
  renderGrades();
}

async function deleteGrade(id) {
  if (!confirm('Note löschen?')) return;
  await dbDelete('grades', id);
  showToast('Gelöscht', 'success');
  renderGrades();
}
