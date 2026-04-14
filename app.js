// Gemini key comes from user's browser localStorage (set at signup or via voice prompt)
// DO NOT hardcode a key here — each user stores their own
let GEMINI_KEY = '';

const App = {
  view: 'all',
  empFilter: null,
  search: '',
  priority: '',
  sortKey: 'dueDate',
  sortDir: 'asc',
  editId: null,
  voiceParsed: null,
  _tasks: [],
  _employees: [],
  _companies: [],
  _settings: {},
};

const $ = id => document.getElementById(id);

const el = {
  main:           $('main'),
  sidebar:        $('sidebar'),
  mobOverlay:     $('mobOverlay'),
  sidebarClose:   $('sidebarCloseBtn'),
  mobMenuBtn:     $('mobMenuBtn'),
  darkToggle:     $('darkToggle'),
  sunIcon:        $('sunIcon'),
  moonIcon:       $('moonIcon'),
  pageTitle:      $('pageTitle'),
  pageSub:        $('pageSubtitle'),
  searchInput:    $('searchInput'),
  priorityFilter: $('priorityFilter'),
  addTaskBtn:     $('addTaskBtn'),
  employeeNav:    $('employeeNav'),
  addEmpBtn:      $('addEmployeeBtn'),
  taskTable:      $('taskTable'),
  taskBody:       $('taskBody'),
  emptyState:     $('emptyState'),
  taskModal:      $('taskModal'),
  modalTitle:     $('modalTitle'),
  modalClose:     $('modalClose'),
  modalCancel:    $('modalCancel'),
  modalSave:      $('modalSave'),
  taskTitle:      $('taskTitle'),
  taskDesc:       $('taskDesc'),
  taskAssignee:   $('taskAssignee'),
  taskPriority:   $('taskPriority'),
  taskAssigned:   $('taskAssignedDate'),
  taskDue:        $('taskDueDate'),
  taskTags:       $('taskTags'),
  empModal:       $('employeeModal'),
  empModalClose:  $('empModalClose'),
  empModalCancel: $('empModalCancel'),
  empModalSave:   $('empModalSave'),
  empName:        $('empName'),
  empRole:        $('empRole'),
  drawerBg:       $('drawerBg'),
  drawer:         $('taskDrawer'),
  drawerClose:    $('drawerClose'),
  drawerTitle:    $('drawerTaskTitle'),
  drawerBody:     $('drawerBody'),
  voiceBtn:       $('voiceBtn'),
  vpOverlay:      $('vpOverlay'),
  voicePanel:     $('voicePanel'),
  vpClose:        $('vpClose'),
  vpMic:          $('vpMicBtn'),
  vpTranscript:   $('vpTranscript'),
  vpParsed:       $('vpParsed'),
  vpStatus:       $('vpStatus'),
  vpActions:      $('vpActions'),
  vpRetry:        $('vpRetry'),
  vpConfirm:      $('vpConfirm'),
  toast:          $('toast'),
  addCompanyBtn:  $('addCompanyBtn'),
  companyNav:     $('companyNav'),
  taskCompany:    $('taskCompany'),
  coModal:        $('companyModal'),
  coModalClose:   $('coModalClose'),
  coModalCancel:  $('coModalCancel'),
  coModalSave:    $('coModalSave'),
  coName:         $('coName'),
  exportBtn:      $('exportBtn'),
};

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth gate — redirects to login.html if no valid session
  const ok = await Auth.init();
  if (!ok) return;

  // Per-user Gemini key from localStorage
  GEMINI_KEY = Auth.getGeminiKey();

  // Populate user info in sidebar
  const name = App._settings?.managerName || Auth.getUserName();
  const nameEl = $('userNameSidebar');
  const avEl   = $('userAvatar');
  if (nameEl) nameEl.textContent = name;
  if (avEl)   avEl.textContent   = name[0].toUpperCase();

  init();
});

async function init() {
  el.taskAssigned.value = today();
  loadTheme();
  bindEvents();
  await refreshCache();

  // Sync manager name from auth metadata if not yet in settings
  if (!App._settings.managerName) {
    App._settings.managerName = Auth.getUserName();
    await Storage.saveSettings({ managerName: App._settings.managerName });
  }

  renderAll();
}

async function refreshCache() {
  [App._tasks, App._employees, App._settings, App._companies] = await Promise.all([
    Storage.getAllTasks(),
    Storage.getEmployees(),
    Storage.getSettings(),
    Storage.getCompanies(),
  ]);
  await purgeOldCompletedTasks();
}

async function purgeOldCompletedTasks() {
  if (!Array.isArray(App._tasks) || !App._tasks.length) return;
  const cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
  const expired = App._tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt).getTime() < cutoff);
  if (!expired.length) return;
  await Promise.all(expired.map(t => Storage.deleteTask(t.id)));
  App._tasks = await Storage.getAllTasks();
}

