const { listFromEnv, loadConfig, numberFromEnv } = require('../config');

describe('loadConfig', () => {
  it('has safe defaults and no secret fallbacks', () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      port: 3003,
      mongoUrl: null,
      jwtSecret: null,
      corsOrigins: ['http://localhost:3000'],
      bcryptRounds: 10,
    });
  });

  it('reads the port from the environment instead of hardcoding it', () => {
    // The original server called `app.listen(3003)` with the number inline,
    // while its Dockerfile exposed 5000.
    expect(loadConfig({ PORT: '8650' }).port).toBe(8650);
  });

  it('lets API_PORT win over PORT, which react-scripts also reads', () => {
    // `npm start` runs both processes in one shell. Without this, setting PORT
    // to move the dev server would move the API on top of it.
    expect(loadConfig({ PORT: '3000', API_PORT: '4001' }).port).toBe(4001);
  });

  it('accepts a comma-separated CORS allowlist', () => {
    expect(loadConfig({ CORS_ORIGIN: 'http://a.test, http://b.test ' }).corsOrigins).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('marks production explicitly', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).isProduction).toBe(true);
    expect(loadConfig({ NODE_ENV: 'test' }).isProduction).toBe(false);
  });

  it('fails loudly on a non-numeric port rather than listening on NaN', () => {
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT must be a number/);
  });
});

describe('env helpers', () => {
  it.each([
    [{}, 7, 7],
    [{ VALUE: '' }, 7, 7],
    [{ VALUE: '0' }, 7, 0],
    [{ VALUE: '42' }, 7, 42],
  ])('numberFromEnv with env %p and fallback %p returns %p', (env, fallback, expected) => {
    expect(numberFromEnv('VALUE', fallback, env)).toBe(expected);
  });

  it('drops blank entries from a list', () => {
    expect(listFromEnv('VALUE', 'a, ,b,', {})).toEqual(['a', 'b']);
  });
});
