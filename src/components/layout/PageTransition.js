'use client';

import { usePathname } from 'next/navigation';

// Re-keys its children on every route change so the entrance animation below
// restarts — gives every page (chat, admin, settings, login…) the same soft
// fade-and-rise on arrival that the in-app view switches already have.
export default function PageTransition({ children }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
      <style jsx>{`
        /* No fill-mode: once the animation ends the element reverts to its
           unanimated style (transform: none), so it stops acting as a
           containing block for position:fixed descendants (modals, the
           floating chat bubble). Using "forwards"/"both" here would leave
           translateY(0) applied forever and silently break their fixed
           positioning. */
        .page-transition {
          animation: pageTransitionEnter 0.4s cubic-bezier(.22,1,.36,1);
        }
        @keyframes pageTransitionEnter {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .page-transition { animation: none; }
        }
      `}</style>
    </div>
  );
}
