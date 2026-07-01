/* =============================================
   CYBER-TODO v1.2.0
   Main Application Logic
   ============================================= */

'use strict';

const VERSION = '1.2.1';
const API_BASE = 'api.php?action=';

// ── State ────────────────────────────────────
const state = {
  tasks: [],
  filter: 'all',        // all | active | completed
  categoryFilter: 'all',
  searchQuery: '',
  sortBy: 'created',    // created | priority | dueDate | alpha
  editingId: null,
};

// ── Utils ────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;
  return task.dueDate < today();
}

function isDueToday(task) {
  if (!task.dueDate || task.completed) return false;
  return task.dueDate === today();
}

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

const CATEGORY_LABELS = {
  personal: 'Személyes',
  work:     'Munka',
  shopping: 'Bevásárlás',
  health:   'Egészség',
  other:    'Egyéb',
};

// ── API Storage ───────────────────────────────
async function loadTasks() {
  try {
    const resp = await fetch(API_BASE + 'getTasks');
    const data = await resp.json();
    if (data.success) state.tasks = data.tasks || [];
  } catch {
    state.tasks = [];
  }
}

async function saveTasks() {
  // Nem kell külön menteni, minden művelet azonnal menti a szerverre
}

async function apiCall(action, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    cache: 'no-cache'
  };
  if (body) opts.body = JSON.stringify(body);
  const url = API_BASE + action + '&_t=' + Date.now();
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ── Telegram Integration ──────────────────────
let telegramSettings = null;

async function loadTelegramSettings() {
  try {
    const data = await apiCall('getTelegram');
    if (data.success) telegramSettings = data.telegram;
  } catch { /* ignore */ }
  if (!telegramSettings) {
    telegramSettings = {
      enabled:    false,
      botToken:   '',
      chatId:     '',
      onAdd:      true,
      onComplete: true,
      onDelete:   false,
      onOverdue:  true,
    };
  }
}

function getTelegramSettings() {
  return telegramSettings || {
    enabled:    false,
    botToken:   '',
    chatId:     '',
    onAdd:      true,
    onComplete: true,
    onDelete:   false,
    onOverdue:  true,
  };
}

async function saveTelegramSettings(settings) {
  const data = await apiCall('saveTelegram', 'POST', settings);
  if (data.success) {
    telegramSettings = data.telegram;
  }
}

async function saveTelegramState() {
  const data = await apiCall('saveTelegram', 'POST', telegramSettings);
  if (data.success) {
    telegramSettings = data.telegram;
  }
}

/**
 * Send a raw text message via the Telegram Bot API.
 * Returns true on success, false on failure (silently logs).
 */
async function sendTelegramMessage(text, token, chatId) {
  const cfg = getTelegramSettings();
  const botToken = token   ?? cfg.botToken;
  const chat     = chatId  ?? cfg.chatId;

  if (!botToken || !chat) return false;

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }),
      }
    );
    const data = await resp.json();
    if (!data.ok) throw new Error(data.description || 'Ismeretlen hiba');
    return true;
  } catch (err) {
    console.warn('[Telegram]', err.message);
    return false;
  }
}

async function testTelegramApi(token, chatId) {
  return await apiCall('testTelegram', 'POST', { botToken: token, chatId: chatId });
}

/**
 * Fire a Telegram notification for a specific event type.
 * Respects per-event enable flags.
 */
async function tgNotify(type, task) {
  const cfg = getTelegramSettings();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return;

  const cat = (CATEGORY_LABELS[task?.category] || task?.category || '').toUpperCase();
  const due = task?.dueDate ? ` | Határidő: <b>${formatDate(task.dueDate)}</b>` : '';
  let text  = '';

  switch (type) {
    case 'add':
      if (!cfg.onAdd) return;
      text = `⚡ <b>Új feladat hozzáadva</b>\n\n📌 ${task.text}\n🏷 ${cat}${due}`;
      break;
    case 'complete':
      if (!cfg.onComplete) return;
      text = `✅ <b>Feladat teljesítve</b>\n\n📌 ${task.text}\n🏷 ${cat}`;
      break;
    case 'uncomplete':
      if (!cfg.onComplete) return;
      text = `↩️ <b>Feladat visszaállítva</b>\n\n📌 ${task.text}`;
      break;
    case 'delete':
      if (!cfg.onDelete) return;
      text = `🗑 <b>Feladat törölve</b>\n\n📌 ${task.text}`;
      break;
    default:
      return;
  }

  await sendTelegramMessage(text);
}

