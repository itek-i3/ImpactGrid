'use client';

// Magic UI — Dot Pattern (https://magicui.design/docs/components/dot-pattern)
// Ported from the upstream TSX source, logic unchanged.
import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function DotPattern({
  width = 16, height = 16, x = 0, y = 0, cx = 1, cy = 1, cr = 1,
  className, glow = false, ...props
}) {
  const id = useId();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [dots, setDots] = useState([]);

  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        const { width: w, height: h } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: w, height: h });
      }
    }
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // The per-dot delay/duration (only used when `glow` animates them) comes
  // from Math.random(), so it's computed here rather than during render —
  // calling an impure function while rendering isn't allowed.
  useEffect(() => {
    function computeDots() {
      const cols = Math.ceil(dimensions.width / width);
      const rows = Math.ceil(dimensions.height / height);
      const next = Array.from({ length: cols * rows }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return { x: col * width + cx + x, y: row * height + cy + y, delay: Math.random() * 5, duration: Math.random() * 3 + 2 };
      });
      setDots(next);
    }
    computeDots();
  }, [dimensions.width, dimensions.height, width, height, cx, cy, x, y]);

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      {...props}
    >
      <defs>
        <radialGradient id={`${id}-gradient`}>
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {dots.map((dot) => (
        <motion.circle
          key={`${dot.x}-${dot.y}`}
          cx={dot.x} cy={dot.y} r={cr}
          fill={glow ? `url(#${id}-gradient)` : 'currentColor'}
          initial={glow ? { opacity: 0.4, scale: 1 } : {}}
          animate={glow ? { opacity: [0.4, 1, 0.4], scale: [1, 1.5, 1] } : {}}
          transition={glow ? { duration: dot.duration, repeat: Infinity, repeatType: 'reverse', delay: dot.delay, ease: 'easeInOut' } : {}}
        />
      ))}
    </svg>
  );
}
