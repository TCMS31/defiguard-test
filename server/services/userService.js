const { ApiError } = require('../middleware/errors');

/**
 * A bcrypt hash of a value no one will ever submit.
 *
 * Compared against when the username is unknown so that a failed login costs
 * the same time whether or not the account exists. Without it, response timing
 * tells an attacker which usernames are registered.
 */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** Fields that may leave the server. The password hash is never one of them. */
function toPublicUser(user) {
  if (!user) return null;

  return {
    _id: String(user._id),
    username: user.username,
    email: user.email,
    avatarImage: user.avatarImage ?? '',
    isAvatarImageSet: Boolean(user.isAvatarImageSet),
  };
}

const MIN_PASSWORD_LENGTH = 8;
const MAX_PAGE_SIZE = 100;

/**
 * User registration, authentication and profile reads.
 *
 * All collaborators are injected, so the tests exercise the real logic against
 * an in-memory repository rather than mocking the logic itself.
 *
 * @param {object} deps
 * @param {object} deps.users        repository
 * @param {object} deps.hasher       bcrypt-compatible { hash, compare }
 * @param {object} deps.tokens       jsonwebtoken-compatible { sign, verify }
 * @param {string|null} deps.jwtSecret
 * @param {string} [deps.jwtExpiresIn]
 * @param {number} [deps.bcryptRounds]
 */
function createUserService({
  users,
  hasher,
  tokens,
  jwtSecret,
  jwtExpiresIn = '1d',
  bcryptRounds = 10,
}) {
  function requireSecret() {
    if (!jwtSecret) {
      throw ApiError.serviceUnavailable(
        'Authentication is disabled because JWT_SECRET is not configured.',
        'auth_disabled'
      );
    }

    return jwtSecret;
  }

  /**
   * @param {{ _id: string }} user
   * @returns {string} a signed JWT
   */
  function issueToken(user) {
    return tokens.sign({ id: String(user._id) }, requireSecret(), { expiresIn: jwtExpiresIn });
  }

  return {
    toPublicUser,
    issueToken,

    /**
     * @param {string} token
     * @returns {object} the decoded payload
     * @throws {ApiError} 401 when the token is missing, expired or forged
     */
    verifyToken(token) {
      if (!token) throw ApiError.unauthorized();

      try {
        return tokens.verify(token, requireSecret());
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw ApiError.unauthorized('Token is invalid or has expired.', 'invalid_token');
      }
    },

    /**
     * @param {{ username: string, email: string, password: string }} input
     * @returns {Promise<{ user: object, token: string }>}
     */
    async register({ username, email, password }) {
      if (!username || !email || !password) {
        throw ApiError.badRequest('username, email and password are all required.');
      }

      if (String(password).length < MIN_PASSWORD_LENGTH) {
        throw ApiError.badRequest(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
          'weak_password'
        );
      }

      if (await users.findByUsername(username)) {
        throw ApiError.conflict('That username is already taken.', 'username_taken');
      }

      if (await users.findByEmail(email)) {
        throw ApiError.conflict('That email is already registered.', 'email_taken');
      }

      const created = await users.create({
        username,
        email,
        password: await hasher.hash(password, bcryptRounds),
      });

      return { user: toPublicUser(created), token: issueToken(created) };
    },

    /**
     * @param {{ username: string, password: string }} input
     * @returns {Promise<{ user: object, token: string }>}
     * @throws {ApiError} 401 with a message that does not say which half was wrong
     */
    async login({ username, password }) {
      if (!username || !password) {
        throw ApiError.badRequest('username and password are both required.');
      }

      const user = await users.findByUsername(username);
      const valid = await hasher.compare(password, user ? user.password : DUMMY_HASH);

      if (!user || !valid) {
        throw ApiError.unauthorized('Incorrect username or password.', 'invalid_credentials');
      }

      return { user: toPublicUser(user), token: issueToken(user) };
    },

    /**
     * @param {{ excludeId: string, page?: number, pageSize?: number }} input
     * @returns {Promise<{ users: object[], page: number, pageSize: number, total: number }>}
     */
    async listUsers({ excludeId, page = 1, pageSize = 25 }) {
      // An unbounded find() is the first thing that falls over once the table
      // is real, so the page size is clamped rather than trusted.
      const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), MAX_PAGE_SIZE);
      const safePage = Math.max(Number(page) || 1, 1);

      const [rows, total] = await Promise.all([
        users.listOthers({
          excludeId,
          limit: safePageSize,
          skip: (safePage - 1) * safePageSize,
        }),
        users.countOthers({ excludeId }),
      ]);

      return {
        users: rows.map(toPublicUser),
        page: safePage,
        pageSize: safePageSize,
        total,
      };
    },

    /**
     * @param {string} id
     * @returns {Promise<object>}
     */
    async getById(id) {
      const user = await users.findById(id);

      if (!user) throw ApiError.notFound('User not found.');

      return toPublicUser(user);
    },

    /**
     * @param {string} id
     * @param {string} image
     * @returns {Promise<object>}
     */
    async setAvatar(id, image) {
      if (!image) throw ApiError.badRequest('An avatar image is required.');

      const updated = await users.setAvatar(id, image);

      if (!updated) throw ApiError.notFound('User not found.');

      return toPublicUser(updated);
    },
  };
}

module.exports = { createUserService, toPublicUser, MIN_PASSWORD_LENGTH, MAX_PAGE_SIZE };
