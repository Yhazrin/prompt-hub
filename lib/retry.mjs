/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {Object} opts
 * @param {number} opts.retries - Max retry attempts (default 3)
 * @param {number} opts.delay - Initial delay in ms (default 1000)
 * @param {number} opts.backoff - Multiplier for each retry (default 2)
 * @param {Function} opts.shouldRetry - (error) => boolean, default: retry on 5xx/network only
 */
export async function withRetry(fn, opts = {}) {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = defaultShouldRetry,
  } = opts;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err)) {
        throw err;
      }
      const wait = delay * Math.pow(backoff, attempt);
      console.warn(`Retry ${attempt + 1}/${retries} after ${wait}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function defaultShouldRetry(err) {
  // Retry on network errors
  if (!err.response) return true;
  // Retry on 5xx server errors
  const status = err.response?.status || err.status;
  if (status && status >= 500) return true;
  // Don't retry on 4xx client errors
  return false;
}
