'use client';

import React from 'react';

interface CSVecnaLogoProps {
  variant?: 'full' | 'icon-only' | 'text-only';
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtext?: boolean;
  className?: string;
}

export default function CSVecnaLogo({
  variant = 'full',
  theme = 'dark',
  size = 'md',
  showSubtext = true,
  className = '',
}: CSVecnaLogoProps) {
  // Dimensions
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  const subtextSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const subtextColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {variant !== 'text-only' && (
        <div className={`relative flex-shrink-0 ${iconSizes[size]}`}>
          {/* Vector CSVecna Symbol: Geometric 'V' + Speech Bubble + AI Core */}
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-md"
          >
            <defs>
              <linearGradient id="csvecnaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="50%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="csvecnaBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Rounded Shield */}
            <rect width="100" height="100" rx="26" fill="url(#csvecnaBg)" />
            
            {/* Outer WhatsApp Speech Bubble Ring */}
            <path
              d="M50 16C31.222 16 16 31.222 16 50C16 56.4 17.766 62.4 20.85 67.55L17.5 82.5L32.85 79.25C37.85 82.15 43.7 84 50 84C68.778 84 84 68.778 84 50C84 31.222 68.778 16 50 16Z"
              stroke="url(#csvecnaGrad)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Stylized Futuristic Geometric 'V' Icon */}
            <path
              d="M32 34L50 72L68 34H58L50 54L42 34H32Z"
              fill="url(#csvecnaGrad)"
            />

            {/* AI Core Glowing Hexagon Center Node */}
            <circle cx="50" cy="40" r="5" fill="#A7F3D0" filter="url(#glow)" />
          </svg>
        </div>
      )}

      {variant !== 'icon-only' && (
        <div className="flex flex-col justify-center leading-none">
          <div className={`font-extrabold tracking-tight ${textSizes[size]} ${textColor}`}>
            CS<span className="text-emerald-400">Vecna</span>
          </div>
          {showSubtext && (
            <span className={`font-medium tracking-normal mt-1 ${subtextSizes[size]} ${subtextColor}`}>
              por <span className="font-semibold text-emerald-400/90">C-Space Technologies</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
