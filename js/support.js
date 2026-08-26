let supportTickets = [];
let supportFilter = 'open';
let supportLockedAccounts = [];

async function renderSupportPanel() {
  if (!SYSTEM_ROLES.includes(profile.role)) return;
  const [tickets, schools, locked] = await Promise.all([
    dbGet('support_tickets'),
    dbGet('schools'),
    _sb.from('login_security').select('*').order('last_attempt_at', { ascending: false })
  ]);
  supportTickets = tickets;
  adminAllSchools = schools;
  supportLockedAccounts = (locked.data || []).filter(s => s.locked_until && new Date(s.locked_until) > new Date());
  renderSupportContent();
}

function renderSupportContent() {
  const el = document.getElementById('support-content');
  if (!el) return;
  const myTickets = supportTickets.filter(t => t.assigned_to === currentUser.id && !['resolved','closed'].includes(t.status));
  const openTickets = supportTickets.filter(t => t.status === 'open');
  const inProgress = supportTickets.filter(t => t.assigned_to === currentUser.id && t.status === 'in_progress');
  const resolved = supportTickets.filter(t => ['resolved','closed'].includes(t.status));

  el.innerHTML = `
    <div class="tabs mb-20">
      <button class="tab ${supportFilter==='open'?'active':''}" onclick="supportFilter='open';renderSupportContent()">Offen (${openTickets.length})</button>
      <button class="tab ${supportFilter==='mine'?'active':''}" onclick="supportFilter='mine';renderSupportContent()">Meine (${myTickets.length + inProgress.length})</button>
      <button class="tab ${supportFilter==='resolved'?'active':''}" onclick="supportFilter='resolved';renderSupportContent()">Erledigt (${resolved.length})</button>
      <button class="tab ${supportFilter==='security'?'active':''}" onclick="supportFilter='security';renderSupportContent()">Sicherheit (${supportLockedAccounts.length})</button>
    </div>
    ${supportFilter === 'security' ? renderSecurityTab() : renderTicketList()}`;
}

function renderSecurityTab() {
  if (supportLockedAccounts.length === 0) return '<div class="empty-state"><h3>Keine gesperrten Accounts</h3></div>';
  return `<div class="table-wrapper">
    <table>
      <thead><tr><th>E-Mail</th><th>Versuche</th><th>Gesperrt bis</th><th style="text-align:right">Aktion</th></tr></thead>
      <tbody>${supportLockedAccounts.map(s => {
        const lockTime = new Date(s.locked_until);
        const remaining = Math.max(0, Math.round((lockTime - new Date()) / 3600000));
        return `<tr>
          <td><strong>${escapeHtml(s.email)}</strong></td>
          <td><span class="badge badge-red">${s.failed_attempts}/3</span></td>
          <td style="font-size:0.813rem">${lockTime.toLocaleString('de-DE')} (noch ~${remaining}h)</td>
          <td style="text-align:right">
            <button class="btn btn-primary btn-sm" onclick="supportResendSecurityEmail('${escapeHtml(s.email)}')">Sicherheits-E-Mail senden</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

async function supportResendSecurityEmail(email) {
  try {
    const result = await resendSecurityEmail(email);
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) await renderSupportPanel();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

function renderTicketList() {
  let tickets;
  if (supportFilter === 'open') tickets = supportTickets.filter(t => t.status === 'open');
  else if (supportFilter === 'mine') tickets = supportTickets.filter(t => t.assigned_to === currentUser.id && !['resolved','closed'].includes(t.status));
  else tickets = supportTickets.filter(t => ['resolved','closed'].includes(t.status));

  if (tickets.length === 0) return '<div class="empty-state"><h3>Keine Anfragen</h3></div>';

  const catLabels = { account: 'Konto', password: 'Passwort', deactivate: 'Deaktivieren', delete: 'Löschen', timetable: 'Stundenplan', grades: 'Noten', general: 'Allgemein' };
  const statusLabels = { open: 'Offen', claimed: 'Übernommen', in_progress: 'In Bearbeitung', resolved: 'Erledigt', closed: 'Geschlossen' };
  const statusColors = { open: 'badge-yellow', claimed: 'badge-blue', in_progress: 'badge-blue', resolved: 'badge-green', closed: 'badge-green' };

  return tickets.map(t => {
    const school = adminAllSchools?.find(s => s.id === t.school_id);
    return `<div class="card mb-12" style="padding:16px">
      <div class="flex-between mb-8">
        <div>
          <strong>${escapeHtml(t.title)}</strong>
          <span class="badge ${statusColors[t.status]}" style="margin-left:8px">${statusLabels[t.status]}</span>
          <span class="badge badge-blue" style="margin-left:4px">${catLabels[t.category] || t.category}</span>
        </div>
        <span style="font-size:0.75rem;color:var(--text-muted)">${formatDate(t.created_at)}</span>
      </div>
      <p style="font-size:0.875rem;color:var(--text-secondary);margin:0 0 12px">${escapeHtml(t.description || '')}</p>
      <div style="font-size:0.813rem;color:var(--text-muted);margin-bottom:8px">Schule: ${school ? escapeHtml(school.name) : 'Unbekannt'}</div>
      ${t.status === 'open' ? `<button class="btn btn-primary btn-sm" onclick="claimTicket('${t.id}')">Übernehmen</button>` : ''}
      ${t.status === 'in_progress' && t.assigned_to === currentUser.id ? `<button class="btn btn-success btn-sm" onclick="resolveTicket('${t.id}')">Erledigt</button>` : ''}
    </div>`;
  }).join('');
}

async function claimTicket(ticketId) {
  await _sb.from('support_tickets').update({
    assigned_to: currentUser.id,
    status: 'claimed',
    claimed_at: new Date().toISOString()
  }).eq('id', ticketId);
  showToast('Anfrage übernommen!', 'success');
  await renderSupportPanel();
}

async function resolveTicket(ticketId) {
  const note = prompt('Lösungshinweis (optional):');
  await _sb.from('support_tickets').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolution_note: note || null
  }).eq('id', ticketId);
  showToast('Anfrage als erledigt markiert!', 'success');
  await renderSupportPanel();
}

async function createSupportTicket() {
  const title = document.getElementById('ticket-title')?.value;
  const description = document.getElementById('ticket-desc')?.value;
  const category = document.getElementById('ticket-category')?.value || 'general';
  if (!title) { showToast('Titel nötig', 'error'); return; }
  await dbInsert('support_tickets', {
    school_id: profile.school_id,
    created_by: currentUser.id,
    title, description, category,
    status: 'open'
  });
  closeModal('support-ticket-modal');
  showToast('Anfrage gesendet!', 'success');
  renderSupportPanel();
}
