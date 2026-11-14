'use strict';

// Discord role mutations for one member must run in order. Different members
// remain independent, so a busy panel does not block an entire guild.
const queues = new Map();

function serializeByKey(key, task) {
  const previous = queues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  queues.set(key, current);
  return current.finally(() => {
    if (queues.get(key) === current) queues.delete(key);
  });
}

function isTransientDiscordError(error) {
  const status = Number(error?.status || error?.httpStatus || 0);
  const code = String(error?.code || error?.cause?.code || '');
  return status === 429 || status >= 500 ||
    ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
}

async function withDiscordRetry(operation, options = {}) {
  const attempts = Math.max(1, Math.min(4, Number(options.attempts) || 3));
  const delayMs = Math.max(0, Number(options.delayMs) || 350);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientDiscordError(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

module.exports = { serializeByKey, withDiscordRetry, isTransientDiscordError };
