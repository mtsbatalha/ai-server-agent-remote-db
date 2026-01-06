/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: [],
    // Enable standalone output for Docker
    output: 'standalone',
    // Allow Server Actions from forwarded requests (behind reverse proxy)
    experimental: {
        serverActions: {
            // Allow requests from any origin - adjust this to your specific domains in production
            allowedOrigins: ['localhost:3000', '127.0.0.1:3000'],
        },
    },
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        return [
            {
                source: '/api/:path*',
                destination: `${apiUrl}/api/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;

