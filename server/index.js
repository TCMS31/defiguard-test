const http = require('http');

const { Server } = require('socket.io');

const { createApp } = require('./app');
const { loadConfig } = require('./config');
const { connectDatabase } = require('./db');
const { registerPresence } = require('./realtime/presence');
const { createMongoMessageRepository } = require('./repositories/mongoMessageRepository');
const { createMongoUserRepository } = require('./repositories/mongoUserRepository');

/**
 * Compose and start the API.
 *
 * Process wiring only: configuration, database, HTTP server, sockets and
 * shutdown. The application itself is built in `app.js`, which knows nothing
 * about ports or process signals.
 */
async function main() {
  const config = loadConfig();
  const connection = await connectDatabase(config);

  const app = createApp({
    config,
    users: connection ? createMongoUserRepository() : undefined,
    messages: connection ? createMongoMessageRepository() : undefined,
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigins, credentials: true },
  });

  registerPresence(io);

  server.listen(config.port, () => {
    console.info(
      'API listening on port %d (%s persistence, auth %s)',
      config.port,
      connection ? 'mongodb' : 'in-memory',
      config.jwtSecret ? 'enabled' : 'disabled'
    );
  });

  const shutdown = (signal) => {
    console.info('%s received, shutting down.', signal);
    io.close();
    server.close(() => process.exit(0));
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));

  return server;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start the API:', error);
    process.exit(1);
  });
}

module.exports = { main };
