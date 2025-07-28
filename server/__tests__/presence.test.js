const { registerPresence } = require('../realtime/presence');

/** A minimal stand-in for the parts of Socket.IO this module uses. */
function createFakeIo() {
  const connectionHandlers = [];

  return {
    on(event, handler) {
      if (event === 'connection') connectionHandlers.push(handler);
    },
    connect() {
      const handlers = new Map();
      const emitted = [];
      const socket = {
        id: `socket_${connectionHandlers.length}_${Math.random().toString(16).slice(2)}`,
        data: {},
        on: (event, handler) => handlers.set(event, handler),
        to: (target) => ({ emit: (event, payload) => emitted.push({ target, event, payload }) }),
        fire: (event, payload) => handlers.get(event)?.(payload),
        emitted,
      };

      connectionHandlers.forEach((handler) => handler(socket));

      return socket;
    },
  };
}

describe('registerPresence', () => {
  it('tracks one entry per connected user', () => {
    const io = createFakeIo();
    const presence = registerPresence(io);

    io.connect().fire('add-user', 'alice');
    io.connect().fire('add-user', 'bob');

    expect(presence.size()).toBe(2);
  });

  it('routes a message to the recipient socket', () => {
    const io = createFakeIo();
    registerPresence(io);

    const bob = io.connect();
    bob.fire('add-user', 'bob');

    const alice = io.connect();
    alice.fire('add-user', 'alice');
    alice.fire('send-msg', { to: 'bob', msg: 'hello' });

    expect(alice.emitted).toEqual([{ target: bob.id, event: 'msg-receive', payload: 'hello' }]);
  });

  it('drops a message addressed to someone who is offline', () => {
    const io = createFakeIo();
    registerPresence(io);

    const alice = io.connect();
    alice.fire('add-user', 'alice');
    alice.fire('send-msg', { to: 'nobody', msg: 'hello' });

    expect(alice.emitted).toEqual([]);
  });

  it('removes a user on disconnect instead of leaking an entry per session', () => {
    const io = createFakeIo();
    const presence = registerPresence(io);

    const alice = io.connect();
    alice.fire('add-user', 'alice');
    expect(presence.size()).toBe(1);

    alice.fire('disconnect');
    expect(presence.size()).toBe(0);
  });

  it('ignores an add-user with no id', () => {
    const io = createFakeIo();
    const presence = registerPresence(io);

    io.connect().fire('add-user', undefined);

    expect(presence.size()).toBe(0);
  });

  it('keeps presence per server, not on the global object', () => {
    const io = createFakeIo();
    registerPresence(io);

    io.connect().fire('add-user', 'alice');

    expect(global.onlineUsers).toBeUndefined();
  });
});
