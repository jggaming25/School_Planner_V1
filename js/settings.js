function renderSettings() {
  if (profile) {
    document.getElementById('settings-name').value = profile.full_name || '';
    document.getElementById('settings-email').value = currentUser?.email || profile.email || '';
    document.getElementById('settings-class').value = profile.class_name || '';
    document.getElementById('settings-address').value = profile.address || '';
    document.getElementById('settings-phone').value = profile.phone || '';
  }
  initTheme();
}

async function saveProfile() {
  if (!currentUser) return;
  const updates = {
    full_name: document.getElementById('settings-name').value,
    email: document.getElementById('settings-email').value,
    class_name: document.getElementById('settings-class').value,
    address: document.getElementById('settings-address').value,
    phone: document.getElementById('settings-phone').value
  };
  try {
    await updateProfile(currentUser.id, updates);
    profile = { ...profile, ...updates };
    updateUserUI();
    showToast('Profil gespeichert!', 'success');
  } catch (err) { showToast('Fehler: ' + err.message, 'error'); }
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
