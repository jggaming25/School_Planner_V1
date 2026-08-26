let notificationsData = [];
let unreadCount = 0;

async function notifyUsers(schoolId, title, message, type, recipientIds) {
  if (!recipientIds || recipientIds.length === 0) return;
  const inserts = recipientIds.map(userId => ({
    school_id: schoolId,
    user_id: userId,
    title,
    message,
    type,
    read: false
  }));
  for (const record of inserts) {
    await dbInsert('notifications', record).catch(() => {});
  }
}

async function loadNotifications() {
  if (!currentUser) return;
  notificationsData = await dbGet('notifications', { user_id: currentUser.id });
  unreadCount = notificationsData.filter(n => !n.read).length;
  updateNotificationBadge();
}

function updateNotificationBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleNotificationPanel() {
  const panel = document.getElementById('notification-panel');
  if (!panel) return;
  const isVisible = panel.style.display === 'block';
  panel.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    loadNotifications().then(() => renderNotificationPanel());
  }
}

function renderNotificationPanel() {
  const list = document.getElementById('notification-list');
  if (!list) return;
  if (notificationsData.length === 0) {
    list.innerHTML = '<div class="notif-empty"><p>Keine Benachrichtigungen</p></div>';
    return;
  }
  const typeIcons = {
    grade: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>',
    homework: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    exam: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    test: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    event: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    substitution: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    announcement: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
  };
  list.innerHTML = notificationsData.slice(0, 20).map(n => `
    <div class="notif-item ${n.read ? '' : 'notif-unread'}" onclick="markNotificationRead('${n.id}', this)">
      <div class="notif-icon">${typeIcons[n.type] || typeIcons.event}</div>
      <div class="notif-content">
        <div class="notif-title">${escapeHtml(n.title)}</div>
        <div class="notif-message">${escapeHtml(n.message)}</div>
        <div class="notif-time">${formatNotificationTime(n.created_at)}</div>
      </div>
    </div>
  `).join('');
}

function formatNotificationTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `vor ${diffD} Tag${diffD !== 1 ? 'en' : ''}`;
  return formatDate(dateStr);
}

async function markNotificationRead(id, el) {
  await dbUpdate('notifications', { id }, { read: true });
  if (el) el.classList.remove('notif-unread');
  unreadCount = Math.max(0, unreadCount - 1);
  updateNotificationBadge();
}

async function markAllNotificationsRead() {
  const unread = notificationsData.filter(n => !n.read);
  for (const n of unread) {
    await dbUpdate('notifications', { id: n.id }, { read: true }).catch(() => {});
  }
  unreadCount = 0;
  updateNotificationBadge();
  renderNotificationPanel();
}

function closeNotificationPanel() {
  const panel = document.getElementById('notification-panel');
  if (panel) panel.style.display = 'none';
}

function checkNotifications() {
  if (!currentUser || !profile) return;
  checkHomeworkDue();
  checkExamUpcoming();
  loadNotifications();
}

async function checkHomeworkDue() {
  const filters = profile.school_id ? { school_id: profile.school_id } : {};
  if (profile.role === 'student') filters.class_name = profile.class_name;
  const hw = await dbGet('homework', filters);
  hw.filter(h => !h.completed && daysUntil(h.due_date) <= 1 && daysUntil(h.due_date) >= 0)
    .forEach(h => {
      if (!sessionStorage.getItem('notif_hw_' + h.id)) {
        showToast(`HA fällt ab: ${h.title}`, 'info');
        sessionStorage.setItem('notif_hw_' + h.id, '1');
      }
    });
}

async function checkExamUpcoming() {
  const filters = profile.school_id ? { school_id: profile.school_id } : {};
  if (profile.role === 'student') filters.class_name = profile.class_name;
  const exams = await dbGet('exams', filters);
  exams.filter(e => daysUntil(e.exam_date) === 0).forEach(e => {
    if (!sessionStorage.getItem('notif_ex_' + e.id)) {
      showToast(`Klausur heute: ${e.title}`, 'info');
      sessionStorage.setItem('notif_ex_' + e.id, '1');
    }
  });
}

document.addEventListener('click', e => {
  const panel = document.getElementById('notification-panel');
  const bell = document.getElementById('notif-bell');
  if (panel && !panel.contains(e.target) && bell && !bell.contains(e.target)) {
    panel.style.display = 'none';
  }
});

setInterval(checkNotifications, 60000);