/**
 * Send a daily overdue summary if not already sent today.
 */
async function checkOverdueNotifications() {
  const cfg = getTelegramSettings();
  if (!cfg.enabled || !cfg.onOverdue || !cfg.botToken || !cfg.chatId) return;

  const todayStr  = today();
  const lastCheck = new Date().toISOString().slice(0, 10) + '_overdue';
  if (telegramSettings._lastOverdue === todayStr) return;

  const overdueTasks = state.tasks.filter(isOverdue);
  if (overdueTasks.length === 0) return;

  const list = overdueTasks
    .map(t => `• ${t.text} <i>(${formatDate(t.dueDate)})</i>`)
    .join('\n');
  const text = `⚠️ <b>CYBER-TODO — Lejárt feladatok: ${overdueTasks.length} db</b>\n\n${list}`;

  const ok = await sendTelegramMessage(text);
  if (ok) {
    telegramSettings._lastOverdue = todayStr;
    await saveTelegramState();
  }
}

// ── DOM References ───────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const taskList        = $('#taskList');
const emptyState      = $('#emptyState');
const taskInput       = $('#taskInput');
const taskPriority    = $('#taskPriority');
const taskCategory    = $('#taskCategory');
const taskDueDate     = $('#taskDueDate');
const addTaskForm     = $('#addTaskForm');
const searchInput     = $('#searchInput');
const sortSelect      = $('#sortSelect');
const filterTabs      = $$('.filter-tab');
const catBtns         = $$('.cat-btn');
const bulkActions     = $('#bulkActions');
const completeAllBtn  = $('#completeAll');
const clearCompBtn    = $('#clearCompleted');
const clearAllBtn     = $('#clearAll');
const taskCounter     = $('#taskCounter');
const statTotal       = $('#statTotal');
const statActive      = $('#statActive');
const statCompleted   = $('#statCompleted');
const statOverdue     = $('#statOverdue');
const modalOverlay    = $('#modalOverlay');
const editForm        = $('#editForm');
const editTaskInput   = $('#editTaskInput');
const editNotes       = $('#editNotes');
const editPriority    = $('#editPriority');
const editCategory    = $('#editCategory');
const editDueDate     = $('#editDueDate');
const cancelEditBtn   = $('#cancelEdit');
const toastContainer  = $('#toastContainer');

// Telegram modal
const telegramBtn     = $('#telegramBtn');
const telegramModal   = $('#telegramModal');
const tgEnabled       = $('#tgEnabled');
const tgBotToken      = $('#tgBotToken');
const tgChatId        = $('#tgChatId');
const tgOnAdd         = $('#tgOnAdd');
const tgOnComplete    = $('#tgOnComplete');
const tgOnDelete      = $('#tgOnDelete');
const tgOnOverdue     = $('#tgOnOverdue');
const tgTest          = $('#tgTest');
const cancelTelegram  = $('#cancelTelegram');
const saveTelegram    = $('#saveTelegram');

