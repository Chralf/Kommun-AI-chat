// Content script som injicerar sidebar till höger på skärmen

console.debug('=== KOMMUN AI CHAT: CONTENT SCRIPT LADDAD ===', {
  url: window.location.href,
  readyState: document.readyState
});

const DEFAULT_API_URL = '';
const DEFAULT_MODEL_NAME = '';
const DEFAULT_ALLOWED_DOMAINS = [];

// SVG-ikoner för att undvika CSP-problem
const ICONS = {
  history: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41l-0.36,2.54c-0.59,0.24-1.13,0.56-1.62,0.94l-2.39-0.96c-0.22-0.08-0.47,0-0.59,0.22 L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>',
  restart_alt: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
  content_copy: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  delete: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>'
};

// Konfiguration (läses från storage)
let CONFIG = {
  OPENWEBUI_BASE_URL: '',
  API_ENDPOINT: '/api/v1',
  MODEL_NAME: DEFAULT_MODEL_NAME,
  API_KEY: '',
  MAX_CONTENT_LENGTH: 5000,
  SIDEBAR_WIDTH: '400px',
  ALLOWED_DOMAINS: [...DEFAULT_ALLOWED_DOMAINS],
  API_TIMEOUT_SECONDS: 30,
  EXTENSION_NAME: 'Kommun AI Chat',
  MAX_SESSIONS: 50
};

// AI-inställningar
let aiConfigs = [];
let selectedAIId = null;

// Session-hantering
let currentSessionId = null;
let currentView = 'chat'; // 'chat' eller 'history'
let sessionSaveQueue = Promise.resolve();
let historySearchTimeoutId = null;
let pageContextIgnored = false; // Om användaren har valt att ignorera sidinnehåll

function sanitizeBaseUrl(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return '';
  }
  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return '';
  }
}

function normalizeDomain(domain) {
  if (!domain) return null;
  let value = domain.trim().toLowerCase();
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      value = new URL(value).hostname;
    } catch {
      return null;
    }
  }

  value = value.replace(/^\.+/, '');

  if (!/^[a-z0-9.-]+$/.test(value)) {
    return null;
  }

  return value;
}

function sanitizeAllowedDomains(input) {
  if (!input) return [];
  return Array.from(
    new Set(
      input
        .split('\n')
        .map(normalizeDomain)
        .filter(Boolean)
    )
  );
}

// Ladda konfiguration från storage
async function loadConfig() {
  const settings = await chrome.storage.local.get([
    'allowed_domains',
    'extension_name',
    'chat_session_limit',
    'ai_configs',
    'selected_ai_id'
  ]);
  
  CONFIG.EXTENSION_NAME = (settings.extension_name || 'Kommun AI Chat').trim();
  CONFIG.MAX_SESSIONS = parseInt(settings.chat_session_limit) || 50;
  
  const sanitizedDomains = sanitizeAllowedDomains(settings.allowed_domains);
  CONFIG.ALLOWED_DOMAINS = sanitizedDomains.length > 0 ? sanitizedDomains : [...DEFAULT_ALLOWED_DOMAINS];
  
  // Ladda AI-inställningar
  aiConfigs = Array.isArray(settings.ai_configs) ? settings.ai_configs : [];
  selectedAIId = settings.selected_ai_id || null;
  
  // Om ingen AI är vald men det finns AI-konfigurationer, välj första automatiskt
  if (!selectedAIId && aiConfigs.length > 0) {
    const firstAI = aiConfigs[0];
    if (firstAI && isValidAIId(firstAI.id)) {
      selectedAIId = firstAI.id;
      await chrome.storage.local.set({ selected_ai_id: selectedAIId });
      console.debug('Kommun AI Chat: Automatiskt valde första AI vid laddning:', firstAI.name);
    }
  }
  
  // Uppdatera dropdown
  updateAIDropdown();
  
  // Uppdatera vald AI
  updateSelectedAI();
  
  console.debug('Kommun AI Chat: Config loaded', {
    aiConfigs: aiConfigs.length,
    selectedAIId,
    domains: CONFIG.ALLOWED_DOMAINS.length,
    extensionName: CONFIG.EXTENSION_NAME,
    maxSessions: CONFIG.MAX_SESSIONS
  });
  
  return CONFIG;
}

// Validera AI ID
function isValidAIId(aiId) {
  if (!aiId || typeof aiId !== 'string') return false;
  // AI ID ska börja med 'ai-' och innehålla bara alfanumeriska tecken, bindestreck och punkter
  return /^ai-[a-z0-9.-]+$/i.test(aiId);
}

// Hämta vald AI-inställning
function getSelectedAIConfig() {
  if (!selectedAIId || !aiConfigs.length || !isValidAIId(selectedAIId)) {
    return null;
  }
  return aiConfigs.find(config => config.id === selectedAIId) || null;
}

