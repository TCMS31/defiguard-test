const { ApiError } = require('./errors');

/**
 * Reject a request that does not carry a valid bearer token.
 *
 * The identity comes from the verified token, never from a URL parameter. The
 * routes this replaces took the user id from the path (`/allusers/:id`,
 * `/setavatar/:id`), so any caller could read or modify any account by editing
 * the URL.
 *
 * @param {{ userService: object }} deps
 * @returns {import('express').RequestHandler}
 */
function requireAuth({ userService }) {
  return (req, res, next) => {
    try {
      const header = req.get('authorization') || '';
      const [scheme, token] = header.split(' ');

      if (scheme !== 'Bearer' || !token) {
        throw ApiError.unauthorized('Send a bearer token in the Authorization header.');
      }

      req.userId = String(userService.verifyToken(token).id);

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireAuth };
