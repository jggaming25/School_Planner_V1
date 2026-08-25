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
  const { data, error } = await _sb
    .from('schools').select('*').eq('id', schoolId).single();
  if (error) return null;
  return data;
}

async function dbGet(table, filters = {}) {
  let query = _sb.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
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
