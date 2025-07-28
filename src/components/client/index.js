import React from 'react';
import { Carousel } from 'react-bootstrap';

import './index.css';

import ClientImg from '../../assets/images/client-placeholder.svg';

function ClientSection() {
  return (
    <div className="client_section layout_padding">
      <div className="container">
        <Carousel controls={false} interval={null}>
          <Carousel.Item>
            <h1 className="client_taital">What Is Says Our Clients One</h1>
            <p className="client_text">
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            </p>
            <div className="client_img">
              <img src={ClientImg} alt="" />
            </div>
            <h3 className="magna_text">Magna Aliqua.</h3>
            <p className="consectetur_text">
              consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
              magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
            </p>
          </Carousel.Item>

          <Carousel.Item>
            <h1 className="client_taital">What Is Says Our Clients Two</h1>
            <p className="client_text">
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            </p>
            <div className="client_img">
              <img src={ClientImg} alt="" />
            </div>
            <h3 className="magna_text">Magna Aliqua.</h3>
            <p className="consectetur_text">
              consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
              magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
            </p>
          </Carousel.Item>

          <Carousel.Item>
            <h1 className="client_taital">What Is Says Our Clients Three</h1>
            <p className="client_text">
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            </p>
            <div className="client_img">
              <img src={ClientImg} alt="" />
            </div>
            <h3 className="magna_text">Magna Aliqua.</h3>
            <p className="consectetur_text">
              consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
              magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
            </p>
          </Carousel.Item>
        </Carousel>
      </div>
    </div>
  );
}

export default ClientSection;
