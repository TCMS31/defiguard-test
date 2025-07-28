const mongoose = require('mongoose');

/**
 * Connect to MongoDB if one is configured.
 *
 * Returns null when `MONGO_URL` is absent so the API can start in in-memory
 * mode. The original file had this connection commented out entirely, which is
 * why none of the persistent routes could work.
 *
 * @param {{ mongoUrl: string|null }} config
 * @param {{ logger?: Console }} [options]
 * @returns {Promise<typeof mongoose|null>}
 */
async function connectDatabase(config, { logger = console } = {}) {
  if (!config.mongoUrl) {
    logger.warn('MONGO_URL is not set - starting with in-memory storage. Data will not persist.');
    return null;
  }

  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 5000 });
  logger.info('Connected to MongoDB.');

  return mongoose;
}

module.exports = { connectDatabase };
