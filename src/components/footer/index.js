import React from 'react';
import { Link } from 'react-router-dom';

import { ArrowRightIcon, EnvelopeIcon, LocationIcon, PhoneIcon } from '../icons';

import './index.css';

function Footer() {
  return (
    <>
      {/* Footer Section */}
      <div className="footer_section layout_padding">
        <div className="container">
          <div className="row">
            {/* Our Company Links */}
            <div className="col-lg-3 col-sm-6">
              <h3 className="useful_text">Our Company</h3>
              <div className="footer_menu">
                <ul>
                  <li>
                    <Link to="/">Home</Link>
                  </li>
                  <li>
                    <Link to="/about">About</Link>
                  </li>
                  <li>
                    <Link to="/services">Services</Link>
                  </li>
                  <li>
                    <Link to="/features">Features</Link>
                  </li>
                  <li>
                    <Link to="/blog">Blog</Link>
                  </li>
                  <li>
                    <Link to="/contact">Contact</Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Additional Links */}
            <div className="col-lg-3 col-sm-6">
              <h3 className="useful_text">Wallet</h3>
              <div className="footer_menu">
                <ul>
                  <li>
                    <Link to="/wallet">Open wallet</Link>
                  </li>
                  <li>
                    <Link to="/wallet">Send ETH</Link>
                  </li>
                  <li>
                    <Link to="/wallet">Receive ETH</Link>
                  </li>
                  <li>
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Get MetaMask
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Contact Us */}
            <div className="col-lg-3 col-sm-6">
              <h3 className="useful_text">Contact Us</h3>
              <div className="location_text">
                <ul>
                  <li>
                    <span className="padding_left_10">
                      <LocationIcon />
                    </span>
                    105 Todd Weaver Rd, Alto GA, 30510
                  </li>
                  <li>
                    <a href="tel:+18022021022">
                      <span className="padding_left_10">
                        <PhoneIcon />
                      </span>
                      (802) 202-1022
                    </a>
                  </li>
                  <li>
                    <a href="mailto:support@defiguard.com">
                      <span className="padding_left_10">
                        <EnvelopeIcon />
                      </span>
                      support@defiguard.com
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Newsletter Section */}
            <div className="col-lg-3 col-sm-6">
              <h3 className="useful_text">Newsletter</h3>
              <div className="form-group">
                <label className="visually-hidden" htmlFor="newsletter-email">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  className="update_mail"
                  type="email"
                  placeholder="Your Email"
                  name="email"
                  autoComplete="email"
                />
                <div className="subscribe_bt">
                  <button type="button" aria-label="Subscribe">
                    <ArrowRightIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Section */}
      <div className="copyright_section">
        <div className="container">
          <p className="copyright_text">2025 All Rights Reserved. DeFiGuard</p>
        </div>
      </div>
    </>
  );
}

export default Footer;
