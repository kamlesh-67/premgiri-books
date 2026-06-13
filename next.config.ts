import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'better-sqlite3',
    '@prisma/adapter-better-sqlite3',
    '@react-pdf/renderer',
    '@react-pdf/reconciler',
    '@react-pdf/font',
    '@react-pdf/layout',
    '@react-pdf/pdfkit',
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
