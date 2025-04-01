/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove styled-components compiler option
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(stl)$/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/files/',
          outputPath: 'static/files/',
          name: '[name].[hash].[ext]',
        },
      },
    });
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/kiri-viewer',
        destination: '/kiri-viewer/index.html',
      },
      {
        source: '/kiri-viewer/:path*',
        destination: '/kiri-viewer/:path*',
      },
    ];
  },
}

module.exports = nextConfig 