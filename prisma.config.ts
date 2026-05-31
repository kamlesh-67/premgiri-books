import "dotenv/config";
import { defineConfig } from "prisma/config";

// Phase 17: SQLite migration — desktop app uses local file database
// DATABASE_URL should be file:./dev.db for development
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "file:./dev.db",
  },
});
