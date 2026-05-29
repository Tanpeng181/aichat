function resolveApiBase() {
  const metaBase = document.querySelector('meta[name="api-base"]')?.content?.trim();
  if (metaBase) {
    return metaBase.replace(/\/$/, '');
  }

  const globalBase = typeof window.__API_BASE__ === 'string' ? window.__API_BASE__.trim() : '';
  if (globalBase) {
    return globalBase.replace(/\/$/, '');
  }

  const queryBase = new URLSearchParams(window.location.search).get('apiBase') || new URLSearchParams(window.location.search).get('api_base');
  if (queryBase) {
    return queryBase.trim().replace(/\/$/, '');
  }

  if (window.location.protocol !== 'file:') {
    if (window.location.port === '18080') {
      return `${window.location.protocol}//${window.location.hostname}:8080`;
    }
    return window.location.origin;
  }

  return 'http://127.0.0.1';
}

const API_BASE = resolveApiBase();
const STORAGE_KEY = 'aichat.lastSessionId';

const state = {
  sessions: [],
  models: [],
  currentSessionId: '',
  currentSessionModel: '',
  currentSessionTitle: '新对话',
  currentSessionSubtitle: '等待选择模型并开始消息交互',
  messages: [],
  isLoadingHistory: false,
  isLoadingModels: false,
  isStreaming: false,
  modalOpen: false,
  selectedModel: '',
  renderQueued: false,
  lastActiveElement: null,
  activeStreamController: null,
};

const els = {};

const LANGUAGE_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  python: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  bash: 'bash',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  html: 'html',
  xml: 'html',
  svg: 'html',
  css: 'css',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
  go: 'go',
  rust: 'rust',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kotlin: 'kotlin',
};