// Uppdatera vald AI
function updateSelectedAI() {
  const aiConfig = getSelectedAIConfig();
  if (aiConfig) {
    CONFIG.OPENWEBUI_BASE_URL = aiConfig.api_url || '';
    CONFIG.API_KEY = (aiConfig.api_key || '').trim();
    CONFIG.MODEL_NAME = (aiConfig.model_name || DEFAULT_MODEL_NAME).trim() || DEFAULT_MODEL_NAME;
    CONFIG.API_ENDPOINT = (aiConfig.api_endpoint_path || '/api/v1').trim();
    CONFIG.API_TIMEOUT_SECONDS = parseInt(aiConfig.api_timeout_seconds) || 30;
    
    console.log('📝 Kommun AI Chat: AI-inställning aktiv', {
      namn: aiConfig.name,
      modell: CONFIG.MODEL_NAME,
      api_url: CONFIG.OPENWEBUI_BASE_URL,
      endpoint: CONFIG.API_ENDPOINT
    });
  } else {
    CONFIG.OPENWEBUI_BASE_URL = '';
    CONFIG.API_KEY = '';
    CONFIG.MODEL_NAME = DEFAULT_MODEL_NAME;
    CONFIG.API_ENDPOINT = '/api/v1';
    CONFIG.API_TIMEOUT_SECONDS = 30;
    
    console.warn('⚠️ Kommun AI Chat: Ingen AI-inställning vald');
  }
}

// Uppdatera AI-dropdown
function updateAIDropdown() {
  const dropdown = document.getElementById('ai-select');
  if (!dropdown) {
    console.debug('Kommun AI Chat: Dropdown finns inte än, hoppar över uppdatering');
    return;
  }
  
  dropdown.innerHTML = '';
  
  console.debug('Kommun AI Chat: Uppdaterar dropdown med', aiConfigs.length, 'AI-inställningar');
  
  if (aiConfigs.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Inga AI-inställningar';
    option.disabled = true;
    dropdown.appendChild(option);
    return;
  }
  
  aiConfigs.forEach(config => {
    const option = document.createElement('option');
    option.value = config.id;
    option.textContent = config.name || 'Namnlös AI';
    if (config.id === selectedAIId) {
      option.selected = true;
    }
    dropdown.appendChild(option);
  });
  
  console.debug('Kommun AI Chat: Dropdown uppdaterad, vald AI:', selectedAIId);
}

// Funktionen behövs inte längre eftersom vi använder SVG-ikoner direkt
function ensureMaterialIconsLoaded() {
  // Inga externa ikoner behövs
}

// Kontrollera om vi är på en tillåten domän
function isAllowedDomain() {
  const currentDomain = window.location.hostname;
  
  for (const allowedDomain of CONFIG.ALLOWED_DOMAINS) {
    if (currentDomain === allowedDomain || currentDomain.endsWith('.' + allowedDomain)) {
      return true;
    }
  }
  
  return false;
}

// Deklarera variabler först
let sidebarVisible = false;
let sidebarElement = null;

console.debug('Kommun AI Chat: Variabler deklarerade');

// Ladda config och initialisera
(async function() {
  console.debug('Kommun AI Chat: Laddar konfiguration...');
  await loadConfig();
  
  // Kontrollera om vi är på en tillåten domän
  if (!isAllowedDomain()) {
    console.debug('Kommun AI Chat: Domän inte tillåten:', window.location.hostname);
    return;
  }
  
  console.debug('Kommun AI Chat: Domän tillåten, försöker initialisera...');
  
  if (document.body) {
    console.debug('Kommun AI Chat: Body finns, initialiserar sidebar');
    initSidebar();
  } else {
    console.debug('Kommun AI Chat: Body finns inte än, väntar på DOMContentLoaded');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.debug('Kommun AI Chat: DOMContentLoaded, initialiserar sidebar');
        initSidebar();
      });
    } else {
      // Om readyState är 'interactive' eller 'complete' men body saknas, vänta lite
      setTimeout(() => {
        console.debug('Kommun AI Chat: Timeout, försöker initialisera igen');
        if (document.body) {
          initSidebar();
        }
      }, 100);
    }
  }
})();

// Skapa ny session
async function createNewSession() {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  currentSessionId = sessionId;
  // Spara som aktiv session
  await chrome.storage.local.set({ current_active_session_id: sessionId });
  return sessionId;
}

// Ladda session
async function loadSession(sessionId) {
  const { chat_sessions } = await chrome.storage.local.get('chat_sessions');
  const sessions = chat_sessions || [];
  const session = sessions.find(s => s.id === sessionId);
  
  if (session) {
    currentSessionId = sessionId;
    // Sätt som aktiv session
    await chrome.storage.local.set({ current_active_session_id: sessionId });
    window.chatHistory = session.messages || [];
    displayChatHistory();
    switchToChatView();
    // Uppdatera sessionens URL och title
    await updateSessionUrlAndTitle();
    return true;
  }
  
  return false;
}

