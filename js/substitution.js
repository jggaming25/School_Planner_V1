let substitutionData = [];
let substitutionTimetableData = [];
let substitutionSchoolSettings = null;
let subSelectedClass = '';
let subSelectedDate = '';
let subSelectedPeriodEntry = null;
let allSchoolProfiles = [];

async function renderSubstitution() {
  if (!currentUser) return;
  const isSchulleitung = ['school_admin', 'admin', 'supporter', 'head_admin', 'super_admin', 'ceo'].includes(profile.role);
  substitutionSchoolSettings = await getSchool(profile.school_id);

  let filterBarHtml = '';
  if (isSchulleitung) {
    subSelectedDate = subSelectedDate || new Date().toISOString().split('T')[0];
    filterBarHtml = `
      <div class="flex gap-12 mb-20" style="flex-wrap:wrap;align-items:flex-end">
        <div class="input-group" style="margin-bottom:0"><label>Datum</label><input type="date" class="input-field" id="sub-date-select" value="${subSelectedDate}" onchange="onSubDateChange(this.value)"></div>
        <div class="input-group" style="margin-bottom:0;min-width:180px"><label>Klasse</label><select class="input-field" id="sub-class-select" onchange="onSubClassChange(this.value)"><option value="">Klasse wählen...</option>${schoolClasses.map(c => `<option value="${escapeHtml(c.name)}" ${subSelectedClass === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
      </div>`;
  }

  let filterEl = document.getElementById('sub-filter-bar');
  let mainEl = document.getElementById('sub-main-content');
  const pageBody = document.querySelector('#page-substitution .page-body');

  if (isSchulleitung) {
    if (!filterEl) {
      filterEl = document.createElement('div');
      filterEl.id = 'sub-filter-bar';
      pageBody.insertBefore(filterEl, pageBody.firstChild);
    }
    filterEl.innerHTML = filterBarHtml;

    if (!mainEl) {
      mainEl = document.createElement('div');
      mainEl.id = 'sub-main-content';
      pageBody.appendChild(mainEl);
    }

    await loadSubstitutionProfiles();
    await renderSubstitutionSchulleitung(mainEl);
  } else {
    if (filterEl) filterEl.remove();
    if (mainEl) mainEl.remove();
    await renderSubstitutionList();
  }
}

async function loadSubstitutionProfiles() {
  allSchoolProfiles = allSchoolUsers.filter(u => ['teacher','school_admin'].includes(u.role));
}

function onSubDateChange(val) {
  subSelectedDate = val;
  subSelectedPeriodEntry = null;
  const mainEl = document.getElementById('sub-main-content');
  if (mainEl) renderSubstitutionSchulleitung(mainEl);
}

function onSubClassChange(val) {
  subSelectedClass = val;
  subSelectedPeriodEntry = null;
  const mainEl = document.getElementById('sub-main-content');
  if (mainEl) renderSubstitutionSchulleitung(mainEl);
}

async function renderSubstitutionSchulleitung(container) {
  if (!subSelectedClass) {
    container.innerHTML = '<div class="empty-state"><h3>Klasse wählen</h3><p>Wähle oben eine Klasse und ein Datum aus, um den Vertretungsplan zu bearbeiten.</p></div>';
    return;
  }

  const date = subSelectedDate;
  const dateObj = new Date(date + 'T12:00:00');
  const dayOfWeek = (dateObj.getDay() + 6) % 7;
  if (dayOfWeek > 4) {
    container.innerHTML = '<div class="empty-state"><h3>Kein Schultag</h3><p>Kein Unterricht am Wochenende.</p></div>';
    return;
  }

  substitutionTimetableData = await dbGet('timetable', { school_id: profile.school_id, class_name: subSelectedClass });
  substitutionData = await dbGet('substitutions', { school_id: profile.school_id, date: date, class_name: subSelectedClass });

  const maxPeriods = substitutionSchoolSettings?.school_settings?.max_periods || 8;
  const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1);

  let html = '<div class="grid" style="grid-template-columns:1fr 380px;gap:20px;align-items:start">';

  html += '<div class="card"><div class="card-header"><h3>Stundenplan – ' + escapeHtml(subSelectedClass) + '</h3><span class="badge badge-blue">' + getDayName(dayOfWeek) + ', ' + formatDate(date) + '</span></div>';
  html += '<div class="table-wrapper"><table><thead><tr><th style="width:60px">Std.</th><th>Fach</th><th>Lehrer</th><th>Raum</th><th>Vertretung</th><th style="width:100px">Aktion</th></tr></thead><tbody>';

  periods.forEach(period => {
    const entry = substitutionTimetableData.find(t =>
      t.day_of_week === dayOfWeek && period >= t.period_start && period <= t.period_end &&
      (t.week_type === 'A' || t.week_type === 'both')
    );
    const sub = entry ? subjects.find(s => s.id === entry.subject_id) : null;
    const existingSub = substitutionData.find(s => s.period === period);
    const pt = substitutionSchoolSettings?.school_settings?.period_times?.[period];
    const timeStr = pt ? ` <span style="font-size:0.7rem;color:var(--text-muted)">${pt.start || ''}</span>` : '';

    if (entry) {
      const color = sub?.color || '#F97316';
      const subStatus = existingSub ? getSubBadgeHtml(existingSub.status) : '';
      const subTeacher = existingSub?.substitute_teacher ? `<span class="badge badge-blue">${escapeHtml(existingSub.substitute_teacher)}</span>` : '';
      const subNote = existingSub?.note ? `<div style="font-size:0.7rem;color:var(--text-muted);font-style:italic;margin-top:2px">${escapeHtml(existingSub.note)}</div>` : '';
      const isActive = subSelectedPeriodEntry?.period === period;
      html += `<tr style="${isActive ? 'background:var(--accent-light)' : ''};cursor:pointer" onclick="selectSubPeriod(${period}, '${entry.id}')">
        <td style="font-weight:600">${period}.${timeStr}</td>
        <td><span style="color:${color};font-weight:600">${escapeHtml(sub?.short_name || sub?.name || '')}</span></td>
        <td>${escapeHtml(entry.teacher || '')}</td>
        <td>${escapeHtml(entry.room || '')}</td>
        <td>${subTeacher} ${subStatus} ${subNote}</td>
        <td>${existingSub ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();deleteSubstitution('${existingSub.id}')" title="Löschen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>` : '<span style="font-size:0.75rem;color:var(--text-muted)">Klick</span>'}</td>
      </tr>`;
    } else {
      html += `<tr style="opacity:0.4"><td style="font-weight:600">${period}.${timeStr}</td><td colspan="5" style="font-style:italic;color:var(--text-muted)">Freistunde</td></tr>`;
    }
  });

  html += '</tbody></table></div></div>';

  html += '<div class="card" id="sub-detail-panel">';
  if (subSelectedPeriodEntry) {
    html += await renderSubDetailPanel(subSelectedPeriodEntry, dayOfWeek);
  } else {
    html += '<div class="card-header"><h3>Vertretung zuweisen</h3></div><div class="empty-state" style="padding:30px"><p style="color:var(--text-muted)">Klicke auf eine Stunde links, um eine Vertretung zuzuweisen.</p></div>';
  }
  html += '</div>';

  html += '</div>';
  container.innerHTML = html;
}

