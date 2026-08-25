let timetableData = [];
let currentWeekType = 'A';

async function renderTimetable() {
  if (!currentUser) return;
  const filters = { school_id: profile.school_id };
  if (profile.role === 'student') {
    filters.class_name = profile.class_name;
  }
  timetableData = await dbGet('timetable', filters);
  document.getElementById('week-toggle').textContent = `Woche ${currentWeekType}`;
  buildTimetableGrid();
}

function toggleWeekType() { currentWeekType = currentWeekType === 'A' ? 'B' : 'A'; document.getElementById('week-toggle').textContent = `Woche ${currentWeekType}`; buildTimetableGrid(); }

function buildTimetableGrid() {
  const grid = document.getElementById('timetable-grid');
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const periods = Array.from({length: 14}, (_, i) => i + 1);
  let html = '<div class="tt-header"><div class="tt-corner"></div>';
  days.forEach(d => { html += `<div class="tt-day-header">${d}</div>`; });
  html += '</div><div class="tt-body">';
  periods.forEach(period => {
    html += `<div class="tt-period-label">${period}</div>`;
    for (let day = 0; day < 5; day++) {
      const entry = timetableData.find(t => t.day_of_week === day && period >= t.period_start && period <= t.period_end && (t.week_type === currentWeekType || t.week_type === 'both'));
      if (entry) {
        const sub = subjects.find(s => s.id === entry.subject_id);
        const color = sub?.color || '#F97316';
        const canDelete = profile.role !== 'student';
        html += `<div class="tt-cell" style="background:${color}18;border:1px solid ${color}40" ${canDelete ? `onclick="deleteTimetableEntry('${entry.id}')"` : ''}>
          <div class="tt-cell-subject" style="color:${color}">${escapeHtml(sub?.short_name || sub?.name || '')}</div>
          <div class="tt-cell-info">${escapeHtml(entry.room || '')} ${entry.teacher ? '&middot; ' + escapeHtml(entry.teacher) : ''}</div>
        </div>`;
      } else { html += '<div class="tt-cell tt-cell-empty"></div>'; }
    }
  });
  html += '</div>';
  grid.innerHTML = html;
}

async function saveTimetableEntry() {
  const subjectId = document.getElementById('tt-subject').value;
  if (!subjectId) { showToast('Fach wählen', 'error'); return; }
  const record = {
    school_id: profile.school_id, user_id: currentUser.id, subject_id: subjectId,
    day_of_week: parseInt(document.getElementById('tt-day').value),
    period_start: parseInt(document.getElementById('tt-period-start').value),
    period_end: parseInt(document.getElementById('tt-period-end').value),
    room: document.getElementById('tt-room').value, teacher: document.getElementById('tt-teacher').value,
    week_type: document.getElementById('tt-week').value
  };
  await dbInsert('timetable', record);
  closeModal('timetable-modal');
  showToast('Stunde eingetragen!', 'success');
  renderTimetable();
}

async function deleteTimetableEntry(id) {
  if (!confirm('Eintrag löschen?')) return;
  await dbDelete('timetable', { id });
  showToast('Gelöscht', 'success');
  renderTimetable();
}
