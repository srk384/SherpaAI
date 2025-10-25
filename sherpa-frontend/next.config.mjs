/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add your configuration options here
  // For example: `output: 'export'`, if needed for static exports.

  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
      // You can add more redirect objects here
    ];
  },
};

export default nextConfig;
