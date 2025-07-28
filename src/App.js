import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './App.css';
import './assets/css/responsive.css';
import './assets/css/style.css';

import About from './pages/about';
import Blog from './pages/blog';
import Contact from './pages/contact';
import Features from './pages/features';
import Home from './pages/home';
import NotFound from './pages/not-found';
import Services from './pages/services';
import Team from './pages/team';

/**
 * The wallet is the only route that needs web3.js. Loading it lazily keeps that
 * dependency out of the bundle every visitor downloads for the marketing pages;
 * see the README's design notes for the measured difference.
 */
const Wallet = lazy(() => import('./pages/wallet'));

/** Shown while the wallet chunk is in flight. */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      Loading…
    </div>
  );
}

/**
 * Route table for the marketing site and the wallet.
 *
 * `errorElement` matters here: without it React Router renders its own
 * stack-trace page for an unknown URL, which is what a visitor saw for any
 * typo'd path.
 */
export const routes = [
  { path: '/', element: <Home /> },
  { path: '/services', element: <Services /> },
  { path: '/about', element: <About /> },
  { path: '/features', element: <Features /> },
  { path: '/team', element: <Team /> },
  { path: '/blog', element: <Blog /> },
  { path: '/contact', element: <Contact /> },
  {
    path: '/wallet',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <Wallet />
      </Suspense>
    ),
  },
  { path: '*', element: <NotFound /> },
];

/**
 * Opting into the v7 behaviours now keeps the console clean and makes the
 * eventual React Router 7 upgrade a version bump rather than a migration.
 */
export const ROUTER_FUTURE_FLAGS = { v7_relativeSplatPath: true };

/** `v7_startTransition` is opted into on the provider, not on the router. */
export const PROVIDER_FUTURE_FLAGS = { v7_startTransition: true };

const router = createBrowserRouter(
  routes.map((route) => ({ ...route, errorElement: <NotFound /> })),
  { future: ROUTER_FUTURE_FLAGS }
);

function App() {
  return <RouterProvider router={router} future={PROVIDER_FUTURE_FLAGS} />;
}

export default App;
