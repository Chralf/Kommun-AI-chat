const DEFAULT_API_URL = '';
const DEFAULT_MODEL_NAME = '';
const DEFAULT_ALLOWED_DOMAINS = '';

let editingAIId = null;

function sanitizeBaseUrl(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return '';
  }
  try {
    const { origin } = new URL(trimmed);
    return origin;
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

function sanitizeEndpoint(endpoint) {
  if (!endpoint) return '/api/v1';
  const trimmed = endpoint.trim();
  if (!trimmed.startsWith('/')) {
    return '/' + trimmed;
  }
  return trimmed;
}

function generateAIId() {
  return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Ladda AI-inställningar
async function loadAIConfigs() {
  const { ai_configs } = await chrome.storage.local.get('ai_configs');
  return Array.isArray(ai_configs) ? ai_configs : [];
}

// Spara AI-inställningar
async function saveAIConfigs(configs) {
  await chrome.storage.local.set({ ai_configs: configs });
}

// Visa AI-lista
async function displayAIConfigs() {
  const configs = await loadAIConfigs();
  const listContainer = document.getElementById('ai-configs-list');
  
  if (configs.length === 0) {
    listContainer.innerHTML = '<p class="help-text" style="margin: 0;">Inga AI-inställningar än. Klicka på "Lägg till AI" för att börja.</p>';
    return;
  }
  
  listContainer.innerHTML = '';
  
  configs.forEach(config => {
    const item = document.createElement('div');
    item.className = 'ai-config-item';
    item.dataset.aiId = config.id;
    
    item.innerHTML = `
      <div class="ai-config-header">
        <div class="ai-config-name">${escapeHtml(config.name || 'Namnlös AI')}</div>
        <div class="ai-config-actions">
          <button class="btn-secondary btn-small ai-edit-btn" data-ai-id="${escapeHtml(config.id)}">Redigera</button>
          <button class="btn-danger btn-small ai-delete-btn" data-ai-id="${escapeHtml(config.id)}">Ta bort</button>
        </div>
      </div>
      <div class="ai-config-info">
        ${escapeHtml(config.api_url || '')} | ${escapeHtml(config.model_name || '')}
      </div>
    `;
    
    // Lägg till event listeners
    const editBtn = item.querySelector('.ai-edit-btn');
    const deleteBtn = item.querySelector('.ai-delete-btn');
    
    if (editBtn) {
      editBtn.addEventListener('click', () => editAIConfig(config.id));
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => deleteAIConfig(config.id));
    }
    
    listContainer.appendChild(item);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Öppna modal för att lägga till/redigera AI
function openAIForm(aiId = null) {
  editingAIId = aiId;
  const modal = document.getElementById('ai-form-modal');
  const title = document.getElementById('ai-form-title');
  
  if (aiId) {
    title.textContent = 'Redigera AI';
    loadAIConfigForEdit(aiId);
  } else {
    title.textContent = 'Lägg till AI';
    clearAIForm();
  }
  
  modal.style.display = 'flex';
}

// Validera AI ID
function isValidAIId(aiId) {
  if (!aiId || typeof aiId !== 'string') return false;
  // AI ID ska börja med 'ai-' och innehålla bara alfanumeriska tecken, bindestreck och punkter
  return /^ai-[a-z0-9.-]+$/i.test(aiId);
}

// Ladda AI-inställning för redigering
async function loadAIConfigForEdit(aiId) {
  if (!isValidAIId(aiId)) return;
  
  const configs = await loadAIConfigs();
  const config = configs.find(c => c.id === aiId);
  
  if (!config) return;
  
  document.getElementById('ai-name').value = config.name || '';
  document.getElementById('ai-api-url').value = config.api_url || '';
  document.getElementById('ai-api-key').value = config.api_key || '';
  document.getElementById('ai-model-name').value = config.model_name || '';
  document.getElementById('ai-api-endpoint').value = config.api_endpoint_path || '/api/v1';
  document.getElementById('ai-api-timeout').value = config.api_timeout_seconds || 30;
}

// Rensa AI-formulär
function clearAIForm() {
  document.getElementById('ai-name').value = '';
  document.getElementById('ai-api-url').value = '';
  document.getElementById('ai-api-key').value = '';
  document.getElementById('ai-model-name').value = '';
  document.getElementById('ai-api-endpoint').value = '/api/v1';
  document.getElementById('ai-api-timeout').value = 30;
  
  // Dölj testresultat
  const testResult = document.getElementById('ai-test-result');
  if (testResult) {
    testResult.style.display = 'none';
  }
}

// Stäng modal
function closeAIForm() {
  const modal = document.getElementById('ai-form-modal');
  modal.style.display = 'none';
  editingAIId = null;
  clearAIForm();
  
  // Dölj testresultat
  const testResult = document.getElementById('ai-test-result');
  if (testResult) {
    testResult.style.display = 'none';
  }
}

// Spara AI-inställning
async function saveAIConfig() {
  const name = document.getElementById('ai-name').value.trim();
  const apiUrlInput = document.getElementById('ai-api-url').value;
  const apiKey = document.getElementById('ai-api-key').value.trim();
  const modelName = document.getElementById('ai-model-name').value.trim();
  const apiEndpoint = document.getElementById('ai-api-endpoint').value.trim();
  const apiTimeout = document.getElementById('ai-api-timeout').value;

  if (!name) {
    showStatus('Namn krävs', 'error');
    return;
  }

  const sanitizedUrl = sanitizeBaseUrl(apiUrlInput);
  if (!sanitizedUrl) {
    showStatus('API Server URL måste börja med https:// och vara giltig.', 'error');
    return;
  }

  if (!apiKey) {
    showStatus('API-nyckel krävs', 'error');
    return;
  }

  if (!modelName) {
    showStatus('Modellnamn krävs', 'error');
    return;
  }

  const sanitizedEndpoint = sanitizeEndpoint(apiEndpoint);
  const timeoutSeconds = parseInt(apiTimeout) || 30;
  if (timeoutSeconds < 5 || timeoutSeconds > 300) {
    showStatus('Timeout måste vara mellan 5 och 300 sekunder.', 'error');
    return;
  }

  // Be om permission för API-URL:en
  try {
    const urlObj = new URL(sanitizedUrl);
    const origin = urlObj.origin;
    const permissionUrl = origin + '/*';
    
    const hasPermission = await chrome.permissions.contains({
      origins: [permissionUrl]
    });
    
    if (!hasPermission) {
      const granted = await chrome.permissions.request({
        origins: [permissionUrl]
      });
      
      if (!granted) {
        showStatus('Tillstånd att ansluta till API-servern nekades. Extensionen behöver detta tillstånd för att fungera.', 'error');
        return;
      }
    }
  } catch (error) {
    console.error('Fel vid kontroll av permissions:', error);
    // Fortsätt ändå - permission kan redan finnas eller hanteras senare
  }

  const configs = await loadAIConfigs();
  const config = {
    id: editingAIId || generateAIId(),
    name,
    api_url: sanitizedUrl,
    api_key: apiKey,
    model_name: modelName,
    api_endpoint_path: sanitizedEndpoint,
    api_timeout_seconds: timeoutSeconds
  };

  if (editingAIId) {
    const index = configs.findIndex(c => c.id === editingAIId);
    if (index >= 0) {
      configs[index] = config;
    }
  } else {
    configs.push(config);
  }

  await saveAIConfigs(configs);
  await displayAIConfigs();
  closeAIForm();
  showStatus('AI-inställning sparad!', 'success');
  
  // Meddela alla öppna flikar
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'settings_updated' });
    } catch {
      // Ignorera
    }
  }
}

