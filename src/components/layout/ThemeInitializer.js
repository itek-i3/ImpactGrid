'use client';

import { useServerInsertedHTML } from 'next/navigation';

/**
 * ThemeInitializer uses useServerInsertedHTML to inject the inline blocking script
 * that sets the theme class (data-theme) on the html element before paint.
 * Because useServerInsertedHTML runs during SSR and returns null on client render,
 * it bypasses React 19's warnings about rendering script tags inside components.
 */
export default function ThemeInitializer() {
  useServerInsertedHTML(() => {
    return (
      <script
        id="theme-initializer"
        dangerouslySetInnerHTML={{
          __html: `
            try {
              const theme = localStorage.getItem('impactnotion-theme') || 'dark';
              document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {}
            try {
              // Saved sidebar width (see SIDEBAR_WIDTH in useWorkspaceStore), applied before
              // first paint so the sidebar doesn't jump. Keep min/max/key in sync with it.
              const w = parseInt(localStorage.getItem('impactgrid-sidebar-width'), 10);
              if (w) document.documentElement.style.setProperty('--sidebar-width', Math.min(480, Math.max(220, w)) + 'px');
            } catch (e) {}
          `,
        }}
      />
    );
  });

  return null;
}