const KEYWORDS = {
  javascript: ['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield'],
  typescript: ['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'private', 'protected', 'public', 'readonly', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield'],
  python: ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'],
  bash: ['case', 'do', 'done', 'elif', 'else', 'esac', 'fi', 'for', 'function', 'if', 'in', 'then', 'until', 'while'],
  c: ['break', 'case', 'char', 'const', 'continue', 'default', 'do', 'else', 'enum', 'extern', 'float', 'for', 'if', 'inline', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while'],
  cpp: ['alignas', 'alignof', 'asm', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'constexpr', 'continue', 'decltype', 'default', 'delete', 'do', 'else', 'enum', 'explicit', 'export', 'extern', 'false', 'final', 'float', 'for', 'friend', 'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private', 'protected', 'public', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while'],
  json: ['false', 'null', 'true'],
  yaml: ['true', 'false', 'null', 'yes', 'no', 'on', 'off'],
  html: ['html', 'head', 'body', 'div', 'span', 'script', 'style', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'button', 'input', 'textarea', 'label', 'form', 'img', 'svg', 'path', 'g', 'rect', 'circle', 'meta', 'link'],
  css: ['align-items', 'animation', 'background', 'border', 'box-shadow', 'color', 'display', 'flex', 'font-size', 'height', 'justify-content', 'line-height', 'margin', 'opacity', 'padding', 'position', 'transform', 'transition', 'width', 'z-index'],
  sql: ['and', 'as', 'asc', 'between', 'by', 'case', 'create', 'delete', 'desc', 'distinct', 'drop', 'exists', 'false', 'from', 'group', 'having', 'in', 'insert', 'into', 'join', 'left', 'like', 'limit', 'not', 'null', 'on', 'or', 'order', 'select', 'set', 'table', 'then', 'true', 'union', 'update', 'values', 'where'],
  go: ['break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var'],
  rust: ['as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while'],
  java: ['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try', 'void', 'volatile', 'while'],
  kotlin: ['as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias', 'val', 'var', 'when', 'while'],
  markdown: ['TODO', 'FIXME'],
  generic: ['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'let', 'null', 'return', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'while'],
};

const COMMENT_MARKERS = {
  javascript: [{ start: '//', end: '\n' }, { start: '/*', end: '*/' }],
  typescript: [{ start: '//', end: '\n' }, { start: '/*', end: '*/' }],
  c: [{ start: '//', end: '\n' }, { start: '/*', end: '*/' }],
  cpp: [{ start: '//', end: '\n' }, { start: '/*', end: '*/' }],
  java: [{ start: '//', end: '\n' }, { start: '/*', end: '*/' }],
  go: [{ start: '//', end: '\n' }, { start: '/*', end: '*/' }],
  rust: [{ start: '//', end: '\n' }, { start: '/*', end: '*/' }],
  sql: [{ start: '--', end: '\n' }, { start: '/*', end: '*/' }],
  css: [{ start: '/*', end: '*/' }],
  html: [{ start: '<!--', end: '-->' }],
  python: [{ start: '#', end: '\n' }],
  bash: [{ start: '#', end: '\n' }],
  yaml: [{ start: '#', end: '\n' }],
};

const STRING_DELIMITERS = {
  javascript: ['"', "'", '`'],
  typescript: ['"', "'", '`'],
  c: ['"', "'"],
  cpp: ['"', "'"],
  java: ['"', "'"],
  go: ['"', "'", '`'],
  rust: ['"', "'"],
  python: ['"', "'"],
  bash: ['"', "'"],
  json: ['"'],
  sql: ['"', "'", '`'],
  html: ['"', "'"],
  css: ['"', "'"],
  yaml: ['"', "'"],
  generic: ['"', "'", '`'],
};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  renderSessionList();
  renderMessages();
  updateComposerState();
  showWelcomeView();
  loadSessions();
});

function cacheElements() {
  els.newChatTopBtn = document.getElementById('newChatTopBtn');
  els.newChatCenterBtn = document.getElementById('newChatCenterBtn');
  els.sessionList = document.getElementById('sessionList');
  els.welcomeView = document.getElementById('welcomeView');
  els.chatView = document.getElementById('chatView');
  els.chatTitle = document.getElementById('chatTitle');
  els.chatSubtitle = document.getElementById('chatSubtitle');
  els.chatModelBadge = document.getElementById('chatModelBadge');
  els.messageList = document.getElementById('messageList');
  els.composerForm = document.getElementById('composerForm');
  els.messageInput = document.getElementById('messageInput');
  els.charCount = document.getElementById('charCount');
  els.sendButton = document.getElementById('sendButton');
  els.modelModal = document.getElementById('modelModal');
  els.closeModalBtn = document.getElementById('closeModalBtn');
  els.cancelModelBtn = document.getElementById('cancelModelBtn');
  els.confirmModelBtn = document.getElementById('confirmModelBtn');
  els.modelGrid = document.getElementById('modelGrid');
  els.toastArea = document.getElementById('toastArea');
}

function bindEvents() {
  els.newChatTopBtn.addEventListener('click', openModelPicker);
  els.newChatCenterBtn.addEventListener('click', openModelPicker);
  els.closeModalBtn.addEventListener('click', closeModelPicker);
  els.cancelModelBtn.addEventListener('click', closeModelPicker);
  els.confirmModelBtn.addEventListener('click', createSessionFromSelection);
  els.modelModal.addEventListener('click', (event) => {
    if (event.target === els.modelModal || event.target.classList.contains('modal-backdrop')) {
      closeModelPicker();
    }
  });

  els.sessionList.addEventListener('click', handleSessionListClick);
  els.messageList.addEventListener('click', handleMessageListClick);
  els.composerForm.addEventListener('submit', handleSendMessage);
  els.messageInput.addEventListener('input', handleComposerInput);
  els.messageInput.addEventListener('keydown', handleComposerKeydown);
  els.modelGrid.addEventListener('change', handleModelGridChange);
  document.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('beforeunload', abortActiveStream);
}

async function loadSessions(options = {}) {
  const silent = Boolean(options.silent);
  const clearMissingCurrent = Boolean(options.clearMissingCurrent);
  try {
    const payload = await apiJson('/api/sessions');
    const sessions = Array.isArray(payload.data) ? payload.data.map(normalizeSession).sort((a, b) => b.updated_at - a.updated_at) : [];
    state.sessions = sessions;

    if (state.currentSessionId) {
      const current = sessions.find((session) => session.id === state.currentSessionId);
      if (current) {
        state.currentSessionModel = current.model || state.currentSessionModel;
        state.currentSessionTitle = current.first_user_message?.trim() || state.currentSessionTitle;
        state.currentSessionSubtitle = buildSubtitle(current, state.messages.length);
      } else if (clearMissingCurrent) {
        clearCurrentSession({ keepWelcome: true });
      }
    }

    renderSessionList();
    updateComposerState();
  } catch (error) {
    if (!silent) {
      toast(error.message || '获取会话列表失败', 'error');
    }
    state.sessions = [];
    renderSessionList();
  }
}

async function openModelPicker() {
  if (state.isStreaming || state.isLoadingHistory || state.isLoadingModels) {
    toast('请先等待当前操作完成', 'info');
    return;
  }

  state.lastActiveElement = document.activeElement;
  state.modalOpen = true;
  state.selectedModel = '';
  els.modelGrid.innerHTML = renderLoadingCard('正在获取模型列表...');
  showModal();
  updateConfirmButtonState();

  try {
    state.isLoadingModels = true;
    updateConfirmButtonState();
    const payload = await apiJson('/api/models');
    if (!state.modalOpen) {
      return;
    }
    state.models = Array.isArray(payload.data) ? payload.data.map(normalizeModel) : [];
    if (!state.models.length) {
      els.modelGrid.innerHTML = '<div class="empty-state">暂无可用模型</div>';
      state.selectedModel = '';
      updateConfirmButtonState();
      return;
    }

    state.selectedModel = state.models[0].name;
    renderModelGrid();
  } catch (error) {
    toast(error.message || '获取模型列表失败', 'error');
    closeModelPicker();
  } finally {
    state.isLoadingModels = false;
    updateConfirmButtonState();
  }
}

function renderModelGrid() {
  if (!state.models.length) {
    els.modelGrid.innerHTML = '<div class="empty-state">暂无可用模型</div>';
    return;
  }

  els.modelGrid.innerHTML = state.models.map((model, index) => {
    const checked = state.selectedModel ? state.selectedModel === model.name : index === 0;
    return `
      <label class="model-card${checked ? ' active' : ''}">
        <input type="radio" name="model-choice" value="${escapeAttr(model.name)}"${checked ? ' checked' : ''}>
        <div class="model-head">
          <div class="model-name">${escapeHtml(model.name)}</div>
          <span class="model-radio" aria-hidden="true"></span>
        </div>
        <div class="model-desc">${escapeHtml(model.desc || '该模型暂未提供描述')}</div>
      </label>
    `;
  }).join('');
  updateConfirmButtonState();
}

async function createSessionFromSelection() {
  if (state.isLoadingModels || state.isStreaming || state.isLoadingHistory) {
    toast('请先等待当前操作完成', 'info');
    return;
  }

  if (!state.selectedModel) {
    toast('请先选择一个模型', 'error');
    return;
  }

  const modelName = state.selectedModel;
  const hadActiveSession = Boolean(state.currentSessionId);
  closeModelPicker();

  try {
    const payload = await apiJson('/api/session', {
      method: 'POST',
      body: JSON.stringify({ model: modelName }),
    });

    const data = payload.data || {};
    const sessionId = data.session_id || data.sessionId || data.id;
    if (!sessionId) {
      throw new Error('创建会话失败，未返回会话ID');
    }

    const session = normalizeSession({
      id: sessionId,
      model: data.model || modelName,
      created_at: Date.now(),
      updated_at: Date.now(),
      message_count: 0,
      first_user_message: '',
    });

    upsertSession(session);
    setCurrentSession(session.id, session.model, '新对话', `模型：${session.model} · 等待输入第一条消息`);
    state.messages = [];
    state.isLoadingHistory = true;
    showChatView();
    renderMessages();
    updateComposerState();
    localStorage.setItem(STORAGE_KEY, session.id);

    await loadHistoryForSession(session.id, { sessionMeta: session });
    toast('会话创建成功', 'success');
    loadSessions({ silent: true });
  } catch (error) {
    toast(error.message || '创建会话失败', 'error');
    if (hadActiveSession) {
      showChatView();
      updateChatHeader();
      renderMessages();
    } else {
      showWelcomeView();
    }
  }
}

async function loadHistoryForSession(sessionId, options = {}) {
  const sessionMeta = options.sessionMeta || state.sessions.find((session) => session.id === sessionId);
  if (!sessionId) {
    return;
  }

  state.currentSessionId = sessionId;
  state.currentSessionModel = sessionMeta?.model || state.currentSessionModel || '';
  state.currentSessionTitle = sessionMeta?.first_user_message?.trim() || state.currentSessionTitle || '新对话';
  state.currentSessionSubtitle = buildSubtitle(sessionMeta, 0, true);
  state.messages = [];
  state.isLoadingHistory = true;
  showChatView();
  updateChatHeader();
  renderMessages();
  updateComposerState();

  try {
    const payload = await apiJson(`/api/session/${encodeURIComponent(sessionId)}/history`);
    const history = Array.isArray(payload.data) ? payload.data.map(normalizeMessage).sort((a, b) => a.timestamp - b.timestamp) : [];
    state.messages = history;

    const firstUserMessage = history.find((message) => message.role === 'user');
    if (firstUserMessage) {
      state.currentSessionTitle = firstUserMessage.content.slice(0, 64) || '新对话';
    } else if (sessionMeta?.first_user_message) {
      state.currentSessionTitle = sessionMeta.first_user_message.slice(0, 64);
    }

    state.currentSessionModel = sessionMeta?.model || state.currentSessionModel || '';
    state.currentSessionSubtitle = buildSubtitle(sessionMeta, history.length);
    state.isLoadingHistory = false;
    updateChatHeader();
    renderMessages();
    renderSessionList();
    scrollMessageListToBottom();
    updateComposerState();
    if (sessionId === localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, sessionId);
    }
  } catch (error) {
    state.isLoadingHistory = false;
    updateChatHeader();
    renderMessages();
    updateComposerState();
    toast(error.message || '加载历史消息失败', 'error');
  }
}

