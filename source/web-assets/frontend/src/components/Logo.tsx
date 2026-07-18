import React from 'react';

/** Canonical local brand mark (globe + V lockup). Cache-bust via query when swapping PNG. */
const LOGO_URL = '/global-vibez-logo.png?v=12';

export default function Logo({ size = 'md', className = '' }) {
  const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
    '3xl': 'w-48 h-48',
  };

  return (
    <img
      src={LOGO_URL}
      alt="Global Vibez DSG Logo"
      className={`${sizes[size]} ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

export { LOGO_URL };