// ── EVENTS ────────────────────────────────────────────────
function bindEvents() {
  el.mobMenuBtn.addEventListener('click', toggleSidebar);
  el.sidebarClose.addEventListener('click', toggleSidebar);
  el.mobOverlay.addEventListener('click', closeMobSidebar);
  el.darkToggle.addEventListener('click', toggleDark);
  el.exportBtn.addEventListener('click', () => openExportModal());

  document.querySelectorAll('.nav-link[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      setView(a.dataset.view);
      if (window.innerWidth <= 900) closeMobSidebar();
    });
  });

  el.addTaskBtn.addEventListener('click', () => openTaskModal());
  el.addEmpBtn.addEventListener('click', () => openEmpModal());

  el.modalClose.addEventListener('click', closeTaskModal);
  el.modalCancel.addEventListener('click', closeTaskModal);
  el.modalSave.addEventListener('click', saveTask);
  el.taskModal.addEventListener('click', e => { if (e.target === el.taskModal) closeTaskModal(); });

  el.empModalClose.addEventListener('click', closeEmpModal);
  el.empModalCancel.addEventListener('click', closeEmpModal);
  el.empModalSave.addEventListener('click', saveEmployee);
  el.empModal.addEventListener('click', e => { if (e.target === el.empModal) closeEmpModal(); });

  el.drawerClose.addEventListener('click', closeDrawer);
  el.drawerBg.addEventListener('click', closeDrawer);

  el.searchInput.addEventListener('input', () => { App.search = el.searchInput.value.toLowerCase(); renderTasks(); });
  el.priorityFilter.addEventListener('change', () => { App.priority = el.priorityFilter.value; renderTasks(); });

  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      App.sortDir = App.sortKey === key ? (App.sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      App.sortKey = key;
      document.querySelectorAll('.sa').forEach(s => s.textContent = '↕');
      th.querySelector('.sa').textContent = App.sortDir === 'asc' ? '↑' : '↓';
      renderTasks();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeTaskModal(); closeEmpModal(); closeCoModal(); closeDrawer(); closeVoicePanel(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openTaskModal(); }
  });

  el.voiceBtn.addEventListener('click', toggleVoicePanel);
  el.vpClose.addEventListener('click', closeVoicePanel);
  el.vpOverlay.addEventListener('click', closeVoicePanel);
  el.vpMic.addEventListener('click', startVoice);
  el.vpRetry.addEventListener('click', resetVoice);
  el.vpConfirm.addEventListener('click', confirmVoiceTask);

  el.addCompanyBtn.addEventListener('click', () => openCoModal());
  el.coModalClose.addEventListener('click', closeCoModal);
  el.coModalCancel.addEventListener('click', closeCoModal);
  el.coModalSave.addEventListener('click', saveCompany);
  el.coModal.addEventListener('click', e => { if (e.target === el.coModal) closeCoModal(); });
}

// ── THEME ─────────────────────────────────────────────────
function loadTheme() { applyTheme(localStorage.getItem('tf_theme') || 'light'); }
function toggleDark() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tf_theme', theme);
  el.sunIcon.style.display  = theme === 'dark' ? 'none' : '';
  el.moonIcon.style.display = theme === 'dark' ? '' : 'none';
}

// ── SIDEBAR ───────────────────────────────────────────────
function toggleSidebar() {
  if (window.innerWidth <= 900) {
    el.sidebar.classList.toggle('mob-open');
    el.mobOverlay.classList.toggle('show', el.sidebar.classList.contains('mob-open'));
  } else {
    el.sidebar.classList.toggle('collapsed');
    el.main.classList.toggle('sidebar-collapsed');
  }
}
function closeMobSidebar() {
  el.sidebar.classList.remove('mob-open');
  el.mobOverlay.classList.remove('show');
}

// ── VIEW ──────────────────────────────────────────────────
const viewMeta = {
  all:       ['All Tasks',  'Track and manage all tasks'],
  my:        ['My Tasks',   'Tasks assigned to you'],
  team:      ['Team Tasks', 'Tasks assigned to your team'],
  overdue:   ['Overdue',    'Tasks past their due date'],
  completed: ['Completed',  'Tasks marked done'],
};

function setView(view, empId = null) {
  App.view = view;
  App.empFilter = empId;

  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  if (!empId) {
    document.querySelector(`.nav-link[data-view="${view}"]`)?.classList.add('active');
  } else {
    document.querySelector(`.nav-link[data-emp="${empId}"]`)?.classList.add('active');
  }

  if (empId) {
    const emp = App._employees.find(e => e.id === empId);
    const co  = App._companies.find(c => c.id === empId);
    if (co) {
      el.pageTitle.textContent = co.name;
      el.pageSub.textContent = 'Company tasks';
    } else {
      el.pageTitle.textContent = emp ? `${emp.name}'s Tasks` : 'Employee Tasks';
      el.pageSub.textContent = emp?.role || 'Employee';
    }
  }

  renderTasks();
}

