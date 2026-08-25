async function dbGet(table, filters = {}) {
  let query = supabase.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query = query.eq(key, value);
  });
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) { console.error('dbGet error:', error); return []; }
  return data || [];
}

async function dbInsert(table, record) {
  const { data, error } = await supabase.from(table).insert(record).select();
  if (error) { console.error('dbInsert error:', error); throw error; }
  return data[0];
}

async function dbUpdate(table, filters, updates) {
  let query = supabase.from(table).update(updates);
  Object.entries(filters).forEach(([key, value]) => { query = query.eq(key, value); });
  const { data, error } = await query.select();
  if (error) { console.error('dbUpdate error:', error); throw error; }
  return data;
}

async function dbDelete(table, filters) {
  let query = supabase.from(table).delete();
  Object.entries(filters).forEach(([key, value]) => { query = query.eq(key, value); });
  const { error } = await query;
  if (error) { console.error('dbDelete error:', error); throw error; }
}
