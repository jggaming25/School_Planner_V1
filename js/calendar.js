let calendarDate = new Date();
let calendarEvents = [];

async function renderCalendar() {
  if (!currentUser) return;
  calendarEvents = await dbGet('calendar_events', profile.school_id ? { school_id: profile.school_id } : {});
  buildCalendar();
}

function changeMonth(d) { calendarDate.setMonth(calendarDate.getMonth() + d); buildCalendar(); }

function buildCalendar() {
  const year = calendarDate.getFullYear(), month = calendarDate.getMonth();
  document.getElementById('calendar-month-label').textContent = calendarDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0), startDay = (firstDay.getDay() + 6) % 7;
  const today = new Date();
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const ec = { exam: '#A855F7', homework: '#3B82F6', school: '#22C55E', personal: '#F59E0B', holiday: '#EF4444' };
  let html = days.map(d => `<div class="cal-header">${d}</div>`).join('');
  for (let i = 0; i < startDay; i++) html += '<div class="cal-day cal-day-empty"></div>';
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const de = calendarEvents.filter(e => e.event_date === ds);
    html += `<div class="cal-day ${isToday ? 'cal-today' : ''}" onclick="showDayEvents('${ds}')">
      <span class="cal-day-num">${day}</span>
      <div class="cal-events">${de.slice(0, 3).map(e => `<div class="cal-event" style="background:${e.color || ec[e.event_type] || 'var(--accent)'}">${escapeHtml(e.title)}</div>`).join('')}</div></div>`;
  }
  document.getElementById('calendar-grid').innerHTML = html;
}

function showDayEvents(ds) {
  const events = calendarEvents.filter(e => e.event_date === ds);
  if (events.length === 0) { document.getElementById('ev-date').value = ds; openModal('event-modal'); return; }
  alert('Events am ' + formatDate(ds) + ':\n\n' + events.map(e => '• ' + e.title).join('\n'));
}

async function saveEvent() {
  const title = document.getElementById('ev-title').value, date = document.getElementById('ev-date').value;
  if (!title || !date) { showToast('Titel & Datum nötig', 'error'); return; }
  await dbInsert('calendar_events', {
    school_id: profile.school_id, user_id: currentUser.id, title, description: document.getElementById('ev-desc').value,
    event_date: date, event_time: document.getElementById('ev-time').value || null,
    color: document.getElementById('ev-color').value, event_type: document.getElementById('ev-type').value
  });
  closeModal('event-modal');
  showToast('Event erstellt!', 'success');
  document.getElementById('ev-title').value = '';

  if (profile.school_id && typeof notifyUsers === 'function') {
    const allStudents = await dbGet('profiles', { school_id: profile.school_id, role: 'student' });
    if (allStudents.length > 0) {
      await notifyUsers(
        profile.school_id,
        'Neues Kalender-Event',
        `${escapeHtml(title)} am ${formatDate(date)}`,
        'event',
        allStudents.map(s => s.id)
      );
    }
  }
  renderCalendar();
}
