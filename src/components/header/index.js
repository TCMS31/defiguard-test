import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import AppLogo from '../../assets/images/logo.png';

import './index.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/features', label: 'Features' },
  { to: '/team', label: 'Team' },
  { to: '/blog', label: 'Blog' },
  { to: '/contact', label: 'Contact' },
  { to: '/wallet', label: 'Wallet' },
];

/**
 * Site navigation.
 *
 * Uses router `Link`s rather than plain anchors: the anchors triggered a full
 * document reload on every click, which discarded the React tree and any
 * connected wallet state along with it.
 *
 * The collapse is driven by React state because only Bootstrap's CSS is
 * loaded: the `data-bs-toggle` attributes it used to rely on need Bootstrap's
 * JavaScript, so below the `lg` breakpoint the menu could never be opened.
 */
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="container">
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <Link className="navbar-brand" to="/">
          <img src={AppLogo} alt="DeFiGuard" />
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          aria-controls="navbarSupportedContent"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div
          className={`collapse navbar-collapse${menuOpen ? ' show' : ''}`}
          id="navbarSupportedContent"
          data-testid="nav-menu"
        >
          <ul className="navbar-nav ms-auto">
            {NAV_ITEMS.map((item) => (
              <li className="nav-item" key={item.to}>
                <Link className="nav-link" to={item.to} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}

export default Header;
