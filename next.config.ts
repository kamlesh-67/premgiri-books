import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ioredis', 'pg', '@prisma/adapter-pg'],
};

export default nextConfig;