async function renderSubDetailPanel(periodEntry, dayOfWeek) {
  const entry = substitutionTimetableData.find(t => t.id === periodEntry.entryId);
  if (!entry) return '';
  const sub = subjects.find(s => s.id === entry.subject_id);
  const existingSub = substitutionData.find(s => s.period === periodEntry.period);

  const availableTeachers = await findAvailableTeachers(periodEntry.period, dayOfWeek, subSelectedClass);

  let html = `<div class="card-header"><h3>${periodEntry.period}. Stunde – Zuweisung</h3></div>`;

  html += '<div style="padding:12px 0;border-bottom:1px solid var(--border-light)">';
  html += `<div style="font-size:0.813rem;color:var(--text-secondary);margin-bottom:4px">Originaleintrag</div>`;
  html += `<div class="flex gap-12" style="align-items:center">`;
  const color = sub?.color || '#F97316';
  html += `<span class="badge" style="background:${color}18;color:${color}">${escapeHtml(sub?.short_name || sub?.name || '')}</span>`;
  html += `<span style="font-size:0.875rem">${escapeHtml(entry.teacher || '')}</span>`;
  html += `<span style="font-size:0.813rem;color:var(--text-secondary)">${escapeHtml(entry.room || '')}</span>`;
  html += '</div></div>';

  html += `<div style="padding:12px 0"><div class="flex-between mb-8"><div style="font-size:0.813rem;color:var(--text-secondary)">Verfügbare Lehrer (${availableTeachers.length})</div>`;
  html += `<div class="flex gap-8">
    <button class="btn btn-sm btn-secondary" onclick="assignSubstitution('cancelled')">Entfällt</button>
    <button class="btn btn-sm btn-secondary" onclick="assignSubstitution('room_change')">Raumänderung</button>
  </div></div>`;

  if (availableTeachers.length === 0) {
    html += '<div style="font-size:0.813rem;color:var(--text-muted);padding:8px 0">Keine verfügbaren Lehrer für diese Stunde.</div>';
  } else {
    html += '<div style="max-height:300px;overflow-y:auto">';
    availableTeachers.forEach(t => {
      const isCurrentSub = existingSub?.substitute_teacher === t.full_name;
      html += `<div class="sub-teacher-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:var(--radius-sm);cursor:pointer;margin-bottom:4px;${isCurrentSub ? 'background:var(--accent-light);border:1px solid var(--accent)' : 'background:var(--bg-tertiary)'}" onclick="assignSubstitutionForTeacher('${escapeHtml(t.full_name)}')">
        <div><strong style="font-size:0.875rem">${escapeHtml(t.full_name)}</strong>
        <div style="font-size:0.75rem;color:var(--text-secondary)">${t.subjects ? t.subjects.join(', ') : ''}</div></div>
        ${isCurrentSub ? '<span class="badge badge-blue">Aktuell</span>' : '<span style="font-size:0.75rem;color:var(--text-muted)">→ Zuweisen</span>'}
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  if (existingSub) {
    html += '<div style="padding:12px 0;border-top:1px solid var(--border-light)">';
    html += `<div class="input-group"><label>Notiz</label><input type="text" class="input-field" id="sub-note-input" value="${escapeHtml(existingSub.note || '')}" placeholder="Optionale Notiz..."></div>`;
    html += `<button class="btn btn-primary btn-sm" onclick="updateSubstitutionNote('${existingSub.id}')" style="width:100%">Notiz speichern</button>`;
    html += '</div>';
  }

  return html;
}

async function findAvailableTeachers(period, dayOfWeek, excludeClassName) {
  const allTimetable = await dbGet('timetable', { school_id: profile.school_id });
  const occupiedTeachers = new Set();
  allTimetable.forEach(t => {
    if (t.day_of_week === dayOfWeek && period >= t.period_start && period <= t.period_end) {
      occupiedTeachers.add(t.teacher);
    }
  });
  return allSchoolProfiles.filter(teacher => !occupiedTeachers.has(teacher.full_name));
}

function selectSubPeriod(period, entryId) {
  subSelectedPeriodEntry = { period, entryId };
  const mainEl = document.getElementById('sub-main-content');
  if (mainEl) renderSubstitutionSchulleitung(mainEl);
}

function getSubBadgeHtml(status) {
  const labels = { substituted: 'Vertretung', cancelled: 'Entfällt', room_change: 'Raumänderung', free: 'Freistunde' };
  const colors = { substituted: 'badge-blue', cancelled: 'badge-red', room_change: 'badge-yellow', free: 'badge-green' };
  return `<span class="badge ${colors[status] || 'badge-blue'}">${labels[status] || status}</span>`;
}

async function assignSubstitutionForTeacher(teacherName) {
  if (!subSelectedPeriodEntry || !subSelectedDate) return;
  const entry = substitutionTimetableData.find(t => t.id === subSelectedPeriodEntry.entryId);
  if (!entry) return;
  const sub = subjects.find(s => s.id === entry.subject_id);

  const existingSub = substitutionData.find(s => s.period === subSelectedPeriodEntry.period);
  const record = {
    school_id: profile.school_id,
    user_id: currentUser.id,
    date: subSelectedDate,
    period: subSelectedPeriodEntry.period,
    subject: sub?.name || '',
    original_teacher: entry.teacher || '',
    substitute_teacher: teacherName,
    room: entry.room || '',
    substitute_room: '',
    status: 'substituted',
    note: '',
    class_name: subSelectedClass
  };

  if (existingSub) {
    await dbUpdate('substitutions', { id: existingSub.id }, { substitute_teacher: teacherName, status: 'substituted' });
  } else {
    await dbInsert('substitutions', record);
  }
  showToast(`${teacherName} als Vertretung eingetragen!`, 'success');
  subSelectedPeriodEntry = null;
  const mainEl = document.getElementById('sub-main-content');
  if (mainEl) renderSubstitutionSchulleitung(mainEl);
}

async function assignSubstitution(status) {
  if (!subSelectedPeriodEntry || !subSelectedDate) return;
  const entry = substitutionTimetableData.find(t => t.id === subSelectedPeriodEntry.entryId);
  if (!entry) return;
  const sub = subjects.find(s => s.id === entry.subject_id);

  const existingSub = substitutionData.find(s => s.period === subSelectedPeriodEntry.period);
  if (existingSub) {
    await dbUpdate('substitutions', { id: existingSub.id }, { status, substitute_teacher: '' });
  } else {
    await dbInsert('substitutions', {
      school_id: profile.school_id,
      user_id: currentUser.id,
      date: subSelectedDate,
      period: subSelectedPeriodEntry.period,
      subject: sub?.name || '',
      original_teacher: entry.teacher || '',
      substitute_teacher: '',
      room: entry.room || '',
      substitute_room: '',
      status,
      note: '',
      class_name: subSelectedClass
    });
  }
  const statusLabels = { cancelled: 'Entfällt', room_change: 'Raumänderung' };
  showToast(statusLabels[status] || status, 'success');
  subSelectedPeriodEntry = null;
  const mainEl = document.getElementById('sub-main-content');
  if (mainEl) renderSubstitutionSchulleitung(mainEl);
}

async function updateSubstitutionNote(id) {
  const note = document.getElementById('sub-note-input')?.value || '';
  await dbUpdate('substitutions', { id }, { note });
  showToast('Notiz gespeichert!', 'success');
  const mainEl = document.getElementById('sub-main-content');
  if (mainEl) renderSubstitutionSchulleitung(mainEl);
}

async function renderSubstitutionList() {
  const data = await dbGet('substitutions', profile.school_id ? { school_id: profile.school_id } : {});
  let filtered = data;
  if (profile.role === 'student') {
    filtered = data.filter(s => s.class_name === profile.class_name);
  } else if (profile.role === 'teacher') {
    filtered = data.filter(s => s.substitute_teacher === profile.full_name || s.class_name === profile.class_name);
  }
  filtered.sort((a, b) => b.date !== a.date ? new Date(b.date) - new Date(a.date) : a.period - b.period);

  const el = document.getElementById('substitution-list');
  if (!el) return;
  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><h3>Keine Vertretungen</h3><p style="color:var(--text-muted)">Für dich liegen keine Vertretungen vor.</p></div>';
    return;
  }
  const grouped = {};
  filtered.forEach(s => { if (!grouped[s.date]) grouped[s.date] = []; grouped[s.date].push(s); });
  const sl = { substituted: 'Vertretung', cancelled: 'Entfällt', room_change: 'Raumänderung', free: 'Freistunde' };
  const sc = { substituted: 'badge-blue', cancelled: 'badge-red', room_change: 'badge-yellow', free: 'badge-green' };

  el.innerHTML = Object.entries(grouped).map(([date, entries]) => `
    <div class="card mb-16"><div class="card-header"><h3>${isToday(date) ? 'Heute' : formatDate(date)}</h3></div>
    ${entries.map(s => `<div class="sub-entry" style="padding:10px 0;border-top:1px solid var(--border-light)"><div class="flex-between">
      <div class="flex gap-12" style="align-items:center"><div style="min-width:50px;font-weight:600;color:var(--text-secondary)">${s.period}. Std.</div>
      <div><strong>${escapeHtml(s.subject || s.original_subject || '')}</strong>
      ${s.class_name ? `<span class="badge badge-green" style="margin-left:6px;font-size:0.688rem">${escapeHtml(s.class_name)}</span>` : ''}
      <div style="font-size:0.813rem;color:var(--text-secondary)">${escapeHtml(s.original_teacher || '')} ${s.substitute_teacher ? '→ ' + escapeHtml(s.substitute_teacher) : ''} ${s.room ? '&middot; ' + escapeHtml(s.room) : ''} ${s.substitute_room ? '→ ' + escapeHtml(s.substitute_room) : ''}</div>
      ${s.note ? `<div style="font-size:0.75rem;color:var(--text-muted);font-style:italic">${escapeHtml(s.note)}</div>` : ''}</div></div>
      <div class="flex gap-8" style="align-items:center"><span class="badge ${sc[s.status] || 'badge-blue'}">${sl[s.status] || s.status}</span>
      ${profile.role !== 'student' ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="deleteSubstitution('${s.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/></svg></button>` : ''}</div></div></div>`).join('')}</div>`).join('');
}

async function saveSubstitution() {
  const date = document.getElementById('sub-date').value;
  if (!date) { showToast('Datum nötig', 'error'); return; }
  const subRecord = {
    school_id: profile.school_id,
    user_id: currentUser.id,
    date,
    period: parseInt(document.getElementById('sub-period').value),
    subject: document.getElementById('sub-subject').value,
    original_teacher: document.getElementById('sub-teacher').value,
    substitute_teacher: document.getElementById('sub-sub-teacher').value,
    substitute_room: document.getElementById('sub-room').value,
    status: document.getElementById('sub-status').value,
    note: document.getElementById('sub-note').value,
    class_name: document.getElementById('sub-class-name')?.value || null
  };
  await dbInsert('substitutions', subRecord);
  closeModal('substitution-modal');
  showToast('Vertretung eingetragen!', 'success');

  if (typeof notifyUsers === 'function' && profile.school_id) {
    const statusLabels = { substituted: 'Vertretung', cancelled: 'Entfällt', room_change: 'Raumänderung', free: 'Freistunde' };
    const allStudents = await dbGet('profiles', { school_id: profile.school_id, role: 'student' });
    if (allStudents.length > 0) {
      await notifyUsers(
        profile.school_id,
        `Vertretung: ${statusLabels[subRecord.status] || subRecord.status}`,
        `${subRecord.subject || ''} - ${subRecord.original_teacher || ''} → ${subRecord.substitute_teacher || 'kein Lehrer'} am ${formatDate(date)}, ${subRecord.period}. Std.`,
        'substitution',
        allStudents.map(s => s.id)
      );
    }
  }
  renderSubstitution();
}

async function deleteSubstitution(id) {
  if (!confirm('Löschen?')) return;
  await dbDelete('substitutions', { id });
  showToast('Gelöscht', 'success');
  renderSubstitution();
}
