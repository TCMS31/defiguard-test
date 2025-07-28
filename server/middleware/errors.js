/**
 * An error whose message and status are safe to send to the client.
 *
 * Anything that is not an ApiError is treated as a programming fault: it is
 * logged in full and answered with a generic 500, so stack traces and driver
 * messages never reach a caller.
 */
class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string} [code]
   */
  constructor(status, message, code = 'error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message, code = 'bad_request') {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = 'Authentication required.', code = 'unauthorized') {
    return new ApiError(401, message, code);
  }

  static notFound(message = 'Not found.', code = 'not_found') {
    return new ApiError(404, message, code);
  }

  static conflict(message, code = 'conflict') {
    return new ApiError(409, message, code);
  }

  static serviceUnavailable(message, code = 'service_unavailable') {
    return new ApiError(503, message, code);
  }
}

/** 404 handler for unmatched routes. */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

/**
 * Terminal error middleware.
 *
 * @param {{ logger?: Console }} [options]
 * @returns {import('express').ErrorRequestHandler}
 */
function errorHandler({ logger = console } = {}) {
  // eslint-disable-next-line no-unused-vars -- Express identifies this by arity.
  return (error, req, res, next) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }

    logger.error('Unhandled error while serving %s %s', req.method, req.originalUrl, error);

    res.status(500).json({
      error: { code: 'internal_error', message: 'Something went wrong handling this request.' },
    });
  };
}

module.exports = { ApiError, errorHandler, notFoundHandler };
