/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/os',
  async headers() {
    return [
      {
        // Widens session-sw.js's allowed scope beyond its own directory
        // (/os/) so it can control the bare start_url "/os" too — without
        // this, Chrome's PWA install check sees the manifest's start_url
        // falling outside the service worker's scope and silently refuses
        // to consider the site installable.
        source: '/session-sw.js',
        headers: [{ key: 'Service-Worker-Allowed', value: '/os' }],
      },
    ];
  },
};

export default nextConfig;
