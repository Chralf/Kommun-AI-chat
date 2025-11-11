// Background service worker

const DEFAULT_ALLOWED_DOMAINS = [];

chrome.runtime.onInstalled.addListener(() => {
  console.debug('Kommun AI Chat: Extension installerad');
});

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

async function getAllowedDomains() {
  const { allowed_domains } = await chrome.storage.local.get('allowed_domains');
  const domainsText = allowed_domains || DEFAULT_ALLOWED_DOMAINS.join('\n');
  const domains = domainsText
    .split('\n')
    .map(normalizeDomain)
    .filter(Boolean);

  return domains.length > 0 ? domains : DEFAULT_ALLOWED_DOMAINS;
}

function isDomainAllowed(urlString, allowedDomains) {
  if (!urlString) return false;
  try {
    const { hostname } = new URL(urlString);
    return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function ensureContentScripts(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['sidebar.css']
    });
  } catch (error) {
    console.debug('Kommun AI Chat: insertCSS misslyckades eller redan injicerad', error);
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (error) {
    console.debug('Kommun AI Chat: executeScript misslyckades eller redan injicerad', error);
  }
}

async function showBadge(tabId, text, timeout = 2000) {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#d9534f' });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }, timeout);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !tab.url) {
    return;
  }

  const allowedDomains = await getAllowedDomains();
  if (!isDomainAllowed(tab.url, allowedDomains)) {
    await showBadge(tab.id, '!');
    chrome.runtime.openOptionsPage();
    return;
  }

  await ensureContentScripts(tab.id);

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
  } catch (error) {
    console.error('Kommun AI Chat: Kunde inte toggla sidebar', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'open_settings') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
  return false;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab?.url) {
    return;
  }

  const allowedDomains = await getAllowedDomains();
  if (!isDomainAllowed(tab.url, allowedDomains)) {
    return;
  }

  await ensureContentScripts(tabId);
});