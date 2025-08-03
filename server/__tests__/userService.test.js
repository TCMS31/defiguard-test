const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { ApiError } = require('../middleware/errors');
const { createInMemoryUserRepository } = require('../repositories/inMemoryRepositories');
const { createUserService } = require('../services/userService');

const JWT_SECRET = 'test-secret-not-used-anywhere-real';

function buildService({ jwtSecret = JWT_SECRET } = {}) {
  const users = createInMemoryUserRepository();

  return {
    users,
    // 4 rounds keeps the suite fast; the real value comes from BCRYPT_ROUNDS.
    service: createUserService({ users, hasher: bcrypt, tokens: jwt, jwtSecret, bcryptRounds: 4 }),
  };
}

const CREDENTIALS = { username: 'ada', email: 'ada@example.com', password: 'correct horse' };

describe('userService.register', () => {
  it('creates a user and returns a usable token', async () => {
    const { service } = buildService();

    const { user, token } = await service.register(CREDENTIALS);

    expect(user).toMatchObject({ username: 'ada', email: 'ada@example.com' });
    expect(jwt.verify(token, JWT_SECRET).id).toBe(user._id);
  });

  it('never returns the password hash', async () => {
    const { service } = buildService();

    const { user } = await service.register(CREDENTIALS);

    // The original controller called `delete user.password` on a Mongoose
    // document, which is a no-op: the hash was returned to the client on both
    // register and login.
    expect(user).not.toHaveProperty('password');
    expect(JSON.stringify(user)).not.toContain('$2');
  });

  it('stores the password as a hash, not as text', async () => {
    const { service, users } = buildService();

    await service.register(CREDENTIALS);
    const stored = await users.findByUsername('ada');

    expect(stored.password).not.toBe(CREDENTIALS.password);
    await expect(bcrypt.compare(CREDENTIALS.password, stored.password)).resolves.toBe(true);
  });

  it.each([
    [{ ...CREDENTIALS, username: '' }, /required/],
    [{ ...CREDENTIALS, email: '' }, /required/],
    [{ ...CREDENTIALS, password: 'short' }, /at least 8 characters/],
  ])('rejects invalid input %#', async (input, expected) => {
    const { service } = buildService();

    await expect(service.register(input)).rejects.toThrow(expected);
  });

  it('rejects a duplicate username with 409', async () => {
    const { service } = buildService();
    await service.register(CREDENTIALS);

    await expect(
      service.register({ ...CREDENTIALS, email: 'other@example.com' })
    ).rejects.toMatchObject({ status: 409, code: 'username_taken' });
  });

  it('rejects a duplicate email with 409', async () => {
    const { service } = buildService();
    await service.register(CREDENTIALS);

    await expect(service.register({ ...CREDENTIALS, username: 'grace' })).rejects.toMatchObject({
      status: 409,
      code: 'email_taken',
    });
  });
});

describe('userService.login', () => {
  it('authenticates a registered user', async () => {
    const { service } = buildService();
    await service.register(CREDENTIALS);

    const { user, token } = await service.login({
      username: CREDENTIALS.username,
      password: CREDENTIALS.password,
    });

    expect(user.username).toBe('ada');
    expect(typeof token).toBe('string');
  });

  it('rejects a wrong password', async () => {
    const { service } = buildService();
    await service.register(CREDENTIALS);

    await expect(
      service.login({ username: 'ada', password: 'wrong password' })
    ).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
  });

  it('gives an unknown user the same answer as a wrong password', async () => {
    const { service } = buildService();

    await expect(
      service.login({ username: 'nobody', password: 'whatever it is' })
    ).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
  });

  it('refuses to work at all without a configured secret', async () => {
    const { service } = buildService({ jwtSecret: null });

    await expect(service.register(CREDENTIALS)).rejects.toMatchObject({
      status: 503,
      code: 'auth_disabled',
    });
  });
});

describe('userService.verifyToken', () => {
  it('accepts a token it issued', async () => {
    const { service } = buildService();
    const { user, token } = await service.register(CREDENTIALS);

    expect(service.verifyToken(token).id).toBe(user._id);
  });

  it.each([
    ['a forged token', jwt.sign({ id: 'mem_1' }, 'a different secret')],
    ['garbage', 'not.a.token'],
    ['nothing', ''],
  ])('rejects %s', (_label, token) => {
    const { service } = buildService();

    expect(() => service.verifyToken(token)).toThrow(ApiError);
  });

  it('rejects an expired token', async () => {
    const { service } = buildService();
    const expired = jwt.sign({ id: 'mem_1' }, JWT_SECRET, { expiresIn: '-1s' });

    expect(() => service.verifyToken(expired)).toThrow(/invalid or has expired/);
  });
});

describe('userService.listUsers', () => {
  async function seed(service, count) {
    for (let index = 0; index < count; index += 1) {
      // Sequential on purpose: the ids are asserted below.
      // eslint-disable-next-line no-await-in-loop
      await service.register({
        username: `user${String(index).padStart(2, '0')}`,
        email: `user${index}@example.com`,
        password: 'a long enough password',
      });
    }
  }

  it('excludes the caller', async () => {
    const { service } = buildService();
    const { user } = await service.register(CREDENTIALS);
    await seed(service, 3);

    const page = await service.listUsers({ excludeId: user._id });

    expect(page.users.map((entry) => entry.username)).not.toContain('ada');
    expect(page.total).toBe(3);
  });

  it('paginates instead of returning every row', async () => {
    const { service } = buildService();
    const { user } = await service.register(CREDENTIALS);
    await seed(service, 12);

    const first = await service.listUsers({ excludeId: user._id, page: 1, pageSize: 5 });
    const second = await service.listUsers({ excludeId: user._id, page: 2, pageSize: 5 });

    expect(first.users).toHaveLength(5);
    expect(second.users).toHaveLength(5);
    expect(first.total).toBe(12);
    expect(first.users[0].username).not.toBe(second.users[0].username);
  });

  it('clamps a hostile page size', async () => {
    const { service } = buildService();
    const { user } = await service.register(CREDENTIALS);

    const page = await service.listUsers({ excludeId: user._id, pageSize: 100000 });

    expect(page.pageSize).toBe(100);
  });

  it('never leaks a password hash in the list', async () => {
    const { service } = buildService();
    const { user } = await service.register(CREDENTIALS);
    await seed(service, 2);

    const page = await service.listUsers({ excludeId: user._id });

    page.users.forEach((entry) => expect(entry).not.toHaveProperty('password'));
  });
});

describe('userService.setAvatar', () => {
  it('sets the avatar and flags it', async () => {
    const { service } = buildService();
    const { user } = await service.register(CREDENTIALS);

    const updated = await service.setAvatar(user._id, 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');

    expect(updated.isAvatarImageSet).toBe(true);
  });

  it('rejects an empty image', async () => {
    const { service } = buildService();
    const { user } = await service.register(CREDENTIALS);

    await expect(service.setAvatar(user._id, '')).rejects.toMatchObject({ status: 400 });
  });

  it('404s for an unknown user', async () => {
    const { service } = buildService();

    await expect(service.setAvatar('nope', 'x')).rejects.toMatchObject({ status: 404 });
  });
});
