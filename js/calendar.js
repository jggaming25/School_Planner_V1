let calendarDate = new Date();
let calendarEvents = [];

async function renderCalendar() {
  if (!currentUser) return;
  calendarEvents = await dbGet('calendar_events', currentUser.id);
  buildCalendar();
}

function changeMonth(delta) {
  calendarDate.setMonth(calendarDate.getMonth() + delta);
  buildCalendar();
}

function buildCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const label = calendarDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  document.getElementById('calendar-month-label').textContent = label;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const today = new Date();
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const eventColors = { exam: '#A855F7', homework: '#3B82F6', school: '#22C55E', personal: '#F59E0B', holiday: '#EF4444' };

  let html = days.map(d => `<div class="cal-header">${d}</div>`).join('');
  for (let i = 0; i < startDay; i++) html += '<div class="cal-day cal-day-empty"></div>';
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const dayEvents = calendarEvents.filter(e => {
      const eDate = e.event_date;
      return eDate === dateStr;
    });
    html += `<div class="cal-day ${isToday ? 'cal-today' : ''}" onclick="showDayEvents('${dateStr}')">
      <span class="cal-day-num">${day}</span>
      <div class="cal-events">${dayEvents.slice(0, 3).map(e => `<div class="cal-event" style="background:${e.color || eventColors[e.event_type] || 'var(--accent)'}">${escapeHtml(e.title)}</div>`).join('')}</div>
    </div>`;
  }
  document.getElementById('calendar-grid').innerHTML = html;
}

function showDayEvents(dateStr) {
  const events = calendarEvents.filter(e => e.event_date === dateStr);
  if (events.length === 0) {
    document.getElementById('ev-date').value = dateStr;
    openModal('event-modal');
    return;
  }
  const list = events.map(e => {
    const typeColors = { exam: 'badge-blue', homework: 'badge-orange', school: 'badge-green', personal: 'badge-yellow', holiday: 'badge-red' };
    return `<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border-light)">
      <div>
        <strong style="font-size:0.875rem">${escapeHtml(e.title)}</strong>
        ${e.event_time ? `<span class="text-muted" style="font-size:0.75rem;margin-left:8px">${formatTime(e.event_time)}</span>` : ''}
      </div>
      <span class="badge ${typeColors[e.event_type] || 'badge-blue'}">${e.event_type}</span>
    </div>`;
  }).join('');
  alert('Events am ' + formatDate(dateStr) + ':\n\n' + events.map(e => '• ' + e.title).join('\n'));
}

async function saveEvent() {
  const title = document.getElementById('ev-title').value;
  const date = document.getElementById('ev-date').value;
  if (!title || !date) { showToast('Titel & Datum nötig', 'error'); return; }
  const record = {
    user_id: currentUser.id,
    title,
    description: document.getElementById('ev-desc').value,
    event_date: date,
    event_time: document.getElementById('ev-time').value || null,
    end_date: document.getElementById('ev-end-date').value || null,
    end_time: document.getElementById('ev-end-time').value || null,
    color: document.getElementById('ev-color').value,
    event_type: document.getElementById('ev-type').value
  };
  await dbInsert('calendar_events', record);
  closeModal('event-modal');
  showToast('Event erstellt!', 'success');
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-desc').value = '';
  renderCalendar();
}
