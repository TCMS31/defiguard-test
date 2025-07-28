/**
 * Socket.IO presence and message relay.
 *
 * The original implementation kept the online-user map on `global` and stashed
 * the most recent socket on `global.chatSocket`, so two concurrent users
 * overwrote each other. The map is now owned by this module, and disconnects
 * clean up after themselves instead of leaking an entry per session.
 *
 * Identity comes from the bearer token sent in the handshake
 * (`io(url, { auth: { token } })`), the same token the HTTP routes accept. The
 * id in an `add-user` payload is ignored: trusting it let any client register
 * as any user and receive their messages.
 *
 * @param {import('socket.io').Server} io
 * @param {{ verifyToken: (token: string) => { id: string } }} deps
 * @returns {{ onlineUsers: Map<string, string>, size: () => number }}
 */
function registerPresence(io, { verifyToken }) {
  const onlineUsers = new Map();

  io.use((socket, next) => {
    try {
      const claims = verifyToken(socket.handshake?.auth?.token);

      socket.data.userId = String(claims.id);
      next();
    } catch (error) {
      next(new Error(error.message || 'Unauthorized.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('add-user', () => {
      onlineUsers.set(socket.data.userId, socket.id);
    });

    socket.on('send-msg', (data) => {
      const target = onlineUsers.get(String(data?.to));

      if (target) {
        socket.to(target).emit('msg-receive', { from: socket.data.userId, msg: data.msg });
      }
    });

    socket.on('disconnect', () => {
      // A user who reconnects in a new tab before the old socket closes must
      // not be marked offline by the old socket's disconnect.
      if (onlineUsers.get(socket.data.userId) === socket.id) {
        onlineUsers.delete(socket.data.userId);
      }
    });
  });

  return { onlineUsers, size: () => onlineUsers.size };
}

module.exports = { registerPresence };
