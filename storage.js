const SUPABASE_URL = 'https://ylhqhjjakztxyrzoaaok.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaHFoampha3p0eHlyem9hYW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODIyODksImV4cCI6MjA5MTU1ODI4OX0.79YaM7pdbimRTqcEs7paQ_0D5PziNE83lPbCtFD-ljg';

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
    const r = await fetch(`${_url(table)}?select=*`, { headers: _headers() });
    const rows = await r.json();
    if (table === 'settings') {
      _cache[table] = rows[0]?.data || { managerName: 'Manager' };
    } else {
      _cache[table] = Array.isArray(rows) ? rows.map(r => r.data) : [];
    }
    return _cache[table];
  }

  async function _upsert(table, id, data) {
    _cache[table] = null;
    const userId = (typeof Auth !== 'undefined') ? Auth.getUserId() : null;
    const payload = userId ? { ...data, userId } : data;
    const res = await fetch(_url(table), {
      method: 'POST',
      headers: _headers(),
      body: JSON.stringify({ id, data: payload }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase upsert error on ' + table + ':', err);
    }
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
  async function getTaskById(id) { return (await getAllTasks()).find(t => t.id === id) || null; }

  async function saveTask(taskData) {
    const now = new Date().toISOString();
    if (taskData.id) {
      const existing = (await getAllTasks()).find(t => t.id === taskData.id);
      const updated = { ...existing, ...taskData, updatedAt: now };
      await _upsert('tasks', updated.id, updated);
      return updated;
    }
    const newTask = {
      id: _id(), title: '', description: '', assignee: 'me',
      priority: 'medium', assignedDate: now.split('T')[0],
      dueDate: '', tags: [], completed: false, completedAt: null,
      createdAt: now, updatedAt: now, ...taskData,
    };
    await _upsert('tasks', newTask.id, newTask);
    return newTask;
  }

  async function deleteTask(id) { await _delete('tasks', id); }

  async function toggleTaskComplete(id) {
    const task = (await getAllTasks()).find(t => t.id === id);
    if (!task) return null;
    task.completed   = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt   = new Date().toISOString();
    await _upsert('tasks', id, task);
    return task;
  }

  async function getEmployees() { return await _get('employees'); }

  async function saveEmployee(data) {
    if (data.id) {
      const existing = (await getEmployees()).find(e => e.id === data.id);
      const updated = { ...existing, ...data };
      await _upsert('employees', updated.id, updated);
      return updated;
    }
    const newEmp = {
      id: _id(), name: data.name || 'Unknown',
      role: data.role || '', createdAt: new Date().toISOString(),
    };
    await _upsert('employees', newEmp.id, newEmp);
    return newEmp;
  }

  async function deleteEmployee(id) { await _delete('employees', id); }

  async function getCompanies() { return await _get('companies'); }

  async function saveCompany(data) {
    if (data.id) {
      const existing = (await getCompanies()).find(c => c.id === data.id);
      const updated = { ...existing, ...data };
      await _upsert('companies', updated.id, updated);
      return updated;
    }
    const newCo = { id: _id(), name: data.name, createdAt: new Date().toISOString() };
    await _upsert('companies', newCo.id, newCo);
    return newCo;
  }

  async function deleteCompany(id) { await _delete('companies', id); }

  async function getSettings() { return await _get('settings'); }

  async function saveSettings(settings) {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    _cache.settings = updated;
    const userId = (typeof Auth !== 'undefined') ? Auth.getUserId() : 'singleton';
    await _upsert('settings', 'singleton_' + userId, updated);
  }

  return {
    getAllTasks, getTaskById, saveTask, deleteTask, toggleTaskComplete,
    getEmployees, saveEmployee, deleteEmployee,
    getCompanies, saveCompany, deleteCompany,
    getSettings, saveSettings,
  };

})();
