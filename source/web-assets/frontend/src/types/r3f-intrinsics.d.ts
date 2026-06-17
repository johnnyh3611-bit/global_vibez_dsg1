// R3F v9 no longer augments the global JSX namespace by default.
// It exposes `ThreeElements` as a scoped interface. To keep our existing
// lowercase <mesh>, <boxGeometry>, etc. tags compiling under strict TS,
// we re-export R3F's `ThreeElements` into the global JSX.IntrinsicElements.
//
// Runtime behaviour is unchanged — R3F's custom reconciler still renders
// these tags. This file is a pure dev-time type aid.

import type { ThreeElements } from '@react-three/fiber';

declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends ThreeElements {}
  }
}

export {};
