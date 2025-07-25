/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Enable client-side instrumentation
  experimental: {
    clientRouterFilter: true,
    instrumentationHook: true
  },

  // Enable source maps and detailed logging
  webpack: (config, { dev, isServer }) => {
    if (!isServer && dev) {
      config.devtool = 'eval-source-map';
    }
    return config;
  },

  // Enable more detailed logging
  logging: {
    level: 'verbose'
  }
};

module.exports = nextConfig; 