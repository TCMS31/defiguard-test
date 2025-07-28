const User = require('../models/userModel');

/**
 * Mongoose-backed user storage.
 *
 * The service layer talks to this shape, never to Mongoose directly, which is
 * what lets the tests run against an in-memory implementation with no database
 * and no network.
 *
 * @returns {{ findByUsername: Function, findByEmail: Function, findById: Function, listOthers: Function, create: Function, setAvatar: Function }}
 */
function createMongoUserRepository() {
  return {
    findByUsername: (username) => User.findOne({ username }).lean(),
    findByEmail: (email) => User.findOne({ email }).lean(),
    findById: (id) => User.findById(id).lean(),

    /**
     * Everyone except the given id.
     *
     * `select` is not cosmetic here: without it Mongoose returns the password
     * hash for every user in the list.
     */
    listOthers: ({ excludeId, limit, skip }) =>
      User.find({ _id: { $ne: excludeId } })
        .select(['email', 'username', 'avatarImage', '_id'])
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

    countOthers: ({ excludeId }) => User.countDocuments({ _id: { $ne: excludeId } }),

    create: (user) => User.create(user).then((created) => created.toObject()),

    setAvatar: (id, avatarImage) =>
      User.findByIdAndUpdate(id, { isAvatarImageSet: true, avatarImage }, { new: true }).lean(),
  };
}

module.exports = { createMongoUserRepository };