function handleSessionListClick(event) {
  const deleteButton = event.target.closest('[data-delete-session]');
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    deleteSession(deleteButton.dataset.deleteSession);
    return;
  }

  const card = event.target.closest('[data-session-id]');
  if (!card) {
    return;
  }

  const sessionId = card.dataset.sessionId;
  if (!sessionId || sessionId === state.currentSessionId) {
    return;
  }

  if (state.isStreaming || state.isLoadingHistory || state.isLoadingModels) {
    toast('请先等待当前操作完成', 'info');
    return;
  }

  const session = state.sessions.find((item) => item.id === sessionId) || null;
  state.currentSessionId = sessionId;
  state.currentSessionModel = session?.model || '';
  state.currentSessionTitle = session?.first_user_message?.trim() || '新对话';
  state.currentSessionSubtitle = buildSubtitle(session, 0, true);
  state.messages = [];
  state.isLoadingHistory = true;
  showChatView();
  renderMessages();
  updateChatHeader();
  updateComposerState();
  localStorage.setItem(STORAGE_KEY, sessionId);
  loadHistoryForSession(sessionId, { sessionMeta: session });
}

async function deleteSession(sessionId) {
  if (!sessionId) {
    return;
  }

  if (state.isStreaming || state.isLoadingHistory || state.isLoadingModels) {
    toast('请先等待当前操作完成', 'info');
    return;
  }

  try {
    await apiJson(`/api/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    state.sessions = state.sessions.filter((session) => session.id !== sessionId);
    if (state.currentSessionId === sessionId) {
      clearCurrentSession({ keepWelcome: true });
      localStorage.removeItem(STORAGE_KEY);
    }
    renderSessionList();
    updateComposerState();
    toast('会话已删除', 'success');
  } catch (error) {
    toast(error.message || '删除会话失败', 'error');
  }
}

function handleComposerInput() {
  autoResizeComposer();
  updateComposerState();
}

function handleComposerKeydown(event) {
  if (event.key !== 'Enter') {
    return;
  }

  if (event.shiftKey) {
    return;
  }

  event.preventDefault();
  handleSendMessage(event);
}

async function handleSendMessage(event) {
  event.preventDefault();

  if (state.isStreaming || state.isLoadingHistory || !state.currentSessionId) {
    return;
  }

  const rawText = els.messageInput.value;
  const text = rawText.trim();
  if (!text) {
    return;
  }

  if (text.length > 2000) {
    toast('消息长度不能超过2000字', 'error');
    return;
  }

  const sessionId = state.currentSessionId;
  const userMessage = {
    role: 'user',
    content: text,
    timestamp: Date.now(),
    pending: false,
  };
  const assistantMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    pending: true,
  };

  state.messages.push(userMessage, assistantMessage);
  els.messageInput.value = '';
  autoResizeComposer();
  updateComposerState();
  renderMessages();
  scrollMessageListToBottom();

  state.isStreaming = true;
  updateComposerState();

  try {
    state.activeStreamController = new AbortController();
    const response = await fetch(`${API_BASE}/api/message/async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message: text }),
      signal: state.activeStreamController.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    assistantMessage.content = '';
    let buffer = '';

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              done = true;
              break;
            }
            if (dataStr) {
              try {
                const parsedStr = JSON.parse(dataStr);
                assistantMessage.content += parsedStr;
                scheduleMessageRender();
                scrollMessageListToBottom();
              } catch (e) {
                console.warn('Failed to parse SSE data', dataStr, e);
              }
            }
          }
        }
      }
    }

    assistantMessage.pending = false;
    scheduleMessageRender();
  } catch (error) {
    if (error.name === 'AbortError') {
      toast('消息发送已取消', 'info');
    } else {
      assistantMessage.pending = false;
      assistantMessage.content = `**请求失败**\n\n${error.message || '未知错误'}`;
      scheduleMessageRender();
      toast(error.message || '消息发送失败', 'error');
    }
  } finally {
    state.isStreaming = false;
    updateComposerState();
    scheduleMessageRender();
    scrollMessageListToBottom();
    loadSessions({ silent: true });
  }
}

