let gradesData = [];
let chartInstance = null;
let selectedClass = '';
let gradeView = 'personal';

const WEIGHT_TYPES = [
  { value: 1, label: 'Normal', short: '1x' },
  { value: 2, label: 'Halbe Klausur', short: '2x' },
  { value: 3, label: 'Klausur', short: '3x' },
  { value: 4, label: 'Abi/Bonus', short: '4x' }
];

const GRADE_OPTIONS = [
  { value: 1, label: '1' },
  { value: 1.25, label: '1+' },
  { value: 1.5, label: '1-' },
  { value: 2, label: '2' },
  { value: 2.25, label: '2+' },
  { value: 2.5, label: '2-' },
  { value: 3, label: '3' },
  { value: 3.25, label: '3+' },
  { value: 3.5, label: '3-' },
  { value: 4, label: '4' },
  { value: 4.25, label: '4+' },
  { value: 4.5, label: '4-' },
  { value: 5, label: '5' },
  { value: 5.25, label: '5+' },
  { value: 5.5, label: '5-' },
  { value: 6, label: '6' }
];

const TYPE_LABELS = { oral: 'Mündlich', written: 'Schriftlich', exam: 'Klausur', participation: 'Mitarbeit', homework: 'Hausaufgabe', test: 'Test' };

const WEIGHT_LABELS = { 1: 'Normal', 2: 'Halbe Klausur', 3: 'Klausur', 4: 'Abi/Bonus' };

async function renderGrades() {
  if (!currentUser) return;

  const isTeacherRole = ['teacher', 'school_admin', 'admin', 'supporter', 'head_admin', 'super_admin', 'ceo'].includes(profile.role);

  renderGradeClassSelector();
  renderGradeViewTabs();

  if (gradeView === 'class' && isTeacherRole && selectedClass) {
    await renderClassGridView();
    return;
  }

  const filters = profile.school_id ? { school_id: profile.school_id } : {};
  if (profile.role === 'student') filters.student_id = currentUser.id;
  gradesData = await dbGet('grades', filters);

  renderGradeStats();
  renderGradeSubjects();
  renderGradeChart();
  renderGradeTable();
}

function renderGradeViewTabs() {
  const isTeacherRole = ['teacher', 'school_admin', 'admin', 'supporter', 'head_admin', 'super_admin', 'ceo'].includes(profile.role);
  const tabsEl = document.getElementById('grade-view-tabs');
  if (!tabsEl) return;
  if (isTeacherRole) {
    tabsEl.innerHTML = `
      <div class="tabs" style="display:inline-flex">
        <button class="tab ${gradeView === 'personal' ? 'active' : ''}" onclick="switchGradeView('personal')">Persönliche Noten</button>
        <button class="tab ${gradeView === 'class' ? 'active' : ''}" onclick="switchGradeView('class')">Klassenansicht</button>
      </div>`;
  } else {
    tabsEl.innerHTML = '';
  }
}

function switchGradeView(view) {
  gradeView = view;
  renderGrades();
}

