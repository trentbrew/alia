import aliasStorage from './storage.js';

let aliases = {};

// Initialize aliases from IndexedDB
aliasStorage
  .getAll()
  .then((storedAliases) => {
    aliases = storedAliases || {};
  })
  .catch((error) => {
    console.error('Error initializing aliases:', error);
  });

var re = /[\d\s\+\-=\(\)\*]+/g;

// Safe math evaluation without eval()
function safeMathEval(expr) {
  // Only allow digits, operators, parentheses, and spaces
  if (!/^[\d\s\+\-\*\/\(\)\.]+$/.test(expr)) return null;
  try {
    // Use Function constructor as safer alternative (still restricted by CSP)
    // Instead, manually parse simple expressions
    const sanitized = expr.replace(/\s/g, '');
    // Simple recursive descent parser for basic math
    return parseExpression(sanitized);
  } catch {
    return null;
  }
}

function parseExpression(expr) {
  let pos = 0;

  function parseNumber() {
    let start = pos;
    while (pos < expr.length && /[\d\.]/.test(expr[pos])) pos++;
    if (start === pos) return null;
    return parseFloat(expr.slice(start, pos));
  }

  function parseFactor() {
    if (expr[pos] === '(') {
      pos++;
      const result = parseAddSub();
      if (expr[pos] === ')') pos++;
      return result;
    }
    if (expr[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    return parseNumber();
  }

  function parseMulDiv() {
    let left = parseFactor();
    while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/')) {
      const op = expr[pos++];
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
      const op = expr[pos++];
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = parseAddSub();
  return pos === expr.length ? result : null;
}

// Escape special XML characters for omnibox descriptions
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
var link =
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;
var search_url = /https:\/\/www\.google\.com\/search\?q=(\w+)&/;

// on input change

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  try {
    const allAliases = await aliasStorage.getAll();
    aliases = allAliases || {};

    var suggestions = [];
    for (const key in aliases) {
      if (key.startsWith(text) || text === '') {
        var desc = `<match>${escapeXml(text)}: </match><dim>${escapeXml(key)} → </dim><url>${escapeXml(aliases[key])}</url>`;
        suggestions.push({ content: aliases[key], description: desc });
      }
    }

    if (suggestions.length > 0) {
      var first = suggestions.splice(0, 1)[0];
      chrome.omnibox.setDefaultSuggestion({
        description: first['description'],
      });
    } else if (/^\d{4}$/.test(text)) {
      // 4-digit number = localhost port
      chrome.omnibox.setDefaultSuggestion({
        description: `<match>localhost:</match><url>${text}</url>`,
      });
    } else if (/^\d+k$/i.test(text)) {
      // Shorthand: 3k = localhost:3000, 8k = localhost:8000
      const port = parseInt(text) * 1000;
      chrome.omnibox.setDefaultSuggestion({
        description: `<match>localhost:</match><url>${port}</url>`,
      });
    } else if (text.match(re) && /^[\d\s\+\-=\(\)\*]+$/.test(text)) {
      // Only treat as math if it's PURELY math characters (no letters)
      var result = safeMathEval(text);
      if (result !== null && !isNaN(result)) {
        chrome.omnibox.setDefaultSuggestion({
          description: `<match>= </match><url>${result}</url>`,
        });
      } else {
        chrome.omnibox.setDefaultSuggestion({
          description: `<match>${escapeXml(text)}: </match><dim> - Google Search</dim>`,
        });
      }
    } else {
      chrome.omnibox.setDefaultSuggestion({
        description: `<match>${escapeXml(text)}: </match><dim> - Google Search</dim>`,
      });
    }
    suggest(suggestions);
  } catch (error) {
    console.error('Error in onInputChanged:', error);
    chrome.omnibox.setDefaultSuggestion({
      description: 'Error loading suggestions',
    });
    suggest([]);
  }
  // This block is now handled in the try-catch above
});

// accept omnibox input

chrome.omnibox.onInputEntered.addListener(async (text) => {
  try {
    // First check if it's a direct URL match
    if (text.match(link)) {
      chrome.tabs.update({ url: text });
      return;
    }

    // Check if it's an alias (before math expression to allow aliases like '3k')
    const url = await aliasStorage.get(text);
    if (url) {
      chrome.tabs.update({ url });
      return;
    }

    // Check if it's a 4-digit port number -> localhost
    if (/^\d{4}$/.test(text)) {
      chrome.tabs.update({ url: `http://localhost:${text}` });
      return;
    }

    // Shorthand: 3k = localhost:3000, 8k = localhost:8000
    if (/^\d+k$/i.test(text)) {
      const port = parseInt(text) * 1000;
      chrome.tabs.update({ url: `http://localhost:${port}` });
      return;
    }

    // Then check if it's a math expression (only pure math characters)
    if (text.match(re) && /^[\d\s\+\-=\(\)\*]+$/.test(text)) {
      var result = safeMathEval(text);
      if (result !== null && !isNaN(result)) {
        chrome.tabs.update({ url: `https://google.com/search?q=${result}` });
        return;
      }
    }

    // Default to Google search
    chrome.tabs.update({ url: `https://google.com/search?q=${text}` });
  } catch (error) {
    console.error('Error in onInputEntered:', error);
    // Default to Google search on error
    chrome.tabs.update({ url: `https://google.com/search?q=${text}` });
  }
  // This block is now handled in the try-catch above
});

// Starting input - refresh aliases

chrome.omnibox.onInputStarted.addListener(async () => {
  try {
    aliases = (await aliasStorage.getAll()) || {};
  } catch (error) {
    console.error('Error refreshing aliases:', error);
  }
});
