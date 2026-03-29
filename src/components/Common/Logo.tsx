
import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 300 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <defs>
        <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0D9488"/>
          <stop offset="100%" stopColor="#14B8A6"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B"/>
          <stop offset="100%" stopColor="#FBBF24"/>
        </linearGradient>
      </defs>

      {/* ICON (left side) */}
      <g transform="translate(10, 10)">
        {/* Main circle */}
        <circle cx="50" cy="50" r="32" fill="none" stroke="url(#iconGrad)" strokeWidth="3" opacity="0.2"/>
        <circle cx="50" cy="50" r="24" fill="none" stroke="url(#iconGrad)" strokeWidth="2"/>

        {/* Shanyrak rays */}
        <g stroke="url(#goldGrad)" strokeWidth="2" strokeLinecap="round">
          <line x1="50" y1="18" x2="50" y2="26"/>
          <line x1="50" y1="74" x2="50" y2="82"/>
          <line x1="18" y1="50" x2="26" y2="50"/>
          <line x1="74" y1="50" x2="82" y2="50"/>
        </g>

        {/* AI Dots */}
        <circle cx="44" cy="56" r="5" fill="url(#iconGrad)"/>
        <circle cx="56" cy="44" r="5" fill="url(#goldGrad)"/>
        <line 
          x1="44" y1="56" x2="56" y2="44"
          stroke="url(#goldGrad)" 
          strokeWidth="1.5" 
          strokeDasharray="2,2" 
        />
      </g>

      {/* TEXT (right side) */}
      <text 
        x="110" 
        y="65"
        fontFamily="'Outfit', sans-serif"
        fontWeight="800"
        fontSize="48"
        letterSpacing="-1"
        fill="#0D9488"
      >
        BILGE
      </text>

      <text 
        x="112" 
        y="85"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontWeight="600"
        fontSize="12"
        letterSpacing="2"
        fill="#F59E0B"
      >
        AI · БІЛІМ ПЛАТФОРМАСЫ
      </text>
    </svg>
  );
};
