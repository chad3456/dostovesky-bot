/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // epubjs ships browser-only code; ensure it is only bundled client-side.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
  experimental: {
    // Allow larger server action / upload bodies (EPUBs can be a few MB).
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

module.exports = nextConfig;
