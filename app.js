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
  _notes: [],
  calDate: new Date(),
  calView: 'monthly',
  calMode: 'normal',
  notesGrid: false,
  editNoteId: null,
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
  settingsBtn:    $('settingsBtn'),
  settingsModal:  $('settingsModal'),
  settingsModalClose: $('settingsModalClose'),
  settingsModalCancel: $('settingsModalCancel'),
  settingsModalSave: $('settingsModalSave'),
  webhookUrl:     $('webhookUrl'),
  syncSheetsBtn:  $('syncSheetsBtn'),
  taskSection:    document.querySelector('.task-section'),
  calendarSection:$('calendarSection'),
  notesSection:   $('notesSection'),
  calPrevBtn:     $('calPrevBtn'),
  calNextBtn:     $('calNextBtn'),
  calTodayBtn:    $('calTodayBtn'),
  calTitleDisplay:$('calTitleDisplay'),
  calViewContainer:$('calViewContainer'),
  notesContainer: $('notesContainer'),
  calViewFilter:  $('calViewFilter'),
  calModeToggle:  $('calModeToggle'),
  calModeNormal:  $('calModeNormal'),
  calModeHeatmap: $('calModeHeatmap'),
  notesGridToggle:$('notesGridToggle'),
  noteModal:      $('noteModal'),
  noteModalTitle: $('noteModalTitle'),
  noteModalClose: $('noteModalClose'),
  noteModalCancel:$('noteModalCancel'),
  noteModalSave:  $('noteModalSave'),
  noteTitle:      $('noteTitle'),
  noteContent:    $('noteContent'),
  noteColor:      $('noteColor'),
  notePinned:     $('notePinned'),
  statsRow:       document.querySelector('.stats-row'),
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
  startReminderChecker();
}