function handleModelGridChange(event) {
  const input = event.target.closest('input[name="model-choice"]');
  if (!input) {
    return;
  }

  state.selectedModel = input.value;
  renderModelGrid();
}

function handleMessageListClick(event) {
  const copyButton = event.target.closest('.copy-code-btn');
  if (!copyButton) {
    return;
  }

  const codeShell = copyButton.closest('.code-shell');
  const codeElement = codeShell ? codeShell.querySelector('code') : null;
  const text = codeElement ? codeElement.textContent || '' : '';
  if (!text) {
    toast('没有可复制的代码', 'info');
    return;
  }

  copyText(text)
    .then(() => {
      const original = copyButton.textContent;
      copyButton.textContent = '已复制';
      setTimeout(() => {
        copyButton.textContent = original;
      }, 1200);
      toast('代码已复制', 'success');
    })
    .catch(() => {
      toast('复制失败', 'error');
    });
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && state.modalOpen) {
    closeModelPicker();
  }
}

function showWelcomeView() {
  els.welcomeView.classList.remove('hidden');
  els.chatView.classList.add('hidden');
  updateChatHeader();
}

function showChatView() {
  els.welcomeView.classList.add('hidden');
  els.chatView.classList.remove('hidden');
}

function clearCurrentSession(options = {}) {
  abortActiveStream();
  state.currentSessionId = '';
  state.currentSessionModel = '';
  state.currentSessionTitle = '新对话';
  state.currentSessionSubtitle = '等待选择模型并开始消息交互';
  state.messages = [];
  state.isLoadingHistory = false;
  state.isStreaming = false;
  renderMessages();
  updateChatHeader();
  updateComposerState();
  if (options.keepWelcome !== false) {
    showWelcomeView();
  }
}

