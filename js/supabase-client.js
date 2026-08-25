const SUPABASE_URL = 'https://tkatqbppvgrmupuacgxc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KB0haEcBH8s61qjhbbQBoA_b7Jw67EK';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let currentProfile = null;

async function initAuth() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    currentProfile = await getProfile(currentUser.id);
  }
  supabase.auth.onAuthStateChange(async (event, session) => {
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = 'index.html';
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

async function getSchool(schoolId) {
  const { data, error } = await supabase
    .from('schools').select('*').eq('id', schoolId).single();
  if (error) return null;
  return data;
}

async function dbGet(table, filters = {}) {
  let query = supabase.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) query = query.in(key, value);
    else query = query.eq(key, value);
  });
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function dbInsert(table, record) {
  const { data, error } = await supabase.from(table).insert(record).select();
  if (error) throw error;
  return data[0];
}

async function dbUpdate(table, filters, updates) {
  let query = supabase.from(table).update(updates);
  Object.entries(filters).forEach(([key, value]) => { query = query.eq(key, value); });
  const { data, error } = await query.select();
  if (error) throw error;
  return data;
}

async function dbDelete(table, filters) {
  let query = supabase.from(table).delete();
  Object.entries(filters).forEach(([key, value]) => { query = query.eq(key, value); });
  const { error } = await query;
  if (error) throw error;
}
