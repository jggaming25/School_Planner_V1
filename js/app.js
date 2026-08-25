let profile = null;
let subjects = [];
let currentPage = 'dashboard';

async function initApp() {
  const user = await initAuth();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  try {
    profile = await getProfile(user.id);
    updateUserUI();
    await loadAllData();
    navigateTo('dashboard');
  } catch (err) {
    console.error('Init error:', err);
    showToast('Fehler beim Laden der Daten', 'error');
  }
}

function updateUserUI() {
  if (!profile) return;
  const initials = profile.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '?';
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent = profile.full_name || 'Unbekannt';
  document.getElementById('user-role').textContent = profile.class_name ? `Klasse ${profile.class_name}` : 'Schüler';
  if (currentUser) {
    document.getElementById('settings-email').textContent = currentUser.email;
    document.getElementById('settings-name').value = profile.full_name || '';
    document.getElementById('settings-class').value = profile.class_name || '';
  }
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll('.sidebar-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });
  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-backdrop').classList.remove('active');
  }
  renderPage(page);
}

async function loadAllData() {
  if (!currentUser) return;
  subjects = await dbGet('subjects', currentUser.id);
  renderSubjectSelects();
  updateBadges();
}

function renderSubjectSelects() {
  const selects = ['tt-subject', 'hw-subject', 'gr-subject', 'ex-subject'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Fach wählen...</option>' +
      subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  });
}

function renderPage(page) {
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'timetable': renderTimetable(); break;
    case 'homework': renderHomework(); break;
    case 'grades': renderGrades(); break;
    case 'exams': renderExams(); break;
    case 'calendar': renderCalendar(); break;
    case 'subjects': renderSubjects(); break;
    case 'substitution': renderSubstitution(); break;
    case 'messages': renderMessages(); break;
    case 'settings': renderSettings(); break;
  }
}

async function updateBadges() {
  if (!currentUser) return;
  const hw = await dbGet('homework', currentUser.id);
  const openHw = hw.filter(h => !h.completed);
  const examBadge = document.getElementById('hw-badge');
  if (examBadge) {
    examBadge.textContent = openHw.length;
    examBadge.style.display = openHw.length > 0 ? 'inline' : 'none';
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    if (id === 'event-modal') {
      document.getElementById('ev-date').value = new Date().toISOString().split('T')[0];
    }
    if (id === 'substitution-modal') {
      document.getElementById('sub-date').value = new Date().toISOString().split('T')[0];
    }
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.remove('active');
  });
});

async function handleLogout() {
  try {
    await signOut();
  } catch (err) {
    window.location.href = 'index.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initApp();
});
