const { asyncHandler } = require('../middleware/asyncHandler');

/**
 * HTTP adapters for the message service.
 *
 * @param {{ messageService: object }} deps
 */
function createMessageController({ messageService }) {
  return {
    getMessages: asyncHandler(async (req, res) => {
      const { to, limit, before } = req.body ?? {};

      res.json(
        await messageService.listConversation({
          from: req.userId,
          to,
          limit,
          before: before ? new Date(before) : undefined,
        })
      );
    }),

    addMessage: asyncHandler(async (req, res) => {
      const { to, message } = req.body ?? {};
      const created = await messageService.addMessage({ from: req.userId, to, message });

      res.status(201).json(created);
    }),
  };
}

module.exports = { createMessageController };