// ── RENDER ALL ────────────────────────────────────────────
function renderAll() {
  renderEmpNav();
  renderAssigneeDropdown();
  renderCompanyNav();
  renderCompanyDropdown();
  renderTasks();
  renderStats();
  renderBadges();
}

// ── EMPLOYEE NAV ──────────────────────────────────────────
function renderEmpNav() {
  el.employeeNav.innerHTML = '';
  App._employees.forEach(emp => {
    const open = App._tasks.filter(t => t.assignee === emp.id && !t.completed).length;
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="#" class="nav-link nav-link-emp" data-emp="${emp.id}">
        <div class="av-nav" style="background:${strColor(emp.name)}">${emp.name[0].toUpperCase()}</div>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(emp.name)}</span>
        ${open ? `<span class="nb">${open}</span>` : ''}
        <button class="emp-del" data-id="${emp.id}" title="Remove">×</button>
      </a>`;
    li.querySelector('.nav-link-emp').addEventListener('click', e => {
      if (e.target.classList.contains('emp-del')) return;
      e.preventDefault();
      setView('employee', emp.id);
      closeMobSidebar();
    });
    li.querySelector('.emp-del').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`Remove ${emp.name}?`)) return;
      await Promise.all(App._tasks.filter(t => t.assignee === emp.id).map(t => Storage.saveTask({ ...t, assignee: 'me' })));
      await Storage.deleteEmployee(emp.id);
      if (App.empFilter === emp.id) setView('all');
      await refreshCache();
      renderAll();
      toast(`${emp.name} removed`);
    });
    el.employeeNav.appendChild(li);
  });
}

// ── ASSIGNEE DROPDOWN ─────────────────────────────────────
function renderAssigneeDropdown() {
  el.taskAssignee.innerHTML = `<option value="me">${esc(App._settings.managerName || 'You')} (Manager)</option>`;
  App._employees.forEach(emp => {
    const o = document.createElement('option');
    o.value = emp.id;
    o.textContent = emp.name + (emp.role ? ` — ${emp.role}` : '');
    el.taskAssignee.appendChild(o);
  });
}

// ── COMPANY NAV ──────────────────────────────────────────
function renderCompanyNav() {
  el.companyNav.innerHTML = '';
  App._companies.forEach(co => {
    const count = App._tasks.filter(t => t.company === co.id && !t.completed).length;
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="#" class="nav-link nav-link-co" data-co="${co.id}">
        <svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="15" rx="1.5"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(co.name)}</span>
        ${count ? `<span class="nb">${count}</span>` : ''}
        <button class="emp-del" data-id="${co.id}" title="Remove">×</button>
      </a>`;
    li.querySelector('.nav-link-co').addEventListener('click', e => {
      if (e.target.classList.contains('emp-del')) return;
      e.preventDefault();
      setView('company', co.id);
      closeMobSidebar();
    });
    li.querySelector('.emp-del').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`Remove ${co.name}?`)) return;
      // strip company from its tasks
      await Promise.all(App._tasks.filter(t => t.company === co.id).map(t => Storage.saveTask({ ...t, company: '' })));
      await Storage.deleteCompany(co.id);
      if (App.empFilter === co.id) setView('all');
      await refreshCache();
      renderAll();
      toast(`${co.name} removed`);
    });
    el.companyNav.appendChild(li);
  });
}

// ── COMPANY DROPDOWN ─────────────────────────────────────
function renderCompanyDropdown() {
  el.taskCompany.innerHTML = '<option value="">No Company</option>';
  App._companies.forEach(co => {
    const o = document.createElement('option');
    o.value = co.id;
    o.textContent = co.name;
    el.taskCompany.appendChild(o);
  });
}

