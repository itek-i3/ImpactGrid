'use client';

import { useEffect, useState } from 'react';

// Returns true on viewports at/below `breakpoint` (default 768px). Panels use it
// to collapse fixed multi-column grids to a single column on phones (inline grid
// styles can't be overridden by CSS media queries, so this drives them in JS).
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    const raf = requestAnimationFrame(onChange); // initial read, deferred to keep the effect body side-effect-free
    mq.addEventListener('change', onChange);
    return () => { cancelAnimationFrame(raf); mq.removeEventListener('change', onChange); };
  }, [breakpoint]);
  return isMobile;
}
