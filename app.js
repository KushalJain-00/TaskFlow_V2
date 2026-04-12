// ── STATE ─────────────────────────────────────────────────
const App = {
  view: 'all',
  empFilter: null,
  search: '',
  priority: '',
  sortKey: 'dueDate',
  sortDir: 'asc',
  editId: null,
  voiceParsed: null,
};

// ── DOM ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const el = {

  main:          $('main'),

  sidebar:       $('sidebar'),
  mobOverlay:    $('mobOverlay'),
  sidebarClose:  $('sidebarCloseBtn'),
  mobMenuBtn:    $('mobMenuBtn'),
  darkToggle:    $('darkToggle'),
  sunIcon:       $('sunIcon'),
  moonIcon:      $('moonIcon'),

  pageTitle:     $('pageTitle'),
  pageSub:       $('pageSubtitle'),
  searchInput:   $('searchInput'),
  priorityFilter:$('priorityFilter'),
  addTaskBtn:    $('addTaskBtn'),
  employeeNav:   $('employeeNav'),
  addEmpBtn:     $('addEmployeeBtn'),

  taskTable:     $('taskTable'),
  taskBody:      $('taskBody'),
  emptyState:    $('emptyState'),

  taskModal:     $('taskModal'),
  modalTitle:    $('modalTitle'),
  modalClose:    $('modalClose'),
  modalCancel:   $('modalCancel'),
  modalSave:     $('modalSave'),
  taskTitle:     $('taskTitle'),
  taskDesc:      $('taskDesc'),
  taskAssignee:  $('taskAssignee'),
  taskPriority:  $('taskPriority'),
  taskAssigned:  $('taskAssignedDate'),
  taskDue:       $('taskDueDate'),
  taskTags:      $('taskTags'),

  empModal:      $('employeeModal'),
  empModalClose: $('empModalClose'),
  empModalCancel:$('empModalCancel'),
  empModalSave:  $('empModalSave'),
  empName:       $('empName'),
  empRole:       $('empRole'),

  drawerBg:      $('drawerBg'),
  drawer:        $('taskDrawer'),
  drawerClose:   $('drawerClose'),
  drawerTitle:   $('drawerTaskTitle'),
  drawerBody:    $('drawerBody'),

  voiceBtn:      $('voiceBtn'),
  vpOverlay:     $('vpOverlay'),
  voicePanel:    $('voicePanel'),
  vpClose:       $('vpClose'),
  vpMic:         $('vpMicBtn'),
  vpTranscript:  $('vpTranscript'),
  vpParsed:      $('vpParsed'),
  vpStatus:      $('vpStatus'),
  vpActions:     $('vpActions'),
  vpRetry:       $('vpRetry'),
  vpConfirm:     $('vpConfirm'),

  toast:         $('toast'),
};

// ── INIT ──────────────────────────────────────────────────
function init() {
  el.taskAssigned.value = today();
  loadTheme();
  bindEvents();
  renderAll();
}

// ── EVENTS ────────────────────────────────────────────────
function bindEvents() {
  // Mobile sidebar
  el.mobMenuBtn.addEventListener('click', toggleSidebar);
  el.sidebarClose.addEventListener('click', toggleSidebar);
  el.sidebarClose.addEventListener('click', () => closeMobSidebar());
  el.mobOverlay.addEventListener('click', () => closeMobSidebar());

  // Dark mode
  el.darkToggle.addEventListener('click', toggleDark);

  // Nav links (workspace)
  document.querySelectorAll('.nav-link[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      setView(a.dataset.view);
      if (window.innerWidth <= 900) closeMobSidebar();
    });
  });

  // Add task / employee
  el.addTaskBtn.addEventListener('click', () => openTaskModal());
  el.addEmpBtn.addEventListener('click', () => openEmpModal());

  // Task modal
  el.modalClose.addEventListener('click', closeTaskModal);
  el.modalCancel.addEventListener('click', closeTaskModal);
  el.modalSave.addEventListener('click', saveTask);
  el.taskModal.addEventListener('click', e => { if (e.target === el.taskModal) closeTaskModal(); });

  // Employee modal
  el.empModalClose.addEventListener('click', closeEmpModal);
  el.empModalCancel.addEventListener('click', closeEmpModal);
  el.empModalSave.addEventListener('click', saveEmployee);
  el.empModal.addEventListener('click', e => { if (e.target === el.empModal) closeEmpModal(); });

  // Drawer
  el.drawerClose.addEventListener('click', closeDrawer);
  el.drawerBg.addEventListener('click', closeDrawer);

  // Search & filter
  el.searchInput.addEventListener('input', () => { App.search = el.searchInput.value.toLowerCase(); renderTasks(); });
  el.priorityFilter.addEventListener('change', () => { App.priority = el.priorityFilter.value; renderTasks(); });

  // Sort
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

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeTaskModal(); closeEmpModal(); closeDrawer(); closeVoicePanel(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openTaskModal(); }
  });

  // Voice
  el.voiceBtn.addEventListener('click', toggleVoicePanel);
  el.vpClose.addEventListener('click', closeVoicePanel);
  el.vpOverlay.addEventListener('click', closeVoicePanel);
  el.vpMic.addEventListener('click', startVoice);
  el.vpRetry.addEventListener('click', resetVoice);
  el.vpConfirm.addEventListener('click', confirmVoiceTask);
}