// ── TASK TABLE ────────────────────────────────────────────
function renderTasks() {
  let tasks = [...App._tasks];

  if (App.view === 'my')             tasks = tasks.filter(t => t.assignee === 'me');
  else if (App.view === 'team')      tasks = tasks.filter(t => t.assignee !== 'me');
  else if (App.view === 'overdue')   tasks = tasks.filter(t => !t.completed && isOverdue(t.dueDate));
  else if (App.view === 'completed') tasks = tasks.filter(t => t.completed);
  else if (App.view === 'employee' && App.empFilter) tasks = tasks.filter(t => t.assignee === App.empFilter);
  else if (App.view === 'company' && App.empFilter) tasks = tasks.filter(t => t.company === App.empFilter);

  if (App.search) tasks = tasks.filter(t =>
    t.title.toLowerCase().includes(App.search) ||
    (t.description || '').toLowerCase().includes(App.search) ||
    (t.tags || []).some(tag => tag.toLowerCase().includes(App.search))
  );
  if (App.priority) tasks = tasks.filter(t => t.priority === App.priority);

  const priOrder = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const av = App.sortKey === 'priority' ? (priOrder[a.priority] ?? 1) : (a[App.sortKey] || '');
    const bv = App.sortKey === 'priority' ? (priOrder[b.priority] ?? 1) : (b[App.sortKey] || '');
    if (av < bv) return App.sortDir === 'asc' ? -1 : 1;
    if (av > bv) return App.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (!tasks.length) {
    el.taskTable.style.display = 'none';
    el.emptyState.style.display = 'flex';
    return;
  }

  el.taskTable.style.display = '';
  el.emptyState.style.display = 'none';
  el.taskBody.innerHTML = tasks.map(taskRow).join('');

  el.taskBody.querySelectorAll('.t-chk').forEach(cb => {
    cb.addEventListener('change', async () => {
      const was = App._tasks.find(t => t.id === cb.dataset.id);
      await Storage.toggleTaskComplete(cb.dataset.id);
      await refreshCache();
      renderAll();
      toast(was?.completed ? 'Reopened' : '✓ Completed');
    });
  });

  el.taskBody.querySelectorAll('tr.t-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.row-acts') || e.target.classList.contains('t-chk')) return;
      openDrawer(row.dataset.id);
    });
  });

  el.taskBody.querySelectorAll('.ra-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openTaskModal(btn.dataset.id); });
  });

  el.taskBody.querySelectorAll('.ra-del').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Delete this task?')) return;
      await Storage.deleteTask(btn.dataset.id);
      await refreshCache();
      renderAll();
      toast('Task deleted');
    });
  });
}

