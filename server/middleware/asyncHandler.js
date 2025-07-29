/**
 * Forward a rejected promise from an async handler to Express's error pipeline.
 *
 * Without this every handler needs its own try/catch, and a forgotten one
 * leaves the request hanging until the client times out.
 *
 * @param {Function} handler
 * @returns {Function} an Express handler
 */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
