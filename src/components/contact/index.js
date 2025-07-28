import React, { useState } from 'react';

import './index.css';

import CoinImg from '../../assets/images/coin-img.png';

function ContactSection() {
  // State to manage form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSubmitted(false);
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // There is no contact backend in this project, so the form acknowledges the
  // submission in place rather than pretending to send it anywhere.
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  return (
    <div className="contact_section layout_padding">
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <h1 className="contact_taital">REQUEST A CALL BACK</h1>
          </div>
        </div>
        <div className="contact_section_2">
          <div className="row">
            <div className="col-md-8">
              <div className="mail_section map_form_container">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="mail_text"
                        placeholder="Your Name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="mail_text"
                        placeholder="Email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="mail_text"
                        placeholder="Phone Number"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="mail_text"
                        placeholder="Subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <textarea
                    className="massage-bt"
                    placeholder="Message"
                    rows="5"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                  />
                  <div className="btn_main">
                    <div className="send_bt active">
                      <button type="submit">Send</button>
                    </div>
                  </div>
                  {submitted && (
                    <p className="contact_ack" role="status">
                      Thanks — this demo does not send mail, so nothing left your browser.
                    </p>
                  )}
                </form>
              </div>
            </div>
            <div className="col-md-4">
              <div className="contact_img">
                <img src={CoinImg} alt="Coin" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactSection;
