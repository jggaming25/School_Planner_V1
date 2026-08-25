let currentWeekType = 'A';
let timetableData = [];

async function renderTimetable() {
  if (!currentUser) return;
  timetableData = await dbGet('timetable', currentUser.id);
  document.getElementById('week-toggle').textContent = `Woche ${currentWeekType}`;
  buildTimetableGrid();
}

function toggleWeekType() {
  currentWeekType = currentWeekType === 'A' ? 'B' : 'A';
  document.getElementById('week-toggle').textContent = `Woche ${currentWeekType}`;
  buildTimetableGrid();
}

function buildTimetableGrid() {
  const grid = document.getElementById('timetable-grid');
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const periods = [];
  for (let i = 1; i <= 14; i++) periods.push(i);

  let html = '<div class="tt-header"><div class="tt-corner"></div>';
  days.forEach(d => { html += `<div class="tt-day-header">${d}</div>`; });
  html += '</div><div class="tt-body">';

  periods.forEach(period => {
    html += `<div class="tt-period-label">${period}</div>`;
    for (let day = 0; day < 5; day++) {
      const entry = timetableData.find(t =>
        t.day_of_week === day &&
        period >= t.period_start && period <= t.period_end &&
        (t.week_type === currentWeekType || t.week_type === 'both')
      );
      if (entry) {
        const sub = subjects.find(s => s.id === entry.subject_id);
        html += `<div class="tt-cell" style="background:${sub?.color || '#4A90D9'}20;border:1px solid ${sub?.color || '#4A90D9'}40" onclick="deleteTimetableEntry('${entry.id}')">
          <div class="tt-cell-subject" style="color:${sub?.color || '#4A90D9'}">${escapeHtml(sub?.short_name || sub?.name || '')}</div>
          <div class="tt-cell-info">${escapeHtml(entry.room || '')} ${entry.teacher ? '&middot; ' + escapeHtml(entry.teacher) : ''}</div>
        </div>`;
      } else {
        html += '<div class="tt-cell tt-cell-empty"></div>';
      }
    }
  });
  html += '</div>';
  grid.innerHTML = html;
}

async function saveTimetableEntry() {
  const subjectId = document.getElementById('tt-subject').value;
  if (!subjectId) { showToast('Bitte Fach wählen', 'error'); return; }
  const weekType = document.getElementById('tt-week').value;
  const record = {
    user_id: currentUser.id,
    subject_id: subjectId,
    day_of_week: parseInt(document.getElementById('tt-day').value),
    period_start: parseInt(document.getElementById('tt-period-start').value),
    period_end: parseInt(document.getElementById('tt-period-end').value),
    room: document.getElementById('tt-room').value,
    teacher: document.getElementById('tt-teacher').value,
    week_type: weekType
  };
  await dbInsert('timetable', record);
  closeModal('timetable-modal');
  showToast('Stunde eingetragen!', 'success');
  renderTimetable();
}

async function deleteTimetableEntry(id) {
  if (!confirm('Diesen Eintrag löschen?')) return;
  await dbDelete('timetable', id);
  showToast('Gelöscht', 'success');
  renderTimetable();
}