// ── Toast ─────────────────────────────────────
function showToast(message, type = 'default', duration = 2600) {
  const toast = document.createElement('div');
  toast.className = `toast${type !== 'default' ? ' ' + type : ''}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Task CRUD ─────────────────────────────────
async function addTask(text, priority, category, dueDate) {
  if (!text.trim()) return false;
  const result = await apiCall('addTask', 'POST', {
    text: text.trim(),
    priority,
    category,
    dueDate: dueDate || null,
  });
  if (result.success) {
    state.tasks.unshift(result.task);
    tgNotify('add', result.task);
    return true;
  }
  return false;
}

async function toggleTask(id) {
  const result = await apiCall('toggleTask', 'POST', { id });
  if (result.success) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx >= 0) state.tasks[idx] = result.task;
    tgNotify(result.task.completed ? 'complete' : 'uncomplete', result.task);
    render();
  }
}

async function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  const result = await apiCall('deleteTask', 'POST', { id });
  if (result.success) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    if (task) tgNotify('delete', task);
    render();
  }
}

async function updateTask(id, updates) {
  const result = await apiCall('updateTask', 'POST', { id, ...updates });
  if (result.success) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx >= 0) state.tasks[idx] = result.task;
    render();
  }
}

async function reorderTasks(taskIds) {
  const result = await apiCall('reorderTasks', 'POST', { taskIds });
  if (result.success) {
    state.tasks = result.tasks;
  }
}

// ── Filtering & Sorting ───────────────────────
function getFilteredTasks() {
  let tasks = [...state.tasks];

  if (state.filter === 'active')    tasks = tasks.filter(t => !t.completed);
  if (state.filter === 'completed') tasks = tasks.filter(t =>  t.completed);

  if (state.categoryFilter !== 'all') {
    tasks = tasks.filter(t => t.category === state.categoryFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      t.text.toLowerCase().includes(q) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  tasks.sort((a, b) => {
    switch (state.sortBy) {
      case 'priority':
        return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      case 'dueDate': {
        if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      case 'alpha':
        return a.text.localeCompare(b.text, 'hu');
      default: // created
        return b.createdAt - a.createdAt;
    }
  });

  return tasks;
}

// ── Stats ─────────────────────────────────────
function updateStats() {
  const total     = state.tasks.length;
  const completed = state.tasks.filter(t =>  t.completed).length;
  const active    = total - completed;
  const overdue   = state.tasks.filter(isOverdue).length;

  statTotal.textContent     = total;
  statActive.textContent    = active;
  statCompleted.textContent = completed;
  statOverdue.textContent   = overdue;

  taskCounter.textContent = active === 0
    ? '> nincs aktív feladat'
    : `> ${active} aktív feladat`;

  bulkActions.style.display = total > 0 ? 'flex' : 'none';
}

// ── Render ────────────────────────────────────
function buildTaskItem(task) {
  const li = document.createElement('li');
  li.className = [
    'task-item',
    task.completed ? 'completed' : '',
    `priority-${task.priority}`,
    isOverdue(task) ? 'overdue' : '',
  ].filter(Boolean).join(' ');
  li.dataset.id = task.id;
  li.setAttribute('draggable', 'true');

  // Due date badge
  let dueBadge = '';
  if (task.dueDate) {
    const cls   = isOverdue(task)  ? 'overdue'   : isDueToday(task) ? 'due-today' : '';
    const label = isDueToday(task) ? 'MA'
                : isOverdue(task)  ? `LEJÁRT: ${formatDate(task.dueDate)}`
                : formatDate(task.dueDate);
    dueBadge = `<span class="badge badge-due ${cls}"># ${label}</span>`;
  }

  const priorityLabel = { high: 'MAGAS', medium: 'KÖZEPES', low: 'ALACSONY' }[task.priority];
  const catLabel      = (CATEGORY_LABELS[task.category] || task.category).toUpperCase();

  li.innerHTML = `
    <div class="task-checkbox-wrap">
      <input
        type="checkbox"
        class="task-checkbox"
        ${task.completed ? 'checked' : ''}
        aria-label="${task.completed ? 'Feladat visszavonása' : 'Feladat teljesítése'}"
      />
    </div>
    <div class="task-body">
      <div class="task-text">${escapeHtml(task.text)}</div>
      ${task.notes ? `<div class="task-notes">&gt; ${escapeHtml(task.notes)}</div>` : ''}
      <div class="task-badges">
        <span class="badge badge-cat">${catLabel}</span>
        <span class="badge badge-priority-${task.priority}">${priorityLabel}</span>
        ${dueBadge}
      </div>
    </div>
    <div class="task-actions">
      <button class="action-btn edit"   title="Szerkesztés" aria-label="Szerkesztés">&#9998;</button>
      <button class="action-btn delete" title="Törlés"      aria-label="Törlés">&#10005;</button>
    </div>
  `;

  // Checkbox toggle
  li.querySelector('.task-checkbox').addEventListener('change', () => {
    const wasCompleted = task.completed;
    toggleTask(task.id);
    render();
    showToast(
      wasCompleted ? 'Feladat visszaállítva.' : 'Feladat teljesítve!',
      wasCompleted ? 'warning' : 'success'
    );
  });

  // Edit button
  li.querySelector('.action-btn.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(task.id);
  });

  // Delete button
  li.querySelector('.action-btn.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Biztosan törlöd ezt a feladatot?')) {
      deleteTask(task.id);
      render();
      showToast('Feladat törölve.', 'warning');
    }
  });

  // Drag & Drop
  li.addEventListener('dragstart', onDragStart);
  li.addEventListener('dragend',   onDragEnd);
  li.addEventListener('dragover',  onDragOver);
  li.addEventListener('drop',      onDrop);
  li.addEventListener('dragleave', onDragLeave);

  return li;
}

