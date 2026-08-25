function renderSettings() {
  if (profile) {
    document.getElementById('settings-name').value = profile.full_name || '';
    document.getElementById('settings-class').value = profile.class_name || '';
  }
  initTheme();
}

async function saveProfile() {
  if (!currentUser) return;
  const updates = {
    full_name: document.getElementById('settings-name').value,
    class_name: document.getElementById('settings-class').value
  };
  try {
    if (supabase) {
      await supabase.from('profiles').update(updates).eq('id', currentUser.id);
    }
    profile = { ...profile, ...updates };
    localStorage.setItem('sp_profile_' + currentUser.id, JSON.stringify(profile));
    updateUserUI();
    showToast('Profil gespeichert!', 'success');
  } catch (err) {
    showToast('Fehler beim Speichern', 'error');
  }
}

async function exportData() {
  if (!currentUser) return;
  const tables = ['subjects', 'timetable', 'homework', 'grades', 'exams', 'calendar_events', 'substitutions', 'messages'];
  const exportObj = { version: '1.0', exportDate: new Date().toISOString(), userId: currentUser.id, data: {} };
  for (const table of tables) {
    exportObj.data[table] = await dbGet(table, currentUser.id);
  }
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `school-planner-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Daten exportiert!', 'success');
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.data) { showToast('Ungültiges Dateiformat', 'error'); return; }
      const tables = ['subjects', 'timetable', 'homework', 'grades', 'exams', 'calendar_events', 'substitutions', 'messages'];
      for (const table of tables) {
        if (imported.data[table]) {
          for (const record of imported.data[table]) {
            const { id, created_at, ...rest } = record;
            await dbInsert(table, { ...rest, user_id: currentUser.id });
          }
        }
      }
      showToast('Daten importiert! Seite wird neu geladen...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast('Fehler beim Importieren', 'error');
    }
  };
  reader.readAsText(file);
}
