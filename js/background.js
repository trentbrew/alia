import aliasStorage from './storage.js';
import { resolve, matchAliases } from './resolve.js';
import { runCommand } from './commands.js';

const LAUNCHER_PATH = 'launcher.html';
const launcherUrl = () => chrome.runtime.getURL(LAUNCHER_PATH);
const isLauncher = (url) => typeof url === 'string' && url.startsWith(launcherUrl());

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const startsWithInput = (alias, text) => alias.toLowerCase().startsWith(text.trim().toLowerCase());

// ---------------------------------------------------------------------------
// Omnibox keyword ("q" + Tab) in normal browser windows.

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  try {
    const aliases = await aliasStorage.getAll();
    const matches = matchAliases(text, aliases);
    const target = resolve(text, aliases);
    const head = matches[0];
    if (head && (startsWithInput(head.alias, text) || !target)) {
      chrome.omnibox.setDefaultSuggestion({
        description: `<match>${escapeXml(head.alias)}</match><dim> → </dim><url>${escapeXml(head.url)}</url>`,
      });
      matches.shift();
    } else if (target) {
      chrome.omnibox.setDefaultSuggestion({
        description: `<match>${escapeXml(target.label)}</match><dim> → </dim><url>${escapeXml(target.url)}</url>`,
      });
    }
    suggest(
      matches.map(({ alias, url }) => ({
        content: url,
        description: `<match>${escapeXml(alias)}</match><dim> → </dim><url>${escapeXml(url)}</url>`,
      })),
    );
  } catch (error) {
    console.error('Alia: omnibox suggestions failed', error);
    suggest([]);
  }
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let url;
  try {
    const aliases = await aliasStorage.getAll();
    // Mirrors onInputChanged: a prefix alias match is the default suggestion.
    const head = matchAliases(text, aliases)[0];
    const target = resolve(text, aliases);
    url = target?.kind === 'search' && head && startsWithInput(head.alias, text) ? head.url : target?.url;
  } catch (error) {
    console.error('Alia: omnibox resolve failed', error);
  }
  if (!url) return;
  if (disposition === 'currentTab') chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
});

// ---------------------------------------------------------------------------
// "Alia windows": app windows opened on launcher.html, plus the popup windows
// their new-tab links get moved into. Kept in session storage because the
// service worker is torn down between events.

async function getAliaWindows() {
  const { aliaWindows = [] } = await chrome.storage.session.get('aliaWindows');
  return new Set(aliaWindows);
}

async function markAliaWindow(windowId) {
  const windows = await getAliaWindows();
  if (windows.has(windowId)) return;
  windows.add(windowId);
  await chrome.storage.session.set({ aliaWindows: [...windows] });
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url && isLauncher(changeInfo.url)) markAliaWindow(tab.windowId).catch(() => {});
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const windows = await getAliaWindows();
  if (windows.delete(windowId)) await chrome.storage.session.set({ aliaWindows: [...windows] });
});

// target=_blank / window.open from an Alia window lands as a tab in a normal
// (tabbed) window. Move it into a tab-strip-less popup window instead, keeping
// the tab itself so window.opener (OAuth flows etc.) still works.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId === undefined || tab.id === undefined) return;
  try {
    const opener = await chrome.tabs.get(tab.openerTabId);
    if (opener.windowId === tab.windowId) return;
    if (!(await getAliaWindows()).has(opener.windowId)) return;
    const home = await chrome.windows.get(tab.windowId);
    if (home.type !== 'normal') return;
    const popup = await chrome.windows.create({ tabId: tab.id, type: 'popup', focused: true });
    if (popup?.id !== undefined) await markAliaWindow(popup.id);
  } catch (error) {
    console.error('Alia: could not move new tab out of the tab strip', error);
  }
});

// ---------------------------------------------------------------------------
// The bar: Alt+L (chrome://extensions/shortcuts) opens it over the current
// page; where scripts cannot run (chrome://, the Web Store) it falls back to
// the launcher page.

async function openBar(tab) {
  if (tab?.id === undefined) return;
  if (isLauncher(tab.url)) {
    chrome.runtime.sendMessage({ type: 'focus-bar' }).catch(() => {});
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['js/overlay.js'] });
  } catch {
    const from = tab.url ? `?from=${encodeURIComponent(tab.url)}` : '';
    await chrome.tabs.update(tab.id, { url: `${launcherUrl()}${from}` });
  }
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'open-bar') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await openBar(tab);
});

// ---------------------------------------------------------------------------
// Messages from the overlay (content script) and the launcher page.

async function handleMessage(message, sender) {
  switch (message?.type) {
    case 'register-window': {
      if (sender.tab?.windowId !== undefined) await markAliaWindow(sender.tab.windowId);
      return { ok: true };
    }
    case 'query': {
      const aliases = await aliasStorage.getAll();
      return { target: resolve(message.text, aliases), matches: matchAliases(message.text, aliases) };
    }
    case 'submit': {
      const aliases = await aliasStorage.getAll();
      const here = isLauncher(sender.tab?.url) ? undefined : sender.tab?.url;
      const command = await runCommand(message.text, aliasStorage, aliases, message.currentUrl ?? here);
      if (command.done) return command;
      const url = message.url ?? resolve(message.text, aliases)?.url;
      if (url && sender.tab?.id !== undefined) await chrome.tabs.update(sender.tab.id, { url });
      return { done: true, ok: Boolean(url) };
    }
    default:
      return undefined;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!['register-window', 'query', 'submit'].includes(message?.type)) return false;
  handleMessage(message, sender).then(sendResponse, (error) => {
    console.error('Alia: message failed', error);
    sendResponse({ done: true, ok: false, message: String(error?.message ?? error) });
  });
  return true;
});

// ---------------------------------------------------------------------------
// Window bar: publish the active tab's favicon through a native messaging host
// so the Omarchy bottom bar can show it. The host downloads the icon to a
// local file; the browser never talks to QML. Failures are silent — the bar
// just keeps showing the app icon.

const WINDOWBAR_HOST = 'com.trentbrew.windowbar';
let lastWindowbarReport = '';

async function reportActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return;

    const url = typeof tab.url === 'string' ? tab.url : '';
    const favicon = typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '';
    const title = typeof tab.title === 'string' ? tab.title : '';
    const signature = `${tab.id}|${url}|${favicon}|${title}`;
    if (signature === lastWindowbarReport) return;
    lastWindowbarReport = signature;

    await chrome.runtime.sendNativeMessage(WINDOWBAR_HOST, {
      url,
      favicon,
      title,
      windowId: tab.windowId,
    });
  } catch {
    void chrome.runtime.lastError;
  }
}

chrome.tabs.onActivated.addListener(reportActiveTab);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.favIconUrl || changeInfo.title || changeInfo.status === 'complete') {
    reportActiveTab();
  }
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) reportActiveTab();
});
reportActiveTab();
