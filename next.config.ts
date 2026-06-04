import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