async function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const targetId = this.dataset.id;
  if (!dragSrcId || dragSrcId === targetId) return;

  const srcIdx = state.tasks.findIndex(t => t.id === dragSrcId);
  const tgtIdx = state.tasks.findIndex(t => t.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;

  const [moved] = state.tasks.splice(srcIdx, 1);
  state.tasks.splice(tgtIdx, 0, moved);
  
  const taskIds = state.tasks.map(t => t.id);
  await reorderTasks(taskIds);
  render();
}

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function render() {
  const tasks = getFilteredTasks();
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    emptyState.style.display      = 'flex';
    emptyState.style.flexDirection = 'column';
    emptyState.style.alignItems   = 'center';
  } else {
    emptyState.style.display = 'none';
    const frag = document.createDocumentFragment();
    tasks.forEach(task => frag.appendChild(buildTaskItem(task)));
    taskList.appendChild(frag);
  }

  updateStats();
}

// ── Edit Modal ────────────────────────────────
function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  state.editingId       = id;
  editTaskInput.value   = task.text;
  editNotes.value       = task.notes || '';
  editPriority.value    = task.priority;
  editCategory.value    = task.category;
  editDueDate.value     = task.dueDate || '';
  modalOverlay.style.display = 'flex';
  editTaskInput.focus();
}

function closeEditModal() {
  state.editingId = null;
  modalOverlay.style.display = 'none';
}

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.editingId) return;
  const text = editTaskInput.value.trim();
  if (!text) { showToast('A feladat szövege nem lehet üres!', 'error'); return; }
  await updateTask(state.editingId, {
    text,
    notes:    editNotes.value.trim(),
    priority: editPriority.value,
    category: editCategory.value,
    dueDate:  editDueDate.value || null,
  });
  closeEditModal();
  render();
  showToast('Feladat frissítve.', 'success');
});

cancelEditBtn.addEventListener('click', closeEditModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeEditModal();
});

// ── Add Task ──────────────────────────────────
addTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ok = await addTask(
    taskInput.value,
    taskPriority.value,
    taskCategory.value,
    taskDueDate.value
  );
  if (ok) {
    taskInput.value    = '';
    taskDueDate.value  = '';
    taskPriority.value = 'medium';
    taskInput.focus();
    render();
    showToast('Feladat hozzáadva!', 'success');
  } else {
    showToast('Kérlek írj be egy feladatot!', 'error');
    taskInput.focus();
  }
});

// ── Filter Tabs ───────────────────────────────
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.filter = tab.dataset.filter;
    render();
  });
});

// ── Category Filter ───────────────────────────
catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.categoryFilter = btn.dataset.category;
    render();
  });
});

// ── Search ────────────────────────────────────
searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value;
  render();
});

// ── Sort ──────────────────────────────────────
sortSelect.addEventListener('change', () => {
  state.sortBy = sortSelect.value;
  render();
});

// ── Bulk Actions ──────────────────────────────
completeAllBtn.addEventListener('click', async () => {
  for (const task of state.tasks) {
    if (!task.completed) {
      await toggleTask(task.id);
    }
  }
  render();
  showToast('Összes feladat teljesítve!', 'success');
});

clearCompBtn.addEventListener('click', async () => {
  const count = state.tasks.filter(t => t.completed).length;
  if (count === 0) { showToast('Nincs kész feladat.'); return; }
  if (confirm(`Biztosan törlöd a ${count} kész feladatot?`)) {
    for (const task of state.tasks.filter(t => t.completed)) {
      await deleteTask(task.id);
    }
    render();
    showToast(`${count} feladat törölve.`, 'warning');
  }
});

clearAllBtn.addEventListener('click', async () => {
  if (state.tasks.length === 0) { showToast('Nincs feladat.'); return; }
  if (confirm('Biztosan törlöd az összes feladatot?')) {
    for (const task of [...state.tasks]) {
      await deleteTask(task.id);
    }
    render();
    showToast('Összes feladat törölve.', 'warning');
  }
});