function renderGradeClassSelector() {
  const el = document.getElementById('grade-class-selector');
  if (!el) return;
  const isTeacherRole = ['teacher', 'school_admin', 'admin', 'supporter', 'head_admin', 'super_admin', 'ceo'].includes(profile.role);
  if (!isTeacherRole) { el.innerHTML = ''; return; }
  el.innerHTML = `<select class="input-field" style="max-width:200px" onchange="selectGradeClass(this.value)">
    <option value="">Klasse wählen...</option>
    ${schoolClasses.map(c => `<option value="${c.name}" ${selectedClass === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
  </select>`;
}

function selectGradeClass(className) {
  selectedClass = className;
  gradeView = className ? 'class' : 'personal';
  renderGrades();
}

async function getStudentsForClass(className) {
  return dbGet('profiles', { school_id: profile.school_id, role: 'student', class_name: className });
}

async function renderClassGridView() {
  if (!selectedClass) {
    document.getElementById('grade-stats').innerHTML = '';
    document.getElementById('grade-subject-list').innerHTML = '<div class="empty-state"><p>Klasse wählen</p></div>';
    const chartCtx = document.getElementById('grade-chart');
    if (chartCtx) chartCtx.getContext('2d').clearRect(0, 0, chartCtx.width, chartCtx.height);
    document.getElementById('grade-table-wrapper').innerHTML = '<div class="empty-state"><p>Klasse wählen</p></div>';
    return;
  }

  const [students, allGrades] = await Promise.all([
    getStudentsForClass(selectedClass),
    dbGet('grades', profile.school_id ? { school_id: profile.school_id } : {})
  ]);

  const classGrades = allGrades.filter(g => students.some(s => s.id === g.student_id));
  const studentGrades = {};
  students.forEach(s => { studentGrades[s.id] = classGrades.filter(g => g.student_id === s.id); });

  const subjectIds = [...new Set(classGrades.map(g => g.subject_id))];
  const subMap = {};
  subjectIds.forEach(sid => { subMap[sid] = subjects.find(s => s.id === sid); });

  const classAvg = calculateGradeAverage(classGrades);
  document.getElementById('grade-stats').innerHTML = `
    <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="stat-info"><h4>${students.length}</h4><p>Schüler in Klasse</p></div></div>
    <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div><div class="stat-info"><h4 style="color:${getGradeColor(classAvg)}">${classAvg > 0 ? classAvg.toFixed(2) : '-'}</h4><p>Klassendurchschnitt</p></div></div>
    <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg></div><div class="stat-info"><h4>${classGrades.length}</h4><p>Gesamte Noten</p></div></div>`;

  document.getElementById('grade-subject-list').innerHTML = subjectIds.length === 0 ?
    '<div class="empty-state"><p>Noch keine Noten für Klasse ' + escapeHtml(selectedClass) + '</p></div>' :
    subjectIds.map(sid => {
      const sub = subMap[sid];
      const sGrades = classGrades.filter(g => g.subject_id === sid);
      const avg = calculateGradeAverage(sGrades);
      return `<div class="flex-between" style="padding:12px 0;border-bottom:1px solid var(--border-light)">
        <div class="flex gap-12" style="align-items:center"><div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div><div><strong style="font-size:0.875rem">${escapeHtml(sub?.name || '?')}</strong><br><span class="text-muted" style="font-size:0.75rem">${sGrades.length} Note${sGrades.length !== 1 ? 'n' : ''}</span></div></div>
        <span style="font-size:1.125rem;font-weight:700;color:${getGradeColor(avg)}">${avg.toFixed(1)}</span></div>`;
    }).join('');

  const chartCtx = document.getElementById('grade-chart');
  if (chartInstance) chartInstance.destroy();
  if (subjectIds.length > 0 && chartCtx) {
    const labels = [], data = [], colors = [];
    subjectIds.forEach(sid => {
      const sub = subMap[sid];
      labels.push(sub?.short_name || sub?.name || '?');
      data.push(calculateGradeAverage(classGrades.filter(g => g.subject_id === sid)));
      colors.push(sub?.color || '#F97316');
    });
    chartInstance = new Chart(chartCtx, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + '80'), borderColor: colors, borderWidth: 2, borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 6, reverse: true, grid: { color: 'var(--border-light)' }, ticks: { color: 'var(--text-muted)' } },
          x: { grid: { display: false }, ticks: { color: 'var(--text-secondary)' } } } }
    });
  }

  const el = document.getElementById('grade-table-wrapper');
  if (students.length === 0 || classGrades.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>Keine Daten für Klasse ' + escapeHtml(selectedClass) + '</p></div>';
    return;
  }

  let headerRow = '<th>Schüler</th>';
  subjectIds.forEach(sid => {
    const sub = subMap[sid];
    headerRow += `<th style="text-align:center"><div class="color-dot" style="background:${sub?.color || 'var(--accent)'};margin:0 auto 4px"></div><span style="font-size:0.75rem">${escapeHtml(sub?.short_name || sub?.name || '')}</span></th>`;
  });
  headerRow += '<th style="text-align:center">Durchschn.</th>';

  const bodyRows = students.map(st => {
    const sGrades = studentGrades[st.id] || [];
    const sAvg = calculateGradeAverage(sGrades);
    let row = `<td><strong style="font-size:0.875rem">${escapeHtml(st.full_name || '?')}</strong></td>`;
    subjectIds.forEach(sid => {
      const grades = sGrades.filter(g => g.subject_id === sid);
      if (grades.length === 0) {
        row += '<td style="text-align:center;color:var(--text-muted)">-</td>';
      } else {
        const avg = calculateGradeAverage(grades);
        row += `<td style="text-align:center"><strong style="color:${getGradeColor(avg)};font-size:0.875rem">${avg.toFixed(1)}</strong><span style="font-size:0.625rem;color:var(--text-muted);display:block">(${grades.length})</span></td>`;
      }
    });
    row += `<td style="text-align:center"><strong style="color:${getGradeColor(sAvg)};font-size:1rem">${sGrades.length > 0 ? sAvg.toFixed(2) : '-'}</strong></td>`;
    return `<tr>${row}</tr>`;
  }).join('');

  el.innerHTML = `<div class="grade-grid-scroll"><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

function renderGradeStats() {
  const avg = calculateGradeAverage(gradesData);
  const best = gradesData.length > 0 ? Math.min(...gradesData.map(g => g.grade)) : 0;
  const worst = gradesData.length > 0 ? Math.max(...gradesData.map(g => g.grade)) : 0;
  document.getElementById('grade-stats').innerHTML = `
    <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div><div class="stat-info"><h4 style="color:${getGradeColor(avg)}">${avg > 0 ? avg.toFixed(2) : '-'}</h4><p>Gewichteter Durchschnitt</p></div></div>
    <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg></div><div class="stat-info"><h4 style="color:var(--success)">${best > 0 ? formatGradeValue(best) : '-'}</h4><p>Beste Note</p></div></div>
    <div class="stat-card"><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg></div><div class="stat-info"><h4 style="color:var(--danger)">${worst > 0 ? formatGradeValue(worst) : '-'}</h4><p>Schlechteste Note</p></div></div>`;
}

function renderGradeSubjects() {
  const sg = {};
  gradesData.forEach(g => { if (!sg[g.subject_id]) sg[g.subject_id] = []; sg[g.subject_id].push(g); });
  const el = document.getElementById('grade-subject-list');
  const entries = Object.entries(sg);
  if (entries.length === 0) { el.innerHTML = '<div class="empty-state"><p>Noch keine Noten</p></div>'; return; }
  el.innerHTML = entries.map(([sid, gs]) => {
    const sub = subjects.find(s => s.id === sid);
    const avg = calculateGradeAverage(gs);
    return `<div class="flex-between" style="padding:12px 0;border-bottom:1px solid var(--border-light)">
      <div class="flex gap-12" style="align-items:center"><div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div><div><strong style="font-size:0.875rem">${escapeHtml(sub?.name || '?')}</strong><br><span class="text-muted" style="font-size:0.75rem">${gs.length} Note${gs.length !== 1 ? 'n' : ''} &middot; Ø ${avg.toFixed(1)}</span></div></div>
      <span style="font-size:1.125rem;font-weight:700;color:${getGradeColor(avg)}">${avg.toFixed(1)}</span></div>`;
  }).join('');
}

function renderGradeChart() {
  const ctx = document.getElementById('grade-chart');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  const sg = {};
  gradesData.forEach(g => { if (!sg[g.subject_id]) sg[g.subject_id] = []; sg[g.subject_id].push(g); });
  const labels = [], data = [], colors = [];
  Object.entries(sg).forEach(([sid, gs]) => {
    const sub = subjects.find(s => s.id === sid);
    labels.push(sub?.short_name || sub?.name || '?');
    data.push(calculateGradeAverage(gs));
    colors.push(sub?.color || '#F97316');
  });
  if (data.length === 0) return;
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + '80'), borderColor: colors, borderWidth: 2, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 6, reverse: true, grid: { color: 'var(--border-light)' }, ticks: { color: 'var(--text-muted)' } },
        x: { grid: { display: false }, ticks: { color: 'var(--text-secondary)' } } } }
  });
}