// Spara nuvarande session
function saveCurrentSession() {
  if (!currentSessionId || !Array.isArray(window.chatHistory) || window.chatHistory.length === 0) {
    return sessionSaveQueue;
  }

  const saveTask = async () => {
    try {
      const { chat_sessions } = await chrome.storage.local.get('chat_sessions');
      const sessions = Array.isArray(chat_sessions) ? [...chat_sessions] : [];
      const now = Date.now();
      const sessionIndex = sessions.findIndex((s) => s.id === currentSessionId);
      const sessionData = {
        id: currentSessionId,
        url: window.location.href,
        title: (document.title || '').substring(0, 200),
        timestamp: now,
        messages: window.chatHistory.map((msg) => ({ ...msg }))
      };

      if (sessionIndex >= 0) {
        sessions[sessionIndex] = sessionData;
      } else {
        sessions.push(sessionData);
      }

      sessions.sort((a, b) => b.timestamp - a.timestamp);

      if (sessions.length > CONFIG.MAX_SESSIONS) {
        sessions.length = CONFIG.MAX_SESSIONS;
      }

      await chrome.storage.local.set({ chat_sessions: sessions });
    } catch (error) {
      console.error('Kommun AI Chat: Kunde inte spara session', error);
    }
  };

  sessionSaveQueue = sessionSaveQueue.then(saveTask, saveTask);
  return sessionSaveQueue;
}

// Initialisera sidebar
async function initSidebar() {
  // Om sidebaren redan är initialiserad, returnera
  if (sidebarElement) {
    return;
  }
  
  console.debug('Kommun AI Chat: Initialiserar sidebar...');
  
  await loadConfig();
  ensureMaterialIconsLoaded();
  
  // Skapa sidebar HTML med Material Icons
  const sidebarHTML = `
    <div id="kommun-sidebar" class="kommun-sidebar">
      <div class="sidebar-header">
        <h2 id="extension-name">${escapeHtml(CONFIG.EXTENSION_NAME)}</h2>
        <div class="header-actions">
          <button id="history-btn" class="icon-btn" title="Chatthistorik">
            ${ICONS.history}
          </button>
          <button id="settings-btn" class="icon-btn" title="Inställningar">
            ${ICONS.settings}
          </button>
        </div>
      </div>
      <div class="sidebar-content">
        <!-- Chat-vy -->
        <div id="chat-view" class="view-container">
        <div id="chat-container" class="chat-container">
          <div id="chat-history" class="chat-history">
            <p class="empty-message">Inga meddelanden än. Ställ en fråga för att börja!</p>
          </div>
        </div>
        <div class="input-section">
          <div id="page-context-badge" class="page-context-badge" style="display: none;">
            <label class="badge-checkbox-label">
              <input type="checkbox" id="include-page-context" checked>
              <span class="badge-text">Fråga på aktuell sida</span>
            </label>
          </div>
          <textarea 
            id="question-input" 
            class="question-input"
            placeholder="Ställ en fråga..."
            rows="3"
          ></textarea>
          <div class="input-actions">
            <select id="ai-select" class="ai-select" title="Välj AI">
            </select>
            <button id="new-chat-btn" class="btn-icon" title="Ny chatt">
              ${ICONS.restart_alt}
            </button>
            <button id="send-btn" class="btn-primary">Skicka</button>
          </div>
          </div>
        </div>
        
        <!-- Historik-vy -->
        <div id="history-view" class="view-container" style="display: none;">
          <div class="history-header">
            <input type="text" id="history-search" class="history-search" placeholder="Sök i chatthistorik...">
          </div>
          <div id="history-list" class="history-list">
            <p class="empty-message">Inga sparade chattar än.</p>
          </div>
        </div>
      </div>
      <div id="loader" class="loader" style="display: none;">
        <div class="spinner"></div>
        <p>Tänker...</p>
      </div>
    </div>
  `;

  // Injicera sidebar i DOM
  const sidebarDiv = document.createElement('div');
  sidebarDiv.innerHTML = sidebarHTML;
  sidebarElement = sidebarDiv.firstElementChild;
  document.body.appendChild(sidebarElement);

  // Ladda chatthistorik och sessioner
  await loadChatHistory();
  await loadSessions();

  // Setup event listeners
  setupEventListeners();
  updateHeaderControls();

  // Uppdatera dropdown efter att sidebar skapats
  updateAIDropdown();

  // Extrahera sidinnehåll
  extractPageContent();
  
  // Uppdatera badge för sidinnehåll
  updatePageContextBadge();

  // Uppdatera extension-namn i header
  updateExtensionName();

  // Kontrollera om AI-inställningar finns
  const { ai_configs } = await chrome.storage.local.get('ai_configs');
  const hasSettings = Array.isArray(ai_configs) && ai_configs.length > 0;
  
  console.debug('Kommun AI Chat: Har inställningar:', hasSettings);
  
  // Om inga inställningar finns, visa sidebaren direkt
  if (!hasSettings) {
    console.debug('Kommun AI Chat: Inga inställningar, visar sidebar');
    showSidebar();
  } else {
    // Annars, kontrollera om sidebaren ska vara synlig
    const { sidebar_visible } = await chrome.storage.local.get('sidebar_visible');
    console.debug('Kommun AI Chat: Sidebar state från storage:', sidebar_visible);
    
    if (sidebar_visible === true) {
      console.debug('Kommun AI Chat: Visar sidebar (från storage)');
      showSidebar();
    } else {
      console.debug('Kommun AI Chat: Sidebar dold som standard');
    }
  }
}

