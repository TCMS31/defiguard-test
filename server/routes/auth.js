const { Router } = require('express');

/**
 * @param {{ userController: object, authGuard: import('express').RequestHandler }} deps
 * @returns {import('express').Router}
 */
function createAuthRouter({ userController, authGuard }) {
  const router = Router();

  router.post('/register', userController.register);
  router.post('/login', userController.login);

  router.get('/me', authGuard, userController.me);
  router.get('/users', authGuard, userController.listUsers);
  router.post('/avatar', authGuard, userController.setAvatar);

  return router;
}

module.exports = { createAuthRouter };
