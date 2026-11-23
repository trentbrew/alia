// Shared input resolution for the omnibox keyword, the launcher page and the
// in-page bar: one function decides what a typed string means.

export function searchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

const PURE_MATH = /^[\d\s+\-*/().]+$/;
const HAS_OPERATOR = /\d\s*[+\-*/]\s*[\d(]/;
const SCHEME_URL = /^[a-z][a-z0-9+.-]*:\/\//i;
const BARE_SCHEMES = /^(about|data|mailto|javascript|view-source):/i;
const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(:\d{1,5})?([/?#].*)?$/i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}(:\d{1,5})?([/?#].*)?$/;
const DOMAIN = /^(?:[\w-]+\.)+[a-z][a-z0-9-]{1,62}\.?(:\d{1,5})?([/?#].*)?$/i;

// Small recursive-descent evaluator (no eval) for "12*(3+4)" style input.
export function evalMath(input) {
  const expr = input.replace(/\s+/g, '');
  let pos = 0;
  const peek = () => expr[pos];

  function number() {
    const start = pos;
    while (pos < expr.length && /[\d.]/.test(expr[pos])) pos++;
    if (start === pos) throw new Error('number expected');
    const value = Number(expr.slice(start, pos));
    if (Number.isNaN(value)) throw new Error('bad number');
    return value;
  }
  function factor() {
    if (peek() === '-') { pos++; return -factor(); }
    if (peek() === '+') { pos++; return factor(); }
    if (peek() === '(') {
      pos++;
      const value = sum();
      if (peek() !== ')') throw new Error(') expected');
      pos++;
      return value;
    }
    return number();
  }
  function product() {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      const op = expr[pos++];
      const rhs = factor();
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }
  function sum() {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const op = expr[pos++];
      const rhs = product();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  try {
    const value = sum();
    return pos === expr.length && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function findAlias(text, aliases) {
  if (Object.hasOwn(aliases, text)) return text;
  const lower = text.toLowerCase();
  return Object.keys(aliases).find((key) => key.toLowerCase() === lower) ?? null;
}

/**
 * Work out where `input` should go.
 * Returns { kind, url, label } or null for empty input.
 * kind: alias | port | url | math | search
 */
export function resolve(input, aliases = {}) {
  const text = (input ?? '').trim();
  if (!text) return null;

  const alias = findAlias(text, aliases);
  if (alias) return { kind: 'alias', url: aliases[alias], label: alias, alias };

  if (/^\d{4,5}$/.test(text)) {
    return { kind: 'port', url: `http://localhost:${text}`, label: `localhost:${text}` };
  }
  if (/^\d+k$/i.test(text)) {
    const port = parseInt(text, 10) * 1000;
    if (port <= 65535) {
      return { kind: 'port', url: `http://localhost:${port}`, label: `localhost:${port}` };
    }
  }

  if (!/\s/.test(text)) {
    if (SCHEME_URL.test(text) || BARE_SCHEMES.test(text)) {
      return { kind: 'url', url: text, label: text };
    }
    if (LOCAL_HOST.test(text) || IPV4.test(text)) {
      return { kind: 'url', url: `http://${text}`, label: text };
    }
    if (DOMAIN.test(text)) {
      return { kind: 'url', url: `https://${text}`, label: text };
    }
  }

  if (PURE_MATH.test(text) && HAS_OPERATOR.test(text)) {
    const value = evalMath(text);
    if (value !== null) {
      return { kind: 'math', url: searchUrl(text), label: `= ${+value.toFixed(10)}`, value };
    }
  }

  return { kind: 'search', url: searchUrl(text), label: `Search Google for “${text}”` };
}

/** Aliases matching `input`: prefix matches first, then substring matches. */
export function matchAliases(input, aliases = {}, limit = 8) {
  const text = (input ?? '').trim().toLowerCase();
  const keys = Object.keys(aliases).sort((a, b) => a.localeCompare(b));
  if (!text) return keys.slice(0, limit).map((alias) => ({ alias, url: aliases[alias] }));
  const prefix = [];
  const inner = [];
  for (const alias of keys) {
    const key = alias.toLowerCase();
    if (key.startsWith(text)) prefix.push(alias);
    else if (key.includes(text) || aliases[alias].toLowerCase().includes(text)) inner.push(alias);
  }
  return [...prefix, ...inner].slice(0, limit).map((alias) => ({ alias, url: aliases[alias] }));
}

/**
 * Bar commands: "+name [url]" saves an alias (url defaults to `currentUrl`),
 * "-name" removes one. Returns null when `input` is not a command.
 */
export function parseCommand(input, currentUrl) {
  const text = (input ?? '').trim();
  const add = text.match(/^\+(\w+)(?:\s+(\S+))?$/);
  if (add) {
    const target = add[2] ? resolve(add[2]) : null;
    const url = target && target.kind !== 'search' ? target.url : add[2] ? null : currentUrl;
    return { type: 'add', alias: add[1], url: url ?? null };
  }
  const remove = text.match(/^-(\w+)$/);
  if (remove) return { type: 'remove', alias: remove[1] };
  return null;
}
