function checkNotifications() {
  if (!currentUser || !profile) return;
  checkHomeworkDue();
  checkExamUpcoming();
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

setInterval(checkNotifications, 60000);
