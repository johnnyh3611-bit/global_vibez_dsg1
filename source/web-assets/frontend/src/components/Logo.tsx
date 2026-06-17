import React from 'react';

const LOGO_URL = 'https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/2f76fac8085ba1f9ba0f247ad9db641014e451eb1da890963163722c0541513b.png';

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
