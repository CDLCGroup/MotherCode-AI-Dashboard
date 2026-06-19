// src/useViewport.ts
//
// Single source of truth for responsive breakpoints (the codebase is all inline
// styles, no CSS media queries). One window-resize listener; shared by AppShell
// and the dashboard so the thresholds can never diverge.
//
// Verification override: `?mobile=1` forces the mobile layout AND tells AppShell
// to wrap the app in a fixed 390×844 phone frame, so a desktop-window screenshot
// renders a faithful narrow viewport (real overflow bugs surface). `?mobile=0`
// forces desktop. No param → live `window.innerWidth`.

import { useEffect, useState } from 'react';

export interface Viewport {
  width: number;
  isMobile: boolean;
  isNarrow: boolean;
  framed: boolean; // render inside the phone test-frame
}

export const MOBILE_BREAKPOINT = 760;
export const NARROW_BREAKPOINT = 1180;
export const FRAME_WIDTH = 390;
export const FRAME_HEIGHT = 844;

function compute(): Viewport {
  const force = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mobile') : null;
  const framed = force === '1';
  const width = framed ? FRAME_WIDTH : typeof window !== 'undefined' ? window.innerWidth : 1280;
  const isMobile = force === '1' ? true : force === '0' ? false : width < MOBILE_BREAKPOINT;
  return { width, isMobile, isNarrow: width < NARROW_BREAKPOINT, framed };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(compute);
  useEffect(() => {
    const onResize = () => setVp(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}