// Visa/dölj sidebar
function showSidebar() {
  if (sidebarElement) {
    sidebarElement.classList.add('visible');
    sidebarVisible = true;
    // Justera body margin för att göra plats
    document.body.style.marginRight = CONFIG.SIDEBAR_WIDTH;
    // Spara state
    chrome.storage.local.set({ sidebar_visible: true });
    console.debug('Kommun AI Chat: Sidebar synlig, state sparad');
  }
}

function hideSidebar() {
  if (sidebarElement) {
    sidebarElement.classList.remove('visible');
    sidebarVisible = false;
    document.body.style.marginRight = '0';
    // Spara state
    chrome.storage.local.set({ sidebar_visible: false });
    console.debug('Kommun AI Chat: Sidebar dold, state sparad');
  }
}

// Öppna inställningar (popup)
function openSettings() {
  console.debug('Kommun AI Chat: Öppnar inställningar');
  chrome.runtime.sendMessage({ action: 'open_settings' });
}

// Extrahera relevant innehåll från sidan
function extractPageContent() {
  const content = [];
  
  // Titel
  const title = document.title;
  content.push(`Sidtitel: ${title}`);
  
  // URL
  content.push(`URL: ${window.location.href}`);
  
  // Huvudinnehåll
  const mainContent = document.querySelector('main') || document.querySelector('article') || document.body;
  
  // Rubriker
  const headings = mainContent.querySelectorAll('h1, h2, h3');
  if (headings.length > 0) {
    content.push('\nRubriker:');
    headings.forEach(h => {
      content.push(`- ${h.textContent.trim()}`);
    });
  }
  
  // Brödtext (begränsa längd)
  const paragraphs = mainContent.querySelectorAll('p');
  if (paragraphs.length > 0) {
    content.push('\nInnehåll:');
    let charCount = 0;
    const maxChars = 3000;
    
    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (text && charCount < maxChars) {
        content.push(text);
        charCount += text.length;
      }
    }
  }
  
  // Länkar (begränsat antal)
  const links = mainContent.querySelectorAll('a[href]');
  if (links.length > 0) {
    content.push('\nViktiga länkar:');
    Array.from(links).slice(0, 10).forEach(link => {
      const text = link.textContent.trim();
      const href = link.href;
      if (text && href && !href.includes('#')) {
        content.push(`- ${text}: ${href}`);
      }
    });
  }
  
  // Spara i global variabel
  window.currentPageContent = content.join('\n');
}

// Uppdatera extension-namn i header
function updateExtensionName() {
  const nameElement = document.getElementById('extension-name');
  if (nameElement) {
    nameElement.textContent = CONFIG.EXTENSION_NAME;
  }
}

// Uppdatera badge för sidinnehåll
function updatePageContextBadge() {
  const badge = document.getElementById('page-context-badge');
  if (!badge) return;
  
  if (window.currentPageContent) {
    badge.style.display = 'flex';
    // Uppdatera checkbox baserat på pageContextIgnored
    const checkbox = document.getElementById('include-page-context');
    if (checkbox) {
      checkbox.checked = !pageContextIgnored;
    }
  } else {
    badge.style.display = 'none';
  }
}

// Ladda chatthistorik från storage
async function loadChatHistory() {
  try {
    // Försök ladda nuvarande session om den finns
    if (currentSessionId) {
      const { chat_sessions } = await chrome.storage.local.get('chat_sessions');
      const sessions = chat_sessions || [];
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        window.chatHistory = session.messages || [];
        displayChatHistory();
        // Uppdatera sessionens URL och title
        await updateSessionUrlAndTitle();
        return;
      }
    }
    
    // Om ingen session finns, försök ladda den senaste aktiva sessionen
    const { current_active_session_id, chat_sessions } = await chrome.storage.local.get(['current_active_session_id', 'chat_sessions']);
    if (current_active_session_id) {
      const sessions = chat_sessions || [];
      const activeSession = sessions.find(s => s.id === current_active_session_id);
      if (activeSession) {
        currentSessionId = current_active_session_id;
        window.chatHistory = activeSession.messages || [];
        displayChatHistory();
        // Uppdatera sessionens URL och title
        await updateSessionUrlAndTitle();
        return;
      }
    }
    
    // Om ingen aktiv session finns, skapa ny
    if (!currentSessionId) {
      await createNewSession();
      window.chatHistory = [];
      displayChatHistory();
    }
  } catch (error) {
    console.error('Fel vid laddning av chatthistorik:', error);
    window.chatHistory = [];
    if (!currentSessionId) {
      await createNewSession();
    }
  }
}

// Uppdatera sessionens URL och title
async function updateSessionUrlAndTitle() {
  if (!currentSessionId) return;
  
  try {
    const { chat_sessions } = await chrome.storage.local.get('chat_sessions');
    const sessions = Array.isArray(chat_sessions) ? [...chat_sessions] : [];
    const sessionIndex = sessions.findIndex((s) => s.id === currentSessionId);
    
    if (sessionIndex >= 0) {
      sessions[sessionIndex].url = window.location.href;
      sessions[sessionIndex].title = (document.title || '').substring(0, 200);
      sessions[sessionIndex].timestamp = Date.now();
      await chrome.storage.local.set({ chat_sessions: sessions });
    }
  } catch (error) {
    console.debug('Kunde inte uppdatera session URL/title:', error);
  }
}

