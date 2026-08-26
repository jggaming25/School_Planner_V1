let messagesData = [];
let msgFilter = 'inbox';

async function renderMessages() {
  if (!currentUser) return;
  messagesData = await dbGet('messages', profile.school_id ? { school_id: profile.school_id } : {});
  renderMessageList();
}

function openMessageModal() {
  const sel = document.getElementById('msg-to');
  if (sel && allSchoolUsers.length) {
    sel.innerHTML = '<option value="">Empfänger wählen...</option>' +
      allSchoolUsers.filter(u => u.id !== currentUser.id).map(u =>
        `<option value="${u.id}">${escapeHtml(u.full_name)} (${ROLE_LABELS[u.role] || u.role}${u.class_name ? ', ' + u.class_name : ''})</option>`
      ).join('');
  }
  openModal('message-modal');
}

function filterMessages(f, btn) { msgFilter = f; document.querySelectorAll('#page-messages .tab').forEach(t => t.classList.remove('active')); if (btn) btn.classList.add('active'); renderMessageList(); }

function renderMessageList() {
  let filtered = msgFilter === 'inbox' ? messagesData.filter(m => m.receiver_id === currentUser.id || m.receiver_id === currentUser.email) : messagesData.filter(m => m.sender_id === currentUser.id);
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const el = document.getElementById('message-list');
  if (filtered.length === 0) { el.innerHTML = `<div class="empty-state"><h3>${msgFilter === 'inbox' ? 'Keine Nachrichten' : 'Nichts gesendet'}</h3></div>`; return; }

  const userMap = {};
  allSchoolUsers.forEach(u => { userMap[u.id] = u.full_name; userMap[u.email] = u.full_name; });

  el.innerHTML = filtered.map(m => {
    const otherName = msgFilter === 'inbox'
      ? (userMap[m.sender_id] || String(m.sender_id).substring(0, 8))
      : (userMap[m.receiver_id] || m.receiver_id);
    return `
    <div class="card mb-8" style="padding:16px 20px;${!m.read && msgFilter === 'inbox' ? 'border-left:3px solid var(--accent)' : ''}">
      <div class="flex-between mb-8">
        <div><strong style="font-size:0.938rem">${escapeHtml(m.subject || '(Kein Betreff)')}</strong>
        <div style="font-size:0.75rem;color:var(--text-muted)">${msgFilter === 'inbox' ? 'Von' : 'An'}: ${escapeHtml(otherName)} &middot; ${formatDate(m.created_at)}</div></div>
        <div class="flex gap-8">
          ${!m.read && msgFilter === 'inbox' ? `<button class="btn btn-ghost btn-sm" onclick="markRead('${m.id}')">Gelesen</button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteMessage('${m.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/></svg></button>
        </div></div>
      <div style="font-size:0.875rem;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(m.content)}</div>
    </div>`;
  }).join('');
}

async function sendMessage() {
  const toUserId = document.getElementById('msg-to').value, content = document.getElementById('msg-content').value;
  if (!toUserId || !content) { showToast('Empfänger & Nachricht nötig', 'error'); return; }
  await dbInsert('messages', { school_id: profile.school_id, sender_id: currentUser.id, receiver_id: toUserId, subject: document.getElementById('msg-subject').value, content, read: false });
  closeModal('message-modal');
  showToast('Nachricht gesendet!', 'success');
  document.getElementById('msg-to').value = ''; document.getElementById('msg-subject').value = ''; document.getElementById('msg-content').value = '';
  renderMessages();
}

async function markRead(id) { await dbUpdate('messages', { id }, { read: true }); renderMessages(); }
async function deleteMessage(id) { if (!confirm('Löschen?')) return; await dbDelete('messages', { id }); showToast('Gelöscht', 'success'); renderMessages(); }
