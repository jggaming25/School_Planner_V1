const SUPABASE_URL = 'https://tkatqbppvgrmupuacgxc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KB0haEcBH8s61qjhbbQBoA_b7Jw67EK';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;

async function initAuth() {
  if (!supabase) {
    console.warn('Supabase client not loaded');
    return null;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
  }
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    if (event === 'SIGNED_OUT') {
      window.location.href = 'index.html';
    }
  });
  return currentUser;
}

async function signUp(email, password, fullName, className) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      class_name: className,
      role: 'student'
    });
  }
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
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