function taskRow(t) {
  const si  = statusInfo(t);
  const who = getAssigneeName(t.assignee);
  const tags = (t.tags || []).map(g => `<span class="tag">${esc(g)}</span>`).join('');
  return `
    <tr class="t-row ${si.rowCls}" data-id="${t.id}">
      <td class="tc-chk"><input type="checkbox" class="t-chk" data-id="${t.id}" ${t.completed ? 'checked' : ''}></td>
      <td class="tc-task">
        <div class="t-cell">
          <span class="t-title">${esc(t.title)}</span>
          ${tags ? `<div class="t-tags">${tags}</div>` : ''}
        </div>
      </td>
      <td class="tc-who">
        <div class="who-chip">
          <div class="who-av" style="background:${t.assignee === 'me' ? 'var(--indigo)' : strColor(who)}">${who[0].toUpperCase()}</div>
          <span class="who-name">${esc(who)}</span>
        </div>
      </td>
      <td class="tc-pri"><span class="badge bp-${t.priority}">${capFirst(t.priority)}</span></td>
      <td class="tc-date hide-sm"><span class="dt">${fmtDate(t.assignedDate)}</span></td>
      <td class="tc-date"><span class="dt ${si.dtCls}">${fmtDate(t.dueDate)}</span></td>
      <td class="tc-status hide-sm"><span class="badge ${si.badgeCls}">${si.label}</span></td>
      <td class="tc-act">
        <div class="row-acts">
          <button class="ra-btn ra-edit" data-id="${t.id}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
          </button>
          <button class="ra-btn ra-del" data-id="${t.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

// ── STATS & BADGES ────────────────────────────────────────
function renderStats() {
  const all = App._tasks;
  animateCounter($('stat-total'),   all.length);
  animateCounter($('stat-active'),  all.filter(t => !t.completed).length);
  animateCounter($('stat-overdue'), all.filter(t => !t.completed && isOverdue(t.dueDate)).length);
  animateCounter($('stat-soon'),    all.filter(t => !t.completed && isDueSoon(t.dueDate)).length);
  animateCounter($('stat-done'),    all.filter(t => t.completed).length);
}

function renderBadges() {
  const all = App._tasks;
  $('badge-all').textContent       = all.filter(t => !t.completed).length;
  $('badge-my').textContent        = all.filter(t => t.assignee === 'me' && !t.completed).length;
  $('badge-team').textContent      = all.filter(t => t.assignee !== 'me' && !t.completed).length;
  $('badge-overdue').textContent   = all.filter(t => !t.completed && isOverdue(t.dueDate)).length;
  $('badge-completed').textContent = all.filter(t => t.completed).length;
}

// ── TASK MODAL ────────────────────────────────────────────
function openTaskModal(id = null) {
  App.editId = id;
  renderAssigneeDropdown();

  if (id) {
    const t = App._tasks.find(t => t.id === id);
    if (!t) return;
    el.modalTitle.textContent = 'Edit Task';
    el.taskTitle.value    = t.title;
    el.taskDesc.value     = t.description || '';
    el.taskAssignee.value = t.assignee;
    el.taskPriority.value = t.priority;
    el.taskAssigned.value = t.assignedDate || '';
    el.taskDue.value      = t.dueDate || '';
    el.taskCompany.value  = t.company || '';
    el.taskTags.value     = (t.tags || []).join(', ');
  } else {
    el.modalTitle.textContent = 'New Task';
    el.taskTitle.value    = '';
    el.taskDesc.value     = '';
    el.taskAssignee.value = 'me';
    el.taskPriority.value = 'medium';
    el.taskCompany.value  = '';
    el.taskAssigned.value = today();
    el.taskDue.value      = '';
    el.taskTags.value     = '';
  }

  el.taskModal.classList.add('open');
  setTimeout(() => el.taskTitle.focus(), 80);
}

function closeTaskModal() { el.taskModal.classList.remove('open'); App.editId = null; }

async function saveTask() {
  const title = el.taskTitle.value.trim();
  if (!title) { shake(el.taskTitle); return; }
  const due = el.taskDue.value;
  if (!due) { shake(el.taskDue); return; }

  const tags = el.taskTags.value.trim()
    ? el.taskTags.value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const data = {
    title, description: el.taskDesc.value.trim(),
    assignee: el.taskAssignee.value, priority: el.taskPriority.value,
    assignedDate: el.taskAssigned.value, dueDate: due, tags,
    company: el.taskCompany.value,
  };

  const currentEditId = App.editId;
  closeTaskModal();
  toast('Saving…');

  if (currentEditId) {
    const existing = App._tasks.find(t => t.id === currentEditId) || {};
    const updated = { ...existing, ...data, id: currentEditId };
    await Storage.saveTask(updated);
    toast('Task updated ✓');
  } else {
    await Storage.saveTask(data);
    toast('Task added ✓');
  }

  await refreshCache();
  renderAll();
}

// ── EMPLOYEE MODAL ────────────────────────────────────────
function openEmpModal() {
  el.empName.value = ''; el.empRole.value = '';
  el.empModal.classList.add('open');
  setTimeout(() => el.empName.focus(), 80);
}
function closeEmpModal() { el.empModal.classList.remove('open'); }

async function saveEmployee() {
  const name = el.empName.value.trim();
  if (!name) { shake(el.empName); return; }
  closeEmpModal();
  toast('Saving…');
  await Storage.saveEmployee({ name, role: el.empRole.value.trim() });
  await refreshCache();
  renderAll();
  toast(`${name} added ✓`);
}

// ── COMPANY MODAL ────────────────────────────────────────
function openCoModal() {
  el.coName.value = '';
  el.coModal.classList.add('open');
  setTimeout(() => el.coName.focus(), 80);
}
function closeCoModal() { el.coModal.classList.remove('open'); }

async function saveCompany() {
  const name = el.coName.value.trim();
  if (!name) { shake(el.coName); return; }
  closeCoModal();
  toast('Saving…');
  await Storage.saveCompany({ name });
  await refreshCache();
  renderAll();
  toast(`${name} added ✓`);
}

let exportFormat = 'csv';

function openExportModal() {
  closeMobSidebar();
  document.getElementById('exportModalOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'exportModalOverlay';
  overlay.className = 'modal-overlay open';

  const empOptions = App._employees.map(e =>
    `<option value="emp:${e.id}">${esc(e.name)}</option>`).join('');
  const coOptions = App._companies.map(c =>
    `<option value="co:${c.id}">${esc(c.name)}</option>`).join('');

  overlay.innerHTML = `
    <div class="modal export-modal">
      <div class="modal-hd">
        <h2 class="modal-ttl">Export Tasks</h2>
        <button class="icon-btn" id="exportModalClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body" style="gap:16px">
        <div class="export-section">
          <label class="fl">Which tasks?</label>
          <select class="fi" id="exportScope">
            <option value="all">All Tasks</option>
            <option value="my">My Tasks</option>
            <option value="team">Team Tasks</option>
            <option value="overdue">Overdue Only</option>
            <option value="completed">Completed Only</option>
            ${empOptions ? `<optgroup label="By Employee">${empOptions}</optgroup>` : ''}
            ${coOptions  ? `<optgroup label="By Company">${coOptions}</optgroup>`  : ''}
          </select>
        </div>
        <div class="export-section">
          <label class="fl">Format</label>
          <div class="format-toggle">
            <button id="fmtCsv" class="active" onclick="setExportFmt('csv')">CSV</button>
            <button id="fmtXls" onclick="setExportFmt('xlsx')">Excel (.xls)</button>
          </div>
        </div>
      </div>
      <div class="modal-ft">
        <button class="btn-ghost" id="exportModalClose2">Cancel</button>
        <button class="btn-primary" id="exportConfirm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('exportModalClose').addEventListener('click', close);
  document.getElementById('exportModalClose2').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('exportConfirm').addEventListener('click', () => {
    runExport(document.getElementById('exportScope').value, exportFormat);
    close();
  });

  // reset format toggle to current
  setExportFmt(exportFormat);
}

window.setExportFmt = function(fmt) {
  exportFormat = fmt;
  document.getElementById('fmtCsv')?.classList.toggle('active', fmt === 'csv');
  document.getElementById('fmtXls')?.classList.toggle('active', fmt === 'xlsx');
};

