// launcher.html: the page an `--app` window opens on. With ?q=<text> it goes
// straight to the target; otherwise it shows the bar full-window.
//
// Theme params (bg, fg, accent, muted, surface, font) are saved to
// chrome.storage.local so the in-page overlay matches.
import aliasStorage from './storage.js';
import { resolve } from './resolve.js';

const params = new URLSearchParams(location.search);

const THEME_PARAMS = { bg: 'background', fg: 'foreground', accent: 'accent', muted: 'muted', surface: 'surface', font: 'font' };
const theme = {};
for (const [param, key] of Object.entries(THEME_PARAMS)) {
  const value = params.get(param);
  if (value) theme[key] = value;
}
if (theme.background) document.documentElement.style.background = theme.background;

async function main() {
  const tasks = [chrome.runtime.sendMessage({ type: 'register-window' }).catch(() => {})];
  if (Object.keys(theme).length) {
    tasks.push(
      chrome.storage.local.get('theme').then(({ theme: saved }) => chrome.storage.local.set({ theme: { ...saved, ...theme } })),
    );
  }

  const q = params.get('q');
  if (q) {
    const target = resolve(q, await aliasStorage.getAll());
    await Promise.all(tasks);
    if (target) {
      location.replace(target.url);
      return;
    }
  }

  await Promise.all(tasks);
  globalThis.__aliaMode = 'page';
  const script = document.createElement('script');
  script.src = 'js/overlay.js';
  document.head.append(script);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'focus-bar') globalThis.__aliaBar?.focus();
});

main();
