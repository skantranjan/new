import React from 'react';

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="120" height="24" viewBox="0 0 120 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="6" width="60" height="12" rx="2" fill="#30ea03" />
        <text x="70" y="18" fill="#000" fontSize="18" fontFamily="Segoe UI, Arial, sans-serif">LOGO</text>
      </svg>
    </div>
  );
}

export default Logo; 