function runExport(scope, format) {
  let tasks = [...App._tasks];

  if      (scope === 'my')        tasks = tasks.filter(t => t.assignee === 'me');
  else if (scope === 'team')      tasks = tasks.filter(t => t.assignee !== 'me');
  else if (scope === 'overdue')   tasks = tasks.filter(t => !t.completed && isOverdue(t.dueDate));
  else if (scope === 'completed') tasks = tasks.filter(t => t.completed);
  else if (scope.startsWith('emp:')) {
    const id = scope.slice(4);
    tasks = tasks.filter(t => t.assignee === id);
  } else if (scope.startsWith('co:')) {
    const id = scope.slice(3);
    tasks = tasks.filter(t => t.company === id);
  }

  const headers = ['Title','Description','Assignee','Company','Priority','Status','Assigned Date','Due Date','Tags','Completed','Created'];
  const rows = tasks.map(t => {
    const si = statusInfo(t);
    return [
      t.title,
      t.description || '',
      getAssigneeName(t.assignee),
      App._companies.find(c => c.id === t.company)?.name || '',
      capFirst(t.priority),
      si.label,
      fmtDate(t.assignedDate),
      fmtDate(t.dueDate),
      (t.tags || []).join(', '),
      t.completed ? 'Yes' : 'No',
      fmtDatetime(t.createdAt),
    ];
  });

  if (format === 'csv') {
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
      .join('\n');
    download('taskflow-export.csv', 'text/csv', csv);
  } else {
    const xls = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Tasks"><Table>
    ${[headers, ...rows].map(row =>
      `<Row>${row.map(v =>
        `<Cell><Data ss:Type="String">${String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Data></Cell>`
      ).join('')}</Row>`
    ).join('\n    ')}
  </Table></Worksheet>
</Workbook>`;
    download('taskflow-export.xls', 'application/vnd.ms-excel', xls);
  }
}

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Downloaded ${filename}`);
}

// ── DRAWER ────────────────────────────────────────────────
function openDrawer(id) {
  const t = App._tasks.find(t => t.id === id);
  if (!t) return;
  const si  = statusInfo(t);
  const who = getAssigneeName(t.assignee);

  el.drawerTitle.textContent = t.title;
  el.drawerBody.innerHTML = `
    <div class="d-row">
      <div class="d-field"><div class="d-label">Status</div><span class="badge ${si.badgeCls}">${si.label}</span></div>
      <div class="d-field"><div class="d-label">Priority</div><span class="badge bp-${t.priority}">${capFirst(t.priority)}</span></div>
    </div>
    <div class="d-field">
      <div class="d-label">Assignee</div>
      <div class="who-chip" style="margin-top:4px">
        <div class="who-av" style="background:${t.assignee === 'me' ? 'var(--indigo)' : strColor(who)}">${who[0].toUpperCase()}</div>
        <span class="who-name">${esc(who)}</span>
      </div>
    </div>
    <div class="d-row">
      <div class="d-field"><div class="d-label">Assigned</div><div class="d-val">${fmtDate(t.assignedDate)}</div></div>
      <div class="d-field"><div class="d-label">Due Date</div><div class="d-val ${si.dtCls}">${fmtDate(t.dueDate)}</div></div>
    </div>
    ${t.completedAt ? `<div class="d-field"><div class="d-label">Completed</div><div class="d-val">${fmtDatetime(t.completedAt)}</div></div>` : ''}
    ${t.description ? `<div class="d-field"><div class="d-label">Description</div><div class="d-desc" style="margin-top:4px">${esc(t.description)}</div></div>` : ''}
    ${t.company ? (() => { const co = App._companies.find(c => c.id === t.company); return co ? `<div class="d-field"><div class="d-label">Company</div><div class="d-val">${esc(co.name)}</div></div>` : ''; })() : ''}
    ${(t.tags||[]).length ? `<div class="d-field"><div class="d-label">Tags</div><div class="t-tags" style="margin-top:4px">${t.tags.map(g=>`<span class="tag">${esc(g)}</span>`).join('')}</div></div>` : ''}
    <div class="d-field"><div class="d-label">Created</div><div class="d-val">${fmtDatetime(t.createdAt)}</div></div>
    <div class="d-acts">
      <button class="btn-primary" onclick="openTaskModal('${t.id}');closeDrawer()">Edit Task</button>
      <button class="${t.completed ? 'btn-ghost' : 'btn-success'}" onclick="toggleDrawer('${t.id}')">
        ${t.completed ? 'Reopen Task' : '✓ Mark Complete'}
      </button>
    </div>`;

  el.drawer.classList.add('open');
  el.drawerBg.classList.add('show');
}

function closeDrawer() {
  el.drawer.classList.remove('open');
  el.drawerBg.classList.remove('show');
}

window.toggleDrawer = async id => {
  const was = App._tasks.find(t => t.id === id);
  await Storage.toggleTaskComplete(id);
  closeDrawer();
  await refreshCache();
  renderAll();
  toast(was?.completed ? 'Reopened' : '✓ Completed');
};

// ── VOICE ─────────────────────────────────────────────────
let recognition = null;

function toggleVoicePanel() {
  el.voicePanel.classList.contains('show') ? closeVoicePanel() : openVoicePanel();
}
function openVoicePanel() {
  // If no Gemini key, ask the user to set one first
  if (!GEMINI_KEY) {
    Auth.promptGeminiKey(key => {
      if (key) {
        GEMINI_KEY = key;
        _doOpenVoicePanel();
      }
      // If skipped, open anyway — regex fallback will be used
      else {
        _doOpenVoicePanel();
      }
    });
    return;
  }
  _doOpenVoicePanel();
}

function _doOpenVoicePanel() {
  el.voicePanel.classList.add('show');
  el.vpOverlay.classList.add('show');
  el.voiceBtn.classList.add('active');
}
function closeVoicePanel() {
  try { recognition?.stop(); } catch(e) {}
  el.voicePanel.classList.remove('show');
  el.vpOverlay.classList.remove('show');
  el.voiceBtn.classList.remove('active');
  resetVoice();
}
function resetVoice() {
  el.vpTranscript.textContent = 'Tap the mic to start…';
  el.vpParsed.style.display = 'none';
  el.vpActions.style.display = 'none';
  el.vpStatus.textContent = 'Ready';
  el.vpMic.classList.remove('recording');
  App.voiceParsed = null;
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { el.vpTranscript.textContent = 'Not supported — try Chrome or Edge.'; return; }
  if (el.vpMic.classList.contains('recording')) { recognition.stop(); return; }

  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = true;

  el.vpMic.classList.add('recording');
  el.vpStatus.textContent = 'Listening…';
  el.vpTranscript.textContent = '…';
  el.vpParsed.style.display = 'none';
  el.vpActions.style.display = 'none';
  App.voiceParsed = null;

  recognition.onresult = e => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ');
    el.vpTranscript.textContent = transcript;
    if (e.results[e.results.length - 1].isFinal) {
      el.vpMic.classList.remove('recording');
      el.vpStatus.textContent = 'Processing…';
      parseVoiceInput(transcript);
    }
  };
  recognition.onerror = e => { el.vpMic.classList.remove('recording'); el.vpStatus.textContent = `Error: ${e.error}`; };
  recognition.onend   = () => { el.vpMic.classList.remove('recording'); if (el.vpStatus.textContent === 'Listening…') el.vpStatus.textContent = 'Ready'; };
  recognition.start();
}

