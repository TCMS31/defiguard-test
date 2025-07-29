/**
 * In-memory implementations of the repository interfaces.
 *
 * These exist so the HTTP layer, the services and the auth flow can be tested
 * end to end without a MongoDB instance, a container or a network call. They
 * are also what the server falls back to when `MONGO_URL` is not set, so a
 * fresh clone boots and answers requests instead of crashing.
 */

let sequence = 0;
const nextId = () => `mem_${(sequence += 1)}`;

/** @returns {object} a user repository backed by a Map */
function createInMemoryUserRepository(seed = []) {
  const users = new Map(seed.map((user) => [user._id, { ...user }]));

  const find = (predicate) => [...users.values()].find(predicate) ?? null;

  return {
    async findByUsername(username) {
      return find((user) => user.username === username);
    },
    async findByEmail(email) {
      return find((user) => user.email === email);
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
    async listOthers({ excludeId, limit, skip }) {
      return [...users.values()]
        .filter((user) => user._id !== excludeId)
        .sort((a, b) => a.username.localeCompare(b.username))
        .slice(skip, skip + limit)
        .map(({ email, username, avatarImage, _id }) => ({ email, username, avatarImage, _id }));
    },
    async countOthers({ excludeId }) {
      return [...users.values()].filter((user) => user._id !== excludeId).length;
    },
    async create(user) {
      const created = {
        _id: nextId(),
        isAvatarImageSet: false,
        avatarImage: '',
        ...user,
      };

      users.set(created._id, created);

      return { ...created };
    },
    async setAvatar(id, avatarImage) {
      const user = users.get(id);

      if (!user) return null;

      user.isAvatarImageSet = true;
      user.avatarImage = avatarImage;

      return { ...user };
    },
  };
}

/** @returns {object} a message repository backed by an array */
function createInMemoryMessageRepository(seed = []) {
  const messages = [...seed];

  return {
    async listBetween({ from, to, limit, before }) {
      return messages
        .filter(
          (message) =>
            message.users.includes(from) &&
            message.users.includes(to) &&
            (!before || message.createdAt < before)
        )
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-limit);
    },
    async create({ from, to, text }) {
      const created = {
        _id: nextId(),
        message: { text },
        users: [from, to],
        sender: from,
        createdAt: new Date(),
      };

      messages.push(created);

      return { ...created };
    },
  };
}

module.exports = { createInMemoryUserRepository, createInMemoryMessageRepository };
