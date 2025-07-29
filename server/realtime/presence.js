/**
 * Socket.IO presence and message relay.
 *
 * The original implementation kept the online-user map on `global` and stashed
 * the most recent socket on `global.chatSocket`, so two concurrent users
 * overwrote each other. The map is now owned by this module, and disconnects
 * clean up after themselves instead of leaking an entry per session.
 *
 * @param {import('socket.io').Server} io
 * @returns {{ onlineUsers: Map<string, string>, size: () => number }}
 */
function registerPresence(io) {
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    socket.on('add-user', (userId) => {
      if (!userId) return;

      onlineUsers.set(String(userId), socket.id);
      socket.data.userId = String(userId);
    });

    socket.on('send-msg', (data) => {
      const target = onlineUsers.get(String(data?.to));

      if (target) socket.to(target).emit('msg-receive', data.msg);
    });

    socket.on('disconnect', () => {
      if (socket.data.userId) onlineUsers.delete(socket.data.userId);
    });
  });

  return { onlineUsers, size: () => onlineUsers.size };
}

module.exports = { registerPresence };
