const Storage = (() => {

  let _cache = { tasks: null, employees: null, settings: null, companies: null };

  function _headers() {
    const token = (typeof Auth !== 'undefined') ? Auth.getAccessToken() : SUPABASE_KEY;
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    };
  }

  function _url(table) { return `${SUPABASE_URL}/rest/v1/${table}`; }

  async function _get(table) {
    if (_cache[table]) return _cache[table];
    const userId = (typeof Auth !== 'undefined') ? Auth.getUserId() : null;
    // ↓ Add user_id filter to the query
    const r = await fetch(`${_url(table)}?select=*&user_id=eq.${userId}`, { 
      headers: _headers(), 
      cache: 'no-store' 
    });
    const rows = await r.json();
    if (table === 'settings') {
      _cache[table] = rows[0]?.data || { managerName: 'Manager' };
    } else {
      _cache[table] = Array.isArray(rows) ? rows.map(r => ({ id: r.id, ...r.data })) : [];
    }
    return _cache[table];
  }

  async function _upsert(table, data) {
    _cache[table] = null;
    const { id, ...rest } = data;

    const userId = (typeof Auth !== 'undefined') ? Auth.getUserId() : null;

    // user_id goes as a real column, everything else in data JSONB
    const dbPayload = { data: rest, user_id: userId };  // ← ADD user_id here

    const checkRes = await fetch(`${_url(table)}?id=eq.${id}`, { headers: _headers() });
    const exists = (await checkRes.json()).length > 0;

    const res = await fetch(exists ? `${_url(table)}?id=eq.${id}` : _url(table), {
      method: exists ? 'PATCH' : 'POST',
      headers: _headers(),
      body: JSON.stringify(exists ? dbPayload : { id, ...dbPayload }),  // id + user_id + data
    });

    if (!res.ok) console.error(`Supabase error on ${table}:`, await res.text());
    return res;
  }

  async function _delete(table, id) {
    _cache[table] = null;
    await fetch(`${_url(table)}?id=eq.${id}`, { method: 'DELETE', headers: _headers() });
  }

  function _id() {
    return 'tf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  async function getAllTasks()    { return await _get('tasks'); }
  async function getTaskById(id) { return (await getAllTasks()).find(t => String(t.id) === String(id)) || null; }

  async function saveTask(taskData) {
    const now = new Date().toISOString();
    if (taskData.id) {
      const existing = (await getAllTasks()).find(t => String(t.id) === String(taskData.id));
      const updated = { ...existing, ...taskData, updatedAt: now };
      
      const res = await _upsert('tasks', updated);
      if (res && !res.ok) {
        alert("Failed to save edited task! Check browser console for exact Supabase error.");
      }
      return updated;
    }
    const newTask = {
      id: _id(), title: '', description: '', assignee: 'me',
      priority: 'medium', assignedDate: now.split('T')[0],
      dueDate: '', tags: [], completed: false, completedAt: null,
      createdAt: now, updatedAt: now, ...taskData,
    };
    await _upsert('tasks', newTask);
    return newTask;
  }

  async function deleteTask(id) { await _delete('tasks', id); }

  async function toggleTaskComplete(id) {
    const task = (await getAllTasks()).find(t => String(t.id) === String(id));
    if (!task) return null;
    task.completed   = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt   = new Date().toISOString();
    await _upsert('tasks', task);
    return task;
  }

  async function getEmployees() { return await _get('employees'); }

  async function saveEmployee(data) {
    if (data.id) {
      const existing = (await getEmployees()).find(e => String(e.id) === String(data.id));
      const updated = { ...existing, ...data };
      await _upsert('employees', updated);
      return updated;
    }
    const newEmp = {
      id: _id(), name: data.name || 'Unknown',
      role: data.role || '', createdAt: new Date().toISOString(),
    };
    await _upsert('employees', newEmp);
    return newEmp;
  }

  async function deleteEmployee(id) { await _delete('employees', id); }

  async function getCompanies() { return await _get('companies'); }

  async function saveCompany(data) {
    if (data.id) {
      const existing = (await getCompanies()).find(c => String(c.id) === String(data.id));
      const updated = { ...existing, ...data };
      await _upsert('companies', updated);
      return updated;
    }
    const newCo = { id: _id(), name: data.name, createdAt: new Date().toISOString() };
    await _upsert('companies', newCo);
    return newCo;
  }

  async function deleteCompany(id) { await _delete('companies', id); }

  async function getSettings() { return await _get('settings'); }

  async function saveSettings(settings) {
    const current = await getSettings();
    const updated = { ...current, ...settings, id: Auth.getUserId() };
    _cache.settings = updated;
    await _upsert('settings', updated);
  }

  return {
    getAllTasks, getTaskById, saveTask, deleteTask, toggleTaskComplete,
    getEmployees, saveEmployee, deleteEmployee,
    getCompanies, saveCompany, deleteCompany,
    getSettings, saveSettings,
  };

})();