// ── DARK MODE ─────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('tf_theme') || 'light';
  applyTheme(saved);
}

function toggleDark() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tf_theme', theme);
  el.sunIcon.style.display  = theme === 'dark' ? 'none' : '';
  el.moonIcon.style.display = theme === 'dark' ? '' : 'none';
}

// ── MOBILE SIDEBAR ────────────────────────────────────────
function toggleSidebar() {
  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    const open = el.sidebar.classList.contains('mob-open');
    el.sidebar.classList.toggle('mob-open', !open);
    el.mobOverlay.classList.toggle('show', !open);
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
  all:       ['All Tasks',      'Track and manage all tasks'],
  my:        ['My Tasks',       'Tasks assigned to you'],
  team:      ['Team Tasks',     'Tasks assigned to your team'],
  overdue:   ['Overdue',        'Tasks past their due date'],
  completed: ['Completed',      'Tasks marked done'],
};

function setView(view, empId = null) {
  App.view = view;
  App.empFilter = empId;

  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  if (!empId) {
    const a = document.querySelector(`.nav-link[data-view="${view}"]`);
    if (a) a.classList.add('active');
  } else {
    const a = document.querySelector(`.nav-link[data-emp="${empId}"]`);
    if (a) a.classList.add('active');
  }

  if (empId) {
    const emp = Storage.getEmployees().find(e => e.id === empId);
    el.pageTitle.textContent = emp ? `${emp.name}'s Tasks` : 'Employee Tasks';
    el.pageSub.textContent = emp?.role || 'Employee';
  } else {
    const meta = viewMeta[view] || ['Tasks', ''];
    el.pageTitle.textContent = meta[0];
    el.pageSub.textContent = meta[1];
  }

  renderTasks();
}

// ── RENDER ALL ────────────────────────────────────────────
function renderAll() {
  renderEmpNav();
  renderAssigneeDropdown();
  renderTasks();
  renderStats();
  renderBadges();
}

