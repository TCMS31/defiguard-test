const { asyncHandler } = require('../middleware/asyncHandler');

/**
 * HTTP adapters for the user service.
 *
 * Controllers here do three things and nothing else: read the request, call one
 * service method, and choose a status code. Every rule about passwords, tokens
 * and paging lives in `services/userService.js`, which is where it can be
 * tested without an HTTP server.
 *
 * @param {{ userService: object }} deps
 */
function createUserController({ userService }) {
  return {
    register: asyncHandler(async (req, res) => {
      const { username, email, password } = req.body ?? {};
      const result = await userService.register({ username, email, password });

      res.status(201).json(result);
    }),

    login: asyncHandler(async (req, res) => {
      const { username, password } = req.body ?? {};
      const result = await userService.login({ username, password });

      res.json(result);
    }),

    me: asyncHandler(async (req, res) => {
      res.json({ user: await userService.getById(req.userId) });
    }),

    listUsers: asyncHandler(async (req, res) => {
      res.json(
        await userService.listUsers({
          excludeId: req.userId,
          page: req.query.page,
          pageSize: req.query.pageSize,
        })
      );
    }),

    setAvatar: asyncHandler(async (req, res) => {
      const user = await userService.setAvatar(req.userId, req.body?.image);

      res.json({ isSet: user.isAvatarImageSet, image: user.avatarImage, user });
    }),
  };
}

module.exports = { createUserController };
