let messagesData = [];
let msgFilter = 'inbox';

async function renderMessages() {
  if (!currentUser) return;
  const allMsgs = await dbGet('messages', currentUser.id);
  messagesData = allMsgs;
  renderMessageList();
}

function filterMessages(filter, btn) {
  msgFilter = filter;
  document.querySelectorAll('#page-messages .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMessageList();
}

function renderMessageList() {
  let filtered = [];
  if (msgFilter === 'inbox') {
    filtered = messagesData.filter(m => m.receiver_id === currentUser.id);
  } else {
    filtered = messagesData.filter(m => m.sender_id === currentUser.id);
  }
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const el = document.getElementById('message-list');
  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state"><h3>${msgFilter === 'inbox' ? 'Keine Nachrichten' : 'Nichts gesendet'}</h3><p>${msgFilter === 'inbox' ? 'Dein Posteingang ist leer' : 'Du hast noch keine Nachrichten gesendet'}</p></div>`;
    return;
  }

  el.innerHTML = filtered.map(m => `
    <div class="card mb-8" style="padding:16px 20px;${!m.read && msgFilter === 'inbox' ? 'border-left:3px solid var(--accent)' : ''}">
      <div class="flex-between mb-8">
        <div>
          <strong style="font-size:0.938rem">${escapeHtml(m.subject || '(Kein Betreff)')}</strong>
          <div style="font-size:0.75rem;color:var(--text-muted)">
            ${msgFilter === 'inbox' ? 'Von' : 'An'}: ${escapeHtml(msgFilter === 'inbox' ? m.sender_id.substring(0, 8) + '...' : m.receiver_id.substring(0, 8) + '...')}
            &middot; ${formatDate(m.created_at)} ${formatTime(m.created_at)}
          </div>
        </div>
        <div class="flex gap-8">
          ${!m.read && msgFilter === 'inbox' ? `<button class="btn btn-ghost btn-sm" onclick="markRead('${m.id}')">Gelesen</button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteMessage('${m.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div style="font-size:0.875rem;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(m.content)}</div>
    </div>
  `).join('');
}

async function sendMessage() {
  const toEmail = document.getElementById('msg-to').value;
  const subject = document.getElementById('msg-subject').value;
  const content = document.getElementById('msg-content').value;
  if (!toEmail || !content) { showToast('Empfänger & Nachricht nötig', 'error'); return; }
  const record = {
    sender_id: currentUser.id,
    receiver_id: toEmail,
    subject,
    content,
    read: false
  };
  await dbInsert('messages', record);
  closeModal('message-modal');
  showToast('Nachricht gesendet!', 'success');
  document.getElementById('msg-to').value = '';
  document.getElementById('msg-subject').value = '';
  document.getElementById('msg-content').value = '';
  renderMessages();
}

async function markRead(id) {
  await dbUpdate('messages', id, { read: true });
  renderMessages();
}

async function deleteMessage(id) {
  if (!confirm('Nachricht löschen?')) return;
  await dbDelete('messages', id);
  showToast('Gelöscht', 'success');
  renderMessages();
}