async function parseVoiceInput(text) {
  const empList = App._employees.map(e => `${e.id}:${e.name}`).join(', ') || 'none';
  const coList = App._companies.map(c => `${c.id}:${c.name}`).join(', ') || 'none';

  if (GEMINI_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text:
          `Extract task details from this voice input. Return ONLY valid JSON, no markdown, no backticks.
Voice: "${text}"
Today: ${today()}
Employees (id:name): ${empList}
Companies (id:name): ${coList}
Return: {"title":"...","assigneeId":"me or exact employee id","priority":"high|medium|low","dueDate":"YYYY-MM-DD or empty string","companyId":"matching company id or empty string"}
- title: the task only, clean
- assigneeId: fuzzy-match name to list by id. If no match use "me"
- priority: high=urgent/critical/asap, low=whenever/no rush, else medium
- dueDate: resolve relative dates to YYYY-MM-DD, empty string if none`
        }] }] })
      });
      const data = await res.json();
      const parsed = JSON.parse(data.candidates[0].content.parts[0].text.trim());
      App.voiceParsed = parsed;
      showVoicePreview();
      return;
    } catch(e) { /* fall through to regex */ }
  }

  // Regex fallback
  const t = text.toLowerCase();
  let priority = 'medium';
  if (/\bhigh\b|\burgent\b|\bcritical\b|\basap\b/.test(t)) priority = 'high';
  else if (/\blow\b|\bwhenever\b|\bno rush\b/.test(t)) priority = 'low';

  let assigneeId = 'me';
  for (const emp of App._employees) {
    if (t.includes(emp.name.toLowerCase()) || t.includes(emp.name.split(' ')[0].toLowerCase())) {
      assigneeId = emp.id; break;
    }
  }

  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  let dueDate = '';
  const now = new Date();
  const ndm = t.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  const idm = t.match(/in\s+(\d+)\s+days?/);
  if      (/\btoday\b/.test(t))    dueDate = today();
  else if (/\btomorrow\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate()+1); dueDate = toDateStr(d); }
  else if (ndm) { const d = new Date(now); let df = days.indexOf(ndm[1]) - d.getDay(); if(df<=0)df+=7; d.setDate(d.getDate()+df); dueDate = toDateStr(d); }
  else if (idm) { const d = new Date(now); d.setDate(d.getDate()+parseInt(idm[1])); dueDate = toDateStr(d); }
  else if (/end\s+of\s+(the\s+)?week/.test(t)) { const d = new Date(now); const df=(5-d.getDay()+7)%7||7; d.setDate(d.getDate()+df); dueDate = toDateStr(d); }
  else if (/next\s+week/.test(t))  { const d = new Date(now); d.setDate(d.getDate()+7); dueDate = toDateStr(d); }

  let title = text;
  [/,?\s*assign(ed)?\s+to\s+[\w\s]+/gi, /,?\s*(high|medium|low|urgent|critical|asap)\s+priority/gi,
   /,?\s*priority\s+(high|medium|low)/gi, /,?\s*due\s+(next|this|on|by)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|today|tomorrow|\d)/gi,
   /,?\s*in\s+\d+\s+days?/gi, /,?\s*(next|end\s+of\s+(the\s+)?)\s*week/gi,
  ].forEach(p => { title = title.replace(p, ''); });
  for (const emp of App._employees) {
    title = title.replace(new RegExp(`,?\\s*(for|assign to|give to)\\s+${emp.name}`, 'gi'), '');
  }
  title = title.replace(/\s{2,}/g,' ').replace(/^[,\s]+|[,\s]+$/g,'').trim();
  if (title) title = title[0].toUpperCase() + title.slice(1);

  let companyId = '';
  for (const co of App._companies) {
    if (t.includes(co.name.toLowerCase())) { companyId = co.id; break; }
  }

  App.voiceParsed = { title, assigneeId, priority, dueDate, companyId };
  showVoicePreview();
}

