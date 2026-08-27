const SUPABASE_URL = 'https://tkatqbppvgrmupuacgxc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KB0haEcBH8s61qjhbbQBoA_b7Jw67EK';

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

async function initAuth() {
  if (!_sb) return null;
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    currentProfile = await getProfile(currentUser.id);
  }
  _sb.auth.onAuthStateChange(async (event, session) => {
    currentUser = session ? session.user : null;
    if (currentUser) {
      currentProfile = await getProfile(currentUser.id);
    } else {
      currentProfile = null;
    }
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
  return currentUser;
}

async function signUp(email, password, meta = {}) {
  const { data, error } = await _sb.auth.signUp({
    email,
    password,
    options: { data: meta }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await _sb.auth.signOut();
  if (error) throw error;
  window.location.href = 'index.html';
}

async function getProfile(userId) {
  const { data, error } = await _sb
    .from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

async function updateProfile(userId, updates) {
  const { data, error } = await _sb
    .from('profiles').update(updates).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

async function getSchool(schoolId) {
  if (!schoolId) return null;
  const { data, error } = await _sb
    .from('schools').select('*').eq('id', schoolId).single();
  if (error) return null;
  return data;
}

async function dbGet(table, filters = {}) {
  let query = _sb.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === 'null') return;
    if (Array.isArray(value)) query = query.in(key, value);
    else query = query.eq(key, value);
  });
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) { console.error('dbGet error:', error); return []; }
  return data || [];
}

async function dbInsert(table, record) {
  const { data, error } = await _sb.from(table).insert(record).select();
  if (error) { console.error('dbInsert error:', error); throw error; }
  return data[0];
}

async function dbUpdate(table, filters, updates) {
  let query = _sb.from(table).update(updates);
  Object.entries(filters).forEach(([key, value]) => { query = query.eq(key, value); });
  const { data, error } = await query.select();
  if (error) { console.error('dbUpdate error:', error); throw error; }
  return data;
}

async function dbDelete(table, filters) {
  let query = _sb.from(table).delete();
  Object.entries(filters).forEach(([key, value]) => { query = query.eq(key, value); });
  const { error } = await query;
  if (error) { console.error('dbDelete error:', error); throw error; }
}

// === Security: Login Lockout ===

async function getLoginSecurity(email) {
  const norm = (email || '').trim().toLowerCase();
  const { data, error } = await _sb.from('login_security').select('*').eq('email', norm).single();
  if (error || !data) return null;
  if (data.locked_until && new Date(data.locked_until) > new Date()) {
    return { ...data, locked: true };
  }
  if (data.locked_until && new Date(data.locked_until) <= new Date()) {
    await _sb.from('login_security').update({ locked_until: null, failed_attempts: 0, unlock_token: null }).eq('email', norm);
    return { ...data, locked: false, failed_attempts: 0, locked_until: null };
  }
  return { ...data, locked: false };
}

async function incrementFailedLogin(email) {
  const norm = (email || '').trim().toLowerCase();
  const existing = await getLoginSecurity(norm);
  const attempts = (existing?.failed_attempts || 0) + 1;
  const shouldLock = attempts >= 3;
  const unlockToken = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
  const update = {
    email: norm,
    failed_attempts: attempts,
    last_attempt_at: new Date().toISOString(),
    ...(shouldLock ? { locked_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), unlock_token: unlockToken } : {})
  };
  if (existing) {
    await _sb.from('login_security').update(update).eq('email', norm);
  } else {
    await _sb.from('login_security').insert(update);
  }
  if (shouldLock) {
    const profile = (await _sb.from('profiles').select('id, full_name, email').eq('email', norm).limit(1)).data?.[0];
    await _sb.from('security_events').insert({
      email: norm,
      event_type: 'account_locked',
      metadata: { user_name: profile?.full_name || norm, unlock_token: unlockToken, reason: '3 fehlgeschlagene Login-Versuche' }
    });
    await sendEmail(norm, 'Account gesperrt – Sicherheitswarnung', `Hallo ${profile?.full_name || 'Nutzer'},\n\nDein Account wurde nach 3 fehlgeschlagenen Login-Versuchen gesperrt.\nGrund: Sicherheitssperre aktiv\nEntsperr-Link: ${window.location.origin}/School_Planner_V1/index.html?unlock=${unlockToken}\n\nDie Sperrung wird automatisch nach 48 Stunden aufgehoben.\nFalls du diese Sitzung nicht initiiert hast, ändere dein Passwort umgehend.`);
  }
  return { attempts, locked: shouldLock, unlockToken: shouldLock ? unlockToken : null };
}

async function resetFailedLogins(email) {
  const norm = (email || '').trim().toLowerCase();
  await _sb.from('login_security').update({ failed_attempts: 0, locked_until: null, unlock_token: null }).eq('email', norm);
}

async function unlockAccount(token) {
  const { data, error } = await _sb.from('login_security').select('*').eq('unlock_token', token).single();
  if (error || !data) return { success: false, message: 'Ungültiger Entsperr-Link.' };
  if (!data.locked_until || new Date(data.locked_until) <= new Date()) return { success: false, message: 'Account ist bereits entsperrt.' };
  await _sb.from('login_security').update({ locked_until: null, failed_attempts: 0, unlock_token: null }).eq('email', data.email);
  await _sb.from('security_events').insert({
    email: data.email,
    event_type: 'account_unlocked',
    metadata: { method: 'unlock_link' }
  });
  return { success: true, message: 'Account wurde entsperrt! Du kannst dich jetzt anmelden.' };
}

async function resendSecurityEmail(email) {
  const norm = (email || '').trim().toLowerCase();
  const sec = await getLoginSecurity(norm);
  if (!sec) return { success: false, message: 'Kein Sicherheits-Eintrag für diese E-Mail.' };
  const unlockToken = sec.unlock_token || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2));
  if (!sec.locked_until || new Date(sec.locked_until) <= new Date()) return { success: false, message: 'Account ist nicht gesperrt.' };
  const profile = (await _sb.from('profiles').select('full_name').eq('email', norm).limit(1)).data?.[0];
  await sendEmail(norm, 'Account entsperren – Erinnerung', `Hallo ${profile?.full_name || 'Nutzer'},\n\nDein Account ist noch gesperrt.\nEntsperr-Link: ${window.location.origin}/School_Planner_V1/index.html?unlock=${unlockToken}\n\nDie Sperrung wird automatisch nach 48 Stunden aufgehoben.`);
  await _sb.from('security_events').insert({
    email: norm,
    event_type: 'security_email_resent',
    metadata: { triggered_by: 'support' }
  });
  return { success: true, message: 'Sicherheits-E-Mail wurde erneut gesendet.' };
}

// === Email delivery ===

async function sendEmail(to, subject, text) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ to, subject, text })
    });
    if (res.ok) {
      await logEmail(to, subject, text);
      return { success: true };
    }
    await logEmail(to, subject, text);
    return { success: false, message: (await res.json().catch(() => ({}))).error || 'Senden fehlgeschlagen' };
  } catch (err) {
    await logEmail(to, subject, text);
    return { success: false, message: err.message };
  }
}

async function logEmail(to, subject, text) {
  try {
    await dbInsert('email_log', { recipient_email: to, subject, body: text, event_type: 'email' });
  } catch (e) { console.error('logEmail error:', e); }
}

async function logAnnouncementEmail(announcementId, recipientEmail, subject, body) {
  try {
    await dbInsert('email_log', {
      recipient_email: recipientEmail,
      subject,
      body,
      event_type: 'announcement'
    });
  } catch (e) { console.error('logAnnouncementEmail error:', e); }
}