async function refreshCache() {
  [App._tasks, App._employees, App._settings, App._companies, App._notes] = await Promise.all([
    Storage.getAllTasks(),
    Storage.getEmployees(),
    Storage.getSettings(),
    Storage.getCompanies(),
    Storage.getNotes()
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
  el.settingsBtn.addEventListener('click', openSettingsModal);
  el.syncSheetsBtn.addEventListener('click', syncToGoogleSheets);

  el.settingsModalClose.addEventListener('click', closeSettingsModal);
  el.settingsModalCancel.addEventListener('click', closeSettingsModal);
  el.settingsModalSave.addEventListener('click', saveSettingsModal);
  el.settingsModal.addEventListener('click', e => { if (e.target === el.settingsModal) closeSettingsModal(); });

  document.querySelectorAll('.nav-link[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      setView(a.dataset.view);
      if (window.innerWidth <= 900) closeMobSidebar();
    });
  });

  el.addTaskBtn.addEventListener('click', () => {
    if (App.view === 'notes') openNoteModal();
    else openTaskModal();
  });
  
  el.calPrevBtn?.addEventListener('click', () => changeCalDate(-1));
  el.calNextBtn?.addEventListener('click', () => changeCalDate(1));
  el.calTodayBtn?.addEventListener('click', () => { App.calDate = new Date(); renderCalendar(); });
  el.calViewFilter?.addEventListener('change', (e) => { App.calView = e.target.value; renderCalendar(); });
  el.calModeNormal?.addEventListener('click', () => { setCalMode('normal'); });
  el.calModeHeatmap?.addEventListener('click', () => { setCalMode('heatmap'); });
  
  el.notesGridToggle?.addEventListener('click', toggleNotesGrid);
  
  el.noteModalClose?.addEventListener('click', closeNoteModal);
  el.noteModalCancel?.addEventListener('click', closeNoteModal);
  el.noteModalSave?.addEventListener('click', saveNote);
  el.noteModal?.addEventListener('click', e => { if (e.target === el.noteModal) closeNoteModal(); });
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

  $('rpClose').addEventListener('click', () => {
    $('reminderPopup').classList.remove('show');
  });
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

  // Hide sections by default
  el.taskSection.style.display = 'none';
  el.calendarSection.style.display = 'none';
  el.notesSection.style.display = 'none';
  el.statsRow.style.display = 'none';
  
  // Show/Hide topbar elements
  el.calViewFilter.style.display = 'none';
  el.calModeToggle.style.display = 'none';
  el.notesGridToggle.style.display = 'none';
  el.searchInput.parentElement.style.display = 'none';
  el.priorityFilter.style.display = 'none';
  el.addTaskBtn.style.display = 'none';
  el.addTaskBtn.querySelector('.btn-label').textContent = 'New Task';

  if (view === 'calendar') {
    el.pageTitle.textContent = 'Calendar Planner';
    el.pageSub.textContent = 'View and schedule tasks';
    el.calendarSection.style.display = 'flex';
    el.calViewFilter.style.display = 'block';
    el.calModeToggle.style.display = 'flex';
    el.addTaskBtn.style.display = 'inline-flex';
    renderCalendar();
  } else if (view === 'notes') {
    el.pageTitle.textContent = 'Sticky Notes';
    el.pageSub.textContent = 'Your virtual board';
    el.notesSection.style.display = 'flex';
    el.notesGridToggle.style.display = 'inline-flex';
    el.addTaskBtn.style.display = 'inline-flex';
    el.addTaskBtn.querySelector('.btn-label').textContent = 'New Note';
    renderNotes();
  } else {
    el.statsRow.style.display = 'flex';
    if (empId) {
      const emp = App._employees.find(e => String(e.id) === String(empId));
      const co  = App._companies.find(c => String(c.id) === String(empId));
      if (co) {
        el.pageTitle.textContent = co.name;
        el.pageSub.textContent = 'Company tasks';
      } else {
        el.pageTitle.textContent = emp ? `${emp.name}'s Tasks` : 'Employee Tasks';
        el.pageSub.textContent = emp?.role || 'Employee';
      }
    } else {
      el.pageTitle.textContent = viewMeta[view]?.[0] || 'Tasks';
      el.pageSub.textContent = viewMeta[view]?.[1] || '';
    }
    el.taskSection.style.display = 'flex';
    el.searchInput.parentElement.style.display = 'block';
    el.priorityFilter.style.display = 'block';
    el.addTaskBtn.style.display = 'inline-flex';
    renderTasks();
  }
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
      const was = App._tasks.find(t => String(t.id) === String(cb.dataset.id));
      await Storage.toggleTaskComplete(cb.dataset.id);
      if (!was.completed && was.repeat && was.repeat !== 'none') {
        await generateNextRepeat(was);
      }
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
    const t = App._tasks.find(t => String(t.id) === String(id));
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
    $('taskReminder').value = t.reminderTime || '';
    $('taskRepeat').value   = t.repeat || 'none';
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
    $('taskReminder').value = '';
    $('taskRepeat').value   = 'none';
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
    reminderTime: $('taskReminder').value,
    repeat: $('taskRepeat').value,
  };

  const currentEditId = App.editId;
  closeTaskModal();
  toast('Saving…');

  if (currentEditId) {
    const existing = App._tasks.find(t => String(t.id) === String(currentEditId)) || {};
    // If reminder time changed, reset reminderNotified
    if (existing.reminderTime !== data.reminderTime) {
      data.reminderNotified = false;
    }
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
      App._companies.find(c => String(c.id) === String(t.company))?.name || '',
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

// ── GOOGLE SHEETS SYNC ────────────────────────────────────
function openSettingsModal() {
  closeMobSidebar();
  el.webhookUrl.value = App._settings?.googleSheetWebhookUrl || '';
  el.settingsModal.classList.add('open');
}

function closeSettingsModal() {
  el.settingsModal.classList.remove('open');
}

async function saveSettingsModal() {
  const url = el.webhookUrl.value.trim();
  closeSettingsModal();
  toast('Saving settings...');
  await Storage.saveSettings({ googleSheetWebhookUrl: url });
  toast('Settings saved ✓');
}

async function syncToGoogleSheets() {
  closeMobSidebar();
  const url = App._settings?.googleSheetWebhookUrl;
  if (!url) {
    alert("Please set your Google Sheets Webhook URL in Settings first.");
    openSettingsModal();
    return;
  }

  toast('Syncing to Google Sheets...');
  
  // Format matching "Ughrani Sheet-2.pdf"
  // Group tasks by Assignee
  const grouped = {};
  App._tasks.forEach(t => {
    if (!grouped[t.assignee]) grouped[t.assignee] = [];
    grouped[t.assignee].push(t);
  });

  const payload = [];
  let srNo = 1;

  // Add Manager and Employees
  const allPeople = [{ id: 'me', name: App._settings?.managerName || 'Manager', role: 'Admin' }, ...App._employees];

  for (const person of allPeople) {
    const tasks = grouped[person.id] || [];
    if (tasks.length === 0) continue; // Skip if no tasks

    // Concatenate all tasks into a single string separated by newlines
    const taskListString = tasks.map(t => {
      let line = t.title;
      if (t.description) line += `\n${t.description}`;
      return line;
    }).join('\n\n');

    payload.push({
      srNo: srNo++,
      name: person.name,
      email: '', // Add real email if available
      mobile: '', // Add real mobile if available
      tasks: taskListString,
      frequency: '', 
      fromEmail: '',
      fromMobile: '',
      lastSentDate: new Date().toISOString()
    });
  }

  if (payload.length === 0) {
    toast('No tasks to sync.');
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    // With no-cors, res.ok is always false and status is 0, so we just assume success if no exception thrown
    toast('Synced successfully ✓');
  } catch (err) {
    console.error('Webhook sync failed:', err);
    toast('Sync failed. Check console.');
  }
}

// ── DRAWER ────────────────────────────────────────────────
function openDrawer(id) {
  const t = App._tasks.find(t => String(t.id) === String(id));
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
    ${t.company ? (() => { const co = App._companies.find(c => String(c.id) === String(t.company)); return co ? `<div class="d-field"><div class="d-label">Company</div><div class="d-val">${esc(co.name)}</div></div>` : ''; })() : ''}
    ${t.reminderTime ? `<div class="d-field"><div class="d-label">Reminder</div><div class="d-val">${fmtDatetime(t.reminderTime)}</div></div>` : ''}
    ${t.repeat && t.repeat !== 'none' ? `<div class="d-field"><div class="d-label">Repeat</div><div class="d-val">${capFirst(t.repeat)}</div></div>` : ''}
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
  const was = App._tasks.find(t => String(t.id) === String(id));
  await Storage.toggleTaskComplete(id);
  
  if (!was.completed && was.repeat && was.repeat !== 'none') {
    await generateNextRepeat(was);
  }

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
function uploadFileChunks(fileData, chunkSize = 1024 * 1024) {
  // Placeholder for any file logic from previous versions
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
    : (App._employees.find(e => String(e.id) === String(p.assigneeId))?.name || 'You');
  el.vpParsed.innerHTML = `
    <strong>Task:</strong> ${esc(p.title || '—')}<br>
    <strong>Assignee:</strong> ${esc(whoName)}<br>
    <strong>Priority:</strong> ${capFirst(p.priority)}<br>
    <strong>Due:</strong> ${p.dueDate ? fmtDate(p.dueDate) : 'Not detected'}<br>
    ${p.companyId ? `<strong>Company:</strong> ${esc(App._companies.find(c => String(c.id) === String(p.companyId))?.name || '')}` : ''}`;
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
  return App._employees.find(e => String(e.id) === String(id))?.name || 'Unknown';
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

// ── REPEAT & REMINDERS ──────────────────────────────────────
async function generateNextRepeat(task) {
  if (!task.repeat || task.repeat === 'none') return;
  
  let nextDate = new Date(task.dueDate || today());
  if (task.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1);
  else if (task.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
  else if (task.repeat === 'fortnightly') nextDate.setDate(nextDate.getDate() + 15);
  else if (task.repeat === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
  else if (task.repeat === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
  else if (task.repeat === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
  
  const nextDateStr = toDateStr(nextDate);
  
  let nextReminder = '';
  if (task.reminderTime) {
    const rDate = new Date(task.reminderTime);
    if (task.repeat === 'daily') rDate.setDate(rDate.getDate() + 1);
    else if (task.repeat === 'weekly') rDate.setDate(rDate.getDate() + 7);
    else if (task.repeat === 'fortnightly') rDate.setDate(rDate.getDate() + 15);
    else if (task.repeat === 'monthly') rDate.setMonth(rDate.getMonth() + 1);
    else if (task.repeat === 'quarterly') rDate.setMonth(rDate.getMonth() + 3);
    else if (task.repeat === 'yearly') rDate.setFullYear(rDate.getFullYear() + 1);
    
    const pad = n => String(n).padStart(2, '0');
    nextReminder = `${rDate.getFullYear()}-${pad(rDate.getMonth()+1)}-${pad(rDate.getDate())}T${pad(rDate.getHours())}:${pad(rDate.getMinutes())}`;
  }

  const newTask = {
    ...task,
    id: undefined,
    dueDate: nextDateStr,
    reminderTime: nextReminder,
    reminderNotified: false,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await Storage.saveTask(newTask);
}

let reminderInterval;
function startReminderChecker() {
  if (reminderInterval) clearInterval(reminderInterval);
  
  const checkReminders = () => {
    const now = new Date();
    let needsUpdate = false;
    
    App._tasks.forEach(t => {
      if (!t.completed && t.reminderTime && !t.reminderNotified) {
        const rTime = new Date(t.reminderTime);
        if (now >= rTime) {
          showReminderPopup(t);
          t.reminderNotified = true;
          needsUpdate = true;
          Storage.saveTask(t);
        }
      }
    });
    
    if (needsUpdate) refreshCache();
  };

  reminderInterval = setInterval(checkReminders, 60000);
  setTimeout(checkReminders, 2000);
}

function showReminderPopup(task) {
  const rp = $('reminderPopup');
  if (!rp) return;
  $('rpTaskTitle').textContent = task.title;
  $('rpTaskDue').textContent = 'Due: ' + (task.dueDate ? fmtDate(task.dueDate) : 'No Date');
  rp.classList.add('show');
  
  if (window.Notification && Notification.permission === 'granted') {
    new Notification('⏰ Task Reminder', { body: task.title });
  } else if (window.Notification && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// DOMContentLoaded is handled at the top of this file via Auth.init()

// ── CALENDAR PLANNER ──────────────────────────────────────
function changeCalDate(dir) {
  const d = App.calDate;
  if (App.calView === 'daily') d.setDate(d.getDate() + dir);
  else if (App.calView === 'weekly') d.setDate(d.getDate() + (dir * 7));
  else if (App.calView === 'fortnightly') d.setDate(d.getDate() + (dir * 14));
  else d.setMonth(d.getMonth() + dir);
  App.calDate = new Date(d);
  renderCalendar();
}

function setCalMode(mode) {
  App.calMode = mode;
  el.calModeNormal.classList.toggle('active', mode === 'normal');
  el.calModeHeatmap.classList.toggle('active', mode === 'heatmap');
  renderCalendar();
}

function renderCalendar() {
  if (App.view !== 'calendar') return;
  const container = el.calViewContainer;
  container.innerHTML = '';
  
  const d = new Date(App.calDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  
  el.calTitleDisplay.textContent = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  if (App.calView === 'daily') el.calTitleDisplay.textContent = d.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  
  const tasks = App._tasks.filter(t => !t.completed); // show open tasks
  
  if (App.calMode === 'heatmap') {
    container.innerHTML = '<div class="cal-heatmap" id="calHeatmap"></div>';
    const heatmap = $('calHeatmap');
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const count = tasks.filter(t => t.dueDate === dateStr).length;
      
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.dataset.count = Math.min(count, 5);
      cell.textContent = i;
      cell.title = `${count} tasks`;
      cell.addEventListener('click', () => { App.calDate = new Date(year, month, i); App.calView = 'daily'; el.calViewFilter.value = 'daily'; renderCalendar(); });
      heatmap.appendChild(cell);
    }
    return;
  }
  
  const grid = document.createElement('div');
  grid.className = `cal-grid ${App.calView}`;
  
  if (App.calView === 'daily') {
    for (let h = 8; h <= 20; h++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const hrTasks = tasks.filter(t => t.dueDate === dateStr);
      const row = document.createElement('div');
      row.className = 'timeline-row';
      row.innerHTML = `<div class="timeline-time">${h}:00</div><div class="timeline-content"></div>`;
      if (h === 8) {
        hrTasks.forEach(t => {
          const p = document.createElement('div');
          p.className = `cal-task-pill ${t.priority}`;
          p.textContent = t.title;
          p.addEventListener('click', () => openDrawer(t.id));
          row.querySelector('.timeline-content').appendChild(p);
        });
      }
      grid.appendChild(row);
    }
  } else {
    const days = App.calView === 'weekly' ? 7 : (App.calView === 'fortnightly' ? 14 : 42);
    let start = new Date(year, month, 1);
    if (App.calView === 'weekly' || App.calView === 'fortnightly') {
      start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
    } else {
      start.setDate(1 - start.getDay());
    }
    
    const hdr = document.createElement('div');
    hdr.className = 'cal-header-row';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => {
      hdr.innerHTML += `<div>${day}</div>`;
    });
    grid.appendChild(hdr);
    
    const todayStr = today();
    for (let i = 0; i < days; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const isDiffMonth = current.getMonth() !== month;
      const dStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
      
      const cell = document.createElement('div');
      cell.className = `cal-cell ${isDiffMonth && App.calView === 'monthly' ? 'diff-month' : ''} ${dStr === todayStr ? 'today' : ''}`;
      cell.innerHTML = `<div class="cal-date ${dStr === todayStr ? 'today-text' : ''}">${current.getDate()}</div>`;
      
      tasks.filter(t => t.dueDate === dStr).forEach(t => {
        const p = document.createElement('div');
        p.className = `cal-task-pill ${t.priority}`;
        p.textContent = t.title;
        p.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(t.id); });
        cell.appendChild(p);
      });
      
      cell.addEventListener('click', () => {
        App.calDate = new Date(current); App.calView = 'daily'; el.calViewFilter.value = 'daily'; renderCalendar();
      });
      grid.appendChild(cell);
    }
  }
  container.appendChild(grid);
}

// ── STICKY NOTES ──────────────────────────────────────────
function toggleNotesGrid() {
  App.notesGrid = !App.notesGrid;
  if (App.notesGrid) {
    el.notesContainer.classList.remove('freeform');
    el.notesContainer.classList.add('grid-mode');
  } else {
    el.notesContainer.classList.add('freeform');
    el.notesContainer.classList.remove('grid-mode');
  }
}

function openNoteModal(id = null) {
  App.editNoteId = id;
  if (id) {
    const note = App._notes.find(n => String(n.id) === String(id));
    if (note) {
      el.noteModalTitle.textContent = 'Edit Note';
      el.noteTitle.value = note.title || '';
      el.noteContent.value = note.content || '';
      el.noteColor.value = note.color || 'yellow';
      el.notePinned.value = note.pinned ? 'true' : 'false';
    }
  } else {
    el.noteModalTitle.textContent = 'New Note';
    el.noteTitle.value = '';
    el.noteContent.value = '';
    el.noteColor.value = 'yellow';
    el.notePinned.value = 'false';
  }
  el.noteModal.classList.add('open');
  setTimeout(() => el.noteContent.focus(), 80);
}

function closeNoteModal() {
  el.noteModal.classList.remove('open');
  App.editNoteId = null;
}

async function saveNote() {
  const content = el.noteContent.value.trim();
  if (!content) { shake(el.noteContent); return; }
  
  const data = {
    title: el.noteTitle.value.trim(),
    content: content,
    color: el.noteColor.value,
    pinned: el.notePinned.value === 'true'
  };
  
  closeNoteModal();
  toast('Saving note...');
  
  if (App.editNoteId) {
    data.id = App.editNoteId;
  } else {
    data.posX = 40 + Math.random() * 300;
    data.posY = 40 + Math.random() * 300;
  }
  
  await Storage.saveNote(data);
  App._notes = await Storage.getNotes();
  renderNotes();
  toast('Note saved ✓');
}

function renderNotes() {
  if (App.view !== 'notes') return;
  const container = el.notesContainer;
  container.innerHTML = '';
  
  const sorted = [...(App._notes || [])].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  
  sorted.forEach(note => {
    const card = document.createElement('div');
    card.className = `note-card note-${note.color || 'yellow'} ${note.pinned ? 'note-pinned' : ''}`;
    card.dataset.id = note.id;
    
    if (!App.notesGrid) {
      card.style.left = `${note.posX || 40}px`;
      card.style.top = `${note.posY || 40}px`;
      card.style.zIndex = note.zIndex || 1;
      if (note.width) card.style.width = `${note.width}px`;
      if (note.height) card.style.height = `${note.height}px`;
      makeDraggable(card, note);
    }
    
    card.innerHTML = `
      <div class="note-hd">
        <div class="note-title">${esc(note.title || '')}</div>
        <div class="note-pin">${note.pinned ? '📌' : ''}</div>
      </div>
      <div class="note-content">${esc(note.content || '').replace(/\n/g, '<br/>')}</div>
      <div class="note-footer">${note.updatedAt ? fmtDate(note.updatedAt) : ''}</div>
      <div class="note-acts">
        <button class="note-btn" title="Edit" onclick="openNoteModal('${note.id}')">✎</button>
        <button class="note-btn" title="Delete" onclick="deleteNoteHandler('${note.id}', event)">✖</button>
      </div>
    `;
    
    if (!App.notesGrid) {
      makeDraggable(card, note);
    }
    
    container.appendChild(card);
  });
}

window.deleteNoteHandler = async function(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this note?')) return;
  await Storage.deleteNote(id);
  App._notes = await Storage.getNotes();
  renderNotes();
  toast('Note deleted');
}

function makeDraggable(elem, noteData) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  elem.style.cursor = 'grab';
  elem.onmousedown = dragMouseDown;

  // Watch for manual CSS resizing and debounce the save
  let resizeTimeout;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Ignore resizes triggered by the grid system
      if (App.notesGrid) return;
      
      if (elem.offsetWidth !== noteData.width || elem.offsetHeight !== noteData.height) {
        noteData.width = elem.offsetWidth;
        noteData.height = elem.offsetHeight;
        Storage.saveNote(noteData);
      }
    }, 500);
  });
  ro.observe(elem);

  function dragMouseDown(e) {
    if (e.target.closest('.note-acts') || e.target.tagName === 'BUTTON') return;
    
    // Check if click is on the native resize handle (bottom-right 20x20px area)
    const rect = elem.getBoundingClientRect();
    if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
      return; // Let native resize take over
    }

    // Allow text selection if double clicking or something, but prevent default for dragging
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
    
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    
    const maxZ = Math.max(1, ...App._notes.map(n => n.zIndex || 1));
    elem.style.zIndex = maxZ + 1;
    noteData.zIndex = maxZ + 1;
    elem.style.cursor = 'grabbing';
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Remove strict bounds checking so dragging is smoother even if they drag fast or out of view
    let newTop = elem.offsetTop - pos2;
    let newLeft = elem.offsetLeft - pos1;
    
    // Basic floor clamping so it doesn't go above the top edge
    if (newTop < 0) newTop = 0;
    if (newLeft < 0) newLeft = 0;

    elem.style.top = newTop + "px";
    elem.style.left = newLeft + "px";
  }

  async function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    elem.style.cursor = 'grab';
    
    noteData.posX = parseInt(elem.style.left);
    noteData.posY = parseInt(elem.style.top);
    await Storage.saveNote(noteData);
  }
}