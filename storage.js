/**
 * storage.js — Data layer for TaskFlow
 * Uses localStorage as the persistent backend (works on GitHub Pages / static hosting).
 * All data is keyed under "taskflow_*" namespaces.
 */

const Storage = (() => {

  const KEYS = {
    TASKS: 'taskflow_tasks',
    EMPLOYEES: 'taskflow_employees',
    SETTINGS: 'taskflow_settings',
  };

  // ── Utilities ────────────────────────────────────────────────────

  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[Storage] Read error', key, e);
      return null;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[Storage] Write error', key, e);
      return false;
    }
  }

  function _generateId() {
    return 'tf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ── TASKS ────────────────────────────────────────────────────────

  function getAllTasks() {
    return _get(KEYS.TASKS) || [];
  }

  function getTaskById(id) {
    return getAllTasks().find(t => t.id === id) || null;
  }

  function saveTask(taskData) {
    const tasks = getAllTasks();
    const now = new Date().toISOString();

    if (taskData.id) {
      // Update existing
      const idx = tasks.findIndex(t => t.id === taskData.id);
      if (idx === -1) return null;
      tasks[idx] = { ...tasks[idx], ...taskData, updatedAt: now };
      _set(KEYS.TASKS, tasks);
      return tasks[idx];
    } else {
      // Create new
      const newTask = {
        id: _generateId(),
        title: '',
        description: '',
        assignee: 'me',
        priority: 'medium',
        assignedDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        tags: [],
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ...taskData,
      };
      tasks.unshift(newTask);
      _set(KEYS.TASKS, tasks);
      return newTask;
    }
  }

  function deleteTask(id) {
    const tasks = getAllTasks().filter(t => t.id !== id);
    return _set(KEYS.TASKS, tasks);
  }

  function toggleTaskComplete(id) {
    const tasks = getAllTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx].completed = !tasks[idx].completed;
    tasks[idx].completedAt = tasks[idx].completed ? new Date().toISOString() : null;
    tasks[idx].updatedAt = new Date().toISOString();
    _set(KEYS.TASKS, tasks);
    return tasks[idx];
  }

  // ── EMPLOYEES ────────────────────────────────────────────────────

  function getEmployees() {
    return _get(KEYS.EMPLOYEES) || [];
  }

  function saveEmployee(data) {
    const employees = getEmployees();
    if (data.id) {
      const idx = employees.findIndex(e => e.id === data.id);
      if (idx === -1) return null;
      employees[idx] = { ...employees[idx], ...data };
      _set(KEYS.EMPLOYEES, employees);
      return employees[idx];
    } else {
      const newEmp = {
        id: _generateId(),
        name: data.name || 'Unknown',
        role: data.role || '',
        createdAt: new Date().toISOString(),
      };
      employees.push(newEmp);
      _set(KEYS.EMPLOYEES, employees);
      return newEmp;
    }
  }

  function deleteEmployee(id) {
    const employees = getEmployees().filter(e => e.id !== id);
    return _set(KEYS.EMPLOYEES, employees);
  }

  // ── SETTINGS ─────────────────────────────────────────────────────

  function getSettings() {
    return _get(KEYS.SETTINGS) || { managerName: 'You' };
  }

  function saveSettings(settings) {
    return _set(KEYS.SETTINGS, { ...getSettings(), ...settings });
  }

  // ── EXPORT / IMPORT ──────────────────────────────────────────────

  function exportData() {
    return JSON.stringify({
      tasks: getAllTasks(),
      employees: getEmployees(),
      settings: getSettings(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  function importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.tasks) _set(KEYS.TASKS, data.tasks);
      if (data.employees) _set(KEYS.EMPLOYEES, data.employees);
      if (data.settings) _set(KEYS.SETTINGS, data.settings);
      return true;
    } catch (e) {
      console.error('[Storage] Import error', e);
      return false;
    }
  }

  // ── Public API ───────────────────────────────────────────────────

  return {
    getAllTasks,
    getTaskById,
    saveTask,
    deleteTask,
    toggleTaskComplete,
    getEmployees,
    saveEmployee,
    deleteEmployee,
    getSettings,
    saveSettings,
    exportData,
    importData,
  };

})();
