/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Configuration for handling dependencies - include all UI libraries
  transpilePackages: [
    'lucide-react', 
    '@radix-ui/react-icons',
    '@radix-ui/react-slot',
    '@radix-ui/react-tabs',
    '@radix-ui/react-toast'
  ],
  
  // Webpack configuration with improved module resolution
  webpack: (config, { dev, isServer }) => {
    // Add STL file handling
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
    
    // Improve module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': process.cwd() + '/src'
    };
    
    // Ensure externals are properly handled
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    
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