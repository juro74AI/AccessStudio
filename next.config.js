/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tjzfwefahkgiqoujvivr.supabase.co';

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/api/supabase/:path*',
        destination: `${supabaseUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
