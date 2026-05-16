import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Neon requires a direct (non-pooled) URL for migrate deploy.
    // Set DIRECT_URL in Vercel to the non-pooled Neon connection string.
    // Falls back to DATABASE_URL for local dev (pg direct connection).
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
