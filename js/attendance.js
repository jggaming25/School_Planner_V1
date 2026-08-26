let attendanceData = [];
let attendanceStudents = [];
let attendanceSelectedDate = new Date().toISOString().split('T')[0];
let attendanceSelectedClass = '';
let attendanceSelectedPeriod = 1;

const statusLabels = { present: 'Anwesend', absent: 'Abwesend', late: 'Verspätet' };
const statusBadgeClass = { present: 'badge-green', absent: 'badge-red', late: 'badge-yellow' };

async function renderAttendance() {
  if (!currentUser || !profile) return;

  if (profile.role === 'student') {
    renderStudentAttendance();
    return;
  }

  if (['school_admin', 'admin', 'supporter', 'head_admin', 'ceo'].includes(profile.role)) {
    renderAdminAttendance();
    return;
  }

  renderTeacherAttendance();
}

function renderTeacherAttendance() {
  const el = document.getElementById('attendance-content');
  if (!el) return;

  const teacherClasses = schoolClasses.filter(c =>
    c.class_teacher_id === currentUser.id ||
    ['school_admin', 'admin', 'supporter', 'head_admin', 'ceo'].includes(profile.role)
  );

  if (!attendanceSelectedClass && teacherClasses.length > 0) {
    attendanceSelectedClass = teacherClasses[0].name;
  }

  const maxPeriods = getMaxPeriods();

  el.innerHTML = `
    <div class="page-header flex-between">
      <div><h1>Anwesenheit</h1><p class="subtitle">Anwesenheit erfassen</p></div>
      <button class="btn btn-primary btn-sm" onclick="openModal('absence-request-modal')" style="${profile.role === 'student' ? '' : 'display:none'}">Fehlzeit beantragen</button>
    </div>
    <div class="page-body">
      <div class="card mb-20">
        <div class="flex gap-16" style="align-items:flex-end;flex-wrap:wrap">
          <div class="input-group" style="margin-bottom:0;min-width:180px">
            <label>Datum</label>
            <input type="date" class="input-field" id="att-date" value="${attendanceSelectedDate}" onchange="onAttendanceDateChange(this.value)">
          </div>
          <div class="input-group" style="margin-bottom:0;min-width:180px">
            <label>Klasse</label>
            <select class="input-field" id="att-class" onchange="onAttendanceClassChange(this.value)">
              ${teacherClasses.map(c => `<option value="${escapeHtml(c.name)}" ${c.name === attendanceSelectedClass ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="margin-bottom:0;min-width:140px">
            <label>Stunde</label>
            <select class="input-field" id="att-period" onchange="onAttendancePeriodChange(this.value)">
              ${Array.from({length: maxPeriods}, (_, i) => i + 1).map(p => `<option value="${p}" ${p === attendanceSelectedPeriod ? 'selected' : ''}>${p}. Stunde</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="saveAttendance()">Speichern</button>
        </div>
      </div>
      <div id="att-table-container">
        <div class="empty-state"><p>Lade Schüler...</p></div>
      </div>
    </div>
  `;

  loadAttendanceStudents();
}

function onAttendanceDateChange(val) {
  attendanceSelectedDate = val;
  loadAttendanceStudents();
}

function onAttendanceClassChange(val) {
  attendanceSelectedClass = val;
  loadAttendanceStudents();
}

function onAttendancePeriodChange(val) {
  attendanceSelectedPeriod = parseInt(val);
  loadAttendanceStudents();
}

async function loadAttendanceStudents() {
  const container = document.getElementById('att-table-container');
  if (!container) return;
  if (!attendanceSelectedClass) {
    container.innerHTML = '<div class="empty-state"><p>Keine Klasse ausgewählt</p></div>';
    return;
  }

  attendanceStudents = await dbGet('profiles', {
    school_id: profile.school_id,
    role: 'student',
    class_name: attendanceSelectedClass
  });

  attendanceStudents = attendanceStudents.filter(s => s.is_active !== false);

  attendanceData = await dbGet('attendance', {
    school_id: profile.school_id,
    class_name: attendanceSelectedClass,
    date: attendanceSelectedDate,
    period: attendanceSelectedPeriod
  });

  if (attendanceStudents.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Keine Schüler in dieser Klasse</p></div>';
    return;
  }

  const existingMap = {};
  attendanceData.forEach(a => { existingMap[a.student_id] = a; });

  const dateLabel = formatDate(attendanceSelectedDate);

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>${escapeHtml(attendanceSelectedClass)} &middot; ${dateLabel} &middot; ${attendanceSelectedPeriod}. Stunde</h3>
        <span class="text-muted" style="font-size:0.813rem">${attendanceStudents.length} Schüler</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th style="text-align:center">Anwesend</th>
              <th style="text-align:center">Abwesend</th>
              <th style="text-align:center">Verspätet</th>
              <th style="text-align:center;width:120px">Minuten</th>
            </tr>
          </thead>
          <tbody>
            ${attendanceStudents.map(s => {
              const existing = existingMap[s.id];
              const status = existing ? existing.status : 'present';
              const lateMins = existing ? (existing.late_minutes || 0) : 0;
              return `<tr>
                <td>
                  <strong style="font-size:0.875rem">${escapeHtml(s.full_name || '?')}</strong>
                </td>
                <td style="text-align:center">
                  <button class="btn btn-sm ${status === 'present' ? 'btn-primary' : 'btn-ghost'}" onclick="setAttStatus('${s.id}','present',this)" style="min-width:90px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Anwesend
                  </button>
                </td>
                <td style="text-align:center">
                  <button class="btn btn-sm ${status === 'absent' ? 'btn-danger' : 'btn-ghost'}" onclick="setAttStatus('${s.id}','absent',this)" style="min-width:90px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Abwesend
                  </button>
                </td>
                <td style="text-align:center">
                  <button class="btn btn-sm ${status === 'late' ? 'btn-secondary' : 'btn-ghost'}" onclick="setAttStatus('${s.id}','late',this)" style="min-width:90px;border-color:${status === 'late' ? 'var(--warning)' : ''};color:${status === 'late' ? 'var(--warning)' : ''}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Verspätet
                  </button>
                </td>
                <td style="text-align:center">
                  <input type="number" class="input-field" style="width:80px;margin:0 auto;text-align:center;${status === 'late' ? '' : 'opacity:0.3;pointer-events:none'}"
                    value="${lateMins}" min="0" max="300"
                    id="att-mins-${s.id}"
                    onchange="onAttMinsChange('${s.id}',this.value)">
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function setAttStatus(studentId, status, btn) {
  const row = btn.closest('tr');
  if (!row) return;

  row.querySelectorAll('button').forEach(b => {
    b.className = 'btn btn-sm btn-ghost';
    if (b.querySelector('svg polyline[points="22 4 12 14.01 9 11.01"]') ||
        b.querySelector('svg line[x1="15"]') ||
        b.querySelector('svg polyline[points="12 6 12 12 16 14"]')) {
      b.style.minWidth = '90px';
    }
  });

  const minsInput = document.getElementById('att-mins-' + studentId);
  if (status === 'present') {
    btn.className = 'btn btn-sm btn-primary';
  } else if (status === 'absent') {
    btn.className = 'btn btn-sm btn-danger';
  } else if (status === 'late') {
    btn.className = 'btn btn-sm btn-secondary';
    btn.style.borderColor = 'var(--warning)';
    btn.style.color = 'var(--warning)';
  }

  if (minsInput) {
    minsInput.style.opacity = status === 'late' ? '1' : '0.3';
    minsInput.style.pointerEvents = status === 'late' ? 'auto' : 'none';
    if (status !== 'late') minsInput.value = 0;
  }
}

function onAttMinsChange(studentId, val) {
  const mins = parseInt(val) || 0;
  const input = document.getElementById('att-mins-' + studentId);
  if (input) input.value = Math.max(0, Math.min(300, mins));
}

function getAttRowStatus(studentId) {
  const row = document.querySelector(`tr [id="att-mins-${studentId}"]`)?.closest('tr');
  if (!row) return 'present';
  const btns = row.querySelectorAll('button');
  if (btns[0]?.classList.contains('btn-danger')) return 'absent';
  if (btns[2]?.classList.contains('btn-secondary') && btns[2]?.style.color) return 'late';
  return 'present';
}

function getAttRowMins(studentId) {
  const input = document.getElementById('att-mins-' + studentId);
  return input ? parseInt(input.value) || 0 : 0;
}

async function saveAttendance() {
  const results = [];
  const absentStudents = [];

  for (const student of attendanceStudents) {
    const status = getAttRowStatus(student.id);
    const mins = status === 'late' ? getAttRowMins(student.id) : 0;

    results.push({
      student_id: student.id,
      status,
      late_minutes: mins
    });

    if (status === 'absent') {
      absentStudents.push(student.id);
    }
  }

  const promises = results.map(async (r) => {
    const existing = attendanceData.find(a => a.student_id === r.student_id);
    if (existing) {
      return dbUpdate('attendance', { id: existing.id }, {
        status: r.status,
        late_minutes: r.late_minutes,
        marked_by: currentUser.id
      });
    } else {
      return dbInsert('attendance', {
        school_id: profile.school_id,
        student_id: r.student_id,
        class_name: attendanceSelectedClass,
        date: attendanceSelectedDate,
        period: attendanceSelectedPeriod,
        status: r.status,
        late_minutes: r.late_minutes,
        marked_by: currentUser.id
      });
    }
  });

  await Promise.all(promises);

  if (absentStudents.length > 0) {
    await propagateAbsent(absentStudents, attendanceSelectedDate, attendanceSelectedPeriod);
  }

  showToast('Anwesenheit gespeichert!', 'success');
  loadAttendanceStudents();
}

async function propagateAbsent(absentStudentIds, date, fromPeriod) {
  const maxPeriods = getMaxPeriods();
  const existingLater = await dbGet('attendance', {
    school_id: profile.school_id,
    class_name: attendanceSelectedClass,
    date: date
  });

  const promises = [];

  for (let p = fromPeriod + 1; p <= maxPeriods; p++) {
    for (const sid of absentStudentIds) {
      const alreadyMarked = existingLater.find(a => a.student_id === sid && a.period === p);
      if (!alreadyMarked) {
        promises.push(dbInsert('attendance', {
          school_id: profile.school_id,
          student_id: sid,
          class_name: attendanceSelectedClass,
          date: date,
          period: p,
          status: 'absent',
          late_minutes: 0,
          marked_by: currentUser.id,
          notes: 'Automatisch übertragen'
        }));
      }
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

function getMaxPeriods() {
  if (currentSchoolSettings && currentSchoolSettings.max_periods) {
    return currentSchoolSettings.max_periods;
  }
  return 8;
}

let currentSchoolSettings = null;

async function loadSchoolSettings() {
  if (!profile?.school_id) return;
  const school = await getSchool(profile.school_id);
  if (school?.school_settings) {
    currentSchoolSettings = school.school_settings;
  }
}

async function renderStudentAttendance() {
  const el = document.getElementById('attendance-content');
  if (!el) return;

  const records = await dbGet('attendance', {
    school_id: profile.school_id,
    student_id: currentUser.id
  });

  const totalDays = new Set(records.map(r => r.date)).size;
  const absentDays = new Set(records.filter(r => r.status === 'absent').map(r => r.date)).size;
  const lateCount = records.filter(r => r.status === 'late').length;
  const presentCount = records.filter(r => r.status === 'present').length;
  const totalRecords = records.length;
  const attendanceRate = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : '0.0';

  const byDate = {};
  records.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  el.innerHTML = `
    <div class="page-header flex-between">
      <div><h1>Anwesenheit</h1><p class="subtitle">Deine Anwesenheitsübersicht</p></div>
      <button class="btn btn-primary btn-sm" onclick="openModal('absence-request-modal')">Fehlzeit beantragen</button>
    </div>
    <div class="page-body">
      <div class="grid grid-4 mb-24">
        <div class="stat-card">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg></div>
          <div class="stat-info"><h4>${totalDays}</h4><p>Anwesende Tage</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div class="stat-info"><h4>${attendanceRate}%</h4><p>Anwesenheitsquote</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <div class="stat-info"><h4>${absentDays}</h4><p>Fehlende Tage</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div class="stat-info"><h4>${lateCount}</h4><p>Verspätungen</p></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Anwesenheitshistorie</h3></div>
        ${sortedDates.length === 0 ? '<div class="empty-state"><p>Noch keine Anwesenheitsdaten vorhanden</p></div>' :
          sortedDates.map(date => `
            <div class="mb-16">
              <div class="flex-between mb-8">
                <strong style="font-size:0.875rem">${formatDate(date)}</strong>
              </div>
              <div class="flex gap-8" style="flex-wrap:wrap">
                ${byDate[date].sort((a,b) => a.period - b.period).map(r =>
                  `<span class="badge ${statusBadgeClass[r.status] || 'badge-blue'}">${r.period}. Stunde: ${statusLabels[r.status] || r.status}${r.late_minutes ? ' (' + r.late_minutes + ' Min)' : ''}${r.notes ? ' - ' + escapeHtml(r.notes) : ''}</span>`
                ).join('')}
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;
}

async function renderAdminAttendance() {
  const el = document.getElementById('attendance-content');
  if (!el) return;

  const allClasses = schoolClasses.map(c => c.name);
  if (!attendanceSelectedClass && allClasses.length > 0) {
    attendanceSelectedClass = allClasses[0];
  }

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  el.innerHTML = `
    <div class="page-header flex-between">
      <div><h1>Anwesenheit</h1><p class="subtitle">Anwesenheit aller Klassen einsehen</p></div>
    </div>
    <div class="page-body">
      <div class="card mb-20">
        <div class="flex gap-16" style="align-items:flex-end;flex-wrap:wrap">
          <div class="input-group" style="margin-bottom:0;min-width:180px">
            <label>Klasse</label>
            <select class="input-field" id="admin-att-class" onchange="loadAdminAttendance()">
              ${allClasses.map(c => `<option value="${escapeHtml(c)}" ${c === attendanceSelectedClass ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="margin-bottom:0;min-width:180px">
            <label>Von</label>
            <input type="date" class="input-field" id="admin-att-from" value="${weekAgo}" onchange="loadAdminAttendance()">
          </div>
          <div class="input-group" style="margin-bottom:0;min-width:180px">
            <label>Bis</label>
            <input type="date" class="input-field" id="admin-att-to" value="${today}" onchange="loadAdminAttendance()">
          </div>
          <button class="btn btn-primary btn-sm" onclick="loadAdminAttendance()">Suchen</button>
        </div>
      </div>
      <div id="admin-att-results">
        <div class="empty-state"><p>Lade Daten...</p></div>
      </div>
    </div>
  `;

  loadAdminAttendance();
}

async function loadAdminAttendance() {
  const container = document.getElementById('admin-att-results');
  if (!container) return;

  const cls = document.getElementById('admin-att-class')?.value;
  const from = document.getElementById('admin-att-from')?.value;
  const to = document.getElementById('admin-att-to')?.value;

  if (!cls || !from || !to) {
    container.innerHTML = '<div class="empty-state"><p>Bitte Klasse und Zeitraum wählen</p></div>';
    return;
  }

  const records = await dbGet('attendance', {
    school_id: profile.school_id,
    class_name: cls
  });

  const filtered = records.filter(r => r.date >= from && r.date <= to);

  const students = await dbGet('profiles', {
    school_id: profile.school_id,
    role: 'student',
    class_name: cls
  });

  const activeStudents = students.filter(s => s.is_active !== false);
  const dateSet = new Set(filtered.map(r => r.date));
  const totalDays = dateSet.size;

  if (totalDays === 0) {
    container.innerHTML = '<div class="empty-state"><p>Keine Daten im gewählten Zeitraum</p></div>';
    return;
  }

  const studentStats = activeStudents.map(s => {
    const sRecords = filtered.filter(r => r.student_id === s.id);
    const present = sRecords.filter(r => r.status === 'present').length;
    const absent = sRecords.filter(r => r.status === 'absent').length;
    const late = sRecords.filter(r => r.status === 'late').length;
    const rate = sRecords.length > 0 ? ((present / sRecords.length) * 100).toFixed(1) : '0.0';
    return { student: s, present, absent, late, rate, total: sRecords.length };
  });

  const totalPresent = filtered.filter(r => r.status === 'present').length;
  const totalAll = filtered.length;
  const classRate = totalAll > 0 ? ((totalPresent / totalAll) * 100).toFixed(1) : '0.0';

  container.innerHTML = `
    <div class="grid grid-3 mb-24">
      <div class="stat-card">
        <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
        <div class="stat-info"><h4>${activeStudents.length}</h4><p>Schüler in Klasse</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <div class="stat-info"><h4>${classRate}%</h4><p>Klassenanwesenheit</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg></div>
        <div class="stat-info"><h4>${totalDays}</h4><p>Erfasste Tage</p></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>${escapeHtml(cls)} &middot; ${formatDate(from)} - ${formatDate(to)}</h3></div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th style="text-align:center">Anwesend</th>
              <th style="text-align:center">Abwesend</th>
              <th style="text-align:center">Verspätet</th>
              <th style="text-align:center">Quote</th>
            </tr>
          </thead>
          <tbody>
            ${studentStats.map(s => `
              <tr>
                <td><strong style="font-size:0.875rem">${escapeHtml(s.student.full_name || '?')}</strong></td>
                <td style="text-align:center"><span class="badge badge-green">${s.present}x</span></td>
                <td style="text-align:center"><span class="badge badge-red">${s.absent}x</span></td>
                <td style="text-align:center"><span class="badge badge-yellow">${s.late}x</span></td>
                <td style="text-align:center;font-weight:700;color:${parseFloat(s.rate) >= 90 ? 'var(--success)' : parseFloat(s.rate) >= 70 ? 'var(--warning)' : 'var(--danger)'}">${s.rate}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
