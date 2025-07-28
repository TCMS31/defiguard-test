import React from 'react';
import { Link } from 'react-router-dom';

import Footer from '../../components/footer';
import Header from '../../components/header';

import './index.css';

/** Shown for an unknown URL and as the router's error boundary. */
function NotFound() {
  return (
    <div>
      <div className="header_section">
        <Header />
      </div>

      <main className="not-found">
        <div className="container">
          <p className="not-found__code">404</p>
          <h1 className="not-found__title">This page does not exist</h1>
          <p className="not-found__body">
            The link may be out of date. Everything else is still where you left it.
          </p>
          <div className="not-found__actions">
            <Link className="not-found__link" to="/">
              Back to home
            </Link>
            <Link className="not-found__link not-found__link--ghost" to="/wallet">
              Open the wallet
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default NotFound;