// ── EMPLOYEE NAV ──────────────────────────────────────────
function renderEmpNav() {
  const emps = Storage.getEmployees();
  el.employeeNav.innerHTML = '';
  emps.forEach(emp => {
    const open = Storage.getAllTasks().filter(t => t.assignee === emp.id && !t.completed).length;
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
    li.querySelector('.emp-del').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Remove ${emp.name}?`)) return;
      Storage.getAllTasks().filter(t => t.assignee === emp.id).forEach(t => Storage.saveTask({ ...t, assignee: 'me' }));
      Storage.deleteEmployee(emp.id);
      if (App.empFilter === emp.id) setView('all');
      renderAll();
      toast(`${emp.name} removed`);
    });
    el.employeeNav.appendChild(li);
  });
}

// ── ASSIGNEE DROPDOWN ─────────────────────────────────────
function renderAssigneeDropdown() {
  const s = Storage.getSettings();
  el.taskAssignee.innerHTML = `<option value="me">${esc(s.managerName || 'You')} (Manager)</option>`;
  Storage.getEmployees().forEach(emp => {
    const o = document.createElement('option');
    o.value = emp.id;
    o.textContent = emp.name + (emp.role ? ` — ${emp.role}` : '');
    el.taskAssignee.appendChild(o);
  });
}

// ── TASK TABLE ────────────────────────────────────────────
function renderTasks() {
  let tasks = Storage.getAllTasks();

  if (App.view === 'my')        tasks = tasks.filter(t => t.assignee === 'me');
  else if (App.view === 'team') tasks = tasks.filter(t => t.assignee !== 'me');
  else if (App.view === 'overdue')   tasks = tasks.filter(t => !t.completed && isOverdue(t.dueDate));
  else if (App.view === 'completed') tasks = tasks.filter(t => t.completed);
  else if (App.view === 'employee' && App.empFilter) tasks = tasks.filter(t => t.assignee === App.empFilter);

  if (App.search) tasks = tasks.filter(t =>
    t.title.toLowerCase().includes(App.search) ||
    (t.description || '').toLowerCase().includes(App.search) ||
    (t.tags || []).some(tag => tag.toLowerCase().includes(App.search))
  );
  if (App.priority) tasks = tasks.filter(t => t.priority === App.priority);

  const priOrder = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => {
    let av = App.sortKey === 'priority' ? priOrder[a.priority] ?? 1 : (a[App.sortKey] || '');
    let bv = App.sortKey === 'priority' ? priOrder[b.priority] ?? 1 : (b[App.sortKey] || '');
    if (av < bv) return App.sortDir === 'asc' ? -1 : 1;
    if (av > bv) return App.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (!tasks.length) {
    el.taskTable.style.display = 'none';
    el.emptyState.style.display = 'flex';
    renderStats(); renderBadges();
    return;
  }

  el.taskTable.style.display = '';
  el.emptyState.style.display = 'none';
  el.taskBody.innerHTML = tasks.map(taskRow).join('');

  el.taskBody.querySelectorAll('.t-chk').forEach(cb => {
    cb.addEventListener('change', () => {
      const t = Storage.toggleTaskComplete(cb.dataset.id);
      renderAll();
      toast(t.completed ? '✓ Completed' : 'Reopened');
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
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Delete this task?')) return;
      Storage.deleteTask(btn.dataset.id);
      renderAll();
      toast('Task deleted');
    });
  });

  renderStats(); renderBadges();
}

function taskRow(t) {
  const si   = statusInfo(t);
  const who  = assigneeName(t.assignee);
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
  const all = Storage.getAllTasks();
  $('stat-total').textContent   = all.length;
  $('stat-active').textContent  = all.filter(t => !t.completed).length;
  $('stat-overdue').textContent = all.filter(t => !t.completed && isOverdue(t.dueDate)).length;
  $('stat-soon').textContent    = all.filter(t => !t.completed && isDueSoon(t.dueDate)).length;
  $('stat-done').textContent    = all.filter(t => t.completed).length;
}

function renderBadges() {
  const all = Storage.getAllTasks();
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
    const t = Storage.getTaskById(id);
    if (!t) return;
    el.modalTitle.textContent = 'Edit Task';
    el.taskTitle.value    = t.title;
    el.taskDesc.value     = t.description || '';
    el.taskAssignee.value = t.assignee;
    el.taskPriority.value = t.priority;
    el.taskAssigned.value = t.assignedDate || '';
    el.taskDue.value      = t.dueDate || '';
    el.taskTags.value     = (t.tags || []).join(', ');
  } else {
    el.modalTitle.textContent = 'New Task';
    el.taskTitle.value    = '';
    el.taskDesc.value     = '';
    el.taskAssignee.value = 'me';
    el.taskPriority.value = 'medium';
    el.taskAssigned.value = today();
    el.taskDue.value      = '';
    el.taskTags.value     = '';
  }

  el.taskModal.classList.add('open');
  setTimeout(() => el.taskTitle.focus(), 80);
}

function closeTaskModal() { el.taskModal.classList.remove('open'); App.editId = null; }

function saveTask() {
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
  };
  if (App.editId) { data.id = App.editId; Storage.saveTask(data); toast('Task updated ✓'); }
  else { Storage.saveTask(data); toast('Task added ✓'); }

  closeTaskModal();
  renderAll();
}

// ── EMPLOYEE MODAL ────────────────────────────────────────
function openEmpModal() {
  el.empName.value = ''; el.empRole.value = '';
  el.empModal.classList.add('open');
  setTimeout(() => el.empName.focus(), 80);
}
function closeEmpModal() { el.empModal.classList.remove('open'); }

function saveEmployee() {
  const name = el.empName.value.trim();
  if (!name) { shake(el.empName); return; }
  Storage.saveEmployee({ name, role: el.empRole.value.trim() });
  closeEmpModal();
  renderAll();
  toast(`${name} added ✓`);
}

// ── DRAWER ────────────────────────────────────────────────
function openDrawer(id) {
  const t = Storage.getTaskById(id);
  if (!t) return;
  const si  = statusInfo(t);
  const who = assigneeName(t.assignee);

  el.drawerTitle.textContent = t.title;
  el.drawerBody.innerHTML = `
    <div class="d-row">
      <div class="d-field">
        <div class="d-label">Status</div>
        <span class="badge ${si.badgeCls}">${si.label}</span>
      </div>
      <div class="d-field">
        <div class="d-label">Priority</div>
        <span class="badge bp-${t.priority}">${capFirst(t.priority)}</span>
      </div>
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

window.toggleDrawer = id => {
  const t = Storage.toggleTaskComplete(id);
  closeDrawer(); renderAll();
  toast(t.completed ? '✓ Completed' : 'Reopened');
};

// ── VOICE PANEL ───────────────────────────────────────────
let recognition = null;

function toggleVoicePanel() {
  const open = el.voicePanel.classList.contains('show');
  if (open) { closeVoicePanel(); } else { openVoicePanel(); }
}

function openVoicePanel() {
  el.voicePanel.classList.add('show');
  el.vpOverlay.classList.add('show');
  el.voiceBtn.classList.add('active');
}

function closeVoicePanel() {
  if (recognition) { try { recognition.stop(); } catch(e){} }
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
  if (!SR) {
    el.vpTranscript.textContent = 'Speech recognition is not supported in this browser. Try Chrome or Edge.';
    return;
  }

  if (el.vpMic.classList.contains('recording')) {
    recognition.stop();
    return;
  }

  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

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

  recognition.onerror = e => {
    el.vpMic.classList.remove('recording');
    el.vpStatus.textContent = `Error: ${e.error}`;
  };

  recognition.onend = () => {
    el.vpMic.classList.remove('recording');
    if (el.vpStatus.textContent === 'Listening…') el.vpStatus.textContent = 'Ready';
  };

  recognition.start();
}

function parseVoiceInput(text) {
  const t = text.toLowerCase();
  const employees = Storage.getEmployees();

  // Priority
  let priority = 'medium';
  if (/\bhigh\b|\burgent\b|\bcritical\b/.test(t)) priority = 'high';
  else if (/\blow\b|\bwhenever\b|\bno rush\b/.test(t)) priority = 'low';

  // Due date
  let dueDate = '';
  const now = new Date();

  const nextDayMatch = t.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  const thisWeekMatch = t.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  const inDaysMatch = t.match(/in\s+(\d+)\s+days?/);
  const tomorrowMatch = /\btomorrow\b/.test(t);
  const todayMatch = /\btoday\b/.test(t);
  const endOfWeekMatch = /\bend\s+of\s+(the\s+)?week\b/.test(t);
  const nextWeekMatch = /\bnext\s+week\b/.test(t);
  const dateMatch = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  const monthDayMatch = t.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/);

  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  if (todayMatch) {
    dueDate = today();
  } else if (tomorrowMatch) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    dueDate = toDateStr(d);
  } else if (nextDayMatch) {
    const target = dayNames.indexOf(nextDayMatch[1]);
    const d = new Date(now);
    let diff = target - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    dueDate = toDateStr(d);
  } else if (thisWeekMatch) {
    const target = dayNames.indexOf(thisWeekMatch[1]);
    const d = new Date(now);
    let diff = target - d.getDay();
    if (diff < 0) diff += 7;
    d.setDate(d.getDate() + diff);
    dueDate = toDateStr(d);
  } else if (endOfWeekMatch) {
    const d = new Date(now);
    const daysToFri = (5 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysToFri);
    dueDate = toDateStr(d);
  } else if (nextWeekMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    dueDate = toDateStr(d);
  } else if (inDaysMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1]));
    dueDate = toDateStr(d);
  } else if (monthDayMatch) {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const mo = months.indexOf(monthDayMatch[1]);
    const dy = parseInt(monthDayMatch[2]);
    const d = new Date(now.getFullYear(), mo, dy);
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    dueDate = toDateStr(d);
  } else if (dateMatch) {
    const mo = parseInt(dateMatch[1]) - 1;
    const dy = parseInt(dateMatch[2]);
    const yr = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
    const fullYr = yr < 100 ? 2000 + yr : yr;
    dueDate = toDateStr(new Date(fullYr, mo, dy));
  }

  // Assignee — match employee names
  let assignee = 'me';
  let assigneeName = Storage.getSettings().managerName || 'You';
  for (const emp of employees) {
    const first = emp.name.split(' ')[0].toLowerCase();
    const full  = emp.name.toLowerCase();
    if (t.includes(`assign to ${full}`) || t.includes(`for ${full}`) ||
        t.includes(`assign to ${first}`) || t.includes(`for ${first}`) ||
        t.includes(`give to ${first}`) || t.includes(`give to ${full}`)) {
      assignee = emp.id;
      assigneeName = emp.name;
      break;
    }
  }

  // Clean title — strip known keyword phrases
  let title = text;
  const stripPatterns = [
    /,?\s*assign(ed)?\s+to\s+\w[\w\s]*/gi,
    /,?\s*for\s+(high|medium|low|urgent)\s+priority/gi,
    /,?\s*(high|medium|low|urgent|critical)\s+priority/gi,
    /,?\s*priority\s+(high|medium|low)/gi,
    /,?\s*due\s+(next|this|on|by)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|today|tomorrow|january|february|march|april|may|june|july|august|september|october|november|december|\d)/gi,
    /,?\s*in\s+\d+\s+days?/gi,
    /,?\s*by\s+(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
    /,?\s*end\s+of\s+(the\s+)?week/gi,
    /,?\s*next\s+week/gi,
  ];
  stripPatterns.forEach(p => { title = title.replace(p, ''); });
  // Also strip employee names from title
  for (const emp of employees) {
    title = title.replace(new RegExp(`,?\\s*for\\s+${emp.name}`, 'gi'), '');
    title = title.replace(new RegExp(`,?\\s*give\\s+to\\s+${emp.name}`, 'gi'), '');
  }
  title = title.replace(/\s{2,}/g, ' ').trim();
  title = title.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
  if (title) title = title[0].toUpperCase() + title.slice(1);

  App.voiceParsed = { title, priority, dueDate, assignee };

  // Show parsed preview
  el.vpParsed.innerHTML = `
    <strong>Task:</strong> ${esc(title || '(could not detect title)')}<br>
    <strong>Assignee:</strong> ${esc(assigneeName)}<br>
    <strong>Priority:</strong> ${capFirst(priority)}<br>
    <strong>Due:</strong> ${dueDate ? fmtDate(dueDate) : '(not detected — you can set it manually)'}
  `;
  el.vpParsed.style.display = 'block';
  el.vpStatus.textContent = 'Review and confirm';
  el.vpActions.style.display = 'flex';
}

