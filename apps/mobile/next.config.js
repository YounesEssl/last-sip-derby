/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@last-sip-derby/shared'],
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
}

module.exports = nextConfig