// Ladda sessioner för historik-vyn
async function loadSessions(searchQuery = '') {
  try {
    const { chat_sessions } = await chrome.storage.local.get('chat_sessions');
    const sessions = Array.isArray(chat_sessions) ? [...chat_sessions] : [];
    sessions.sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
    displayHistoryList(sessions, searchQuery);
  } catch (error) {
    console.error('Fel vid laddning av sessioner:', error);
  }
}

function escapeHtml(text) {
  const safeText = text == null ? '' : String(text);
  return safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

// Konvertera Markdown till HTML (sanitiserad)
function markdownToHtml(text) {
  if (!text) {
    return '';
  }

  const links = [];
  const textWithPlaceholders = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) {
      return label;
    }
    const placeholder = `__LINK_${links.length}__`;
    links.push({
      placeholder,
      html: `<a href="${escapeHtml(safeUrl)}" class="link-same-tab">${escapeHtml(label)}</a>`
    });
    return placeholder;
  });

  let html = escapeHtml(textWithPlaceholders);

  html = html.replace(/^### (.*)$/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gim, '<h1>$1</h1>');

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  html = html.replace(/^- (.*)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  html = html.replace(/\n{2,}/g, '</p><p>');
  html = `<p>${html}</p>`;

  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-3]>)/g, '$1');
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');

  links.forEach(({ placeholder, html: linkHtml }) => {
    // placeholder är redan escaped i textWithPlaceholders, så vi behöver inte escape igen
    html = html.replace(placeholder, linkHtml);
  });

  return html;
}

