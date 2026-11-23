// The Alia bar. Injected into pages by the background worker (Alt+L), and
// loaded by launcher.html in "page" mode. Classic script on purpose: content
// scripts injected with chrome.scripting cannot be ES modules, so resolution
// happens in the background worker over runtime messages.
(() => {
  const existing = globalThis.__aliaBar;
  if (existing) {
    existing.toggle();
    return;
  }

  const pageMode = globalThis.__aliaMode === 'page';
  const DEFAULT_THEME = {
    background: '#0d0d0d',
    foreground: '#e8e8e8',
    accent: '#7aa2f7',
    muted: '#8a8a8a',
    surface: '#1a1a1a',
    font: '',
  };

  const host = document.createElement('alia-bar');
  host.style.all = 'initial';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .scrim {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; justify-content: center; align-items: flex-start;
        ${pageMode ? 'flex-direction: column; align-items: center; justify-content: flex-start;' : ''}
        padding: ${pageMode ? '28vh' : '18vh'} 16px 16px;
        background: ${pageMode ? 'var(--bg)' : 'color-mix(in srgb, var(--bg) 55%, transparent)'};
        ${pageMode ? '' : 'backdrop-filter: blur(6px);'}
        font: 15px/1.4 var(--font);
        color: var(--fg);
        box-sizing: border-box;
      }
      .panel {
        width: min(100%, 56rem);
        background: ${pageMode ? 'transparent' : 'var(--bg)'};
        border: 1px solid ${pageMode ? 'transparent' : 'color-mix(in srgb, var(--fg) 14%, transparent)'};
        border-radius: 12px;
        ${pageMode ? '' : 'box-shadow: 0 24px 64px rgb(0 0 0 / 0.45);'}
        overflow: hidden;
      }
      form { display: flex; align-items: center; gap: 10px; padding: 14px 16px;
        border-bottom: 1px solid color-mix(in srgb, var(--fg) 10%, transparent); }
      .sigil { color: var(--accent); font-weight: 700; }
      input {
        flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
        color: var(--fg); font: inherit; font-size: 18px; caret-color: var(--accent);
      }
      input::placeholder { color: var(--muted); }
      .copy {
        display: inline-flex; align-items: center; justify-content: center;
        flex: none; width: 30px; height: 30px; padding: 0; border: 0;
        border-radius: 6px; background: transparent; color: var(--muted);
        cursor: pointer; transition: color .12s, background-color .12s;
      }
      .copy:hover { color: var(--fg); background: var(--surface); }
      .copy[data-copied="true"] { color: var(--accent); }
      .copy[hidden] { display: none; }
      ul { list-style: none; margin: 0; padding: 6px; max-height: 50vh; overflow-y: auto; }
      li {
        display: flex; gap: 12px; align-items: baseline; padding: 8px 10px;
        border-radius: 8px; cursor: pointer; white-space: nowrap; overflow: hidden;
      }
      li[aria-selected="true"] { background: var(--surface); }
      li[aria-selected="true"] .name { color: var(--accent); }
      .name { flex: none; font-weight: 600; }
      .url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
      .kind { flex: none; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
      .status { padding: 8px 16px 12px; color: var(--muted); font-size: 13px; }
      .status.error { color: #e06c75; }
      .status:empty { display: none; }
      .hint { margin-top: auto; padding: 10px 16px 0; text-align: center; color: var(--muted); font-size: 12px; }
      .hint kbd { font: inherit; padding: 0 5px; border-radius: 4px; background: var(--surface); color: var(--fg); }
    </style>
    <div class="scrim" part="scrim">
      <div class="panel" role="dialog" aria-label="Go to">
        <form>
          <span class="sigil">$</span>
          <input type="text" spellcheck="false" autocomplete="off" autocapitalize="off"
            placeholder="alias, url, port, or search" aria-label="Alias, URL or search" />
          <button type="button" class="copy" title="Copy to clipboard" aria-label="Copy to clipboard"></button>
        </form>
        <ul role="listbox"></ul>
        <div class="status"></div>
      </div>
      ${pageMode ? `<div class="hint"><kbd>↵</kbd> go · <kbd>Tab</kbd> complete · <kbd>+name url</kbd> save alias · <kbd>-name</kbd> remove · <kbd>Alt+L</kbd> this bar from any page</div>` : ''}
    </div>`;

  const scrim = root.querySelector('.scrim');
  const form = root.querySelector('form');
  const input = root.querySelector('input');
  const copyBtn = root.querySelector('.copy');
  const list = root.querySelector('ul');
  const status = root.querySelector('.status');

  const COPY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const CHECK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  copyBtn.innerHTML = COPY_ICON;

  let rows = [];
  let selected = 0;
  let queryToken = 0;
  let open = false;
  let copyTimer = 0;

  function applyTheme(theme = {}) {
    const t = { ...DEFAULT_THEME, ...theme };
    scrim.style.setProperty('--bg', t.background);
    scrim.style.setProperty('--fg', t.foreground);
    scrim.style.setProperty('--accent', t.accent);
    scrim.style.setProperty('--muted', t.muted);
    scrim.style.setProperty('--surface', t.surface);
    const font = t.font ? `"${t.font}", ` : '';
    scrim.style.setProperty('--font', `${font}ui-monospace, "JetBrainsMono Nerd Font", monospace`);
    if (pageMode) document.documentElement.style.background = t.background;
  }
  applyTheme();
  chrome.storage?.local.get('theme').then(({ theme }) => applyTheme(theme), () => {});

  const send = (message) => chrome.runtime.sendMessage(message);

  function setStatus(text, error = false) {
    status.textContent = text ?? '';
    status.classList.toggle('error', Boolean(error));
  }

  function render() {
    list.replaceChildren(
      ...rows.map((row, index) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(index === selected));
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = row.name;
        const url = document.createElement('span');
        url.className = 'url';
        url.textContent = row.detail ?? '';
        const kind = document.createElement('span');
        kind.className = 'kind';
        kind.textContent = row.kind;
        li.append(name, url, kind);
        li.addEventListener('mousedown', (event) => {
          event.preventDefault();
          selected = index;
          go();
        });
        return li;
      }),
    );
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  async function update() {
    const text = input.value;
    const token = ++queryToken;
    syncCopyButton();
    setStatus('');
    const trimmed = text.trim();
    if (/^[+-]\w/.test(trimmed)) {
      rows = [{
        kind: 'alias',
        name: trimmed.startsWith('+') ? 'Save alias' : 'Remove alias',
        detail:
          trimmed.startsWith('+') && !/\s/.test(trimmed)
            ? `${trimmed.slice(1)} → ${pageMode ? new URLSearchParams(location.search).get('from') ?? '(add a url)' : 'this page'}`
            : trimmed,
        text,
      }];
      selected = 0;
      render();
      if (trimmed.startsWith('+')) return;
    }
    let reply;
    try {
      reply = await send({ type: 'query', text });
    } catch (error) {
      setStatus(`Alia is not responding: ${error.message ?? error}`, true);
      return;
    }
    if (token !== queryToken) return;
    const next = [];
    if (/^[+-]\w/.test(trimmed)) next.push(...rows);
    const { target, matches = [] } = reply ?? {};
    // A prefix alias match beats a fallback search as the default row.
    const prefix = matches.find((m) => m.alias.toLowerCase().startsWith(trimmed.toLowerCase()));
    const targetRow = target && {
      kind: target.kind,
      name: target.kind === 'alias' ? target.alias : target.label,
      detail: target.kind === 'search' || target.kind === 'math' ? '' : target.url,
      url: target.url,
    };
    if (targetRow && !(target.kind === 'search' && prefix && trimmed)) next.push(targetRow);
    for (const match of matches) {
      if (target?.kind === 'alias' && match.alias === target.alias) continue;
      next.push({ kind: 'alias', name: match.alias, detail: match.url, url: match.url, alias: match.alias });
    }
    if (targetRow && target.kind === 'search' && prefix && trimmed) next.push(targetRow);
    rows = next;
    selected = 0;
    render();
  }

  async function go() {
    const row = rows[selected];
    const text = input.value;
    if (!text.trim() && !row) return;
    let reply;
    try {
      const currentUrl = pageMode ? new URLSearchParams(location.search).get('from') ?? undefined : location.href;
      reply = await send(
        row?.url && !row.text ? { type: 'submit', text, url: row.url } : { type: 'submit', text, currentUrl },
      );
    } catch (error) {
      setStatus(`Alia is not responding: ${error.message ?? error}`, true);
      return;
    }
    if (reply?.message) {
      setStatus(reply.message, !reply.ok);
      if (reply.ok) {
        input.value = '';
        update().then(() => setStatus(reply.message));
      }
      return;
    }
    if (!pageMode) hide();
  }

  function move(delta) {
    if (!rows.length) return;
    selected = (selected + delta + rows.length) % rows.length;
    render();
  }

  function textToCopy() {
    return input.value || (pageMode ? new URLSearchParams(location.search).get('from') ?? '' : location.href);
  }

  function syncCopyButton() {
    copyBtn.hidden = !textToCopy();
  }

  function resetCopyIcon() {
    clearTimeout(copyTimer);
    delete copyBtn.dataset.copied;
    copyBtn.innerHTML = COPY_ICON;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {}
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    (document.body || document.documentElement).append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    input.focus({ preventScroll: true });
    return ok;
  }

  copyBtn.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  copyBtn.addEventListener('click', async () => {
    const text = textToCopy();
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (!ok) {
      setStatus('Could not copy to clipboard', true);
      return;
    }
    clearTimeout(copyTimer);
    copyBtn.dataset.copied = 'true';
    copyBtn.innerHTML = CHECK_ICON;
    setStatus('Copied to clipboard');
    copyTimer = setTimeout(() => {
      resetCopyIcon();
      if (status.textContent === 'Copied to clipboard') setStatus('');
    }, 1500);
  });

  input.addEventListener('input', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    go();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) { event.preventDefault(); move(-1); }
    else if (event.key === 'Tab') {
      const row = rows.find((r, i) => i >= selected && r.alias) ?? rows.find((r) => r.alias);
      if (row) {
        event.preventDefault();
        input.value = row.alias;
        update();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (pageMode || input.value) {
        input.value = '';
        update();
      } else hide();
    }
  });
  // Keep the page's own shortcuts (j/k, /, ...) from seeing our keystrokes.
  for (const type of ['keydown', 'keyup', 'keypress']) {
    host.addEventListener(type, (event) => event.stopPropagation());
  }
  scrim.addEventListener('mousedown', (event) => {
    if (event.target === scrim && !pageMode) hide();
  });

  function show(prefill = pageMode ? '' : location.href) {
    if (!host.isConnected) (pageMode ? document.body : document.documentElement).append(host);
    open = true;
    input.value = prefill;
    resetCopyIcon();
    syncCopyButton();
    update();
    requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      input.select();
    });
  }

  function hide() {
    open = false;
    resetCopyIcon();
    host.remove();
  }

  globalThis.__aliaBar = {
    toggle: () => (open && !pageMode ? hide() : show()),
    show,
    focus: () => {
      input.focus();
      input.select();
    },
    applyTheme,
  };
  show();
})();
