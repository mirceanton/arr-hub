import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/postgres.ts",
  out: "./drizzle/postgres",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://arrhub:arrhub@localhost:5433/arrhub",
  },
});
