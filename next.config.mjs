/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/os',
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ['zustand'],
};

export default nextConfig;
