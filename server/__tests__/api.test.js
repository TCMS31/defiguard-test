const request = require('supertest');

const { createApp } = require('../app');
const { loadConfig } = require('../config');
const {
  createInMemoryMessageRepository,
  createInMemoryUserRepository,
} = require('../repositories/inMemoryRepositories');

const JWT_SECRET = 'test-secret-not-used-anywhere-real';

/**
 * Build the real application over in-memory repositories.
 *
 * No database, no container and no network: these are end-to-end HTTP tests of
 * the code that actually ships.
 */
function buildApp(overrides = {}) {
  const config = {
    ...loadConfig({}),
    jwtSecret: JWT_SECRET,
    bcryptRounds: 4,
    corsOrigins: ['http://localhost:3000'],
    ...overrides.config,
  };

  return createApp({
    config,
    users: createInMemoryUserRepository(),
    messages: createInMemoryMessageRepository(),
    logger: { error: () => {}, warn: () => {}, info: () => {} },
    ...overrides,
  });
}

const CREDENTIALS = { username: 'ada', email: 'ada@example.com', password: 'a long password' };

async function registerAndLogin(app, overrides = {}) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ ...CREDENTIALS, ...overrides })
    .expect(201);

  return response.body;
}

describe('GET /health', () => {
  it('reports how the server is configured', async () => {
    const response = await request(buildApp()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      persistence: 'mongodb',
      authentication: 'enabled',
    });
  });

  it('says authentication is disabled when no secret is set', async () => {
    const response = await request(buildApp({ config: { jwtSecret: null } }))
      .get('/health')
      .expect(200);

    expect(response.body.authentication).toBe('disabled');
  });
});

describe('GET /ping', () => {
  it('still answers, as it did before', async () => {
    await request(buildApp()).get('/ping').expect(200, { msg: 'Ping Successful' });
  });
});

describe('unknown routes', () => {
  it('return a JSON 404 rather than an HTML stack trace', async () => {
    const response = await request(buildApp()).get('/api/does-not-exist').expect(404);

    expect(response.body.error.code).toBe('not_found');
  });
});

describe('POST /api/auth/register', () => {
  it('creates an account and returns 201 with a token', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/auth/register').send(CREDENTIALS).expect(201);

    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.username).toBe('ada');
  });

  it('does not return the password hash', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/auth/register').send(CREDENTIALS).expect(201);

    expect(JSON.stringify(response.body.user)).not.toMatch(/\$2[aby]\$/);
  });

  it('rejects a duplicate with 409, not with 200 and a message', async () => {
    const app = buildApp();
    await registerAndLogin(app);

    // The original controller answered every failure with HTTP 200 and
    // `{ status: false }`, so a client could not tell success from failure by
    // status code alone.
    await request(app).post('/api/auth/register').send(CREDENTIALS).expect(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const app = buildApp();
    await registerAndLogin(app);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: CREDENTIALS.username, password: CREDENTIALS.password })
      .expect(200);

    expect(response.body.token).toEqual(expect.any(String));
  });

  it('returns 401 for a bad password', async () => {
    const app = buildApp();
    await registerAndLogin(app);

    await request(app)
      .post('/api/auth/login')
      .send({ username: 'ada', password: 'not the password' })
      .expect(401);
  });

  it('returns 503 when the server has no signing secret', async () => {
    const app = buildApp({ config: { jwtSecret: null } });

    await request(app).post('/api/auth/register').send(CREDENTIALS).expect(503);
  });
});

describe('authenticated routes', () => {
  it('reject a request with no token', async () => {
    await request(buildApp()).get('/api/auth/me').expect(401);
  });

  it('reject a forged token', async () => {
    await request(buildApp())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token')
      .expect(401);
  });

  it('reject a token sent without the Bearer scheme', async () => {
    const app = buildApp();
    const { token } = await registerAndLogin(app);

    await request(app).get('/api/auth/me').set('Authorization', token).expect(401);
  });

  it('return the caller identified by the token, not by a URL parameter', async () => {
    const app = buildApp();
    const { token, user } = await registerAndLogin(app);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.user._id).toBe(user._id);
  });

  it('list other users, paginated and without the caller', async () => {
    const app = buildApp();
    const { token } = await registerAndLogin(app);
    await registerAndLogin(app, { username: 'grace', email: 'grace@example.com' });

    const response = await request(app)
      .get('/api/auth/users?pageSize=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.users.map((entry) => entry.username)).toEqual(['grace']);
    expect(response.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });
  });

  it('set an avatar on the caller only', async () => {
    const app = buildApp();
    const { token } = await registerAndLogin(app);

    const response = await request(app)
      .post('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })
      .expect(200);

    expect(response.body.isSet).toBe(true);
  });
});

