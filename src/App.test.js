import React from 'react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { PROVIDER_FUTURE_FLAGS, ROUTER_FUTURE_FLAGS, routes } from './App';

// The routing tests are about routing. `detectEthereumProvider` polls the
// window for up to three seconds looking for an injected wallet, which in jsdom
// only ever resolves to "nothing there" -- after the test has finished. The
// wallet's own behaviour is covered in src/pages/wallet/__tests__.
jest.mock('@metamask/detect-provider', () => ({
  __esModule: true,
  default: async () => null,
}));

/**
 * Route-level smoke tests.
 *
 * The routes are exported separately from the browser router so they can be
 * mounted in a memory router here. The shipped test was Create React App's
 * default "renders learn react link", which had never been updated and failed
 * on every run.
 */
function renderAt(path) {
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
    future: ROUTER_FUTURE_FLAGS,
  });

  return render(<RouterProvider router={router} future={PROVIDER_FUTURE_FLAGS} />);
}

describe('routing', () => {
  it('renders the home page at /', async () => {
    renderAt('/');

    expect(
      await screen.findByText(/Build your own blockchain-based platform/i)
    ).toBeInTheDocument();
  });

  it('renders the wallet at /wallet, and says so when no wallet is installed', async () => {
    renderAt('/wallet');

    expect(await screen.findByRole('heading', { name: /DeFiGuard Wallet/i })).toBeInTheDocument();
    expect(await screen.findByTestId('unavailable')).toBeInTheDocument();
  });

  it('renders a real 404 page for an unknown path', async () => {
    renderAt('/does-not-exist');

    expect(await screen.findByText(/This page does not exist/i)).toBeInTheDocument();
  });

  it('declares every navigable route exactly once', () => {
    const paths = routes.map((route) => route.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/services',
        '/about',
        '/features',
        '/team',
        '/blog',
        '/contact',
        '/wallet',
        '*',
      ])
    );
  });
});
