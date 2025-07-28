const Messages = require('../models/messageModel');

/**
 * Mongoose-backed message storage.
 *
 * @returns {{ listBetween: Function, create: Function }}
 */
function createMongoMessageRepository() {
  return {
    /**
     * Messages exchanged between two users, oldest first.
     *
     * Paginated from the newest end: the original query loaded an entire
     * conversation on every open, which grows without bound.
     */
    listBetween: async ({ from, to, limit, before }) => {
      const query = { users: { $all: [from, to] } };

      if (before) query.createdAt = { $lt: before };

      const page = await Messages.find(query).sort({ createdAt: -1 }).limit(limit).lean();

      return page.reverse();
    },

    create: ({ from, to, text }) =>
      Messages.create({ message: { text }, users: [from, to], sender: from }).then((created) =>
        created.toObject()
      ),
  };
}

module.exports = { createMongoMessageRepository };
