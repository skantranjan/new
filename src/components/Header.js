import React from 'react';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <img
          src="https://www.haleon.com/content/experience-fragments/haleon/corporate/en/header/master/_jcr_content/root/container/container_481579621/image.coreimg.svg/1741808075713/haleon-logo-white.svg"
          alt="Logo"
          className="brand-logo"
          style={{ height: '32px', width: 'auto', background: 'transparent' }}
        />
        <span className="brand-title">Sustainability Data Portal</span>
      </div>
      <nav className="header__nav">
        <a href="#" className="nav-link">Home</a>
        <a href="#" className="nav-link">About</a>
        <a href="#" className="nav-link">Contact</a>
      </nav>
    </header>
  );
}

export default Header; 