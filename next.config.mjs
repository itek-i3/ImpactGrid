/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/os',
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ['zustand'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/os',
        basePath: false,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
