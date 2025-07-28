const { registerPresence } = require('../realtime/presence');

/** Tokens in these tests are just the user id; anything else is rejected. */
const TOKENS = { 'token-alice': 'alice', 'token-bob': 'bob' };

function verifyToken(token) {
  if (!TOKENS[token]) throw new Error('Invalid or expired token.');

  return { id: TOKENS[token] };
}

/** A minimal stand-in for the parts of Socket.IO this module uses. */
function createFakeIo() {
  const middleware = [];
  const connectionHandlers = [];
  let counter = 0;

  return {
    use(fn) {
      middleware.push(fn);
    },
    on(event, handler) {
      if (event === 'connection') connectionHandlers.push(handler);
    },
    /** @returns {object} the connected socket, or `{ error }` if the handshake was refused */
    connect(token) {
      const handlers = new Map();
      const emitted = [];
      counter += 1;
      const socket = {
        id: `socket_${counter}`,
        data: {},
        handshake: { auth: token === undefined ? {} : { token } },
        on: (event, handler) => handlers.set(event, handler),
        to: (target) => ({ emit: (event, payload) => emitted.push({ target, event, payload }) }),
        fire: (event, payload) => handlers.get(event)?.(payload),
        emitted,
      };

      let refused = null;
      middleware.forEach((fn) =>
        fn(socket, (error) => {
          refused = refused || error || null;
        })
      );
      if (refused) return { error: refused };

      connectionHandlers.forEach((handler) => handler(socket));

      return socket;
    },
  };
}

function setup() {
  const io = createFakeIo();
  const presence = registerPresence(io, { verifyToken });

  return { io, presence };
}

describe('registerPresence', () => {
  it('tracks one entry per connected user', () => {
    const { io, presence } = setup();

    io.connect('token-alice').fire('add-user');
    io.connect('token-bob').fire('add-user');

    expect(presence.size()).toBe(2);
  });

  it('refuses a handshake without a valid token', () => {
    const { io, presence } = setup();

    expect(io.connect().error.message).toMatch(/invalid/i);
    expect(io.connect('forged').error.message).toMatch(/invalid/i);
    expect(presence.size()).toBe(0);
  });

  it('takes the identity from the token, not from the add-user payload', () => {
    const { io, presence } = setup();

    io.connect('token-alice').fire('add-user', 'bob');

    expect([...presence.onlineUsers.keys()]).toEqual(['alice']);
  });

  it('routes a message to the recipient socket, stamped with the sender', () => {
    const { io } = setup();

    const bob = io.connect('token-bob');
    bob.fire('add-user');

    const alice = io.connect('token-alice');
    alice.fire('add-user');
    alice.fire('send-msg', { to: 'bob', msg: 'hello' });

    expect(alice.emitted).toEqual([
      { target: bob.id, event: 'msg-receive', payload: { from: 'alice', msg: 'hello' } },
    ]);
  });

  it('drops a message addressed to someone who is offline', () => {
    const { io } = setup();

    const alice = io.connect('token-alice');
    alice.fire('add-user');
    alice.fire('send-msg', { to: 'nobody', msg: 'hello' });

    expect(alice.emitted).toEqual([]);
  });

  it('removes a user on disconnect instead of leaking an entry per session', () => {
    const { io, presence } = setup();

    const alice = io.connect('token-alice');
    alice.fire('add-user');
    expect(presence.size()).toBe(1);

    alice.fire('disconnect');
    expect(presence.size()).toBe(0);
  });

  it('keeps a user online when an older socket of theirs disconnects', () => {
    const { io, presence } = setup();

    const oldTab = io.connect('token-alice');
    oldTab.fire('add-user');
    const newTab = io.connect('token-alice');
    newTab.fire('add-user');

    oldTab.fire('disconnect');

    expect(presence.onlineUsers.get('alice')).toBe(newTab.id);
  });

  it('keeps presence per server, not on the global object', () => {
    const { io } = setup();

    io.connect('token-alice').fire('add-user');

    expect(global.onlineUsers).toBeUndefined();
  });
});
