async function renderSettings() {
  if (profile) {
    document.getElementById('settings-name').value = profile.full_name || '';
    document.getElementById('settings-email').value = currentUser?.email || profile.email || '';
    document.getElementById('settings-class').value = profile.class_name || '';
    document.getElementById('settings-address').value = profile.address || '';
    document.getElementById('settings-phone').value = profile.phone || '';
  }
  const schoolInfo = document.getElementById('settings-school-info');
  if (schoolInfo) {
    if (profile?.school_id) {
      const school = await getSchool(profile.school_id);
      const typeLabels = { grundschule: 'Grundschule', realschule: 'Realschule', gymnasium: 'Gymnasium', gesamtschule: 'Gesamtschule', foerderschule: 'Förderschule', berufsschule: 'Berufsschule', sonstige: 'Sonstige' };
      if (school) {
        schoolInfo.innerHTML = `
          <div style="padding:16px">
            <div style="font-size:1.125rem;font-weight:600;margin-bottom:4px">${escapeHtml(school.name)}</div>
            <div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:4px">${typeLabels[school.type] || school.type || ''}</div>
            <div style="font-size:0.813rem;color:var(--text-muted)">ID: ${school.id.substring(0, 8)}...</div>
            ${school.address ? `<div style="font-size:0.813rem;color:var(--text-muted);margin-top:4px">${escapeHtml(school.address)}</div>` : ''}
          </div>`;
      } else {
        schoolInfo.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">Schuldaten konnten nicht geladen werden.</div>';
      }
    } else {
      schoolInfo.innerHTML = `
        <div style="padding:16px;text-align:center">
          <p style="color:var(--text-secondary);margin-bottom:12px">Du bist aktuell keiner Schule zugeordnet.</p>
          <p style="font-size:0.813rem;color:var(--text-muted)">Melde dich beim Admin, um einer Schule zugewiesen zu werden.</p>
        </div>`;
    }
  }
  initTheme();
}

async function saveProfile() {
  if (!currentUser) return;
  const btn = document.querySelector('button[onclick="saveProfile()"]');
  if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = 'Speichern...'; }
  const updates = {
    full_name: document.getElementById('settings-name').value,
    email: document.getElementById('settings-email').value,
    class_name: document.getElementById('settings-class').value,
    address: document.getElementById('settings-address').value,
    phone: document.getElementById('settings-phone').value
  };
  try {
    await updateProfile(currentUser.id, updates);
    if (updates.email && updates.email !== currentUser.email) {
      try { await _sb.auth.updateUser({ email: updates.email }); } catch (e) { console.warn('Email update:', e.message); }
    }
    profile = { ...profile, ...updates };
    updateUserUI();
    showToast('Profil gespeichert!', 'success');
  } catch (err) { showToast('Fehler: ' + err.message, 'error'); }
  if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || 'Speichern'; }
}

async function changePassword() {
  const pw = document.getElementById('settings-new-pw').value;
  if (!pw || pw.length < 6) { showToast('Passwort muss min. 6 Zeichen lang sein', 'error'); return; }
  try {
    await _sb.auth.updateUser({ password: pw });
    showToast('Passwort geändert!', 'success');
    document.getElementById('settings-new-pw').value = '';
  } catch (err) { showToast('Fehler: ' + err.message, 'error'); }
}
