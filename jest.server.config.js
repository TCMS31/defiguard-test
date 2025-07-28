/**
 * Jest configuration for the API.
 *
 * `react-scripts test` only looks inside `src/`, so the server needs its own
 * runner. The Jest version is pinned to the one react-scripts already resolves,
 * which keeps a single copy of Jest in the tree.
 */
module.exports = {
  displayName: 'server',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/server/**/*.test.js'],
  collectCoverageFrom: ['server/**/*.js', '!server/**/*.test.js'],
  clearMocks: true,
};
