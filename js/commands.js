import { parseCommand } from './resolve.js';

/**
 * Run a "+name [url]" / "-name" bar command against storage.
 * Returns { done: true, message, ok } when `text` was a command, otherwise
 * { done: false } so the caller resolves it as normal input. "-name" for an
 * alias that does not exist is not treated as a command (so "-5" still works).
 */
export async function runCommand(text, storage, aliases, currentUrl) {
  const command = parseCommand(text, currentUrl);
  if (!command) return { done: false };

  if (command.type === 'remove') {
    if (!Object.hasOwn(aliases, command.alias)) return { done: false };
    await storage.remove(command.alias);
    return { done: true, ok: true, message: `Removed ${command.alias}` };
  }

  if (!command.url) {
    return { done: true, ok: false, message: `No URL for ${command.alias}: try +${command.alias} example.com` };
  }
  await storage.set(command.alias, command.url);
  return { done: true, ok: true, message: `${command.alias} → ${command.url}` };
}