function renderGradeTable() {
  const el = document.getElementById('grade-table-wrapper');
  if (gradesData.length === 0) { el.innerHTML = '<div class="empty-state"><p>Noch keine Noten</p></div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Fach</th><th>Note</th><th>Gewichtung</th><th>Typ</th><th>Datum</th><th>Kommentar</th>${profile.role !== 'student' ? '<th></th>' : ''}</tr></thead><tbody>${gradesData.map(g => {
    const sub = subjects.find(s => s.id === g.subject_id);
    const w = WEIGHT_TYPES.find(wt => wt.value === g.weight) || WEIGHT_TYPES[0];
    return `<tr>
      <td><div class="flex gap-8" style="align-items:center"><div class="color-dot" style="background:${sub?.color || 'var(--accent)'}"></div>${escapeHtml(sub?.short_name || sub?.name || '')}</div></td>
      <td><strong style="color:${getGradeColor(g.grade)};font-size:1rem">${formatGradeValue(g.grade)}</strong></td>
      <td><span class="badge badge-orange">${w.short}</span></td>
      <td><span class="badge badge-blue">${TYPE_LABELS[g.type] || g.type}</span></td>
      <td>${formatDate(g.date)}</td>
      <td><span style="font-size:0.813rem;color:var(--text-secondary)">${escapeHtml(g.comment || '')}</span></td>
      ${profile.role !== 'student' ? `<td><button class="btn btn-ghost btn-icon btn-sm" onclick="deleteGrade('${g.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button></td>` : ''}
    </tr>`;
  }).join('')}</tbody></table>`;
}

function formatGradeValue(grade) {
  if (!grade) return '-';
  const match = GRADE_OPTIONS.find(o => Math.abs(o.value - grade) < 0.01);
  return match ? match.label : grade.toFixed(1);
}

function getWeightValueFromGrade() {
  const select = document.getElementById('gr-weight');
  return select ? parseFloat(select.value) : 1;
}

async function saveGrade() {
  const subjectId = document.getElementById('gr-subject').value;
  const studentId = document.getElementById('gr-student').value;
  if (!subjectId || !studentId) { showToast('Fach & Schüler nötig', 'error'); return; }
  const weightVal = getWeightValueFromGrade();
  const weightType = weightVal <= 1 ? 'normal' : weightVal <= 2 ? 'half' : weightVal <= 3 ? 'full' : 'bonus';
  const record = {
    school_id: profile.school_id, user_id: currentUser.id, student_id: studentId, subject_id: subjectId,
    grade: parseFloat(document.getElementById('gr-grade').value),
    weight: weightVal,
    weight_type: weightType,
    type: document.getElementById('gr-type').value,
    date: document.getElementById('gr-date').value || new Date().toISOString().split('T')[0],
    comment: document.getElementById('gr-comment').value,
    visible_to_student: document.getElementById('gr-visible').checked
  };
  await dbInsert('grades', record);
  closeModal('grade-modal');
  showToast('Note eingetragen!', 'success');

  if (record.visible_to_student) {
    const subject = subjects.find(s => s.id === subjectId);
    await notifyUsers(
      profile.school_id,
      'Neue Note eingetragen',
      `Du hast eine neue Note in ${escapeHtml(subject?.name || 'Unbekannt')}: ${formatGradeValue(record.grade)} (${WEIGHT_LABELS[weightVal] || 'Normal'})`,
      'grade',
      [studentId]
    );
  }
  renderGrades();
}

async function deleteGrade(id) {
  if (!confirm('Note löschen?')) return;
  await dbDelete('grades', { id });
  showToast('Gelöscht', 'success');
  renderGrades();
}
