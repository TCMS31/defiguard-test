const { ApiError } = require('../middleware/errors');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Direct messages between two users.
 *
 * @param {{ messages: object }} deps
 */
function createMessageService({ messages }) {
  return {
    /**
     * @param {{ from: string, to: string, limit?: number, before?: Date }} input
     * @returns {Promise<{ messages: Array<{ fromSelf: boolean, message: string, sentAt: Date }> }>}
     */
    async listConversation({ from, to, limit = DEFAULT_PAGE_SIZE, before }) {
      if (!from || !to) throw ApiError.badRequest('from and to are both required.');

      const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

      const rows = await messages.listBetween({ from, to, limit: safeLimit, before });

      return {
        messages: rows.map((row) => ({
          fromSelf: String(row.sender) === String(from),
          message: row.message.text,
          sentAt: row.createdAt ?? null,
        })),
        limit: safeLimit,
      };
    },

    /**
     * @param {{ from: string, to: string, message: string }} input
     * @returns {Promise<{ id: string }>}
     */
    async addMessage({ from, to, message }) {
      if (!from || !to) throw ApiError.badRequest('from and to are both required.');
      if (!message || !String(message).trim()) {
        throw ApiError.badRequest('message must not be empty.');
      }

      const created = await messages.create({ from, to, text: String(message).trim() });

      return { id: String(created._id) };
    },
  };
}

module.exports = { createMessageService, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
