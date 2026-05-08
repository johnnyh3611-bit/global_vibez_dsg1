/**
 * Dealer configurations — diverse realistic characters used across holographic dealer UIs.
 * Keys: nova (African male), ace (Asian male), ruby (Latina female), jade (Mixed female).
 */
export const DEALER_CONFIGS = {
  nova: {
    name: 'NOVA',
    skinTone: ['#8b5a3c', '#6d4833', '#5a3828'],
    hairColor: ['#1a0f08', '#0d0804'],
    hairStyle: 'fade',
    eyeColor: '#2c1810',
    gender: 'male',
  },
  ace: {
    name: 'ACE',
    skinTone: ['#f4c7ab', '#e8b89a', '#d9a78a'],
    hairColor: ['#2c1810', '#1a0f08'],
    hairStyle: 'styled',
    eyeColor: '#3d2f1f',
    gender: 'male',
  },
  ruby: {
    name: 'RUBY',
    skinTone: ['#d4a574', '#c9956f', '#b8845f'],
    hairColor: ['#3d2314', '#2c1810'],
    hairStyle: 'long',
    eyeColor: '#4a2f1a',
    gender: 'female',
  },
  jade: {
    name: 'JADE',
    skinTone: ['#c9956f', '#b8845f', '#a67550'],
    hairColor: ['#3d2314', '#2c1810'],
    hairStyle: 'curly',
    eyeColor: '#3d2f1f',
    gender: 'female',
  },
};

export const SIZE_CLASSES = {
  small: 'w-48 h-64',
  normal: 'w-64 h-80',
  large: 'w-80 h-96',
};

export const getDealerConfig = (dealerType) =>
  DEALER_CONFIGS[dealerType] || DEALER_CONFIGS.nova;
