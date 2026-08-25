let localStorageFallback = {};

function dbGet(table, userId) {
  if (!supabase) return Promise.resolve(localStorageGet(table, userId));
  return supabase.from(table).select('*').eq('user_id', userId).order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    })
    .catch(() => localStorageGet(table, userId));
}

function dbInsert(table, record) {
  if (!supabase) return Promise.resolve(localStorageInsert(table, record));
  return supabase.from(table).insert(record).select()
    .then(({ data, error }) => {
      if (error) throw error;
      return data[0];
    })
    .catch(() => localStorageInsert(table, record));
}

function dbUpdate(table, id, updates) {
  if (!supabase) return Promise.resolve(localStorageUpdate(table, id, updates));
  return supabase.from(table).update(updates).eq('id', id).select()
    .then(({ data, error }) => {
      if (error) throw error;
      return data[0];
    })
    .catch(() => localStorageUpdate(table, id, updates));
}

function dbDelete(table, id) {
  if (!supabase) return Promise.resolve(localStorageDelete(table, id));
  return supabase.from(table).delete().eq('id', id)
    .then(({ error }) => {
      if (error) throw error;
    })
    .catch(() => localStorageDelete(table, id));
}

function dbGetByFilter(table, userId, filters) {
  if (!supabase) {
    return dbGet(table, userId).then(data => {
      return data.filter(row => {
        return Object.entries(filters).every(([key, value]) => row[key] === value);
      });
    });
  }
  let query = supabase.from(table).select('*').eq('user_id', userId);
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  return query.order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    });
}

function localStorageGet(table, userId) {
  const key = `sp_${table}_${userId}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function localStorageInsert(table, record) {
  const userId = currentUser ? currentUser.id : 'local';
  const key = `sp_${table}_${userId}`;
  const data = JSON.parse(localStorage.getItem(key) || '[]');
  const newRecord = { ...record, id: record.id || generateId(), created_at: new Date().toISOString() };
  data.push(newRecord);
  localStorage.setItem(key, JSON.stringify(data));
  return newRecord;
}

function localStorageUpdate(table, id, updates) {
  const userId = currentUser ? currentUser.id : 'local';
  const key = `sp_${table}_${userId}`;
  const data = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = data.findIndex(r => r.id === id);
  if (idx !== -1) {
    data[idx] = { ...data[idx], ...updates };
    localStorage.setItem(key, JSON.stringify(data));
    return data[idx];
  }
  return null;
}

function localStorageDelete(table, id) {
  const userId = currentUser ? currentUser.id : 'local';
  const key = `sp_${table}_${userId}`;
  const data = JSON.parse(localStorage.getItem(key) || '[]');
  const filtered = data.filter(r => r.id !== id);
  localStorage.setItem(key, JSON.stringify(filtered));
}
