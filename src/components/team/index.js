import React from 'react';

import './index.css';

import TeamPlaceholder from '../../assets/images/team-placeholder.svg';

function TeamSection() {
  const teamMembers = [
    {
      imgSrc: TeamPlaceholder,
      name: 'Founder',
      role: 'CEO & Founder',
    },
    {
      imgSrc: TeamPlaceholder,
      name: 'Operations Lead',
      role: 'Head of Operations',
    },
    {
      imgSrc: TeamPlaceholder,
      name: 'Engineering Lead',
      role: 'Engineering',
    },
  ];

  return (
    <div className="team_section layout_padding">
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <div className="team_main">
              <hr className="border" />
              <h1 className="services_taital">Excellent Team Workers</h1>
              <hr className="border" />
            </div>
          </div>
        </div>
        <div className="team_section_2">
          <div className="row">
            {teamMembers.map((member) => (
              <div className="col-md-4" key={member.role}>
                <div className="client_box">
                  <div className="team_img">
                    <img src={member.imgSrc} alt="" />
                  </div>
                  <h3 className="client_name">{member.name}</h3>
                  <p className="passages_text">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeamSection;
