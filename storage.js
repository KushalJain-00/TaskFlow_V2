const SUPABASE_URL = 'https://ylhqhjjakztxyrzoaaok.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaHFoampha3p0eHlyem9hYW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODIyODksImV4cCI6MjA5MTU1ODI4OX0.79YaM7pdbimRTqcEs7paQ_0D5PziNE83lPbCtFD-ljg';

const db = (table) => ({
  url: `${SUPABASE_URL}/rest/v1/${table}`,
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
  }
});

const Storage = (() => {

  // local cache so UI stays fast
  let _cache = { tasks: null, employees: null, settings: null };

  async function _get(table) {
    if (_cache[table]) return _cache[table];
    const r = await fetch(`${db(table).url}?select=*`, { headers: db(table).headers });
    const rows = await r.json();
    if (table === 'settings') {
      _cache[table] = rows[0]?.data || { managerName: 'You' };
    } else {
      _cache[table] = rows.map(r => r.data);
    }
    return _cache[table];
  }

  async function _upsert(table, id, data) {
    _cache[table] = null; // bust cache
    await fetch(db(table).url, {
      method: 'POST',
      headers: { ...db(table).headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ id, data }),
    });
  }

  async function _delete(table, id) {
    _cache[table] = null;
    await fetch(`${db(table).url}?id=eq.${id}`, {
      method: 'DELETE',
      headers: db(table).headers,
    });
  }

  function _id() {
    return 'tf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ── TASKS ──────────────────────────────────────────────
  async function getAllTasks() {
    return await _get('tasks');
  }

  async function getTaskById(id) {
    const tasks = await getAllTasks();
    return tasks.find(t => t.id === id) || null;
  }

  async function saveTask(taskData) {
    const now = new Date().toISOString();
    if (taskData.id) {
      const tasks = await getAllTasks();
      const existing = tasks.find(t => t.id === taskData.id);
      const updated = { ...existing, ...taskData, updatedAt: now };
      await _upsert('tasks', updated.id, updated);
      return updated;
    } else {
      const newTask = {
        id: _id(), title: '', description: '', assignee: 'me',
        priority: 'medium', assignedDate: now.split('T')[0],
        dueDate: '', tags: [], completed: false, completedAt: null,
        createdAt: now, updatedAt: now, ...taskData,
      };
      await _upsert('tasks', newTask.id, newTask);
      return newTask;
    }
  }

  async function deleteTask(id) {
    await _delete('tasks', id);
  }

  async function toggleTaskComplete(id) {
    const tasks = await getAllTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return null;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
    await _upsert('tasks', id, task);
    return task;
  }

  // ── EMPLOYEES ──────────────────────────────────────────
  async function getEmployees() {
    return await _get('employees');
  }

  async function saveEmployee(data) {
    const emps = await getEmployees();
    if (data.id) {
      const existing = emps.find(e => e.id === data.id);
      const updated = { ...existing, ...data };
      await _upsert('employees', updated.id, updated);
      return updated;
    } else {
      const newEmp = { id: _id(), name: data.name || 'Unknown', role: data.role || '', createdAt: new Date().toISOString() };
      await _upsert('employees', newEmp.id, newEmp);
      return newEmp;
    }
  }

  async function deleteEmployee(id) {
    await _delete('employees', id);
  }

  // ── COMPANIES ──────────────────────────────────────────
  function getCompanies() { 
    return _get('taskflow_companies') || []; 
  }

  function saveCompany(data) {
    const companies = getCompanies();
    if (data.id) {
      const idx = companies.findIndex(c => c.id === data.id);
      if (idx === -1) return null;
      companies[idx] = { ...companies[idx], ...data };
      _set('taskflow_companies', companies);
      return companies[idx];
    }
    const newCo = { id: _generateId(), name: data.name, createdAt: new Date().toISOString() };
    companies.push(newCo);
    _set('taskflow_companies', companies);
    return newCo;
  }

  function deleteCompany(id) {
    _set('taskflow_companies', getCompanies().filter(c => c.id !== id));
  }

  // REPLACE WITH:
  async function getCompanies() {
    return await _get('companies');
  }

  async function saveCompany(data) {
    if (data.id) {
      const companies = await getCompanies();
      const existing = companies.find(c => c.id === data.id);
      const updated = { ...existing, ...data };
      await _upsert('companies', updated.id, updated);
      return updated;
    }
    const newCo = { id: _id(), name: data.name, createdAt: new Date().toISOString() };
    await _upsert('companies', newCo.id, newCo);
    return newCo;
  }

  async function deleteCompany(id) {
    await _delete('companies', id);
  }

  // ── SETTINGS ───────────────────────────────────────────
  async function getSettings() {
    return await _get('settings');
  }

  async function saveSettings(settings) {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    _cache.settings = updated;
    await _upsert('settings', 'singleton', updated);
  }

  return {
    getAllTasks, getTaskById, saveTask, deleteTask, toggleTaskComplete,
    getEmployees, saveEmployee, deleteEmployee, getSettings, saveSettings,
    getCompanies, saveCompany, deleteCompany,
  };

})();