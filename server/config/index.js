require('dotenv').config();

/**
 * Every environment-dependent value in one place.
 *
 * Nothing here has a secret as its default. `JWT_SECRET` in particular has no
 * fallback: a development default would eventually be the thing signing tokens
 * in production, so the server refuses to start the authenticated routes
 * without it rather than silently using a guessable key.
 */

/**
 * @param {string} name
 * @param {string|number} fallback
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {number}
 */
function numberFromEnv(name, fallback, env = process.env) {
  const raw = env[name];

  if (raw === undefined || raw === '') return Number(fallback);

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, got "${raw}".`);
  }

  return parsed;
}

/**
 * @param {string} name
 * @param {string} fallback
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string[]} comma-separated list, trimmed and de-blanked
 */
function listFromEnv(name, fallback, env = process.env) {
  return String(env[name] ?? fallback)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Read configuration from the environment.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {object} the resolved configuration
 */
function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    // API_PORT wins over PORT because `npm start` runs react-scripts in the
    // same shell, and react-scripts also reads PORT. Setting PORT for the dev
    // server would otherwise move the API on top of it.
    port: env.API_PORT ? numberFromEnv('API_PORT', 3003, env) : numberFromEnv('PORT', 3003, env),
    // Absent by design: without it the API starts in read-only "no database"
    // mode instead of crashing or pretending to have persisted anything.
    mongoUrl: env.MONGO_URL || null,
    jwtSecret: env.JWT_SECRET || null,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '1d',
    corsOrigins: listFromEnv('CORS_ORIGIN', 'http://localhost:3000', env),
    bcryptRounds: numberFromEnv('BCRYPT_ROUNDS', 10, env),
    // Directory holding the built React app. Set in the container image so one
    // process serves both the API and the SPA; unset in development, where
    // react-scripts serves the front end on its own port.
    staticDir: env.STATIC_DIR || null,
  };
}

module.exports = { loadConfig, numberFromEnv, listFromEnv };