// ── Telegram Modal ────────────────────────────
function openTelegramModal() {
  const cfg = getTelegramSettings();
  tgEnabled.checked    = cfg.enabled;
  tgBotToken.value     = cfg.botToken;
  tgChatId.value       = cfg.chatId;
  tgOnAdd.checked      = cfg.onAdd;
  tgOnComplete.checked = cfg.onComplete;
  tgOnDelete.checked   = cfg.onDelete;
  tgOnOverdue.checked  = cfg.onOverdue;
  telegramModal.style.display = 'flex';
}

function closeTelegramModal() {
  telegramModal.style.display = 'none';
}

telegramBtn.addEventListener('click', openTelegramModal);

cancelTelegram.addEventListener('click', closeTelegramModal);

telegramModal.addEventListener('click', (e) => {
  if (e.target === telegramModal) closeTelegramModal();
});

saveTelegram.addEventListener('click', async () => {
  const cfg = {
    enabled:    tgEnabled.checked,
    botToken:   tgBotToken.value.trim(),
    chatId:     tgChatId.value.trim(),
    onAdd:      tgOnAdd.checked,
    onComplete: tgOnComplete.checked,
    onDelete:   tgOnDelete.checked,
    onOverdue:  tgOnOverdue.checked,
  };
  await saveTelegramSettings(cfg);
  closeTelegramModal();

  // Reflect Telegram status in header button
  updateTelegramBtnState(cfg.enabled);

  showToast('Telegram beállítások mentve.', 'success');
});

tgTest.addEventListener('click', async () => {
  const token  = tgBotToken.value.trim();
  const chatId = tgChatId.value.trim();
  if (!token || !chatId) {
    showToast('Bot Token és Chat ID megadása kötelező!', 'error');
    return;
  }

  const origText     = tgTest.textContent;
  tgTest.textContent = '...';
  tgTest.disabled    = true;

  const result = await testTelegramApi(token, chatId);

  if (result.success) {
    showToast('Teszt üzenet elküldve!', 'success');
  } else {
    showToast('Sikertelen küldés — ' + (result.error || 'ellenőrizd a Token-t és a Chat ID-t!'), 'error', 4000);
  }

  tgTest.textContent = origText;
  tgTest.disabled    = false;
});

function updateTelegramBtnState(enabled) {
  telegramBtn.title = enabled
    ? 'Telegram értesítések: AKTÍV'
    : 'Telegram értesítések konfigurálása';
  telegramBtn.style.borderColor = enabled ? 'rgba(0,245,255,0.5)' : '';
  telegramBtn.style.color       = enabled ? 'var(--neon-cyan)' : '';
}

// ── Keyboard shortcuts ────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEditModal();
    closeTelegramModal();
  }
});

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    addTaskForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
});

// ── Drag & Drop ───────────────────────────────
let dragSrcId = null;

function onDragStart(e) {
  dragSrcId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  this.classList.remove('dragging');
  $$('.task-item').forEach(el => el.classList.remove('drag-over'));
  dragSrcId = null;
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this.dataset.id !== dragSrcId) this.classList.add('drag-over');
}

function onDragLeave() {
  this.classList.remove('drag-over');
}

async function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const targetId = this.dataset.id;
  if (!dragSrcId || dragSrcId === targetId) return;

  const srcIdx = state.tasks.findIndex(t => t.id === dragSrcId);
  const tgtIdx = state.tasks.findIndex(t => t.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;

  const [moved] = state.tasks.splice(srcIdx, 1);
  state.tasks.splice(tgtIdx, 0, moved);
  
  const taskIds = state.tasks.map(t => t.id);
  await apiCall('reorderTasks', 'POST', { taskIds });
  render();
}

// ── Demo data ────────────────────────────────
async function seedDemo() {
  // Nincsenek demo feladatok - üresen indul az alkalmazás
}

// ── Init ─────────────────────────────────────
(async function init() {
  await loadTasks();
  await loadTelegramSettings();
  seedDemo();
  render();

  taskDueDate.min = today();

  // Reflect saved Telegram state in header button
  updateTelegramBtnState(telegramSettings.enabled);

  // Daily overdue check — runs after a short delay to avoid blocking render
  setTimeout(checkOverdueNotifications, 2500);
})();
