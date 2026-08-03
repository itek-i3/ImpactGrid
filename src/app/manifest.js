export default function manifest() {
  return {
    name: 'ImpactGrid',
    short_name: 'ImpactGrid',
    description: 'A Notion-like workspace for organizing Impact360 community operations',
    start_url: '/os',
    display: 'standalone',
    background_color: '#02040A',
    theme_color: '#1E4FB8',
    icons: [
      { src: '/os/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/os/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/os/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/os/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
