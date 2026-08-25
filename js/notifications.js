function checkNotifications() {
  if (!currentUser) return;
  checkHomeworkDue();
  checkExamUpcoming();
}

async function checkHomeworkDue() {
  const hw = await dbGet('homework', currentUser.id);
  const dueSoon = hw.filter(h => {
    if (h.completed) return false;
    const days = daysUntil(h.due_date);
    return days <= 1 && days >= 0;
  });
  dueSoon.forEach(h => {
    if (!sessionStorage.getItem('notif_hw_' + h.id)) {
      showToast(`HA fällt bald ab: ${h.title}`, 'info');
      sessionStorage.setItem('notif_hw_' + h.id, '1');
    }
  });
}

async function checkExamUpcoming() {
  const exams = await dbGet('exams', currentUser.id);
  const soon = exams.filter(e => {
    const days = daysUntil(e.exam_date);
    return days === 0;
  });
  soon.forEach(e => {
    if (!sessionStorage.getItem('notif_ex_' + e.id)) {
      showToast(`Klausur heute: ${e.title}`, 'info');
      sessionStorage.setItem('notif_ex_' + e.id, '1');
    }
  });
}

setInterval(checkNotifications, 60000);
