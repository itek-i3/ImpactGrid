'use client';

// Magic UI — Magic Card (https://magicui.design/docs/components/magic-card)
// Trimmed port of the upstream TSX source: keeps the pointer-tracked
// spotlight ("gradient" mode), drops the "orb" mode and its next-themes
// dependency, which this project doesn't use — theming here is handled by
// this app's own CSS-variable design system.
import { useCallback } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { cn } from '@/lib/utils';

export function MagicCard({
  children, className, style, gradientSize = 160,
  gradientColor = 'rgba(91,155,255,0.14)', gradientOpacity = 1,
}) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const handlePointerMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }, [mouseX, mouseY]);

  const reset = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [mouseX, mouseY, gradientSize]);

  return (
    <motion.div
      className={cn('group relative isolate overflow-hidden rounded-[inherit]', className)}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onPointerEnter={handlePointerMove}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)`,
          opacity: gradientOpacity,
        }}
      />
      <div className="relative z-20">{children}</div>
    </motion.div>
  );
}
