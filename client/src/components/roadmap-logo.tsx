import React from "react";

interface RoadmapLogoProps {
  className?: string;
  size?: number;
}

export function RoadmapLogo({ className = "w-6 h-6", size }: RoadmapLogoProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rm-comp-grad" x1="15%" y1="85%" x2="85%" y2="15%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id="rm-comp-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Orbit Ring with openings */}
      <path
        d="M 23 63 A 33 33 0 1 1 74 27"
        stroke="url(#rm-comp-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 36 80 A 33 33 0 0 1 25 67"
        stroke="url(#rm-comp-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Ascending Roadmap Path forming the 'M' */}
      <line x1="22" y1="75" x2="35" y2="61" stroke="url(#rm-comp-grad)" strokeWidth="5" strokeLinecap="round" />
      <line x1="35" y1="61" x2="35" y2="39" stroke="url(#rm-comp-grad)" strokeWidth="5" strokeLinecap="round" />
      <line x1="35" y1="39" x2="50" y2="51" stroke="url(#rm-comp-grad)" strokeWidth="5" strokeLinecap="round" />
      <line x1="50" y1="51" x2="65" y2="39" stroke="url(#rm-comp-grad)" strokeWidth="5" strokeLinecap="round" />
      <line x1="65" y1="39" x2="65" y2="61" stroke="url(#rm-comp-grad)" strokeWidth="5" strokeLinecap="round" />
      <line x1="65" y1="39" x2="77" y2="27" stroke="url(#rm-comp-grad)" strokeWidth="5" strokeLinecap="round" />

      {/* Arrow Head */}
      <path
        d="M 72 23 L 83 21 L 81 32 Z"
        fill="url(#rm-comp-grad)"
        stroke="url(#rm-comp-grad)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Milestone Nodes */}
      <circle cx="22" cy="75" r="4.2" fill="#090d16" stroke="url(#rm-comp-grad)" strokeWidth="3" />
      <circle cx="35" cy="61" r="3.8" fill="#090d16" stroke="url(#rm-comp-grad)" strokeWidth="3" />
      <circle cx="35" cy="39" r="4.2" fill="#090d16" stroke="url(#rm-comp-grad)" strokeWidth="3" />
      <circle cx="50" cy="51" r="3.8" fill="#090d16" stroke="url(#rm-comp-grad)" strokeWidth="3" />
      <circle cx="65" cy="39" r="4.2" fill="#090d16" stroke="url(#rm-comp-grad)" strokeWidth="3" />
      <circle cx="65" cy="61" r="3.8" fill="#090d16" stroke="url(#rm-comp-grad)" strokeWidth="3" />
      <circle cx="75" cy="29" r="3.8" fill="#ffffff" stroke="url(#rm-comp-grad)" strokeWidth="2.5" filter="url(#rm-comp-glow)" />
    </svg>
  );
}

export default RoadmapLogo;