function showVoicePreview() {
  const p = App.voiceParsed;
  const whoName = p.assigneeId === 'me'
    ? (App._settings.managerName || 'You')
    : (App._employees.find(e => e.id === p.assigneeId)?.name || 'You');
  el.vpParsed.innerHTML = `
    <strong>Task:</strong> ${esc(p.title || '—')}<br>
    <strong>Assignee:</strong> ${esc(whoName)}<br>
    <strong>Priority:</strong> ${capFirst(p.priority)}<br>
    <strong>Due:</strong> ${p.dueDate ? fmtDate(p.dueDate) : 'Not detected'}<br>
    ${p.companyId ? `<strong>Company:</strong> ${esc(App._companies.find(c => c.id === p.companyId)?.name || '')}` : ''}`;
  el.vpParsed.style.display = 'block';
  el.vpActions.style.display = 'flex';
  el.vpStatus.textContent = 'Review and confirm';
}

async function confirmVoiceTask() {
  const p = App.voiceParsed;
  if (!p?.title) { toast('No title detected — try again'); return; }
  closeVoicePanel();
  toast('Saving…');
  await Storage.saveTask({
    title: p.title, description: '',
    assignee: p.assigneeId || 'me',
    priority: p.priority || 'medium',
    assignedDate: today(), dueDate: p.dueDate || '', tags: [],
    company: p.companyId || '',
  });
  await refreshCache();
  renderAll();
  toast('Task added ✓');
}

// ── HELPERS ───────────────────────────────────────────────
function statusInfo(t) {
  if (t.completed)          return { label: 'Done',     badgeCls: 'b-done', dtCls: '',        rowCls: 'row-done' };
  if (!t.dueDate)           return { label: 'No Date',  badgeCls: 'b-none', dtCls: '',        rowCls: '' };
  if (isOverdue(t.dueDate)) return { label: 'Overdue',  badgeCls: 'b-over', dtCls: 'dt-over', rowCls: 'row-overdue' };
  if (isDueSoon(t.dueDate)) return { label: 'Due Soon', badgeCls: 'b-soon', dtCls: 'dt-soon', rowCls: 'row-soon' };
  return                           { label: 'On Track', badgeCls: 'b-ok',   dtCls: '',        rowCls: '' };
}

function getAssigneeName(id) {
  if (id === 'me') return App._settings.managerName || 'You';
  return App._employees.find(e => e.id === id)?.name || 'Unknown';
}

function isOverdue(d) { return d && new Date(d) < new Date(today()); }
function isDueSoon(d) {
  if (!d) return false;
  const diff = (new Date(d) - new Date(today())) / 86400000;
  return diff >= 0 && diff <= 3;
}

function today()         { return new Date().toISOString().split('T')[0]; }
function toDateStr(d)    { return d.toISOString().split('T')[0]; }
function fmtDate(s)      { if (!s) return '—'; return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtDatetime(s)  { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function esc(s)          { if (!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function capFirst(s)     { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function strColor(s) {
  if (!s) return '#888';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return ['#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#ef4444','#06b6d4','#84cc16'][Math.abs(h) % 8];
}
function shake(input) { input.classList.add('err'); input.focus(); setTimeout(() => input.classList.remove('err'), 700); }

let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
}

function animateCounter(el, target) {
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;
  const t0 = performance.now();
  const tick = now => {
    const p = Math.min((now - t0) / 500, 1);
    el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// DOMContentLoaded is handled at the top of this file via Auth.init()