describe('messages', () => {
  async function twoUsers() {
    const app = buildApp();
    const ada = await registerAndLogin(app);
    const grace = await registerAndLogin(app, {
      username: 'grace',
      email: 'grace@example.com',
    });

    return { app, ada, grace };
  }

  it('require authentication', async () => {
    const { app, grace } = await twoUsers();

    await request(app)
      .post('/api/messages')
      .send({ to: grace.user._id, message: 'hi' })
      .expect(401);
  });

  it('store and read back a conversation in order', async () => {
    const { app, ada, grace } = await twoUsers();
    const auth = { Authorization: `Bearer ${ada.token}` };

    await request(app)
      .post('/api/messages')
      .set(auth)
      .send({ to: grace.user._id, message: 'first' })
      .expect(201);
    await request(app)
      .post('/api/messages')
      .set(auth)
      .send({ to: grace.user._id, message: 'second' })
      .expect(201);

    const response = await request(app)
      .post('/api/messages/search')
      .set(auth)
      .send({ to: grace.user._id })
      .expect(200);

    expect(response.body.messages.map((entry) => entry.message)).toEqual(['first', 'second']);
    expect(response.body.messages.every((entry) => entry.fromSelf)).toBe(true);
  });

  it('mark the other side of the conversation as not fromSelf', async () => {
    const { app, ada, grace } = await twoUsers();

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${ada.token}`)
      .send({ to: grace.user._id, message: 'hello' })
      .expect(201);

    const response = await request(app)
      .post('/api/messages/search')
      .set('Authorization', `Bearer ${grace.token}`)
      .send({ to: ada.user._id })
      .expect(200);

    expect(response.body.messages[0]).toMatchObject({ message: 'hello', fromSelf: false });
  });

  it('reject an empty message', async () => {
    const { app, ada, grace } = await twoUsers();

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${ada.token}`)
      .send({ to: grace.user._id, message: '   ' })
      .expect(400);
  });

  it('clamp the page size', async () => {
    const { app, ada, grace } = await twoUsers();

    const response = await request(app)
      .post('/api/messages/search')
      .set('Authorization', `Bearer ${ada.token}`)
      .send({ to: grace.user._id, limit: 10000 })
      .expect(200);

    expect(response.body.limit).toBe(200);
  });
});

describe('error handling', () => {
  it('answers an unexpected failure with a generic 500, leaking nothing', async () => {
    const users = createInMemoryUserRepository();
    users.findByUsername = async () => {
      throw new Error('connection string mongodb://user:hunter2@cluster/db failed');
    };

    const app = createApp({
      config: { ...loadConfig({}), jwtSecret: JWT_SECRET, bcryptRounds: 4 },
      users,
      messages: createInMemoryMessageRepository(),
      logger: { error: () => {}, warn: () => {}, info: () => {} },
    });

    const response = await request(app).post('/api/auth/login').send(CREDENTIALS).expect(500);

    expect(response.body.error.message).toBe('Something went wrong handling this request.');
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });
});

describe('static hosting (the shape the container image runs in)', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  let staticDir;

  beforeAll(() => {
    staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'defiguard-static-'));
    fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>SPA</title>');
    fs.writeFileSync(path.join(staticDir, 'app.js'), 'console.log("bundle");');
  });

  afterAll(() => fs.rmSync(staticDir, { recursive: true, force: true }));

  it('serves the SPA shell at the root', async () => {
    const response = await request(buildApp({ config: { staticDir } }))
      .get('/')
      .expect(200);

    expect(response.text).toContain('<title>SPA</title>');
  });

  it('serves a client-side route by returning the SPA shell', async () => {
    const response = await request(buildApp({ config: { staticDir } }))
      .get('/wallet')
      .expect(200);

    expect(response.text).toContain('<title>SPA</title>');
  });

  it('serves real assets rather than the shell', async () => {
    const response = await request(buildApp({ config: { staticDir } }))
      .get('/app.js')
      .expect(200);

    expect(response.text).toContain('bundle');
  });

  it('still returns a JSON 404 for an unknown API route', async () => {
    const response = await request(buildApp({ config: { staticDir } }))
      .get('/api/nope')
      .expect(404);

    expect(response.body.error.code).toBe('not_found');
  });
});
