const { Router } = require('express');

/**
 * @param {{ messageController: object, authGuard: import('express').RequestHandler }} deps
 * @returns {import('express').Router}
 */
function createMessageRouter({ messageController, authGuard }) {
  const router = Router();

  router.use(authGuard);
  router.post('/', messageController.addMessage);
  router.post('/search', messageController.getMessages);

  return router;
}

module.exports = { createMessageRouter };
