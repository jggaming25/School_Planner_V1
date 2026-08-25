function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function getDayName(dayIndex) {
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  return days[dayIndex] || '';
}

function getDayShort(dayIndex) {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  return days[dayIndex] || '';
}

function isToday(dateStr) {
  const today = new Date();
  const d = new Date(dateStr);
  return today.toDateString() === d.toDateString();
}

function isPast(dateStr) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function daysUntil(dateStr) {
  const now = new Date(new Date().toDateString());
  const d = new Date(dateStr);
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function calculateGradeAverage(grades) {
  if (!grades.length) return 0;
  let sum = 0;
  let weightSum = 0;
  grades.forEach(g => {
    const w = g.weight || 1;
    sum += g.grade * w;
    weightSum += w;
  });
  return weightSum > 0 ? (sum / weightSum) : 0;
}

function getGradeColor(grade) {
  if (grade <= 1.5) return 'var(--success)';
  if (grade <= 2.5) return 'var(--info)';
  if (grade <= 3.5) return 'var(--warning)';
  return 'var(--danger)';
}

function getPriorityColor(priority) {
  const colors = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--success)' };
  return colors[priority] || colors.medium;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
}
