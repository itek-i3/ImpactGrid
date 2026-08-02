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
      { src: '/notification-icon.png', sizes: '500x500', type: 'image/png', purpose: 'any' },
    ],
  };
}