// Redigera AI-inställning
async function editAIConfig(aiId) {
  if (!isValidAIId(aiId)) {
    showStatus('Ogiltigt AI-ID', 'error');
    return;
  }
  openAIForm(aiId);
}

// Ta bort AI-inställning
async function deleteAIConfig(aiId) {
  if (!isValidAIId(aiId)) {
    showStatus('Ogiltigt AI-ID', 'error');
    return;
  }
  
  if (!confirm('Vill du ta bort denna AI-inställning?')) {
    return;
  }

  const configs = await loadAIConfigs();
  const filtered = configs.filter(c => c.id !== aiId);
  await saveAIConfigs(filtered);
  
  // Om den borttagna AI:n var vald, välj första tillgängliga
  const { selected_ai_id } = await chrome.storage.local.get('selected_ai_id');
  if (selected_ai_id === aiId) {
    if (filtered.length > 0) {
      await chrome.storage.local.set({ selected_ai_id: filtered[0].id });
    } else {
      await chrome.storage.local.remove('selected_ai_id');
    }
  }
  
  await displayAIConfigs();
  showStatus('AI-inställning borttagen!', 'success');
  
  // Meddela alla öppna flikar
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'settings_updated' });
    } catch {
      // Ignorera
    }
  }
}

// Testa AI-anslutning
async function testAIConfig() {
  const testResult = document.getElementById('ai-test-result');
  if (!testResult) return;
  
  const apiUrlInput = document.getElementById('ai-api-url').value;
  const apiKey = document.getElementById('ai-api-key').value.trim();
  const modelName = document.getElementById('ai-model-name').value.trim();
  const apiEndpoint = document.getElementById('ai-api-endpoint').value.trim();

  const sanitizedUrl = sanitizeBaseUrl(apiUrlInput);
  if (!sanitizedUrl) {
    testResult.textContent = 'API Server URL måste börja med https:// och vara giltig.';
    testResult.className = 'ai-test-result error';
    testResult.style.display = 'block';
    return;
  }

  if (!apiKey) {
    testResult.textContent = 'API-nyckel krävs för att testa anslutningen';
    testResult.className = 'ai-test-result error';
    testResult.style.display = 'block';
    return;
  }

  if (!modelName) {
    testResult.textContent = 'Modellnamn krävs för att testa anslutningen';
    testResult.className = 'ai-test-result error';
    testResult.style.display = 'block';
    return;
  }

  const sanitizedEndpoint = sanitizeEndpoint(apiEndpoint);

  testResult.textContent = 'Testar anslutning...';
  testResult.className = 'ai-test-result testing';
  testResult.style.display = 'block';

  try {
    // Be om permission för API-URL:en om det behövs
    const urlObj = new URL(sanitizedUrl);
    const origin = urlObj.origin;
    const permissionUrl = origin + '/*';
    
    const hasPermission = await chrome.permissions.contains({
      origins: [permissionUrl]
    });
    
    if (!hasPermission) {
      const granted = await chrome.permissions.request({
        origins: [permissionUrl]
      });
      
      if (!granted) {
        testResult.textContent = 'Tillstånd att ansluta till API-servern nekades. Vänligen ge tillstånd för att testa anslutningen.';
        testResult.className = 'ai-test-result error';
        return;
      }
    }
    
    const response = await fetch(`${sanitizedUrl}${sanitizedEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: 'Hej'
          }
        ],
        max_tokens: 10
      })
    });

    if (response.ok) {
      testResult.textContent = 'Anslutningen fungerar!';
      testResult.className = 'ai-test-result success';
    } else {
      const errorText = await response.text();
      testResult.textContent = `Anslutningen misslyckades: ${response.status} - ${errorText.substring(0, 100)}`;
      testResult.className = 'ai-test-result error';
    }
  } catch (error) {
    testResult.textContent = `Anslutningsfel: ${error.message}`;
    testResult.className = 'ai-test-result error';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.local.get([
    'allowed_domains',
    'extension_name',
    'chat_session_limit'
  ]);

  document.getElementById('allowed-domains').value = settings.allowed_domains || DEFAULT_ALLOWED_DOMAINS;
  document.getElementById('extension-name').value = settings.extension_name || 'Kommun AI Chat';
  document.getElementById('chat-session-limit').value = settings.chat_session_limit || 50;

  await displayAIConfigs();

  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('reset-btn').addEventListener('click', resetSettings);
  document.getElementById('clear-chat-btn').addEventListener('click', clearChatHistory);
  document.getElementById('add-ai-btn').addEventListener('click', () => openAIForm());
  document.getElementById('ai-form-close').addEventListener('click', closeAIForm);
  document.getElementById('ai-form-cancel').addEventListener('click', closeAIForm);
  document.getElementById('ai-form-save').addEventListener('click', saveAIConfig);
  document.getElementById('ai-form-test').addEventListener('click', testAIConfig);
  
  // Stäng modal vid klick utanför
  document.getElementById('ai-form-modal').addEventListener('click', (e) => {
    if (e.target.id === 'ai-form-modal') {
      closeAIForm();
    }
  });
});

async function saveSettings() {
  const allowedDomainsInput = document.getElementById('allowed-domains').value;
  const extensionName = document.getElementById('extension-name').value.trim();
  const chatSessionLimit = document.getElementById('chat-session-limit').value;

  const sanitizedDomains = sanitizeAllowedDomains(allowedDomainsInput);
  if (sanitizedDomains.length === 0) {
    showStatus('Ange minst en giltig domän (utan http/https).', 'error');
    return;
  }

  const sessionLimit = parseInt(chatSessionLimit) || 50;
  if (sessionLimit < 1 || sessionLimit > 500) {
    showStatus('Max antal chattar måste vara mellan 1 och 500.', 'error');
    return;
  }

  if (!extensionName) {
    showStatus('Namn krävs', 'error');
    return;
  }

  await chrome.storage.local.set({
    allowed_domains: sanitizedDomains.join('\n'),
    extension_name: extensionName,
    chat_session_limit: sessionLimit
  });

  showStatus('Inställningar sparade!', 'success');

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'settings_updated' });
    } catch {
      // Ignorera
    }
  }
}

async function resetSettings() {
  if (!confirm('Vill du återställa till standardinställningar?')) {
    return;
  }

  document.getElementById('allowed-domains').value = DEFAULT_ALLOWED_DOMAINS;
  document.getElementById('extension-name').value = 'Kommun AI Chat';
  document.getElementById('chat-session-limit').value = 50;

  showStatus('Formuläret återställt. Klicka på "Spara inställningar" för att spara.', 'success');
}

async function clearChatHistory() {
  if (!confirm('Vill du rensa all chatthistorik från alla sidor? Detta går inte att ångra.')) {
    return;
  }

  try {
    await chrome.storage.local.set({ 
      chat_sessions: [],
      current_active_session_id: null
    });
    
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'clear_chat_history' });
      } catch {
        // Ignorera
      }
    }
    
    showStatus('Chatthistorik rensad!', 'success');
  } catch (error) {
    showStatus(`Fel vid rensning: ${error.message}`, 'error');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }
}


