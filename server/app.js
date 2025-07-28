const path = require('path');

const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');

const { loadConfig } = require('./config');
const { createMessageController } = require('./controllers/messageController');
const { createUserController } = require('./controllers/userController');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const { requireAuth } = require('./middleware/requireAuth');
const {
  createInMemoryMessageRepository,
  createInMemoryUserRepository,
} = require('./repositories/inMemoryRepositories');
const { createAuthRouter } = require('./routes/auth');
const { createMessageRouter } = require('./routes/messages');
const { createMessageService } = require('./services/messageService');
const { createUserService } = require('./services/userService');

/**
 * Build the Express application.
 *
 * Exported without calling `listen` so the test suite can drive it over
 * supertest, and so the socket server in `index.js` can attach to the same HTTP
 * server. Every collaborator is injectable; the defaults are the real ones.
 *
 * The routes this mounts existed in the original tree but were commented out
 * along with the database connection, so the only endpoint the server actually
 * answered was `/ping`.
 *
 * @param {object} [options]
 * @param {object} [options.config]     result of loadConfig()
 * @param {object} [options.users]      user repository
 * @param {object} [options.messages]   message repository
 * @param {object} [options.hasher]     bcrypt-compatible
 * @param {object} [options.tokens]     jsonwebtoken-compatible
 * @param {object} [options.logger]
 * @returns {import('express').Express}
 */
function createApp({
  config = loadConfig(),
  users,
  messages,
  hasher = bcrypt,
  tokens = jwt,
  logger = console,
} = {}) {
  const app = express();

  // Without an explicit list any origin can drive the API from a user's browser
  // with their cookies attached; the original `cors()` call allowed exactly that.
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  const userRepository = users ?? createInMemoryUserRepository();
  const messageRepository = messages ?? createInMemoryMessageRepository();

  const userService = createUserService({
    users: userRepository,
    hasher,
    tokens,
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn,
    bcryptRounds: config.bcryptRounds,
  });
  const messageService = createMessageService({ messages: messageRepository });

  const authGuard = requireAuth({ userService });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      persistence: users ? 'mongodb' : 'in-memory',
      authentication: config.jwtSecret ? 'enabled' : 'disabled',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // Kept for compatibility with the original tree, which had exactly this route.
  app.get('/ping', (req, res) => res.json({ msg: 'Ping Successful' }));

  app.use(
    '/api/auth',
    createAuthRouter({ userController: createUserController({ userService }), authGuard })
  );
  app.use(
    '/api/messages',
    createMessageRouter({
      messageController: createMessageController({ messageService }),
      authGuard,
    })
  );

  // In the container image the API also serves the built SPA. The API 404
  // handler still owns /api, so a mistyped endpoint returns JSON rather than
  // index.html with a 200.
  if (config.staticDir) {
    app.use(express.static(config.staticDir, { maxAge: '1h', index: false }));

    app.get(/^\/(?!api\/).*/, (req, res, next) => {
      if (req.method !== 'GET') return next();

      return res.sendFile(path.join(config.staticDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler({ logger }));

  app.locals.services = { userService, messageService };

  return app;
}

module.exports = { createApp };