function abortActiveStream() {
  if (state.activeStreamController) {
    state.activeStreamController.abort();
    state.activeStreamController = null;
  }
}

function updateChatHeader() {
  els.chatTitle.textContent = state.currentSessionTitle || '新对话';
  els.chatSubtitle.textContent = state.currentSessionSubtitle || '等待选择模型并开始消息交互';
  els.chatModelBadge.textContent = state.currentSessionModel || '未选择';
}

function renderSessionList() {
  if (!state.sessions.length) {
    els.sessionList.innerHTML = '<div class="empty-state">暂无历史会话，点击“新建对话”开始新的交流。</div>';
    return;
  }

  els.sessionList.innerHTML = state.sessions.map((session) => {
    const active = session.id === state.currentSessionId;
    const timeText = formatTimestamp(session.updated_at) || '未知时间';
    const messageText = session.first_user_message || '暂无第一条消息';
    const countText = `${Number(session.message_count || 0)} 条消息`;
    return `
      <article class="session-card${active ? ' active' : ''}" data-session-id="${escapeAttr(session.id)}">
        <div class="session-head">
          <div class="session-time">${escapeHtml(timeText)}</div>
          <button class="session-delete" type="button" data-delete-session="${escapeAttr(session.id)}" aria-label="删除会话">...</button>
        </div>
        <div class="session-message" title="${escapeAttr(messageText)}">${escapeHtml(messageText)}</div>
        <div class="session-foot">
          <span class="session-model">${escapeHtml(session.model || '未知模型')}</span>
          <span class="session-count">${escapeHtml(countText)}</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderMessages() {
  if (!state.currentSessionId) {
    els.messageList.innerHTML = '';
    return;
  }

  if (state.isLoadingHistory) {
    els.messageList.innerHTML = `
      <div class="empty-state">
        <div>正在加载历史消息</div>
        <div class="empty-state-subtext">请稍候...</div>
      </div>
    `;
    return;
  }

  if (!state.messages.length) {
    els.messageList.innerHTML = `
      <div class="empty-state">
        <div>当前会话还没有消息</div>
        <div class="empty-state-subtext">在下方输入内容后即可开始对话</div>
      </div>
    `;
    return;
  }

  els.messageList.innerHTML = state.messages.map((message) => renderMessage(message)).join('');
}

function renderMessage(message) {
  const isUser = message.role === 'user';
  const sideClass = isUser ? 'user' : 'assistant';
  const avatar = isUser ? '我' : 'AI';
  const timeText = formatTimestamp(message.timestamp) || '刚刚';
  const bubbleClass = isUser ? 'user' : 'assistant';
  const content = isUser ? renderPlainText(message.content) : renderAssistantContent(message);

  return `
    <div class="message-row ${sideClass}">
      <div class="avatar ${sideClass}">${escapeHtml(avatar)}</div>
      <div class="message-body">
        <div class="bubble ${bubbleClass}">
          ${content}
        </div>
        <div class="message-meta">${escapeHtml(timeText)}</div>
      </div>
    </div>
  `;
}

function renderAssistantContent(message) {
  if (message.pending && !message.content.trim()) {
    return '<div class="typing-indicator" aria-label="生成中"><span></span><span></span><span></span></div>';
  }

  const markdown = markdownToHtml(message.content || '');
  return markdown ? `<div class="markdown-body">${markdown}</div>` : '<div class="markdown-body"><p></p></div>';
}

function renderPlainText(text) {
  return `<div class="markdown-body">${escapeHtml(String(text || '')).replace(/\n/g, '<br>')}</div>`;
}

function scheduleMessageRender() {
  if (state.renderQueued) {
    return;
  }

  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    renderMessages();
    updateChatHeader();
    scrollMessageListToBottom();
  });
}

function scrollMessageListToBottom() {
  requestAnimationFrame(() => {
    els.messageList.scrollTop = els.messageList.scrollHeight;
  });
}

function autoResizeComposer() {
  const textarea = els.messageInput;
  textarea.style.height = 'auto';
  const targetHeight = Math.min(textarea.scrollHeight, 220);
  textarea.style.height = `${Math.max(targetHeight, 92)}px`;
  const currentLength = textarea.value.length;
  els.charCount.textContent = `${currentLength}/2000`;
  if (currentLength >= 1800) {
    els.charCount.style.color = 'var(--danger)';
  } else {
    els.charCount.style.color = 'var(--muted)';
  }
}

function updateComposerState() {
  const hasText = els.messageInput.value.trim().length > 0;
  const ready = Boolean(state.currentSessionId) && hasText && !state.isStreaming && !state.isLoadingHistory;
  els.sendButton.disabled = !ready;
  els.newChatTopBtn.disabled = state.isStreaming || state.isLoadingHistory || state.isLoadingModels;
  els.newChatCenterBtn.disabled = state.isStreaming || state.isLoadingHistory || state.isLoadingModels;
  els.confirmModelBtn.disabled = state.isLoadingModels || !state.selectedModel;
  autoResizeComposer();
}

function updateConfirmButtonState() {
  els.confirmModelBtn.disabled = state.isLoadingModels || !state.selectedModel;
}

function showModal() {
  els.modelModal.classList.remove('hidden');
  els.modelModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => {
    els.confirmModelBtn.focus();
  }, 0);
}

function closeModelPicker() {
  state.modalOpen = false;
  state.selectedModel = '';
  state.isLoadingModels = false;
  els.modelModal.classList.add('hidden');
  els.modelModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  updateConfirmButtonState();
  if (state.lastActiveElement && typeof state.lastActiveElement.focus === 'function') {
    state.lastActiveElement.focus();
  }
}

function renderLoadingCard(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function normalizeSession(session) {
  const createdAt = normalizeTimestamp(session.created_at ?? session.createdAt ?? 0);
  const updatedAt = normalizeTimestamp(session.updated_at ?? session.updatedAt ?? createdAt);
  return {
    id: String(session.id || session.session_id || ''),
    model: String(session.model || ''),
    created_at: createdAt,
    updated_at: updatedAt,
    message_count: Number(session.message_count || 0),
    first_user_message: String(session.first_user_message || ''),
  };
}

function normalizeModel(model) {
  return {
    name: String(model.name || '').trim(),
    desc: String(model.desc || '').trim(),
  };
}

function normalizeMessage(message) {
  const role = normalizeRole(message.role);
  return {
    id: String(message.id || ''),
    role,
    content: String(message.content || ''),
    timestamp: normalizeTimestamp(message.timestamp) || Date.now(),
    pending: false,
  };
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'user' || value === 'human' || value === 'client') {
    return 'user';
  }
  return 'assistant';
}

function buildSubtitle(session, messageCount = 0, loading = false) {
  const modelText = session?.model ? `模型：${session.model}` : '模型：未选择';
  if (loading) {
    return `${modelText} · 正在载入历史消息`;
  }
  const countText = messageCount > 0 ? ` · ${messageCount} 条消息` : '';
  const timeText = session?.updated_at ? ` · 更新于 ${formatTimestamp(session.updated_at)}` : '';
  return `${modelText}${countText}${timeText}`;
}

function upsertSession(session) {
  const index = state.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    state.sessions[index] = { ...state.sessions[index], ...session };
  } else {
    state.sessions.unshift(session);
  }
  state.sessions.sort((a, b) => b.updated_at - a.updated_at);
  renderSessionList();
}

function setCurrentSession(sessionId, modelName, title, subtitle) {
  state.currentSessionId = sessionId;
  state.currentSessionModel = modelName || '';
  state.currentSessionTitle = title || '新对话';
  state.currentSessionSubtitle = subtitle || buildSubtitle({ model: modelName, updated_at: Date.now() }, 0, true);
  showChatView();
  updateChatHeader();
  renderSessionList();
  updateComposerState();
}

async function apiJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error('服务器返回了无法解析的JSON');
    }
  }

  if (!response.ok) {
    throw new Error(payload.message || `请求失败(${response.status})`);
  }

  if (payload && payload.success === false) {
    throw new Error(payload.message || '请求失败');
  }

  return payload;
}

function consumeSseBuffer(buffer, assistantMessage) {
  let currentBuffer = buffer;
  let boundaryIndex = findSseBoundary(currentBuffer);

  while (boundaryIndex !== -1) {
    const eventText = currentBuffer.slice(0, boundaryIndex);
    currentBuffer = currentBuffer.slice(boundaryIndex + 2);
    const data = extractSseData(eventText);
    if (data === '[DONE]') {
      break;
    }
    if (data) {
      assistantMessage.content += data;
      scheduleMessageRender();
    }
    boundaryIndex = findSseBoundary(currentBuffer);
  }

  return currentBuffer;
}

function processSsePayload(payload, assistantMessage) {
  const normalized = String(payload || '').replace(/\r\n/g, '\n');
  consumeSseBuffer(normalized, assistantMessage);
}

function findSseBoundary(buffer) {
  const index = buffer.indexOf('\n\n');
  return index;
}

function extractSseData(eventText) {
  const lines = String(eventText || '').split('\n');
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^\s?/, ''));
    }
  }
  return dataLines.join('\n').trimEnd();
}

function markdownToHtml(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return '';
  }

  const lines = normalized.split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      index += 1;
      const codeLines = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'code', lang, content: codeLines.join('\n') });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (index < lines.length) {
        const quoteLine = lines[index].trim();
        if (!quoteLine.startsWith('>')) {
          break;
        }
        quoteLines.push(quoteLine.replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', content: quoteLines.join('\n') });
      continue;
    }

    if (/^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (index < lines.length) {
        const itemLine = lines[index];
        if (!/^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(itemLine)) {
          break;
        }
        const text = itemLine.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');
        items.push(text);
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !startsNewBlock(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: paragraphLines.join('\n') });
  }

  return blocks.map(renderMarkdownBlock).join('');
}

function startsNewBlock(line) {
  const trimmed = line.trim();
  return (
    !trimmed ||
    trimmed.startsWith('```') ||
    /^(#{1,6})\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line) ||
    /^---+$/.test(trimmed)
  );
}

function renderMarkdownBlock(block) {
  switch (block.type) {
    case 'code':
      return renderCodeBlock(block.lang, block.content);
    case 'heading':
      return `<h${block.level}>${renderInlineMarkdown(block.content)}</h${block.level}>`;
    case 'hr':
      return '<hr>';
    case 'quote':
      return `<blockquote>${renderInlineMarkdown(block.content).replace(/\n/g, '<br>')}</blockquote>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'paragraph':
    default:
      return `<p>${renderInlineMarkdown(block.content).replace(/\n/g, '<br>')}</p>`;
  }
}

function renderInlineMarkdown(text) {
  const placeholderCodes = [];
  const withPlaceholders = String(text || '').replace(/`([^`]+?)`/g, (_, code) => {
    const token = `@@CODE_${placeholderCodes.length}@@`;
    placeholderCodes.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  let html = escapeHtml(withPlaceholders);
  html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = sanitizeUrl(url);
    return `<a href="${escapeAttr(safeUrl)}" target="_blank" rel="noreferrer noopener">${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
  html = html.replace(/@@BR@@/g, '<br>');
  html = html.replace(/@@CODE_(\d+)@@/g, (_, index) => placeholderCodes[Number(index)] || '');
  return html;
}

function renderCodeBlock(language, code) {
  const lang = normalizeLanguageName(language);
  const displayLanguage = language ? language.trim() : 'text';
  const highlighted = highlightCode(code || '', lang);
  return `
    <div class="code-shell">
      <div class="code-shell-toolbar">
        <span>${escapeHtml(displayLanguage)}</span>
        <button type="button" class="copy-code-btn">复制</button>
      </div>
      <pre><code class="language-${escapeAttr(lang)}">${highlighted}</code></pre>
    </div>
  `;
}

function highlightCode(code, language) {
  const lang = normalizeLanguageName(language);
  const profile = getHighlightProfile(lang);
  const keywords = new Set(profile.keywords.map((keyword) => String(keyword).toLowerCase()));
  const markers = profile.commentMarkers;
  const strings = profile.stringDelimiters;

  let index = 0;
  let html = '';

  while (index < code.length) {
    const remaining = code.slice(index);

    const htmlTag = profile.tagMode ? readHtmlTag(code, index) : null;
    if (htmlTag) {
      html += `<span class="token tag">${escapeHtml(htmlTag.text)}</span>`;
      index = htmlTag.end;
      continue;
    }

    const comment = readComment(code, index, markers);
    if (comment) {
      html += `<span class="token comment">${escapeHtml(comment.text)}</span>`;
      index = comment.end;
      continue;
    }

    const stringToken = readString(code, index, strings);
    if (stringToken) {
      html += `<span class="token string">${escapeHtml(stringToken.text)}</span>`;
      index = stringToken.end;
      continue;
    }

    const numberToken = readNumber(remaining);
    if (numberToken) {
      html += `<span class="token number">${escapeHtml(numberToken.text)}</span>`;
      index += numberToken.text.length;
      continue;
    }

    const wordToken = readWord(code, index);
    if (wordToken) {
      const lower = wordToken.text.toLowerCase();
      if (keywords.has(lower)) {
        html += `<span class="token keyword">${escapeHtml(wordToken.text)}</span>`;
      } else if (looksLikeFunctionCall(code, wordToken.end)) {
        html += `<span class="token function">${escapeHtml(wordToken.text)}</span>`;
      } else {
        html += escapeHtml(wordToken.text);
      }
      index = wordToken.end;
      continue;
    }

    html += escapeHtml(code[index]);
    index += 1;
  }

  return html;
}

function getHighlightProfile(language) {
  const lang = normalizeLanguageName(language);
  const keywords = KEYWORDS[lang] || KEYWORDS.generic;
  const commentMarkers = COMMENT_MARKERS[lang] || COMMENT_MARKERS.javascript;
  const stringDelimiters = STRING_DELIMITERS[lang] || STRING_DELIMITERS.generic;
  const tagMode = lang === 'html';
  return { keywords, commentMarkers, stringDelimiters, tagMode };
}

function readComment(code, index, markers) {
  for (const marker of markers) {
    if (!code.startsWith(marker.start, index)) {
      continue;
    }

    if (marker.end === '\n') {
      const end = code.indexOf('\n', index);
      const text = end === -1 ? code.slice(index) : code.slice(index, end);
      return { text, end: index + text.length };
    }

    const endIndex = code.indexOf(marker.end, index + marker.start.length);
    const end = endIndex === -1 ? code.length : endIndex + marker.end.length;
    return { text: code.slice(index, end), end };
  }

  return null;
}

function readString(code, index, delimiters) {
  for (const delimiter of delimiters) {
    if (!code.startsWith(delimiter, index)) {
      continue;
    }

    const allowMultiline = delimiter === '`';
    let cursor = index + delimiter.length;
    while (cursor < code.length) {
      const character = code[cursor];
      if (character === '\\') {
        cursor += 2;
        continue;
      }
      if (!allowMultiline && character === '\n') {
        break;
      }
      if (code.startsWith(delimiter, cursor)) {
        cursor += delimiter.length;
        return { text: code.slice(index, cursor), end: cursor };
      }
      cursor += 1;
    }

    return { text: code.slice(index, cursor), end: cursor };
  }

  return null;
}

function readNumber(text) {
  const match = text.match(/^(?:0x[\da-fA-F]+|\d*\.\d+|\d+\.\d*|\d+)/);
  if (!match) {
    return null;
  }
  return { text: match[0], end: match[0].length };
}

function readWord(code, index) {
  const first = code[index];
  if (!/[A-Za-z_$]/.test(first)) {
    return null;
  }

  let cursor = index + 1;
  while (cursor < code.length && /[A-Za-z0-9_$]/.test(code[cursor])) {
    cursor += 1;
  }
  return { text: code.slice(index, cursor), end: cursor };
}

function readHtmlTag(code, index) {
  if (code[index] !== '<') {
    return null;
  }

  const next = code[index + 1];
  if (!next || /\s/.test(next)) {
    return null;
  }

  let cursor = index + 1;
  let quote = '';
  while (cursor < code.length) {
    const character = code[cursor];
    if (quote) {
      if (character === quote && code[cursor - 1] !== '\\') {
        quote = '';
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      cursor += 1;
      return { text: code.slice(index, cursor), end: cursor };
    }
    cursor += 1;
  }

  return { text: code.slice(index, cursor), end: cursor };
}

function looksLikeFunctionCall(code, index) {
  let cursor = index;
  while (cursor < code.length && /\s/.test(code[cursor])) {
    cursor += 1;
  }
  return code[cursor] === '(';
}

function normalizeLanguageName(language) {
  const value = String(language || '').trim().toLowerCase();
  if (!value) {
    return 'generic';
  }
  return LANGUAGE_ALIASES[value] || value;
}

function normalizeTimestamp(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return numeric < 1e11 ? numeric * 1000 : numeric;
}

function formatTimestamp(value) {
  const timestamp = normalizeTimestamp(value);
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(date).replaceAll('/', '-');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/`/g, '&#96;');
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(String(url || ''), window.location.origin);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch (error) {
    return '#';
  }
  return '#';
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        resolve();
      } else {
        reject(new Error('复制失败'));
      }
    } catch (error) {
      document.body.removeChild(textarea);
      reject(error);
    }
  });
}

function toast(message, kind = 'info') {
  const toastElement = document.createElement('div');
  toastElement.className = `toast ${kind}`;
  toastElement.textContent = String(message || '');
  els.toastArea.appendChild(toastElement);

  window.setTimeout(() => {
    toastElement.style.opacity = '0';
    toastElement.style.transform = 'translateY(6px)';
    toastElement.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  }, 2400);

  window.setTimeout(() => {
    if (toastElement.parentElement === els.toastArea) {
      els.toastArea.removeChild(toastElement);
    }
  }, 2800);
}