function confirmVoiceTask() {
  const p = App.voiceParsed;
  if (!p) return;

  if (!p.title) {
    toast('Could not detect a task title. Please try again.');
    return;
  }

  // Open the task modal pre-filled so the user can review/edit before final save
  renderAssigneeDropdown();
  el.modalTitle.textContent = 'New Task (from voice)';
  el.taskTitle.value    = p.title;
  el.taskDesc.value     = '';
  el.taskAssignee.value = p.assignee;
  el.taskPriority.value = p.priority;
  el.taskAssigned.value = today();
  el.taskDue.value      = p.dueDate || '';
  el.taskTags.value     = '';
  App.editId = null;

  closeVoicePanel();
  el.taskModal.classList.add('open');
  setTimeout(() => el.taskTitle.focus(), 80);
}

// ── HELPERS ───────────────────────────────────────────────
function statusInfo(t) {
  if (t.completed) return { label: 'Done',      badgeCls: 'b-done', dtCls: '',         rowCls: 'row-done' };
  if (!t.dueDate)  return { label: 'No Date',   badgeCls: 'b-none', dtCls: '',         rowCls: '' };
  if (isOverdue(t.dueDate))  return { label: 'Overdue',   badgeCls: 'b-over', dtCls: 'dt-over', rowCls: 'row-overdue' };
  if (isDueSoon(t.dueDate))  return { label: 'Due Soon',  badgeCls: 'b-soon', dtCls: 'dt-soon', rowCls: 'row-soon' };
  return { label: 'On Track', badgeCls: 'b-ok',   dtCls: '',         rowCls: '' };
}

function assigneeName(id) {
  if (id === 'me') return Storage.getSettings().managerName || 'You';
  return Storage.getEmployees().find(e => e.id === id)?.name || 'Unknown';
}

function isOverdue(d) { return d && new Date(d) < new Date(today()); }
function isDueSoon(d) {
  if (!d) return false;
  const diff = (new Date(d) - new Date(today())) / 86400000;
  return diff >= 0 && diff <= 3;
}

function today() { return new Date().toISOString().split('T')[0]; }
function toDateStr(d) { return d.toISOString().split('T')[0]; }

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDatetime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capFirst(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

function strColor(s) {
  if (!s) return '#888';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return ['#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#ef4444','#06b6d4','#84cc16'][Math.abs(h) % 8];
}

function shake(input) {
  input.classList.add('err');
  input.focus();
  setTimeout(() => input.classList.remove('err'), 700);
}

let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
}

// ── BOOT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
