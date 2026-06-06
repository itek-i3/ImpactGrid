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
          `,
        }}
      />
    );
  });

  return null;
}
