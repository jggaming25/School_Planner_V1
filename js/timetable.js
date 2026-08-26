let timetableData = [];
let timetableSchoolSettings = null;
let selectedTimetableClass = '';
let selectedTimetableTeacher = '';
let currentKW = getISOWeek(new Date());
let currentYear = new Date().getFullYear();

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getKWWeekType(kw, year) {
  const jan1 = new Date(year, 0, 1);
  const dayOffset = (jan1.getDay() + 6) % 7;
  const kw1Start = new Date(year, 0, 1 - dayOffset + (jan1.getDay() === 1 ? 0 : (jan1.getDay() === 0 ? -6 : 1)));
  const jan4 = new Date(year, 0, 4);
  const kw1OfNextYear = getISOWeek(jan4) === 1 ? getISOWeek(jan1) : 1;
  const weekNumber = ((kw - kw1OfNextYear) % 2 + 2) % 2;
  return weekNumber === 0 ? 'A' : 'B';
}

function getKWDateRange(kw, year) {
  const jan4 = new Date(year, 0, 4);
  const dayOffset = (jan4.getDay() + 6) % 7;
  const kw1Mon = new Date(jan4);
  kw1Mon.setDate(jan4.getDate() - dayOffset);
  const kwStart = new Date(kw1Mon);
  kwStart.setDate(kw1Mon.getDate() + (kw - 1) * 7);
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(kwStart);
    d.setDate(kwStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateShort(date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

async function renderTimetable() {
  if (!currentUser) return;
  timetableSchoolSettings = await getSchool(profile.school_id);
  const isSchulleitung = SYSTEM_ROLES.includes(profile.role) || profile.role === 'school_admin';
  const isTeacher = profile.role === 'teacher' || isSchulleitung;

  const weekType = getKWWeekType(currentKW, currentYear);
  const dates = getKWDateRange(currentKW, currentYear);
  const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

  let filterBarHtml = '<div class="flex gap-12 mb-20" style="flex-wrap:wrap;align-items:center">';
  filterBarHtml += `<div class="flex gap-8" style="align-items:center">
    <button class="btn btn-ghost btn-sm" onclick="changeKW(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
    <div style="text-align:center;min-width:200px">
      <strong style="font-size:0.938rem">KW ${currentKW}</strong>
      <div style="font-size:0.75rem;color:var(--text-muted)">${formatDateShort(dates[0])} - ${formatDateShort(dates[4])} · Woche ${weekType}</div>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="changeKW(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
    <button class="btn btn-ghost btn-sm" onclick="goToCurrentKW()" title="Aktuelle Woche">Heute</button>
  </div>`;

  if (isSchulleitung) {
    filterBarHtml += `<div class="input-group" style="margin-bottom:0;min-width:160px"><label>Klasse</label><select class="input-field" id="tt-class-select" onchange="onTimetableClassChange(this.value)"><option value="">Alle Klassen</option>${schoolClasses.map(c => `<option value="${escapeHtml(c.name)}" ${selectedTimetableClass === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>`;
    filterBarHtml += `<div class="input-group" style="margin-bottom:0;min-width:160px"><label>Lehrer</label><select class="input-field" id="tt-teacher-select" onchange="onTimetableTeacherChange(this.value)"><option value="">Alle Lehrer</option></select></div>`;
  } else if (isTeacher) {
    const cls = schoolClasses.find(c => c.class_teacher_id === currentUser.id);
    if (cls) {
      filterBarHtml += `<div class="input-group" style="margin-bottom:0;min-width:160px"><label>Klasse</label><select class="input-field" id="tt-class-select" onchange="onTimetableClassChange(this.value)"><option value="">Mein Plan</option><option value="${escapeHtml(cls.name)}" ${selectedTimetableClass === cls.name ? 'selected' : ''}>Meine Klasse (${escapeHtml(cls.name)})</option></select></div>`;
    }
  }

  filterBarHtml += '</div>';
  let filterEl = document.getElementById('tt-filter-bar');
  if (!filterEl) {
    const grid = document.getElementById('timetable-grid');
    filterEl = document.createElement('div');
    filterEl.id = 'tt-filter-bar';
    grid.parentElement.insertBefore(filterEl, grid);
  }
  filterEl.innerHTML = filterBarHtml;

  if (isSchulleitung) {
    loadTeacherListForTimetable();
  }

  if (selectedTimetableClass) {
    timetableData = await dbGet('timetable', { school_id: profile.school_id, class_name: selectedTimetableClass });
  } else if (selectedTimetableTeacher) {
    timetableData = await dbGet('timetable', { school_id: profile.school_id, teacher: selectedTimetableTeacher });
  } else if (profile.role === 'student') {
    timetableData = await dbGet('timetable', { school_id: profile.school_id, class_name: profile.class_name });
  } else {
    timetableData = await dbGet('timetable', { school_id: profile.school_id });
  }

  buildTimetableGrid(dates, dayLabels, weekType);
}

function changeKW(delta) {
  currentKW += delta;
  if (currentKW < 1) { currentKW = 52; currentYear--; }
  if (currentKW > 52) { currentKW = 1; currentYear++; }
  renderTimetable();
}

function goToCurrentKW() {
  currentKW = getISOWeek(new Date());
  currentYear = new Date().getFullYear();
  renderTimetable();
}

async function loadTeacherListForTimetable() {
  const staff = allSchoolUsers.filter(u => ['teacher','school_admin'].includes(u.role));
  const sel = document.getElementById('tt-teacher-select');
  if (!sel) return;
  const currentVal = selectedTimetableTeacher;
  sel.innerHTML = '<option value="">Alle Lehrer</option>' +
    staff.map(t => `<option value="${escapeHtml(t.full_name)}" ${currentVal === t.full_name ? 'selected' : ''}>${escapeHtml(t.full_name)}</option>`).join('');
}

function onTimetableClassChange(val) {
  selectedTimetableClass = val;
  selectedTimetableTeacher = '';
  const teacherSel = document.getElementById('tt-teacher-select');
  if (teacherSel) teacherSel.value = '';
  renderTimetable();
}

function onTimetableTeacherChange(val) {
  selectedTimetableTeacher = val;
  selectedTimetableClass = '';
  const classSel = document.getElementById('tt-class-select');
  if (classSel) classSel.value = '';
  renderTimetable();
}

function getTimetableMaxPeriods() {
  const settings = timetableSchoolSettings?.school_settings;
  if (settings?.max_periods) return settings.max_periods;
  return 8;
}

function getTimetablePeriodTime(period) {
  const settings = timetableSchoolSettings?.school_settings;
  if (settings?.period_times?.[period]) return settings.period_times[period];
  return null;
}

function buildTimetableGrid(dates, dayLabels, weekType) {
  const grid = document.getElementById('timetable-grid');
  const maxPeriods = getTimetableMaxPeriods();
  const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1);
  const isEditable = STAFF_ROLES.includes(profile.role);

  let html = '<div class="tt-header"><div class="tt-corner"></div>';
  dayLabels.forEach((label, i) => {
    html += `<div class="tt-day-header">${label}<br><span style="font-size:0.65rem;font-weight:400;opacity:0.7">${formatDateShort(dates[i])}</span></div>`;
  });
  html += '</div><div class="tt-body">';

  periods.forEach(period => {
    const pt = getTimetablePeriodTime(period);
    const timeLabel = pt ? `${period}<br><span style="font-size:0.6rem;font-weight:400;opacity:0.7">${pt.start || ''}-${pt.end || ''}</span>` : period;
    html += `<div class="tt-period-label">${timeLabel}</div>`;
    for (let day = 0; day < 5; day++) {
      const entry = timetableData.find(t =>
        t.day_of_week === day && period >= t.period_start && period <= t.period_end &&
        (t.week_type === weekType || t.week_type === 'both')
      );
      if (entry) {
        const sub = subjects.find(s => s.id === entry.subject_id);
        const color = sub?.color || '#F97316';
        html += `<div class="tt-cell" style="background:${color}18;border:1px solid ${color}40" onclick="onTimetableCellClick(${day}, ${period}, '${entry.id}')">
          <div class="tt-cell-subject" style="color:${color}">${escapeHtml(sub?.short_name || sub?.name || '')}</div>
          <div class="tt-cell-info">${escapeHtml(entry.room || '')} ${entry.teacher ? '&middot; ' + escapeHtml(entry.teacher) : ''}</div>
        </div>`;
      } else {
        const clickAttr = isEditable ? `onclick="onEmptyCellClick(${day}, ${period})"` : '';
        html += `<div class="tt-cell tt-cell-empty" ${clickAttr}></div>`;
      }
    }
  });
  html += '</div>';
  grid.innerHTML = html;
}

function onEmptyCellClick(day, period) {
  document.getElementById('tt-day').value = day;
  document.getElementById('tt-period-start').value = period;
  document.getElementById('tt-period-end').value = period;
  document.getElementById('tt-edit-id').value = '';
  document.querySelector('#timetable-modal .modal-header h2').textContent = 'Stunde eintragen';

  if (selectedTimetableClass) {
    document.getElementById('tt-class-name').value = selectedTimetableClass;
  } else {
    document.getElementById('tt-class-name').value = '';
  }
  openModal('timetable-modal');
}

function onTimetableCellClick(day, period, entryId) {
  const entry = timetableData.find(t => t.id === entryId);
  if (!entry) return;
  if (!STAFF_ROLES.includes(profile.role)) return;

  document.getElementById('tt-day').value = entry.day_of_week;
  document.getElementById('tt-period-start').value = entry.period_start;
  document.getElementById('tt-period-end').value = entry.period_end;
  document.getElementById('tt-week').value = entry.week_type || 'A';
  document.getElementById('tt-room').value = entry.room || '';
  document.getElementById('tt-teacher').value = entry.teacher || '';
  document.getElementById('tt-class-name').value = entry.class_name || '';
  document.getElementById('tt-edit-id').value = entry.id;
  document.querySelector('#timetable-modal .modal-header h2').textContent = 'Stunde bearbeiten';

  const subjectSel = document.getElementById('tt-subject');
  if (subjectSel) subjectSel.value = entry.subject_id || '';
  openModal('timetable-modal');
}

async function saveTimetableEntry() {
  const subjectId = document.getElementById('tt-subject').value;
  if (!subjectId) { showToast('Fach wählen', 'error'); return; }
  const record = {
    school_id: profile.school_id,
    user_id: currentUser.id,
    subject_id: subjectId,
    day_of_week: parseInt(document.getElementById('tt-day').value),
    period_start: parseInt(document.getElementById('tt-period-start').value),
    period_end: parseInt(document.getElementById('tt-period-end').value),
    room: document.getElementById('tt-room').value,
    teacher: document.getElementById('tt-teacher').value,
    week_type: document.getElementById('tt-week').value,
    class_name: document.getElementById('tt-class-name').value || null
  };
  const editId = document.getElementById('tt-edit-id').value;
  if (editId) {
    await dbUpdate('timetable', { id: editId }, record);
    showToast('Stunde aktualisiert!', 'success');
  } else {
    await dbInsert('timetable', record);
    showToast('Stunde eingetragen!', 'success');
  }
  closeModal('timetable-modal');
  renderTimetable();
}

async function deleteTimetableEntry(id) {
  if (!confirm('Eintrag löschen?')) return;
  await dbDelete('timetable', { id });
  showToast('Gelöscht', 'success');
  renderTimetable();
}