// Visa chatthistorik
function displayChatHistory(history = window.chatHistory || []) {
  const container = document.getElementById('chat-history');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = '<p class="empty-message">Inga meddelanden än. Ställ en fråga för att börja!</p>';
    return;
  }
  
  history.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${msg.role}`;
    
    if (msg.role === 'assistant') {
      // Formatera Markdown för assistant-meddelanden
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = markdownToHtml(msg.content);
      
      // Lägg till kopiera-knapp
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.title = 'Kopiera';
      copyBtn.innerHTML = ICONS.content_copy;
      copyBtn.addEventListener('click', () => copyToClipboard(msg.content, copyBtn));
      
      messageDiv.appendChild(contentDiv);
      messageDiv.appendChild(copyBtn);
    } else {
      messageDiv.textContent = msg.content;
    }
    
    container.appendChild(messageDiv);
  });
  
  // Scrolla till botten
  container.scrollTop = container.scrollHeight;
}

// Kopiera till urklipp
async function copyToClipboard(text, buttonElement) {
  try {
    await navigator.clipboard.writeText(text);
    // Visa feedback
    if (buttonElement) {
      const original = buttonElement.innerHTML;
      buttonElement.innerHTML = ICONS.check;
      buttonElement.style.color = '#28a745';
      setTimeout(() => {
        buttonElement.innerHTML = original;
        buttonElement.style.color = '';
      }, 1000);
    }
  } catch (error) {
    console.error('Kunde inte kopiera:', error);
  }
}

// Visa historik-lista
function displayHistoryList(sessions = [], searchQuery = '') {
  const container = document.getElementById('history-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Filtrera sessioner baserat på sökning
  let filteredSessions = sessions;
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredSessions = sessions.filter(session => {
      const titleMatch = session.title?.toLowerCase().includes(query);
      const urlMatch = session.url?.toLowerCase().includes(query);
      const messageMatch = session.messages?.some(msg => 
        msg.content?.toLowerCase().includes(query)
      );
      return titleMatch || urlMatch || messageMatch;
    });
  }
  
  if (filteredSessions.length === 0) {
    container.innerHTML = '<p class="empty-message">Inga sparade chattar hittades.</p>';
    return;
  }
  
  filteredSessions.forEach(session => {
    const sessionDiv = document.createElement('div');
    sessionDiv.className = 'history-item';
    if (session.id === currentSessionId) {
      sessionDiv.classList.add('history-item--active');
    }
    
    const date = new Date(session.timestamp);
    const dateStr = date.toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const title = session.title || 'Namnlös sida';
    const url = session.url || '';
    const urlShort = url.length > 50 ? url.substring(0, 50) + '...' : url;
    const messageCount = session.messages?.length || 0;
    
    sessionDiv.innerHTML = `
      <div class="history-item-content">
        <div class="history-item-title">${escapeHtml(title)}</div>
        <div class="history-item-url">${escapeHtml(urlShort)}</div>
        <div class="history-item-meta">
          <span class="history-item-date">${escapeHtml(dateStr)}</span>
          <span class="history-item-count">${messageCount} meddelanden</span>
        </div>
      </div>
      <div class="history-item-actions">
        <button class="history-item-delete" title="Ta bort" data-session-id="${escapeHtml(session.id)}">
          ${ICONS.delete}
        </button>
      </div>
    `;
    
    // Lägg till klick-händelse för att ladda sessionen
    sessionDiv.querySelector('.history-item-content').addEventListener('click', async () => {
      await loadSession(session.id);
    });
    
    // Lägg till klick-händelse för att ta bort sessionen
    sessionDiv.querySelector('.history-item-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Vill du ta bort denna chatt?')) {
        await deleteSession(session.id);
      }
    });
    
    container.appendChild(sessionDiv);
  });
}

// Ta bort session
async function deleteSession(sessionId) {
  const { chat_sessions } = await chrome.storage.local.get('chat_sessions');
  const sessions = chat_sessions || [];
  const filtered = sessions.filter(s => s.id !== sessionId);
  
  await chrome.storage.local.set({ chat_sessions: filtered });
  
  // Om det var nuvarande session, skapa ny
  if (currentSessionId === sessionId) {
    await createNewSession();
    window.chatHistory = [];
    displayChatHistory();
  }
  
  // Uppdatera historik-listan
  const historySearchField = document.getElementById('history-search');
  const searchQuery = historySearchField ? historySearchField.value.trim() : '';
  await loadSessions(searchQuery);
}

// Växla till chat-vy
function switchToChatView() {
  currentView = 'chat';
  const chatView = document.getElementById('chat-view');
  const historyView = document.getElementById('history-view');
  if (chatView) chatView.style.display = 'flex';
  if (historyView) historyView.style.display = 'none';
  updateHeaderControls();
}

// Växla till historik-vy
async function switchToHistoryView() {
  currentView = 'history';
  const chatView = document.getElementById('chat-view');
  const historyView = document.getElementById('history-view');
  if (chatView) chatView.style.display = 'none';
  if (historyView) historyView.style.display = 'flex';
  updateHeaderControls();

  const historySearchField = document.getElementById('history-search');
  const searchQuery = historySearchField ? historySearchField.value.trim() : '';
  await loadSessions(searchQuery);
  if (historySearchField) {
    historySearchField.focus();
  }
}

function updateHeaderControls() {
  const historyBtn = document.getElementById('history-btn');
  if (historyBtn) {
    historyBtn.classList.toggle('active', currentView === 'history');
  }
}

// Lägg till meddelande
async function addMessage(role, content) {
  if (!window.chatHistory) {
    window.chatHistory = [];
  }
  
  // Skapa session om den inte finns
  if (!currentSessionId) {
    await createNewSession();
  }
  
  window.chatHistory.push({ 
    role, 
    content, 
    timestamp: Date.now() 
  });
  
  // Visa i UI
  displayChatHistory();
  
  // Spara till storage (async)
  saveCurrentSession();
}

// Throttling för streaming-uppdateringar
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 50; // Max 20 uppdateringar/sekund (1000ms / 20 = 50ms)

function throttledDisplayChatHistory() {
  const now = Date.now();
  if (now - lastUpdateTime >= UPDATE_INTERVAL) {
    displayChatHistory();
    lastUpdateTime = now;
  } else {
    // Schemalägg uppdatering om den inte redan är schemalagd
    if (!window.pendingUpdate) {
      window.pendingUpdate = setTimeout(() => {
        displayChatHistory();
        window.pendingUpdate = null;
        lastUpdateTime = Date.now();
      }, UPDATE_INTERVAL - (now - lastUpdateTime));
    }
  }
}

// Ställ fråga till AI
async function askQuestion() {
  const input = document.getElementById('question-input');
  const question = input.value.trim();
  
  if (!question) {
    return;
  }
  
  // Lägg till användarmeddelande
  await addMessage('user', question);
  input.value = '';
  
  // Kontrollera om vi har en vald AI, om inte försök välja första tillgängliga
  let aiConfig = getSelectedAIConfig();
  if (!aiConfig && aiConfigs.length > 0) {
    // Om ingen AI är vald men det finns AI-konfigurationer, välj första automatiskt
    const firstAI = aiConfigs[0];
    if (firstAI && isValidAIId(firstAI.id)) {
      selectedAIId = firstAI.id;
      await chrome.storage.local.set({ selected_ai_id: selectedAIId });
      updateSelectedAI();
      updateAIDropdown();
      aiConfig = getSelectedAIConfig();
      console.log('🔄 Kommun AI Chat: Automatiskt valde första AI:', firstAI.name);
    }
  }
  
  // Uppdatera CONFIG baserat på vald AI innan kontroll
  updateSelectedAI();
  
  if (!CONFIG.OPENWEBUI_BASE_URL || !CONFIG.API_KEY) {
    if (aiConfigs.length === 0) {
      await addMessage('error', 'Konfigurera API-server och nyckel under Inställningar innan du ställer frågor.');
    } else {
      await addMessage('error', 'Välj en AI-källa i dropdown-menyn innan du ställer frågor.');
    }
    return;
  }
  
  // Kontrollera om vi har permission för API-URL:en
  try {
    const urlObj = new URL(CONFIG.OPENWEBUI_BASE_URL);
    const origin = urlObj.origin;
    const permissionUrl = origin + '/*';
    
    const hasPermission = await chrome.permissions.contains({
      origins: [permissionUrl]
    });
    
    if (!hasPermission) {
      await addMessage('error', 'Tillstånd att ansluta till API-servern saknas. Vänligen gå till Inställningar och spara API-konfigurationen igen för att ge tillstånd.');
      return;
    }
  } catch (error) {
    console.error('Fel vid kontroll av permissions:', error);
    // Fortsätt ändå - permission kan finnas eller hanteras senare
  }
  
  // Loggning av vilken AI som används
  const activeAIConfig = getSelectedAIConfig();
  console.log('🚀 Kommun AI Chat: Skickar fråga', {
    ai_namn: activeAIConfig?.name || 'Okänd',
    modell: CONFIG.MODEL_NAME,
    api_url: CONFIG.OPENWEBUI_BASE_URL,
    endpoint: CONFIG.API_ENDPOINT,
    fråga: question.substring(0, 50) + (question.length > 50 ? '...' : '')
  });
  
  try {
    // Bygg prompt med sidkontext - AI:n kan använda kunskapsdatabasen om frågan inte hänger ihop med sidinnehållet
    let prompt = question;
    if (window.currentPageContent && !pageContextIgnored) {
      const truncatedContent = window.currentPageContent.substring(0, CONFIG.MAX_CONTENT_LENGTH);
      prompt = `Sidinnehåll från ${window.location.hostname}:\n\n${truncatedContent}\n\n---\n\nInstruktion: Om frågan är relaterad till sidinnehållet ovan, använd det för att svara. Om frågan inte är relaterad till sidinnehållet, använd din kunskapsdatabas istället.\n\nFråga från medarbetare: ${question}`;
    }
    
    // Skapa AbortController för timeout
    const controller = new AbortController();
    let timeoutId = null;
    
    try {
      timeoutId = setTimeout(() => controller.abort(), (CONFIG.API_TIMEOUT_SECONDS || 30) * 1000);
      
      // Anropa Open WebUI API med streaming
    const response = await fetch(`${CONFIG.OPENWEBUI_BASE_URL}${CONFIG.API_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CONFIG.MODEL_NAME,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
          stream: true
        }),
        signal: controller.signal
      });
      
      // Rensa timeout om fetch lyckades
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API-fel: ${response.status} - ${errorText}`);
    }
    
      // Hantera streaming-svar
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = '';
      
      // Skapa ett temporärt meddelande för streaming
      const tempMessageId = Date.now();
      window.chatHistory.push({ 
        role: 'assistant', 
        content: '', 
        timestamp: tempMessageId,
        isStreaming: true
      });
      displayChatHistory();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content || '';
              if (content) {
                fullAnswer += content;
                
                // Uppdatera det streamande meddelandet med throttling
                const msgIndex = window.chatHistory.findIndex(m => m.timestamp === tempMessageId);
                if (msgIndex !== -1) {
                  window.chatHistory[msgIndex].content = fullAnswer;
                  throttledDisplayChatHistory();
                }
              }
            } catch (e) {
              console.debug('Kunde inte parsa chunk:', e);
            }
          }
        }
      }
      
      // Ta bort streaming-flaggan och gör en sista uppdatering
      const msgIndex = window.chatHistory.findIndex(m => m.timestamp === tempMessageId);
      if (msgIndex !== -1) {
        delete window.chatHistory[msgIndex].isStreaming;
        displayChatHistory();
        // Spara till storage
        await saveCurrentSession();
      }
    } finally {
      // Rensa timeout om den fortfarande är aktiv
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      await addMessage('error', 'API-förfrågan avbröts på grund av timeout.');
    } else {
    console.error('Fel vid fråga:', error);
    await addMessage('error', `Ett fel uppstod: ${error.message}`);
    }
  }
}

// Starta ny chatt
async function newChat() {
  // Spara nuvarande session om den har meddelanden
  if (currentSessionId && window.chatHistory && window.chatHistory.length > 0) {
    await saveCurrentSession();
  }
  
  // Återställ pageContextIgnored när man startar ny chatt
  pageContextIgnored = false;
  
  // Skapa ny session
  await createNewSession();
  window.chatHistory = [];
  displayChatHistory();
  
  // Uppdatera badge
  updatePageContextBadge();
}

// Setup event listeners
function setupEventListeners() {
  // Inställningar
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }
  
  // Historik-knapp
  const historyBtn = document.getElementById('history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', async () => {
      if (currentView === 'chat') {
        await switchToHistoryView();
      } else {
        switchToChatView();
      }
    });
  }
  
  // Sök i historik
  const historySearch = document.getElementById('history-search');
  if (historySearch) {
    historySearch.addEventListener('input', () => {
      if (historySearchTimeoutId) {
        clearTimeout(historySearchTimeoutId);
      }
      historySearchTimeoutId = setTimeout(async () => {
        const currentQuery = historySearch.value.trim();
        await loadSessions(currentQuery);
      }, 200);
    });
  }
  
  // Send button
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', askQuestion);
  }
  
  // New chat button
  const newChatBtn = document.getElementById('new-chat-btn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', newChat);
  }
  
  // Include page context checkbox
  const includePageContextCheckbox = document.getElementById('include-page-context');
  if (includePageContextCheckbox) {
    includePageContextCheckbox.addEventListener('change', (e) => {
      pageContextIgnored = !e.target.checked;
    });
  }
  
  // AI dropdown
  const aiSelect = document.getElementById('ai-select');
  if (aiSelect) {
    aiSelect.addEventListener('change', async (e) => {
      const newAIId = e.target.value || null;
      // Validera AI ID innan sparning
      if (newAIId && !isValidAIId(newAIId)) {
        console.error('Kommun AI Chat: Ogiltigt AI-ID valt');
        return;
      }
      
      const oldAIId = selectedAIId;
      selectedAIId = newAIId;
      
      // Loggning
      const oldConfig = aiConfigs.find(c => c.id === oldAIId);
      const newConfig = aiConfigs.find(c => c.id === newAIId);
      
      console.log('🔄 Kommun AI Chat: AI ändrad i dropdown', {
        från: oldConfig ? { id: oldConfig.id, namn: oldConfig.name, modell: oldConfig.model_name } : 'Ingen',
        till: newConfig ? { id: newConfig.id, namn: newConfig.name, modell: newConfig.model_name } : 'Ingen'
      });
      
      await chrome.storage.local.set({ selected_ai_id: selectedAIId });
      updateSelectedAI();
      
      console.log('✅ Kommun AI Chat: AI-inställning uppdaterad', {
        api_url: CONFIG.OPENWEBUI_BASE_URL,
        modell: CONFIG.MODEL_NAME,
        endpoint: CONFIG.API_ENDPOINT,
        timeout: CONFIG.API_TIMEOUT_SECONDS
      });
    });
  }
  
  // Enter för att skicka (Ctrl+Enter för ny rad)
  const questionInput = document.getElementById('question-input');
  if (questionInput) {
    questionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        askQuestion();
      }
    });
  }
  
  // Lyssna på URL-ändringar (för SPA)
  let lastUrl = location.href;
  new MutationObserver(async () => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      pageContextIgnored = false; // Återställ när man navigerar till ny sida
      extractPageContent();
      updatePageContextBadge();
      // Uppdatera sessionens URL och title när man navigerar
      await updateSessionUrlAndTitle();
    }
  }).observe(document, { subtree: true, childList: true });
}

// Lyssna på meddelanden från background script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.debug('Kommun AI Chat: Meddelande mottaget:', request);
  
  if (request.action === 'settings_updated') {
    console.debug('Kommun AI Chat: Inställningar uppdaterade, laddar om config');
    await loadConfig();
    updateExtensionName();
    // Uppdatera dropdown om sidebaren är initialiserad
    if (sidebarElement) {
      updateAIDropdown();
      updateSelectedAI();
    }
    
    // Kontrollera om vi fortfarande är på en tillåten domän
    if (!isAllowedDomain() && sidebarElement) {
      console.debug('Kommun AI Chat: Domän inte längre tillåten, tar bort sidebar');
      sidebarElement.remove();
      sidebarElement = null;
      sidebarVisible = false;
      document.body.style.marginRight = '0';
      chrome.storage.local.set({ sidebar_visible: false });
    } else if (isAllowedDomain() && !sidebarElement) {
      console.debug('Kommun AI Chat: Domän nu tillåten, initialiserar sidebar');
      await initSidebar();
    }
    
    sendResponse({ success: true });
  } else if (request.action === 'show') {
    console.debug('Kommun AI Chat: Show-action mottagen');
    // Om sidebaren inte är initialiserad, initialisera den först
    if (!sidebarElement) {
      console.debug('Kommun AI Chat: Sidebar inte initialiserad, initialiserar nu');
      await initSidebar();
    }
    // Visa sidebaren
    showSidebar();
    sendResponse({ success: true });
  } else if (request.action === 'hide') {
    console.debug('Kommun AI Chat: Hide-action mottagen');
    hideSidebar();
        sendResponse({ success: true });
  } else if (request.action === 'toggle') {
    console.debug('Kommun AI Chat: Toggle-action mottagen');
    if (sidebarVisible) {
      hideSidebar();
    } else {
      if (!sidebarElement) {
        await initSidebar();
      }
      showSidebar();
    }
    sendResponse({ success: true });
  } else if (request.action === 'showMessage') {
    alert(request.message || 'Meddelande från extension');
    sendResponse({ success: true });
  } else if (request.action === 'clear_chat_history') {
    console.debug('Kommun AI Chat: Rensar chatthistorik');
    // Rensa sessioner och aktiv session-ID
    await chrome.storage.local.set({ 
      chat_sessions: [],
      current_active_session_id: null
    });
    // Skapa ny session
    await createNewSession();
    window.chatHistory = [];
    displayChatHistory();
    await loadSessions();
    sendResponse({ success: true });
  }
  
  return true;
});

